const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const PROFILE_COLLECTION = 'client_profiles';

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

exports.main = async (event) => {
  // 【核心修改】接收clientId参数
  const clientId = event.clientId;

  if (!clientId) {
    return { code: -1, message: '缺少客户ID' };
  }

  const {
    name,
    phone,
    gender = '不愿透露',
    birthday = '',
    address = '',
    avatar = '',
    password
  } = event || {};

  if (!name || !String(name).trim()) {
    return { code: -1, message: '姓名不能为空' };
  }

  if (!/^\d{11}$/.test(String(phone || '').trim())) {
    return { code: -1, message: '手机号格式不正确' };
  }

  const normalizedData = {
    name: String(name).trim(),
    phone: String(phone).trim(),
    gender,
    birthday,
    address,
    avatar,
    updated_at: db.serverDate()
  };

  try {
    await ensureCollection(PROFILE_COLLECTION);

    const collection = db.collection(PROFILE_COLLECTION);

    // 【核心修改】检查手机号是否被其他账号使用
    const duplicate = await collection
      .where({
        phone: normalizedData.phone,
        _id: _.neq(clientId)
      })
      .count();

    if (duplicate.total > 0) {
      return { code: -1, message: '该手机号已被其他账号使用' };
    }

    if (password && String(password).trim()) {
      normalizedData.password = String(password).trim();
    }

    // 【核心修改】直接通过clientId更新文档
    await collection.doc(clientId).update({
      data: normalizedData
    });

    return { code: 0, message: 'success' };
  } catch (error) {
    console.error('saveClientProfile error', error);
    return { code: -1, message: error.message || '保存失败', error };
  }
};
