const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const SERVICES_COLLECTION = 'services';

async function ensureCollection(collectionName) {
    try {
        await db.createCollection(collectionName);
    } catch (error) {
        const ignoreCodes = new Set([-502006, -501001, -502005]);
        if (!(error && ignoreCodes.has(error.errCode))) {
            throw error;
        }
    }
}

exports.main = async (event = {}) => {
    const { OPENID } = cloud.getWXContext();

    if (!OPENID) {
        return { code: -1, message: '未授权访问' };
    }

    const action = event.action || 'getServices';

    try {
        await ensureCollection(SERVICES_COLLECTION);
        const collection = db.collection(SERVICES_COLLECTION);

        // 获取服务列表
        if (action === 'getServices') {
            const servicesRes = await collection
                .orderBy('created_at', 'desc')
                .get();

            return {
                code: 0,
                data: servicesRes.data || []
            };
        }

        // 新增服务
        if (action === 'addService') {
            const { name, price, unit, desc, category, rate, sold, hot } = event;

            if (!name) return { code: -1, message: '请输入服务名称' };
            if (!price) return { code: -1, message: '请输入价格' };
            if (!unit) return { code: -1, message: '请输入单位' };
            if (!desc) return { code: -1, message: '请输入服务介绍' };
            if (!category) return { code: -1, message: '请选择分类' };

            const now = db.serverDate();
            const serviceDoc = {
                name,
                price,
                unit,
                desc,
                category,
                rate: rate || 5.0,
                sold: sold || 0,
                hot: hot || false,
                enabled: true,
                updated_at: now
            };

            const addRes = await collection.add({ data: serviceDoc });

            return {
                code: 0,
                message: '新增成功',
                data: { id: addRes._id }
            };
        }

        // 修改服务
        if (action === 'updateService') {
            const { serviceId, name, price, unit, desc, category } = event;

            if (!serviceId) {
                return { code: -1, message: '缺少服务ID' };
            }

            const updateData = {
                updated_at: db.serverDate()
            };

            if (name !== undefined) updateData.name = name;
            if (price !== undefined) updateData.price = price;
            if (unit !== undefined) updateData.unit = unit;
            if (desc !== undefined) updateData.desc = desc;
            if (category !== undefined) updateData.category = category;

            await collection.doc(serviceId).update({ data: updateData });

            return {
                code: 0,
                message: '修改成功'
            };
        }

        // 切换服务状态（启用/禁用）
        if (action === 'toggleStatus') {
            const serviceId = event.serviceId;
            const enabled = event.enabled; // true or false

            if (!serviceId) {
                return { code: -1, message: '缺少服务ID' };
            }

            await collection.doc(serviceId).update({
                data: {
                    enabled: enabled,
                    updated_at: db.serverDate()
                }
            });

            return {
                code: 0,
                message: enabled ? '服务已启用' : '服务已禁用'
            };
        }

        // 删除服务
        if (action === 'deleteService') {
            const serviceId = event.serviceId;

            if (!serviceId) {
                return { code: -1, message: '缺少服务ID' };
            }

            await collection.doc(serviceId).remove();

            return {
                code: 0,
                message: '删除成功'
            };
        }

        return { code: -1, message: '未知操作' };

    } catch (error) {
        console.error('adminManageServices error', error);
        return { code: -1, message: error.message || '操作失败', error };
    }
};
