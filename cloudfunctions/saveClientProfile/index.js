const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

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
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { code: -1, message: '未登录' };
  }

  const { name, phone, gender = '保密', birthday = '', address = '', avatar = '' } = event || {};

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

    const existing = await db.collection(PROFILE_COLLECTION)
      .where({ _openid: OPENID })
      .limit(1)
      .get();

    if (existing.data && existing.data.length > 0) {
      const docId = existing.data[0]._id;
      await db.collection(PROFILE_COLLECTION).doc(docId).update({ data: normalizedData });
    } else {
      await db.collection(PROFILE_COLLECTION).add({
        data: {
          ...normalizedData,
          client_openid: OPENID,
          created_at: db.serverDate()
        }
      });
    }

    return { code: 0, message: 'success' };
  } catch (error) {
    console.error('saveClientProfile error', error);
    return { code: -1, message: error.message || '保存失败', error };
  }
};
