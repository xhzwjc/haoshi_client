// 云函数: completeServiceAndQuote/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const masterId = event.masterId; // 直接从前端获取
  const { orderId, finalPrice, remark = '' } = event || {};

  if (!orderId) {
    return { code: -1, message: '缺少订单ID' };
  }

  if (!masterId) {
    return { code: -1, message: '缺少师傅ID' };
  }

  const parsedPrice = typeof finalPrice === 'number' ? finalPrice : parseFloat(finalPrice);
  if (isNaN(parsedPrice) || parsedPrice <= 0) {
    return { code: -1, message: '金额不合法' };
  }

  const normalizedPrice = Math.round(parsedPrice * 100) / 100;

  try {
    // 查询订单当前状态
    const orderRes = await db.collection('bookings')
      .where({ _id: orderId, master_id: masterId })
      .get();

    if (!orderRes.data || orderRes.data.length === 0) {
      return { code: 1, message: '订单不存在或无权限' };
    }

    const currentOrder = orderRes.data[0];
    const currentStatus = currentOrder.status;

    // 允许修改的条件：状态为30(待报价)或35(已报价但未确认)
    if (currentStatus !== 30 && currentStatus !== 35) {
      return { code: 1, message: '当前订单状态不允许修改报价' };
    }

    // 更新订单
    const updateRes = await db.collection('bookings')
      .where({ _id: orderId, master_id: masterId })
      .update({
        data: {
          status: 35,
          final_price: normalizedPrice,
          technician_quote_remark: remark,
          service_completed_at: currentOrder.service_completed_at || db.serverDate(),
          quote_submitted_at: db.serverDate(),
          completed_at: currentOrder.completed_at,
          updated_at: db.serverDate()
        }
      });

    if (!updateRes.stats || updateRes.stats.updated === 0) {
      return { code: 1, message: '更新失败' };
    }

    return { code: 0, message: '提交成功' };
  } catch (error) {
    console.error('completeServiceAndQuote error:', error);
    return { code: -1, message: '操作失败', error };
  }
};