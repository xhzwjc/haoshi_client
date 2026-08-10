// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 云函数入口函数
exports.main = async (event, context) => {
    const { key, data } = event;
    const { OPENID } = cloud.getWXContext();

    // 简单的权限验证，实际应检查是否为管理员
    // 这里假设调用端已经做了鉴权，或者后续添加adminAuth中间件
    // 为了安全，建议检查OPENID是否在管理员列表中，或者检查token

    if (!key || !data) {
        return { code: -1, message: '参数错误' };
    }

    try {
        const collection = db.collection('global_config');
        const updateData = {
            ...data,
            updated_at: db.serverDate(),
            updated_by: OPENID
        };

        // 先尝试查询文档是否存在
        const existRes = await collection.doc(key).get().catch(() => ({ data: null }));

        if (existRes.data) {
            // 文档存在，更新
            await collection.doc(key).update({
                data: updateData
            });
        } else {
            // 文档不存在，创建
            await collection.add({
                data: {
                    _id: key,
                    ...updateData
                }
            });
        }

        return {
            code: 0,
            message: '更新成功',
            data: updateData
        };
    } catch (err) {
        console.error('updateGlobalConfig error', err);
        return {
            code: -1,
            message: '更新配置失败',
            error: err.message || err
        };
    }
};
