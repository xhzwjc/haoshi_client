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

  try {
    let orders = [];
    
    // 状态归类查询
    if (status === 'all') {
      // 全部：需要查询两部分数据
      // 1. 所有待接单的订单（status: 10 且 technician_openid 不存在）
      // 2. 该技师接单后的所有订单（排除已取消和已拒单）
      
      const [pendingOrders, myOrders] = await Promise.all([
        // 查询待接单订单
        db.collection('bookings')
          .where({
            status: 10,
            technician_openid: _.exists(false)
          })
          .orderBy('created_at', 'desc')
          .get(),
        // 查询该技师接单后的订单
        db.collection('bookings')
          .where({
            technician_openid: tech_openid,
            status: _.nin([0, -1])
          })
          .orderBy('created_at', 'desc')
          .get()
      ]);
      
      // 合并两个结果，去重，然后排序
      const allOrders = [...pendingOrders.data, ...myOrders.data];
      // 使用 Map 去重（基于 _id）
      const uniqueOrders = Array.from(
        new Map(allOrders.map(order => [order._id, order])).values()
      );
      // 按创建时间排序
      uniqueOrders.sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeB - timeA;
      });
      
      // 分页处理
      orders = uniqueOrders.slice(skipCount, skipCount + pageSize);
      
    } else if (status === 10 || status === '10') {
      // 待接单：查询所有未分配的订单
      const res = await db.collection('bookings')
        .where({
          status: 10,
          technician_openid: _.exists(false)
        })
        .orderBy('created_at', 'desc')
        .skip(skipCount)
        .limit(pageSize)
        .get();
      orders = res.data;
      
    } else if (status === 'pending_payment') {
      // 待收款：状态35和40，且分配给当前技师
      const res = await db.collection('bookings')
        .where({
          technician_openid: tech_openid,
          status: _.in([35, 40])
        })
        .orderBy('created_at', 'desc')
        .skip(skipCount)
        .limit(pageSize)
        .get();
      orders = res.data;
      
    } else if (status === 'completed') {
      // 已完成：状态50和60，且分配给当前技师
      const res = await db.collection('bookings')
        .where({
          technician_openid: tech_openid,
          status: _.in([50, 60])
        })
        .orderBy('created_at', 'desc')
        .skip(skipCount)
        .limit(pageSize)
        .get();
      orders = res.data;
      
    } else {
      // 其他状态（20待服务、30服务中等），且分配给当前技师
      const res = await db.collection('bookings')
        .where({
          technician_openid: tech_openid,
          status: status
        })
        .orderBy('created_at', 'desc')
        .skip(skipCount)
        .limit(pageSize)
        .get();
      orders = res.data;
    }
    
    console.log('查询结果数量:', orders.length);
    
    return {
      code: 0,
      message: 'success',
      data: orders || []
    };

  } catch (e) {
    console.error('查询订单失败:', e);
    return { 
      code: -1, 
      message: e.message || '查询失败', 
      error: e.toString()
    };
  }
}