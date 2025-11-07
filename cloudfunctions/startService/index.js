// 云函数: startService/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const tech_openid = wxContext.OPENID;
  const { orderId } = event || {};

  if (!orderId) {
    return { code: -1, message: '缺少订单ID' };
  }

  try {
    // 仅允许当前技师将自己接到的订单从 待服务(20) 改为 服务中(30)
    const res = await db.collection('bookings')
      .where({ _id: orderId, status: 20, technician_openid: tech_openid })
      .update({
        data: {
          status: 30,
          service_started_at: db.serverDate(),
          updated_at: db.serverDate()
        }
      });

    if (!res.stats || res.stats.updated === 0) {
      return { code: 1, message: '订单状态已变更或无权限' };
    }

    return { code: 0, message: '操作成功' };
  } catch (e) {
    return { code: -1, message: '操作失败', error: e };
  }
};


