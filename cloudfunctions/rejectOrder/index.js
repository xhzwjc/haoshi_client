// 云函数: rejectOrder/index.js
// (这个函数部署在【客户端】共享环境中)
const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV 
});
const db = cloud.database();

exports.main = async (event, context) => {
  const { orderId } = event;
  // 拒单逻辑比较复杂，是直接删除？还是标记为-1？
  // 这里我们假设只是师傅不想接，订单应保持 10 状态或通知管理员
  // 为简单起见，我们仅模拟成功
  // 真实业务中，您可能需要记录拒单日志
  
  return { code: 0, message: '拒单成功' };
}