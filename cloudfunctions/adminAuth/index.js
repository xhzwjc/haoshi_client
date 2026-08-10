const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// 硬编码管理员账号
const ADMIN_ACCOUNTS = [
    { username: 'admin', password: 'admin', name: '超级管理员' }
];

exports.main = async (event = {}) => {
    const { OPENID } = cloud.getWXContext();

    if (!OPENID) {
        return { code: -1, message: '用户未登录' };
    }

    const username = String(event.username || '').trim();
    const password = String(event.password || '').trim();

    if (!username || !password) {
        return { code: -1, message: '请输入账号和密码' };
    }

    const admin = ADMIN_ACCOUNTS.find(a => a.username === username && a.password === password);

    if (!admin) {
        return { code: -1, message: '管理员账号或密码错误' };
    }

    return {
        code: 0,
        message: '登录成功',
        data: {
            token: `ADMIN_${OPENID}_${Date.now()}`,
            openid: OPENID,
            admin: {
                username: admin.username,
                name: admin.name,
                role: 'ADMIN'
            }
        }
    };
};
