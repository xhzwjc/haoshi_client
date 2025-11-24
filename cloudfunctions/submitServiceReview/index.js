const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

async function ensureCollection(collectionName) {
  try {
    await db.createCollection(collectionName);
  } catch (error) {
    const ignoreCodes = new Set([-502006, -501001, -502005]);
    if (!(error && ignoreCodes.has(error.errCode))) {
      throw error;
    }
  }
}

function pad(num) {
  return num < 10 ? `0${num}` : `${num}`;
}

function formatDateTime(date) {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hour = pad(d.getHours());
  const minute = pad(d.getMinutes());
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

async function fetchClientProfile(openid, phone = '') {
  if (!openid && !phone) {
    return null;
  }

  try {
    const matchers = [];
    if (openid) {
      matchers.push({ _openid: openid });
      matchers.push({ client_openid: openid });
      matchers.push({ bound_openids: _.in([openid]) });
    }
    if (phone) {
      matchers.push({ phone });
    }

    if (!matchers.length) {
      return null;
    }

    const res = await db.collection('client_profiles')
      .where(_.or(matchers))
      .limit(1)
      .get();

    return res.data && res.data.length ? res.data[0] : null;
  } catch (error) {
    if (error && error.errCode === -502005) {
      return null;
    }
    throw error;
  }
}

exports.main = async (event = {}, context) => {
  const { OPENID } = cloud.getWXContext();
  const action = event.action || 'create';
  const collectionName = 'service_reviews';

  try {
    await ensureCollection(collectionName);

    if (action === 'reply') {
      const reviewId = event.reviewId || event.id;
      const replyContent = (event.reply || '').trim();

      if (!reviewId) {
        return { code: -1, message: '缺少评价ID' };
      }
      if (!replyContent) {
        return { code: -1, message: '回复内容不能为空' };
      }

      const reviewRes = await db.collection(collectionName).doc(reviewId).get();
      const review = reviewRes.data;
      if (!review) {
        return { code: -1, message: '评价不存在或已删除' };
      }

      const targetTechnician = review.technician_openid || '';
      if (!OPENID || (targetTechnician && targetTechnician !== OPENID)) {
        return { code: -1, message: '无权回复该评价' };
      }

      const now = db.serverDate();

      await db.collection(collectionName).doc(reviewId).update({
        data: {
          reply: replyContent,
          reply_at: now,
          updated_at: now
        }
      });

      if (review.order_id) {
        try {
          await db.collection('bookings').doc(review.order_id).update({
            data: {
              'review.reply': replyContent,
              'review.reply_at': now,
              updated_at: now
            }
          });
        } catch (error) {
          console.warn('更新订单回复信息失败', error);
        }
      }

      return { code: 0, message: 'success', data: { reply: replyContent } };
    }

    const {
      orderId,
      rating,
      comment,
      serviceId,
      serviceName,
      userOpenId,
    } = event;

    if (!orderId || !rating || !comment) {
      return { code: -1, message: '缺少必要参数' };
    }

    const now = db.serverDate();

    let booking = null;
    try {
      const bookingRes = await db.collection('bookings').doc(orderId).get();
      booking = bookingRes.data || null;
    } catch (error) {
      if (!error || error.errCode !== -502005) {
        throw error;
      }
    }

    if (!booking) {
      return { code: -1, message: '订单不存在或已删除' };
    }

    const technicianOpenid = booking.technician_openid || '';
    const technicianMasterId = booking.master_id || '';
    const clientOpenid = booking.client_openid || booking._openid || userOpenId || OPENID || '';
    const profile = await fetchClientProfile(clientOpenid, booking.contact_phone || '');

    const clientName = (profile && profile.name) || booking.contact_name || '匿名客户';
    const clientAvatar = (profile && profile.avatar) || '';

    await db.collection(collectionName).add({
      data: {
        order_id: orderId,
        rating,
        comment,
        service_id: serviceId || booking.service_id || '',
        service_name: serviceName || booking.service_name || '',
        user_openid: clientOpenid,
        technician_openid: technicianOpenid,
        technician_id: technicianMasterId,
        client_name: clientName,
        client_avatar: clientAvatar,
        client_phone: booking.contact_phone || (profile && profile.phone) || '',
        created_at: now,
        updated_at: now,
      }
    });

    const reviewPayload = {
      status: 60,
      review: {
        rating,
        comment,
        created_at: now,
        client_name: clientName,
        client_avatar: clientAvatar,
      },
      review_submitted_at: now,
      updated_at: now,
    };

    if (!booking.completed_at) {
      reviewPayload.completed_at = now;
    }

    await db.collection('bookings').doc(orderId).update({
      data: reviewPayload
    });

    return {
      code: 0,
      message: 'success',
      data: {
        clientName,
        clientAvatar,
        submittedAt: formatDateTime(new Date())
      }
    };
  } catch (error) {
    console.error('submitServiceReview error', error);
    return { code: -1, message: error?.message || '提交失败', error };
  }
};
