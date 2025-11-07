// 云函数: completeServiceAndQuote/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const tech_openid = wxContext.OPENID;
  const { orderId, finalPrice, remark = '' } = event || {};

  if (!orderId) {
    return { code: -1, message: '缺少订单ID' };
  }

  const parsedPrice = typeof finalPrice === 'number' ? finalPrice : parseFloat(finalPrice);
  if (isNaN(parsedPrice) || parsedPrice <= 0) {
    return { code: -1, message: '金额不合法' };
  }

  const normalizedPrice = Math.round(parsedPrice * 100) / 100;

  try {
    const updateRes = await db.collection('bookings')
      .where({ _id: orderId, status: 30, technician_openid: tech_openid })
      .update({
        data: {
          status: 35,
          final_price: normalizedPrice,
          technician_quote_remark: remark,
          completed_at: db.serverDate(),
          updated_at: db.serverDate()
        }
      });

    if (!updateRes.stats || updateRes.stats.updated === 0) {
      return { code: 1, message: '订单状态已变更或无权限' };
    }

    return { code: 0, message: '提交成功' };
  } catch (error) {
    return { code: -1, message: '操作失败', error };
  }
};
