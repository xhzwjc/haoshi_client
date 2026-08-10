// 云函数: getTechnicianOrders/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const masterId = event.masterId; // 直接从前端获取
  const { status = 'all', page = 1, pageSize = 20 } = event;

  if (!masterId) {
    return {
      code: -1,
      message: '缺少师傅ID',
      data: { list: [], total: 0 }
    };
  }

  try {
    // 构建查询条件
    let whereCondition;

    if (status === 'all') {
      whereCondition = _.or([
        { status: 10, master_id: _.exists(false) },
        { master_id: masterId, status: _.nin([0, -1]) }
      ]);
    } else if (status === 'pending') {
      whereCondition = { status: 10, master_id: _.exists(false) };
    } else if (status === 'accepted') {
      whereCondition = { status: 20, master_id: masterId };
    } else if (status === 'ongoing') {
      // 服务中：包含 30(服务中) 和 35(待客户确认)
      whereCondition = { status: _.in([30, 35]), master_id: masterId };
    } else if (status === 'completed') {
      // 已完成：包含 50(已收款/待评价) 和 60(已完成)
      whereCondition = { status: _.in([50, 60]), master_id: masterId };
    } else if (status === 'pending_payment') {
      whereCondition = { status: _.in([35, 40]), master_id: masterId };
    } else {
      const statusNum = parseInt(status);
      if (statusNum === 10) {
        // 特殊处理待接单：查询没有master_id的订单
        whereCondition = { status: 10, master_id: _.exists(false) };
      } else {
        whereCondition = { status: statusNum, master_id: masterId };
      }
    }

    // 分页查询
    const skip = (page - 1) * pageSize;
    const orderRes = await db.collection('bookings')
      .where(whereCondition)
      .orderBy('created_at', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();

    // 统计总数
    const countRes = await db.collection('bookings')
      .where(whereCondition)
      .count();

    return {
      code: 0,
      message: 'success',
      data: {
        list: orderRes.data || [],
        total: countRes.total,
        page: page,
        pageSize: pageSize
      }
    };

  } catch (e) {
    console.error('getTechnicianOrders error:', e);
    return {
      code: -1,
      message: '查询失败',
      error: e,
      data: { list: [], total: 0 }
    };
  }
};