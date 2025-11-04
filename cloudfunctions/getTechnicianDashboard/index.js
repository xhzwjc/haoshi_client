// 云函数: getTechnicianDashboard/index.js
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

  try {
    // 1. 获取师傅信息 (假设您有一个 technicians 集合)
    // const techInfoRes = await db.collection('technicians').where({ _openid: tech_openid }).limit(1).get();
    // const technicianInfo = techInfoRes.data[0];
    
    // 模拟师傅信息
    const technicianInfo = {
        name: '李师傅 (真实)',
        badge: '金牌',
        rating: 4.9,
        servedOrders: 856,
        avatar: '/images/default_avatar.png' 
    };

    // 2. 获取统计数据
    // 待接单 (状态10 且 未分配)
    const pendingCountRes = await db.collection('bookings').where({ status: 10, technician_openid: _.exists(false) }).count();
    // 进行中 (状态 30, 35 且 分配给我的)
    const runningCountRes = await db.collection('bookings').where({ status: _.in([30, 35]), technician_openid: tech_openid }).count();
    
    // (此处省略复杂的本月收入、今日收入、今日待服务/已完成的查询逻辑...)
    
    // 3. 获取最近订单 (待接单 + 分配给我的)
    const recentOrdersRes = await db.collection('bookings')
      .where(_.or([
        { status: 10, technician_openid: _.exists(false) }, // 待接单
        { technician_openid: tech_openid } // 分配给我的
      ]))
      .orderBy('created_at', 'desc')
      .limit(5) // 首页只取5条
      .get();

    const dashboardData = {
        pendingCount: pendingCountRes.total,
        runningCount: runningCountRes.total,
        monthIncome: '12,580', // (应从数据库统计)
        notification: {
            title: `您有 ${pendingCountRes.total} 个新订单待处理`,
            desc: '请及时接单，避免订单流失'
        },
        todayPendingService: 2, // (应从数据库统计)
        todayCompleted: 3,   // (应从数据库统计)
        todayIncome: 540,      // (应从数据库统计)
        recentOrders: recentOrdersRes.data
    };

    return {
      code: 0,
      message: 'success',
      data: {
        dashboardData: dashboardData,
        technicianInfo: technicianInfo
      }
    };
  } catch (e) {
    return { code: -1, message: 'failed', error: e };
  }
}