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
  const tech_openid = wxContext.OPENID; // 当前登录的微信OPENID
  const { orderId } = event;

  if (!orderId) {
    return { code: -1, message: '缺少订单ID' };
  }

  try {
    // 1. 通过当前OPENID查询师傅的master_id
    const techRes = await db.collection('technicians')
      .where({ technician_openid: tech_openid })
      .limit(1)
      .get();

    if (!techRes.data || techRes.data.length === 0) {
      return { code: -1, message: '未找到师傅信息' };
    }

    const masterId = techRes.data[0]._id;
    const masterPhone = techRes.data[0].phone;
    const masterName = techRes.data[0].name;

    // 2. 条件更新：仅当订单为待接单且未分配时才能成功
    const res = await db.collection('bookings')
      .where({
        _id: orderId,
        status: 10,
        master_id: _.exists(false)
      })
      .update({
        data: {
          status: 20,
          master_id: masterId, // 设置师傅ID
          master_phone: masterPhone, // 设置师傅手机号（兼容现有字段）
          master_info: masterName, // 设置师傅姓名
          accepted_at: db.serverDate(),
          updated_at: db.serverDate()
        }
      });

    if (!res.stats || res.stats.updated === 0) {
      return { code: 1, message: '订单已被抢或状态已变更' };
    }

    return { code: 0, message: '接单成功' };

  } catch (e) {
    console.error('acceptOrder error:', e);
    return { code: -1, message: '操作失败', error: e };
  }
}