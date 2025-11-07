const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const PROFILE_COLLECTION = 'client_profiles';
const BOOKINGS_COLLECTION = 'bookings';

const DEFAULT_PROFILE = {
  name: '',
  phone: '',
  gender: '保密',
  birthday: '',
  address: '',
  avatar: '',
  historyOrders: 0,
  completedOrders: 0
};

async function ensureCollection(name) {
  try {
    await db.createCollection(name);
  } catch (error) {
    const ignoreCodes = new Set([-502006, -501001, -502005]);
    if (!(error && ignoreCodes.has(error.errCode))) {
      throw error;
    }
  }
}

async function fetchProfileSummary(openid) {
  const profileRes = await db.collection(PROFILE_COLLECTION)
    .where(
      _.or([
        { _openid: openid },
        { client_openid: openid }
      ])
    )
    .limit(1)
    .get();

  const profile = profileRes.data && profileRes.data.length > 0
    ? profileRes.data[0]
    : null;

  const matcher = _.or([
    { client_openid: openid },
    { _openid: openid }
  ]);

  let historyOrders = 0;
  let completedOrders = 0;

  try {
    const res = await db.collection(BOOKINGS_COLLECTION)
      .where(matcher)
      .count();
    historyOrders = res.total || 0;
  } catch (err) {
    if (!err || err.errCode !== -502005) {
      throw err;
    }
  }

  try {
    const res = await db.collection(BOOKINGS_COLLECTION)
      .where(
        _.and([
          matcher,
          { status: _.in([50, 60]) }
        ])
      )
      .count();
    completedOrders = res.total || 0;
  } catch (err) {
    if (!err || err.errCode !== -502005) {
      throw err;
    }
  }

  if (!profile) {
    return {
      profile: {
        ...DEFAULT_PROFILE,
        historyOrders,
        completedOrders
      }
    };
  }

  return {
    profile: {
      ...DEFAULT_PROFILE,
      ...profile,
      historyOrders,
      completedOrders
    }
  };
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { code: -1, message: '未获取到用户身份' };
  }

  const {
    phone = '',
    password = '',
    action = 'login'
  } = event;

  if (action !== 'login') {
    return { code: -1, message: '不支持的操作类型' };
  }

  const normalizedPhone = String(phone || '').trim();
  const normalizedPassword = String(password || '').trim();

  if (!/^1\d{10}$/.test(normalizedPhone)) {
    return { code: -1, message: '请输入有效手机号' };
  }

  if (!normalizedPassword) {
    return { code: -1, message: '请输入密码' };
  }

  await ensureCollection(PROFILE_COLLECTION);

  try {
    const profileRes = await db.collection(PROFILE_COLLECTION)
      .where({ phone: normalizedPhone })
      .limit(1)
      .get();

    let profileDoc = profileRes.data && profileRes.data.length ? profileRes.data[0] : null;

    if (!profileDoc) {
      if (normalizedPassword !== '6666') {
        return { code: -1, message: '账号不存在或密码错误' };
      }

      const now = db.serverDate();
      const defaultProfile = {
        phone: normalizedPhone,
        name: '',
        gender: '保密',
        birthday: '',
        address: '',
        avatar: '',
        password: '6666',
        client_openid: OPENID,
        created_at: now,
        updated_at: now
      };

      const addRes = await db.collection(PROFILE_COLLECTION).add({ data: defaultProfile });
      const fetchNew = await db.collection(PROFILE_COLLECTION).doc(addRes._id).get();
      profileDoc = fetchNew.data;
    }

    const storedPassword = profileDoc.password || '6666';
    if (storedPassword !== normalizedPassword) {
      return { code: -1, message: '账号不存在或密码错误' };
    }

    const updates = {
      client_openid: OPENID,
      last_login_at: db.serverDate(),
      phone: normalizedPhone
    };

    if (!profileDoc.password) {
      updates.password = '6666';
    }

    // 若手机号存量数据使用 _openid 保存身份，也同步
    if (!profileDoc._openid || profileDoc._openid !== OPENID) {
      updates.bound_openids = _.addToSet(OPENID);
    }

    await db.collection(PROFILE_COLLECTION).doc(profileDoc._id).update({
      data: updates
    });

    const { profile } = await fetchProfileSummary(OPENID);

    const token = `CLIENT_${OPENID}_${Date.now()}`;

    return {
      code: 0,
      data: {
        token,
        openid: OPENID,
        profile: profile || null
      }
    };
  } catch (error) {
    console.error('clientAuth error', error);
    return { code: -1, message: error.message || '登录失败', error };
  }
};
