const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const PROFILE_COLLECTION = 'client_profiles';
const BOOKINGS_COLLECTION = 'bookings';

const DEFAULT_PROFILE = {
  name: '张三',
  phone: '138****5678',
  gender: '保密',
  birthday: '',
  address: '',
  avatar: ''
};

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

exports.main = async () => {
  const { OPENID } = cloud.getWXContext();

  if (!OPENID) {
    return { code: -1, message: '用户未登录' };
  }

  try {
    await ensureCollection(PROFILE_COLLECTION);

    const profileRes = await db.collection(PROFILE_COLLECTION)
      .where({ _openid: OPENID })
      .limit(1)
      .get();

    const profile = profileRes.data && profileRes.data.length > 0
      ? profileRes.data[0]
      : { ...DEFAULT_PROFILE };

    let historyOrders = 0;
    let completedOrders = 0;

    try {
      const historyRes = await db.collection(BOOKINGS_COLLECTION)
        .where({ client_openid: OPENID })
        .count();
      historyOrders = historyRes.total || 0;
    } catch (err) {
      if (!err || err.errCode !== -502005) {
        throw err;
      }
    }

    try {
      const completedRes = await db.collection(BOOKINGS_COLLECTION)
        .where({ client_openid: OPENID, status: _.in([50, 60]) })
        .count();
      completedOrders = completedRes.total || 0;
    } catch (err) {
      if (!err || err.errCode !== -502005) {
        throw err;
      }
    }

    profile.historyOrders = historyOrders;
    profile.completedOrders = completedOrders;

    return {
      code: 0,
      data: profile
    };
  } catch (error) {
    console.error('getClientProfile error', error);
    return { code: -1, message: error.message || '查询失败', error };
  }
};
