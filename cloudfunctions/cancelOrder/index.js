// 云函数: cancelOrder/index.js
// 客户取消订单
const cloud = require('wx-server-sdk');
cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();
const _ = db.command;

/**
 * 构建客户订单归属匹配器
 */
function buildClientOwnershipMatcher(openid) {
    return _.or([
        { client_openid: openid },
        { _openid: openid },
        { bound_openids: _.in([openid]) },
        { client_bound_openids: _.in([openid]) }
    ]);
}

exports.main = async (event, context) => {
    const wxContext = cloud.getWXContext();
    const client_openid = wxContext.OPENID;
    const { orderId } = event;

    if (!orderId) {
        return { code: -1, message: '缺少订单ID' };
    }

    try {
        // 先查询订单，验证归属和状态
        const orderRes = await db.collection('bookings').doc(orderId).get();

        if (!orderRes.data) {
            return { code: -1, message: '订单不存在' };
        }

        const order = orderRes.data;

        // 验证订单归属
        const candidates = new Set();
        if (order.client_openid) candidates.add(order.client_openid);
        if (order._openid) candidates.add(order._openid);
        if (order.clientOpenid) candidates.add(order.clientOpenid);
        if (Array.isArray(order.bound_openids)) {
            order.bound_openids.forEach((value) => value && candidates.add(value));
        }
        if (Array.isArray(order.client_bound_openids)) {
            order.client_bound_openids.forEach((value) => value && candidates.add(value));
        }

        if (!candidates.has(client_openid)) {
            return { code: -1, message: '无权操作该订单' };
        }

        // 验证订单状态：只有待接单(10)和待服务(20)可以取消
        if (order.status !== 10 && order.status !== 20) {
            return { code: -1, message: '当前订单状态不允许取消' };
        }

        // 更新订单状态为已取消
        const updateRes = await db.collection('bookings')
            .doc(orderId)
            .update({
                data: {
                    status: 0,
                    cancelled_at: db.serverDate(),
                    updated_at: db.serverDate()
                }
            });

        if (updateRes.stats && updateRes.stats.updated > 0) {
            return { code: 0, message: '取消成功' };
        } else {
            return { code: -1, message: '取消失败' };
        }

    } catch (error) {
        console.error('取消订单失败:', error);
        return { code: -1, message: '操作失败', error };
    }
};
