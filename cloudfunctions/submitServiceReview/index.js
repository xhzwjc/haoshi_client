const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function ensureCollection(collectionName) {
  try {
    await db.createCollection(collectionName);
  } catch (error) {
    if (!(error && error.errCode === -502006)) {
      throw error;
    }
  }
}

exports.main = async (event, context) => {
  const {
    orderId,
    rating,
    comment,
    serviceId,
    serviceName,
    userOpenId,
  } = event || {};

  if (!orderId || !rating || !comment) {
    return { code: -1, message: '缺少必要参数' };
  }

  const collectionName = 'service_reviews';
  const now = db.serverDate();

  try {
    await ensureCollection(collectionName);

    await db.collection(collectionName).add({
      data: {
        order_id: orderId,
        rating,
        comment,
        service_id: serviceId || '',
        service_name: serviceName || '',
        user_openid: userOpenId || '',
        created_at: now,
        updated_at: now,
      }
    });

    await db.collection('bookings').doc(orderId).update({
      data: {
        status: 60,
        review: {
          rating,
          comment,
          created_at: now,
        },
        review_submitted_at: now,
        updated_at: now,
      }
    });

    return { code: 0, message: 'success' };
  } catch (error) {
    console.error('submitServiceReview error', error);
    return { code: -1, message: error?.message || '提交失败', error };
  }
};
