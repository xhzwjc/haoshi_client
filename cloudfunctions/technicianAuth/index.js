const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const TECHNICIANS_COLLECTION = 'technicians';
const UNIVERSAL_CODE = '6666'; // 万能验证码

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
        return { code: -1, message: '用户未登录' };
    }

    const action = event.action || 'login';

    try {
        await ensureCollection(TECHNICIANS_COLLECTION);
        const collection = db.collection(TECHNICIANS_COLLECTION);

        // 注册师傅
        if (action === 'register') {
            const phone = String(event.phone || '').trim();
            const password = String(event.password || '').trim();
            const name = String(event.name || '').trim();

            if (!/^1\d{10}$/.test(phone)) {
                return { code: -1, message: '请输入正确的手机号' };
            }
            if (!password) {
                return { code: -1, message: '请设置密码' };
            }
            if (!name) {
                return { code: -1, message: '请输入真实姓名' };
            }

            // 检查是否已注册
            const existingRes = await collection.where({ phone }).limit(1).get();
            if (existingRes.data && existingRes.data.length > 0) {
                return { code: -1, message: '该手机号已注册' };
            }

            // 创建师傅记录 - 重要：必须写入数据库！
            const now = db.serverDate();
            const techDoc = {
                phone,
                password,
                name,
                status: 'PENDING', // 待审核
                service_type: '',
                created_at: now,
                updated_at: now
            };

            const addRes = await collection.add({ data: techDoc });

            return {
                code: 0,
                message: '注册成功，请等待管理员审核',
                data: {
                    status: 'PENDING',
                    master_id: addRes._id // 返回师傅ID
                }
            };
        }

        // 密码登录
        if (action === 'loginWithPassword') {
            const phone = String(event.phone || '').trim();
            const password = String(event.password || '').trim();

            if (!/^1\d{10}$/.test(phone)) {
                return { code: -1, message: '请输入正确的手机号' };
            }
            if (!password) {
                return { code: -1, message: '请输入密码' };
            }

            const techRes = await collection.where({ phone }).limit(1).get();
            if (!techRes.data || techRes.data.length === 0) {
                return { code: -1, message: '账号不存在' };
            }

            const techDoc = techRes.data[0];
            if (techDoc.password !== password) {
                return { code: -1, message: '密码错误' };
            }

            // 检查状态
            if (techDoc.status === 'PENDING') {
                return { code: -1, message: '您的账号正在审核中，请等待管理员审核通过后登录' };
            }
            if (techDoc.status === 'DISABLED') {
                return { code: -1, message: '您的账号已被禁用，请联系管理员' };
            }
            if (techDoc.status !== 'ACTIVE') {
                return { code: -1, message: '账号状态异常，请联系管理员' };
            }

            // 登录成功后更新openid（用于当前会话）
            await collection.doc(techDoc._id).update({
                data: {
                    technician_openid: OPENID,
                    last_login_at: db.serverDate(),
                    updated_at: db.serverDate()
                }
            });

            return {
                code: 0,
                message: '登录成功',
                data: {
                    token: `TECH_${techDoc._id}_${Date.now()}`,
                    openid: OPENID,
                    technician: {
                        id: techDoc._id, // master_id
                        name: techDoc.name,
                        phone: techDoc.phone,
                        status: techDoc.status,
                        service_type: techDoc.service_type || ''
                    }
                }
            };
        }

        // 验证码登录
        if (action === 'loginWithCode') {
            const phone = String(event.phone || '').trim();
            const code = String(event.code || '').trim();

            if (!/^1\d{10}$/.test(phone)) {
                return { code: -1, message: '请输入正确的手机号' };
            }
            if (code !== UNIVERSAL_CODE) {
                return { code: -1, message: '验证码错误' };
            }

            const techRes = await collection.where({ phone }).limit(1).get();
            if (!techRes.data || techRes.data.length === 0) {
                return { code: -1, message: '账号不存在，请先注册' };
            }

            const techDoc = techRes.data[0];

            // 检查状态
            if (techDoc.status === 'PENDING') {
                return { code: -1, message: '您的账号正在审核中，请等待管理员审核通过后登录' };
            }
            if (techDoc.status === 'DISABLED') {
                return { code: -1, message: '您的账号已被禁用，请联系管理员' };
            }
            if (techDoc.status !== 'ACTIVE') {
                return { code: -1, message: '账号状态异常，请联系管理员' };
            }

            // 登录成功后更新openid
            await collection.doc(techDoc._id).update({
                data: {
                    technician_openid: OPENID,
                    last_login_at: db.serverDate(),
                    updated_at: db.serverDate()
                }
            });

            return {
                code: 0,
                message: '登录成功',
                data: {
                    token: `TECH_${techDoc._id}_${Date.now()}`,
                    openid: OPENID,
                    technician: {
                        id: techDoc._id, // master_id
                        name: techDoc.name,
                        phone: techDoc.phone,
                        status: techDoc.status,
                        service_type: techDoc.service_type || ''
                    }
                }
            };
        }

        // 获取当前师傅信息
        if (action === 'getInfo') {
            const techRes = await collection.where({ technician_openid: OPENID }).limit(1).get();
            if (!techRes.data || techRes.data.length === 0) {
                return { code: -1, message: '未找到师傅信息' };
            }

            const techDoc = techRes.data[0];
            return {
                code: 0,
                data: {
                    id: techDoc._id,
                    name: techDoc.name,
                    phone: techDoc.phone,
                    status: techDoc.status,
                    service_type: techDoc.service_type || ''
                }
            };
        }

        return { code: -1, message: '未知操作' };

    } catch (error) {
        console.error('technicianAuth error', error);
        return { code: -1, message: error.message || '操作失败', error };
    }
};
