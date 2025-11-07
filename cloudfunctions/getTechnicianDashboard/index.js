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
        avatar: '/packageCommon/images/default_avatar.png' 
    };

    // 2. 获取统计数据
    // 待接单 (状态10 且 未分配)
    const pendingCountRes = await db.collection('bookings').where({ 
      status: 10, 
      technician_openid: _.exists(false) 
    }).count();
    
    // 进行中 (状态 10, 20, 30, 35 且 分配给我的)
    const runningCountRes = await db.collection('bookings').where({ 
      status: _.in([10, 20, 30, 35]), 
      technician_openid: tech_openid 
    }).count();
    
    // 服务状态维度
    const totalPendingServiceRes = await db.collection('bookings').where({
      status: 20,
      technician_openid: tech_openid
    }).count();

    const totalCompletedRes = await db.collection('bookings').where({
      status: 60,
      technician_openid: tech_openid
    }).count();
    
    // 本月收入 (状态60且本月完成的订单金额)
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthIncomeRes = await db.collection('bookings')
      .where({
        status: _.in([50, 60]),
        technician_openid: tech_openid,
        paid_at: _.gte(monthStart)
      })
      .get();
    const monthIncome = monthIncomeRes.data.reduce((sum, order) => {
      const amount = parseFloat(order.final_price);
      if (Number.isNaN(amount) || amount < 0) {
        return sum;
      }
      return sum + amount;
    }, 0);
    
    // 3. 获取最近订单：所有待接单的订单 + 该技师接单后的所有订单（排除已取消和已拒单）
    const recentOrdersRes = await db.collection('bookings')
      .where(_.or([
        // 所有待接单的订单（状态10且未分配）
        { 
          status: 10, 
          technician_openid: _.exists(false) 
        },
        // 该技师接单后的所有订单（排除已取消和已拒单）
        { 
          technician_openid: tech_openid,
          status: _.nin([0, -1]) // 排除已取消(0)和已拒单(-1)
        }
      ]))
      .orderBy('created_at', 'desc')
      .limit(10) // 增加到10条，显示更多订单
      .get();

    const dashboardData = {
        pendingCount: pendingCountRes.total,
        runningCount: runningCountRes.total,
        monthIncome: monthIncome.toFixed(2), // 本月收入（保留2位小数）
        notification: {
            title: `您有 ${pendingCountRes.total} 个新订单待处理`,
            desc: pendingCountRes.total > 0 ? '请及时接单，避免订单流失' : '暂无新订单'
        },
        totalPendingService: totalPendingServiceRes.total,
        totalCompleted: totalCompletedRes.total,
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