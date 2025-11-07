const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function ensureCollection(collectionName) {
  try {
    await db.createCollection(collectionName);
  } catch (error) {
    const alreadyExistsCodes = new Set([-502006, -501001]);
    if (!(error && alreadyExistsCodes.has(error.errCode))) {
      throw error;
    }
  }
}

exports.main = async (event, context) => {
  const {
    orderId,
    scene,
    reason,
    description,
    contactPhone,
    userOpenId,
  } = event || {};

  if (!orderId || !scene || !reason || !description || !contactPhone) {
    return { code: -1, message: '缺少必要参数' };
  }

  const collectionName = 'after_sales';
  const now = db.serverDate();

  try {
    await ensureCollection(collectionName);

    await db.collection(collectionName).add({
      data: {
        order_id: orderId,
        scene,
        reason,
        description,
        contact_phone: contactPhone,
        status: 'pending',
        created_at: now,
        updated_at: now,
        user_openid: userOpenId || '',
      }
    });

    const bookingUpdate = {
      after_sale_submitted_at: now,
      after_sale_last_scene: scene,
      after_sale_last_reason: reason,
      after_sale_contact_phone: contactPhone,
      updated_at: now,
    };

    if (scene === 'amount') {
      bookingUpdate.amount_issue_reported_at = now;
    }

    await db.collection('bookings').doc(orderId).update({ data: bookingUpdate });

    return { code: 0, message: 'success' };
  } catch (error) {
    console.error('submitAfterSale error', error);
    return { code: -1, message: error?.message || '提交失败', error };
  }
};
