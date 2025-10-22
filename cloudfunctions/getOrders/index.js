// 云函数: getOrders/index.js
const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV 
});
const db = cloud.database();

// 云函数入口
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID; // 获取当前登录用户的 openid

  // 接收来自客户端的参数，例如要筛选的状态
  const status = event.status; // 'all', 'pending', 'completed' ...

  let query = {
    _openid: openid // 关键：只查询当前用户的订单
  };
  
  if (status && status !== 'all') {
    query.status = status; // 如果传入了状态，则增加筛选条件
  }

  try {
    const res = await db.collection('bookings')
      .where(query)
      .orderBy('created_at', 'desc') // 按创建时间倒序
      .get();
    
    // 可以在这里处理数据，例如格式化日期
    // ...

    return {
      code: 0,
      message: 'success',
      data: res.data
    };

  } catch (e) {
    return {
      code: -1,
      message: 'failed',
      error: e
    };
  }
}