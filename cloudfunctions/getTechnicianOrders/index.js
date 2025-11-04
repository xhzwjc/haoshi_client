// 云函数: getTechnicianOrders/index.js
// (这个函数部署在【客户端】共享环境中)
const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV 
});
const db = cloud.database();
const _ = db.command;

// 云函数入口
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  // 这是调用此函数的【家政师傅】的 openid
  const tech_openid = wxContext.OPENID; 

  const status = event.status; // 'all', 'running', 40, 20 etc.
  const page = event.page || 1;
  const pageSize = event.pageSize || 10;
  const skipCount = (page - 1) * pageSize;

  let query = {
    // 【核心区别】: 查询分配给当前师傅的订单
    technician_openid: tech_openid 
  };
  
  // 状态归类查询 (与您 order.js 中的逻辑一致)
  if (status && status !== 'all') {
    if (status === 'running') {
      // 进行中: 10(待接单), 30(服务中), 35(待确认金额)
      // 注意：待接单(10) 理论上没有 technician_openid，需要单独逻辑
      query.status = _.in([30, 35]); // 仅查询已接单的
    } else if (status === 'completed') {
      // 已完成: 50(待评价), 60(已完成)
      query.status = _.in([50, 60]);
    } else if (status === 'cancelled') {
      // 已取消: 0(已取消), -1(已拒单)
      query.status = _.in([0, -1]);
    } else {
      // 待支付(40), 待服务(20)
      query.status = status;
    }
  }
  
  // 待接单(10) 需要特殊查询：状态为10 且 technician_openid 为空 (或根据您的业务逻辑)
  if (status === 10) {
     query = {
       status: 10,
       technician_openid: _.exists(false) // 查询未分配师傅的订单
     };
  }

  try {
    const res = await db.collection('bookings')
      .where(query)
      .orderBy('created_at', 'desc')
      .skip(skipCount)
      .limit(pageSize)
      .get();
    
    return {
      code: 0,
      message: 'success',
      data: res.data
    };

  } catch (e) {
    return { code: -1, message: 'failed', error: e };
  }
}