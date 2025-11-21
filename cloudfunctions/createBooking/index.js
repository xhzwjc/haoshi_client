const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

async function ensureCollection(name) {
  try {
    await db.collection(name).limit(1).get();
  } catch (error) {
    if (error && error.errCode === -502005) {
      try {
        await db.createCollection(name);
      } catch (createErr) {
        const ignore = new Set([-502006, -501001]);
        if (!ignore.has(createErr.errCode)) {
          throw createErr;
        }
      }
    } else {
      throw error;
    }
  }
}

exports.main = async (event, context) => {
  const { action, booking } = event || {};
  const { OPENID } = cloud.getWXContext();

  if (!OPENID) {
    return { code: -1, message: '未登录用户无法创建订单' };
  }

  if (action !== 'create') {
    return { code: -1, message: 'unsupported action' };
  }

  if (!booking || !booking.service_id || !booking.service_date || !booking.service_time_slot) {
    return { code: -1, message: '缺少必要的预约信息' };
  }

  const now = db.serverDate();
  const bookingDoc = { ...booking };
  delete bookingDoc._id;

  bookingDoc.status = typeof bookingDoc.status === 'number' ? bookingDoc.status : 10;
  bookingDoc.created_at = now;
  bookingDoc.updated_at = now;
  bookingDoc.client_openid = OPENID;
  if (!bookingDoc.client_phone && bookingDoc.contact_phone) {
    bookingDoc.client_phone = bookingDoc.contact_phone;
  }
  bookingDoc.timeline = Array.isArray(bookingDoc.timeline) ? bookingDoc.timeline : [];
  bookingDoc.timeline.push({
    status: bookingDoc.status,
    description: '客户提交预约',
    created_at: now
  });

  try {
    await ensureCollection('bookings');
    const addRes = await db.collection('bookings').add({ data: bookingDoc });

    try {
      await db.collection('services').doc(bookingDoc.service_id).update({
        data: {
          sold: _.inc(1),
          sales: _.inc(1),
          updated_at: now
        }
      });
    } catch (serviceErr) {
      console.error('update service sales error', serviceErr);
    }

    return {
      code: 0,
      message: 'success',
      data: {
        bookingId: addRes._id
      }
    };
  } catch (error) {
    console.error('createBooking error', error);
    return { code: -1, message: error?.message || '预约提交失败', error };
  }
};
