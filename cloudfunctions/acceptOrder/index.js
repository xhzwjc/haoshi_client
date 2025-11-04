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
    // 关键：接单操作
    // 1. 找到这个订单：必须是 status: 10 (待接单) 且 未被分配
    const res = await db.collection('bookings').doc(orderId)
      .update({
        data: {
          status: 20, // 状态变为 "待服务"
          technician_openid: tech_openid // 分配给当前师傅
        }
      });

    if (res.stats.updated === 0) {
      // 订单状态不对或已被抢
      return { code: 1, message: '订单已被抢或状态已变更' };
    }

    return { code: 0, message: '接单成功' };

  } catch (e) {
    return { code: -1, message: '操作失败', error: e };
  }
}