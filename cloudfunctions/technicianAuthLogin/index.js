const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COLLECTION = 'technicians';

function normalizePhone(phone = '') {
  return phone.replace(/\s+/g, '').trim();
}

function ensureMobile(phone) {
  return /^1\d{10}$/.test(phone);
}

async function ensureCollection(name) {
  try {
    await db.collection(name).limit(1).get();
  } catch (error) {
    if (error && error.errCode === -502005) {
      try {
        await db.createCollection(name);
      } catch (createErr) {
        const ignore = new Set([-502006, -501001]);
        if (!ignore.has(createErr.errCode)) {
          throw createErr;
        }
      }
    } else {
      throw error;
    }
  }
}

function sanitizeTechnician(doc = {}) {
  const {
    password,
    password_hash,
    bound_openids,
    ...rest
  } = doc;

  return {
    name: rest.name || '',
    phone: rest.phone || '',
    status: rest.status || 'active',
    rating: rest.rating || 0,
    servedOrders: rest.servedOrders || rest.served_orders || 0,
    avatar: rest.avatar || '',
    badge: rest.badge || '',
    ...rest
  };
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { code: -1, message: '用户未登录' };
  }

  const action = event.action || 'wechatPhoneLogin';
  if (action !== 'wechatPhoneLogin') {
    return { code: -1, message: 'unsupported action' };
  }

  const rawPhone = event.phone || event.phoneNumber || '';
  const phone = normalizePhone(rawPhone);
  if (!phone) {
    return { code: -1, message: '缺少手机号' };
  }
  if (!ensureMobile(phone)) {
    return { code: -1, message: '手机号格式不正确' };
  }

  await ensureCollection(COLLECTION);

  const collection = db.collection(COLLECTION);

  try {
    const existingRes = await collection.where({ phone }).limit(1).get();
    let doc = existingRes.data && existingRes.data.length > 0 ? existingRes.data[0] : null;

    const now = db.serverDate();

    if (!doc) {
      const baseDoc = {
        name: '',
        phone,
        status: 'active',
        rating: 0,
        servedOrders: 0,
        avatar: '',
        badge: '',
        openid: OPENID,
        bound_openids: [OPENID],
        created_at: now,
        updated_at: now,
        last_login_at: now
      };

      const addRes = await collection.add({ data: baseDoc });
      const fetchRes = await collection.doc(addRes._id).get();
      doc = fetchRes.data || { ...baseDoc, _id: addRes._id };
    } else {
      const boundSet = new Set(Array.isArray(doc.bound_openids) ? doc.bound_openids : []);
      boundSet.add(OPENID);
      await collection.doc(doc._id).update({
        data: {
          openid: OPENID,
          updated_at: now,
          last_login_at: now,
          bound_openids: Array.from(boundSet)
        }
      });
      const refresh = await collection.doc(doc._id).get();
      doc = refresh.data || doc;
    }

    return {
      code: 0,
      message: 'success',
      data: {
        token: `TECH_${OPENID}_${Date.now()}`,
        openid: OPENID,
        profile: sanitizeTechnician(doc)
      }
    };
  } catch (error) {
    console.error('technicianAuthLogin error', error);
    return {
      code: -1,
      message: error?.message || '登录失败',
      error
    };
  }
};
