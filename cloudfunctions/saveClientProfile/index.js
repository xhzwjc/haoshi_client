const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const PROFILE_COLLECTION = 'client_profiles';
const UNIVERSAL_ACCOUNT = '1';

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

  const {
    name,
    phone,
    gender = '保密',
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
    const existingRes = await collection
      .where(
        _.or([
          { _openid: OPENID },
          { client_openid: OPENID },
          { bound_openids: _.in([OPENID]) },
          { phone: normalizedData.phone }
        ])
      )
      .limit(1)
      .get();

    const existingDoc = existingRes.data && existingRes.data.length > 0 ? existingRes.data[0] : null;

    if (existingDoc) {
      const duplicate = await collection
        .where({
          phone: normalizedData.phone,
          _id: _.neq(existingDoc._id)
        })
        .count();

      if (duplicate.total > 0) {
        return { code: -1, message: '该手机号已被其他账号使用' };
      }
    } else {
      const duplicate = await collection
        .where({
          phone: normalizedData.phone,
          _openid: _.neq(OPENID)
        })
        .count();

      if (duplicate.total > 0) {
        return { code: -1, message: '该手机号已被其他账号使用' };
      }
    }

    if (password && String(password).trim()) {
      normalizedData.password = String(password).trim();
    }

    if (existingDoc) {
      const aliasSet = new Set(Array.isArray(existingDoc.alias_accounts) ? existingDoc.alias_accounts : []);
      const boundSet = new Set(Array.isArray(existingDoc.bound_openids) ? existingDoc.bound_openids : []);

      if (aliasSet.has(UNIVERSAL_ACCOUNT)) {
        aliasSet.add(UNIVERSAL_ACCOUNT);
      }
      boundSet.add(OPENID);

      await collection.doc(existingDoc._id).update({
        data: {
          ...normalizedData,
          client_openid: OPENID,
          alias_accounts: Array.from(aliasSet),
          bound_openids: Array.from(boundSet)
        }
      });
    } else {
      const aliasAccounts = [];
      const boundOpenids = [OPENID];

      await collection.add({
        data: {
          ...normalizedData,
          password: password && String(password).trim() ? String(password).trim() : '6666',
          client_openid: OPENID,
          alias_accounts: aliasAccounts,
          bound_openids: boundOpenids,
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
