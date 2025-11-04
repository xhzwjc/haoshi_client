// cloudfunctions/unifiedLogin/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 辅助函数：简单的密码哈希（实际生产环境应使用更安全的方案）
const hashPassword = (password) => {
    // ⚠️ 实际应使用 SHA-256 加盐哈希
    return password; 
};

exports.main = async (event, context) => {
    const { role, account, password } = event;
    const wxContext = cloud.getWXContext();
    const hashedPassword = hashPassword(password);
    
    // 1. 客户登录
    if (role === 'client') {
        // 客户登录：使用 OpenID（静默登录）或手机号+密码
        // 简化起见，这里演示基于手机号的客户端登录表
        const clientRes = await db.collection('clients').where({
            phone: account,
            password_hash: hashedPassword 
        }).limit(1).get();

        if (clientRes.data.length > 0) {
            // 登录成功，返回身份
            return {
                code: 0,
                message: '登录成功',
                data: {
                    token: 'CLIENT_TOKEN_' + clientRes.data[0]._id, // 模拟Token
                    role: 'CLIENT',
                    openid: wxContext.OPENID 
                }
            };
        }
        
    // 2. 家政人员登录
    } else if (role === 'technician') {
        // 家政人员登录：使用工号/手机号+密码
        const techRes = await db.collection('technicians').where({
            employee_id: account, // 假设家政人员使用工号登录
            password_hash: hashedPassword 
        }).limit(1).get();

        if (techRes.data.length > 0) {
            // 登录成功，将师傅的 OpenID 写入师傅表，以供后续查询
            await db.collection('technicians').doc(techRes.data[0]._id).update({
                data: {
                    openid: wxContext.OPENID,
                    last_login: db.serverDate()
                }
            });
            
            // 登录成功，返回身份
            return {
                code: 0,
                message: '登录成功',
                data: {
                    token: 'TECH_TOKEN_' + techRes.data[0]._id, // 模拟Token
                    role: 'TECHNICIAN',
                    openid: wxContext.OPENID 
                }
            };
        }
    }

    return {
        code: -1,
        message: '账号或密码错误，请检查'
    };
};