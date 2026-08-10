const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const PROFILE_COLLECTION = 'client_profiles';
const BOOKINGS_COLLECTION = 'bookings';
const DEFAULT_PROFILE = {
  name: '1',
  phone: '138****5678',
  gender: '不愿透露',
  birthday: '',
  address: '',
  avatar: ''
};
const UNIVERSAL_ACCOUNT = '1';
const DEFAULT_PASSWORD = '6666';

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

async function fetchProfileDocByOpenid(openid) {
  const res = await db
    .collection(PROFILE_COLLECTION)
    .where(
      _.or([
        { _openid: openid },
        { client_openid: openid },
        { bound_openids: _.in([openid]) }
      ])
    )
    .limit(1)
    .get();

  return res.data && res.data.length > 0 ? res.data[0] : null;
}

function buildOpenidSet(profileDoc, openid) {
  const openidSet = new Set();
  if (openid) {
    openidSet.add(openid);
  }
  if (profileDoc) {
    if (profileDoc._openid) {
      openidSet.add(profileDoc._openid);
    }
    if (profileDoc.client_openid) {
      openidSet.add(profileDoc.client_openid);
    }
    if (Array.isArray(profileDoc.bound_openids)) {
      profileDoc.bound_openids.forEach((value) => {
        if (value) {
          openidSet.add(value);
        }
      });
    }
  }
  return Array.from(openidSet).filter(Boolean);
}

async function countOrdersByClientId(clientId) {
  if (!clientId) {
    return { historyOrders: 0, completedOrders: 0 };
  }

  const historyMatcher = {
    client_id: clientId
  };

  const completedMatcher = {
    client_id: clientId,
    status: _.in([50, 60]) // 假设50=已评价, 60=已取消(或者根据业务定义完成状态)
    // 注意：这里需要确认"历史订单"和"已完成订单"的定义
    // 历史订单通常指所有订单？还是已完成的？
    // 原逻辑 historyMatcher 是查所有。
  };

  // 修正 completedMatcher: 
  // 原逻辑: status: _.in([50, 60])

  let historyOrders = 0;
  let completedOrders = 0;

  try {
    const historyRes = await db.collection(BOOKINGS_COLLECTION).where(historyMatcher).count();
    historyOrders = historyRes.total || 0;
  } catch (error) {
    console.warn('count history error', error);
  }

  try {
    const completedRes = await db.collection(BOOKINGS_COLLECTION).where(completedMatcher).count();
    completedOrders = completedRes.total || 0;
  } catch (error) {
    console.warn('count completed error', error);
  }

  return { historyOrders, completedOrders };
}

async function countOrdersByOpenids(openids) {
  if (!openids.length) {
    return { historyOrders: 0, completedOrders: 0 };
  }

  const historyMatcher = _.or([
    { client_openid: _.in(openids) },
    { _openid: _.in(openids) }
  ]);

  const completedMatcher = _.or([
    { client_openid: _.in(openids), status: _.in([50, 60]) },
    { _openid: _.in(openids), status: _.in([50, 60]) }
  ]);

  let historyOrders = 0;
  let completedOrders = 0;

  try {
    const historyRes = await db.collection(BOOKINGS_COLLECTION).where(historyMatcher).count();
    historyOrders = historyRes.total || 0;
  } catch (error) {
    if (!error || error.errCode !== -502005) {
      throw error;
    }
  }

  try {
    const completedRes = await db.collection(BOOKINGS_COLLECTION).where(completedMatcher).count();
    completedOrders = completedRes.total || 0;
  } catch (error) {
    if (!error || error.errCode !== -502005) {
      throw error;
    }
  }

  return { historyOrders, completedOrders };
}

