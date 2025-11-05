// 云函数: acceptOrder/index.js
// (这个函数部署在【客户端】共享环境中)
const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV 
});
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const tech_openid = wxContext.OPENID; // 家政师傅的 openid
  const { orderId } = event;

  if (!orderId) {
    return { code: -1, message: '缺少订单ID' };
  }

  try {
    // 条件更新：仅当订单为待接单且未分配时才能成功
    const res = await db.collection('bookings')
      .where({
        _id: orderId,
        status: 10,
        technician_openid: _.exists(false)
      })
      .update({
        data: {
          status: 20,
          technician_openid: tech_openid
        }
      });

    if (!res.stats || res.stats.updated === 0) {
      return { code: 1, message: '订单已被抢或状态已变更' };
    }

    return { code: 0, message: '接单成功' };

  } catch (e) {
    return { code: -1, message: '操作失败', error: e };
  }
}