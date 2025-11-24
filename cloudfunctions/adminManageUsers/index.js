const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event = {}) => {
    const { OPENID } = cloud.getWXContext();

    if (!OPENID) {
        return { code: -1, message: '未授权访问' };
    }

    const action = event.action || 'getClients';

    try {
        // 获取客户列表
        if (action === 'getClients') {
            const page = parseInt(event.page) || 1;
            const pageSize = parseInt(event.pageSize) || 20;
            const skip = (page - 1) * pageSize;

            const clientsRes = await db.collection('client_profiles')
                .orderBy('created_at', 'desc')
                .skip(skip)
                .limit(pageSize)
                .field({
                    password: false,
                    alias_accounts: false,
                    bound_openids: false
                })
                .get();

            const countRes = await db.collection('client_profiles').count();

            return {
                code: 0,
                data: {
                    list: clientsRes.data || [],
                    total: countRes.total || 0,
                    page,
                    pageSize
                }
            };
        }

        // 获取服务人员列表
        if (action === 'getTechnicians') {
            const page = parseInt(event.page) || 1;
            const pageSize = parseInt(event.pageSize) || 20;
            const status = event.status; // 可选：PENDING, ACTIVE, DISABLED
            const skip = (page - 1) * pageSize;

            let where = {};
            if (status) {
                where.status = status;
            }

            const techsRes = await db.collection('technicians')
                .where(where)
                .orderBy('created_at', 'desc')
                .skip(skip)
                .limit(pageSize)
                .field({ password: false })
                .get();

            const countRes = await db.collection('technicians').where(where).count();

            return {
                code: 0,
                data: {
                    list: techsRes.data || [],
                    total: countRes.total || 0,
                    page,
                    pageSize
                }
            };
        }

        // 审核服务人员（修改状态）
        if (action === 'updateTechnicianStatus') {
            const techId = event.techId;
            const status = event.status; // ACTIVE, DISABLED, PENDING

            if (!techId) {
                return { code: -1, message: '缺少师傅ID' };
            }
            if (!['ACTIVE', 'DISABLED', 'PENDING'].includes(status)) {
                return { code: -1, message: '无效的状态' };
            }

            await db.collection('technicians').doc(techId).update({
                data: {
                    status,
                    updated_at: db.serverDate()
                }
            });

            return {
                code: 0,
                message: '状态更新成功',
                data: { status }
            };
        }

        return { code: -1, message: '未知操作' };

    } catch (error) {
        console.error('adminManageUsers error', error);
        return { code: -1, message: error.message || '操作失败', error };
    }
};
