// 云函数: getOrders/index.js
const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();

// 云函数入口
exports.main = async (event, context) => {
  const clientId = event.clientId; // 【核心修改】从前端获取client_id

  if (!clientId) {
    return {
      code: -1,
      message: '缺少客户ID',
      data: []
    };
  }

  // 接收来自客户端的参数，例如要筛选的状态
  const status = event.status; // 'all', 'pending', 'completed' ...

  let query = {
    client_id: clientId // 【核心修改】使用client_id查询
  };

  if (status && status !== 'all') {
    if (status === 'running') {
      // 运行中：30=服务中, 35=待确认金额
      query.status = db.command.in([30, 35]);
    } else if (status === 'pending_pay') {
      // 待支付：35=待确认金额, 40=待支付
      query.status = db.command.in([35, 40]);
    } else if (status === 'pending_service') {
      // 待服务：10=待接单, 20=待服务
      query.status = db.command.in([10, 20]);
    } else if (status === 'completed') {
      // 已完成：50=待评价, 60=已完成
      query.status = db.command.in([50, 60]);
    } else if (status === 'cancelled') {
      // 已取消：0=已取消, -1=已拒单
      query.status = db.command.in([0, -1]);
    } else {
      // 其他情况直接转换数字
      const statusNum = parseInt(status, 10);
      query.status = isNaN(statusNum) ? status : statusNum;
    }
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