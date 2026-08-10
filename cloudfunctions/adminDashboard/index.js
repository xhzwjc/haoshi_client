const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event = {}) => {
    const { OPENID } = cloud.getWXContext();

    if (!OPENID) {
        return { code: -1, message: '未授权访问' };
    }

    const action = event.action || 'getStats';

    try {
        // 获取总体统计数据
        if (action === 'getStats') {
            // 总用户数
            let totalUsers = 0;
            try {
                const usersRes = await db.collection('client_profiles').count();
                totalUsers = usersRes.total || 0;
            } catch (error) {
                console.warn('Count users failed', error);
            }

            // 总订单数
            let totalOrders = 0;
            try {
                const ordersRes = await db.collection('bookings').count();
                totalOrders = ordersRes.total || 0;
            } catch (error) {
                console.warn('Count orders failed', error);
            }

            // 服务人员数 (status = ACTIVE)
            let totalTechs = 0;
            try {
                const techsRes = await db.collection('technicians').where({ status: 'ACTIVE' }).count();
                totalTechs = techsRes.total || 0;
            } catch (error) {
                console.warn('Count technicians failed', error);
            }

            // 总收入 (status = 50 或 60，已支付/已完成)
            let totalRevenue = 0;
            try {
                const revenueOrders = await db.collection('bookings')
                    .where({ status: _.in([50, 60]) })
                    .field({ final_price: true })
                    .limit(1000) // 限制数量避免超时
                    .get();

                totalRevenue = (revenueOrders.data || []).reduce((sum, order) => {
                    return sum + (parseFloat(order.final_price) || 0);
                }, 0);
            } catch (error) {
                console.warn('Calculate revenue failed', error);
            }

            return {
                code: 0,
                data: {
                    totalUsers,
                    totalOrders,
                    totalTechs,
                    totalRevenue: totalRevenue.toFixed(2)
                }
            };
        }

        // 获取今日统计数据
        if (action === 'getTodayStats') {
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const startTime = startOfDay.getTime();

            // 今日新增订单
            let newOrders = 0;
            try {
                const ordersRes = await db.collection('bookings')
                    .where({
                        created_at: _.gte(db.serverDate({ offset: -(Date.now() - startTime) }))
                    })
                    .count();
                newOrders = ordersRes.total || 0;
            } catch (error) {
                console.warn('Count today orders failed', error);
            }

            // 今日已完成订单
            let completedOrders = 0;
            let revenue = 0;
            try {
                const completedRes = await db.collection('bookings')
                    .where({
                        status: _.in([50, 60]),
                        created_at: _.gte(db.serverDate({ offset: -(Date.now() - startTime) }))
                    })
                    .field({ final_price: true })
                    .limit(1000)
                    .get();

                completedOrders = (completedRes.data || []).length;
                revenue = (completedRes.data || []).reduce((sum, order) => {
                    return sum + (parseFloat(order.final_price) || 0);
                }, 0);
            } catch (error) {
                console.warn('Calculate today revenue failed', error);
            }

            // 今日新增用户
            let newUsers = 0;
            try {
                const usersRes = await db.collection('client_profiles')
                    .where({
                        created_at: _.gte(db.serverDate({ offset: -(Date.now() - startTime) }))
                    })
                    .count();
                newUsers = usersRes.total || 0;
            } catch (error) {
                console.warn('Count today users failed', error);
            }

            return {
                code: 0,
                data: {
                    newOrders,
                    completedOrders,
                    revenue: revenue.toFixed(2),
                    newUsers
                }
            };
        }

        return { code: -1, message: '未知操作' };

    } catch (error) {
        console.error('adminDashboard error', error);
        return { code: -1, message: error.message || '查询失败', error };
    }
};
