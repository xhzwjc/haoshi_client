// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
    const { key } = event;

    try {
        let query = db.collection('global_config');

        if (key) {
            const res = await query.doc(key).get();
            return {
                code: 0,
                data: res.data || {}
            };
        } else {
            // 如果没有指定key，返回所有配置（暂不建议，除非配置很少）
            // 这里为了安全和性能，如果没key，暂返回空或特定列表
            return {
                code: 0,
                data: {}
            };
        }
    } catch (err) {
        // 如果是文档不存在，返回空对象而不是报错
        if (err.errCode === -1 || err.errMsg.includes('does not exist')) {
            return {
                code: 0,
                data: {}
            };
        }
        console.error('getGlobalConfig error', err);
        return {
            code: -1,
            message: '获取配置失败',
            error: err
        };
    }
};