function sanitizeProfile(profileDoc, counters = {}) {
  const { historyOrders = 0, completedOrders = 0 } = counters;
  if (!profileDoc) {
    return {
      ...DEFAULT_PROFILE,
      historyOrders,
      completedOrders
    };
  }

  const {
    password,
    alias_accounts,
    bound_openids,
    ...rest
  } = profileDoc;

  return {
    ...DEFAULT_PROFILE,
    ...rest,
    historyOrders,
    completedOrders
  };
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();

  if (!OPENID) {
    return { code: -1, message: '用户未登录' };
  }

  const action = event.action || 'get';

  const normalizePhone = (value = '') => String(value).replace(/\s+/g, '').trim();
  const isMobile = (value = '') => /^1\d{10}$/.test(value);

  try {
    await ensureCollection(PROFILE_COLLECTION);

    // Action: login (账号密码登录)
    if (action === 'login') {
      const account = String(event.account || event.phone || '').trim();
      const password = String(event.password || '').trim();

      if (!account) {
        return { code: -1, message: '请输入账号' };
      }
      if (!password) {
        return { code: -1, message: '请输入密码' };
      }

      const isUniversal = account === UNIVERSAL_ACCOUNT;
      if (!isUniversal && !/^1\d{10}$/.test(account)) {
        return { code: -1, message: '请输入11位手机号或万能账号' };
      }

      const collection = db.collection(PROFILE_COLLECTION);
      let profileDoc = null;

      if (isUniversal) {
        const universalRes = await collection
          .where({ alias_accounts: _.in([UNIVERSAL_ACCOUNT]) })
          .limit(1)
          .get();

        if (universalRes.data && universalRes.data.length > 0) {
          profileDoc = universalRes.data[0];
        }

        if (!profileDoc) {
          const now = db.serverDate();
          const baseDoc = {
            name: '',
            phone: '',
            gender: '不愿透露',
            birthday: '',
            address: '',
            avatar: '',
            password: DEFAULT_PASSWORD,
            alias_accounts: [UNIVERSAL_ACCOUNT],
            bound_openids: [OPENID],
            client_openid: OPENID,
            created_at: now,
            updated_at: now
          };

          const addRes = await collection.add({ data: baseDoc });
          const fetchRes = await collection.doc(addRes._id).get();
          profileDoc = fetchRes.data;
        }
      } else {
        const profileRes = await collection.where({ phone: account }).limit(1).get();
        if (profileRes.data && profileRes.data.length > 0) {
          profileDoc = profileRes.data[0];
        } else {
          if (password !== DEFAULT_PASSWORD) {
            return { code: -1, message: '账号不存在或密码错误' };
          }

          const now = db.serverDate();
          const baseDoc = {
            name: '',
            phone: account,
            gender: '不愿透露',
            birthday: '',
            address: '',
            avatar: '',
            password: DEFAULT_PASSWORD,
            alias_accounts: [],
            bound_openids: [OPENID],
            client_openid: OPENID,
            created_at: now,
            updated_at: now
          };

          const addRes = await collection.add({ data: baseDoc });
          const fetchRes = await collection.doc(addRes._id).get();
          profileDoc = fetchRes.data;
        }
      }

      if (!profileDoc) {
        return { code: -1, message: '账号不存在或密码错误' };
      }

      const storedPassword = profileDoc.password || DEFAULT_PASSWORD;
      if (storedPassword !== password) {
        return { code: -1, message: '账号不存在或密码错误' };
      }

      const aliasSet = new Set(Array.isArray(profileDoc.alias_accounts) ? profileDoc.alias_accounts : []);
      if (isUniversal) {
        aliasSet.add(UNIVERSAL_ACCOUNT);
      }
      const boundSet = new Set(Array.isArray(profileDoc.bound_openids) ? profileDoc.bound_openids : []);
      boundSet.add(OPENID);

      await collection.doc(profileDoc._id).update({
        data: {
          client_openid: OPENID,
          updated_at: db.serverDate(),
          alias_accounts: Array.from(aliasSet),
          bound_openids: Array.from(boundSet)
        }
      });

      const latestRes = await collection.doc(profileDoc._id).get();
      const latestDoc = latestRes.data || profileDoc;

      // 【关键修改】使用 clientId 统计订单
      const counters = await countOrdersByClientId(latestDoc._id);
      const profile = sanitizeProfile(latestDoc, counters);

      // 【关键修改】添加client_id
      profile.id = latestDoc._id;

      return {
        code: 0,
        data: {
          token: `CLIENT_${OPENID}_${Date.now()}`,
          openid: OPENID,
          profile
        }
      };
    }

    // Action: wechatPhoneLogin (微信手机号登录)
    if (action === 'wechatPhoneLogin') {
      const phone = normalizePhone(event.phone || event.phoneNumber || '');

      if (!phone) {
        return { code: -1, message: '手机号不能为空' };
      }

      if (!isMobile(phone)) {
        return { code: -1, message: '手机号格式错误' };
      }

      const collection = db.collection(PROFILE_COLLECTION);

      let profileDoc = null;
      const profileRes = await collection.where({ phone }).limit(1).get();
      if (profileRes.data && profileRes.data.length > 0) {
        profileDoc = profileRes.data[0];
      } else {
        const now = db.serverDate();
        const defaultName = `用户${phone.slice(-4)}`; // 【关键修改】默认昵称
        const baseDoc = {
          ...DEFAULT_PROFILE,
          name: defaultName,
          phone,
          alias_accounts: [],
          bound_openids: [OPENID],
          client_openid: OPENID,
          created_at: now,
          updated_at: now
        };

        const addRes = await collection.add({ data: baseDoc });
        const fetchRes = await collection.doc(addRes._id).get();
        profileDoc = fetchRes.data;
      }

      if (!profileDoc) {
        return { code: -1, message: '登录失败，请稍后重试' };
      }

      const aliasSet = new Set(Array.isArray(profileDoc.alias_accounts) ? profileDoc.alias_accounts : []);
      const boundSet = new Set(Array.isArray(profileDoc.bound_openids) ? profileDoc.bound_openids : []);
      boundSet.add(OPENID);

      await collection.doc(profileDoc._id).update({
        data: {
          phone,
          client_openid: OPENID,
          updated_at: db.serverDate(),
          alias_accounts: Array.from(aliasSet),
          bound_openids: Array.from(boundSet)
        }
      });

      const latestRes = await collection.doc(profileDoc._id).get();
      const latestDoc = latestRes.data || profileDoc;

      // 【关键修改】使用 clientId 统计订单
      const counters = await countOrdersByClientId(latestDoc._id);
      const profile = sanitizeProfile(latestDoc, counters);

      // 【关键修改】添加client_id
      profile.id = latestDoc._id;

      return {
        code: 0,
        data: {
          token: `CLIENT_${OPENID}_${Date.now()}`,
          openid: OPENID,
          profile
        }
      };
    }

    // Default action: get profile
    // 【关键修改】优先使用 clientId 查询，解决测试环境 OPENID 相同导致的数据串号问题
    let profileDoc = null;
    if (event.clientId) {
      const res = await db.collection(PROFILE_COLLECTION).doc(event.clientId).get();
      profileDoc = res.data;
    } else {
      profileDoc = await fetchProfileDocByOpenid(OPENID);
    }

    // 【关键修改】使用 clientId 统计订单
    let counters = { historyOrders: 0, completedOrders: 0 };
    if (profileDoc && profileDoc._id) {
      counters = await countOrdersByClientId(profileDoc._id);
    } else {
      counters = await countOrdersByOpenids(buildOpenidSet(profileDoc, OPENID));
    }

    const profile = sanitizeProfile(profileDoc, counters);

    // 确保返回 id
    if (profileDoc) {
      profile.id = profileDoc._id;
    }

    return {
      code: 0,
      data: profile
    };
  } catch (error) {
    console.error('getClientProfile error', error);
    return { code: -1, message: error.message || '查询失败', error };
  }
};
