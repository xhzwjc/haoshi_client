const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event = {}) => {
    const { OPENID } = cloud.getWXContext();

    if (!OPENID) {
        return { code: -1, message: '未授权访问' };
    }

    const action = event.action || 'getOrders';

    try {
        // 获取订单列表（按状态筛选）
        if (action === 'getOrders') {
            const page = parseInt(event.page) || 1;
            const pageSize = parseInt(event.pageSize) || 20;
            const status = event.status; // 可选：10,20,30,35,40,50,60
            const skip = (page - 1) * pageSize;

            let where = {};
            if (status !== undefined && status !== 'all') {
                where.status = parseInt(status);
            }

            const ordersRes = await db.collection('bookings')
                .where(where)
                .orderBy('created_at', 'desc')
                .skip(skip)
                .limit(pageSize)
                .get();

            const countRes = await db.collection('bookings').where(where).count();

            return {
                code: 0,
                data: {
                    list: ordersRes.data || [],
                    total: countRes.total || 0,
                    page,
                    pageSize
                }
            };
        }

        // 获取订单详情
        if (action === 'getOrderDetail') {
            const orderId = event.orderId;

            if (!orderId) {
                return { code: -1, message: '缺少订单ID' };
            }

            const orderRes = await db.collection('bookings').doc(orderId).get();

            if (!orderRes.data) {
                return { code: -1, message: '订单不存在' };
            }

            return {
                code: 0,
                data: orderRes.data
            };
        }

        return { code: -1, message: '未知操作' };

    } catch (error) {
        console.error('adminManageOrders error', error);
        return { code: -1, message: error.message || '操作失败', error };
    }
};
