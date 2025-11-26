// 云函数: getTechnicianDashboard/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

function pad(num) {
  return num < 10 ? `0${num}` : `${num}`;
}

function extractMonthKey(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  return `${year}-${month}`;
}

function safeAmount(value) {
  if (typeof value === 'number') {
    return value >= 0 ? value : 0;
  }
  const parsed = parseFloat(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

exports.main = async (event, context) => {
  const masterId = event.masterId; // 直接从前端获取master_id

  if (!masterId) {
    return { code: -1, message: '缺少师傅ID' };
  }

  try {
    // 1. 通过master_id查询师傅信息（不再依赖OPENID）
    let technicianInfo = {
      name: '--',
      badge: '普通',
      rating: 5.0,
      servedOrders: 0,
      avatar: '/packageCommon/images/default_avatar.png'
    };

    try {
      const techData = await db.collection('technicians').doc(masterId).get();

      if (techData.data) {
        // 计算已服务订单数
        const completedOrdersRes = await db.collection('bookings')
          .where({ master_id: masterId, status: 60 })
          .count();

        // 计算平均评分 (改为从 service_reviews 集合获取，保持与评价列表一致)
        let avgRating = 0.0;
        try {
          const reviewsResult = await db.collection('service_reviews').aggregate()
            .match({ technician_id: masterId })
            .group({
              _id: null,
              avgRating: db.command.aggregate.avg('$rating')
            })
            .end();

          if (reviewsResult.list && reviewsResult.list.length > 0) {
            avgRating = reviewsResult.list[0].avgRating.toFixed(1);
          }
        } catch (err) {
          console.warn('获取评价统计失败', err);
        }

        technicianInfo = {
          name: techData.data.name || '--',
          badge: '金牌',
          rating: parseFloat(avgRating),
          servedOrders: completedOrdersRes.total || 0,
          avatar: techData.data.avatar || '/packageCommon/images/default_avatar.png'
        };
      }
    } catch (err) {
      console.warn('获取师傅信息失败', err);
    }

    // 2. 获取统计数据（使用master_id）
    const pendingCountRes = await db.collection('bookings').where({
      status: 10,
      master_id: _.exists(false)
    }).count();

    const runningCountRes = await db.collection('bookings').where({
      status: _.in([10, 20, 30, 35]),
      master_id: masterId
    }).count();

    const totalPendingServiceRes = await db.collection('bookings').where({
      status: 20,
      master_id: masterId
    }).count();

    const totalCompletedRes = await db.collection('bookings').where({
      status: 60,
      master_id: masterId
    }).count();

    // 本月收入
    const now = new Date();
    const currentMonthKey = extractMonthKey(now);
    const incomeRes = await db.collection('bookings')
      .where({
        master_id: masterId,
        status: _.in([50, 60]),
        paid_at: _.exists(true)
      })
      .orderBy('paid_at', 'desc')
      .limit(200)
      .get();

    let monthIncome = 0;
    (incomeRes.data || []).forEach((order) => {
      const paidAt = order.paid_at || order.completed_at || order.updated_at || order.created_at;
      if (extractMonthKey(paidAt) === currentMonthKey) {
        monthIncome += safeAmount(order.final_price);
      }
    });

    // 3. 获取最近订单
    const recentOrdersRes = await db.collection('bookings')
      .where(_.or([
        { status: 10, master_id: _.exists(false) },
        { master_id: masterId, status: _.nin([0, -1]) }
      ]))
      .orderBy('created_at', 'desc')
      .limit(5)
      .get();

    const notification = pendingCountRes.total > 0 ? {
      title: `您有 ${pendingCountRes.total} 个新订单待处理`,
      desc: '请及时接单，避免订单流失'
    } : null;

    const dashboardData = {
      pendingCount: pendingCountRes.total,
      runningCount: runningCountRes.total,
      monthIncome: monthIncome.toFixed(2),
      notification: notification,
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
    console.error('getTechnicianDashboard error:', e);
    return { code: -1, message: 'failed', error: e };
  }
};