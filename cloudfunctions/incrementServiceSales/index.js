const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event = {}) => {
  const serviceId = event.serviceId || event.id || '';
  const amount = Number(event.amount);
  const increment = Number.isFinite(amount) && amount > 0 ? amount : 1;

  if (!serviceId) {
    return { code: -1, message: '缺少服务ID' };
  }

  try {
    const now = db.serverDate();
    const updateRes = await db.collection('services').doc(serviceId).update({
      data: {
        sales: _.inc(increment),
        sold: _.inc(increment),
        updated_at: now
      }
    });

    if (!updateRes.stats || updateRes.stats.updated === 0) {
      return { code: -1, message: '服务不存在或已下架' };
    }

    return {
      code: 0,
      message: 'success',
      data: {
        updated: updateRes.stats.updated,
        increment
      }
    };
  } catch (error) {
    console.error('incrementServiceSales error', error);
    return { code: -1, message: error?.message || '更新销量失败', error };
  }
};
