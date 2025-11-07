const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const COLLECTION = 'client_addresses';

async function ensureCollection() {
  try {
    await db.createCollection(COLLECTION);
  } catch (error) {
    const ignoreCodes = new Set([-502006, -501001, -502005]);
    if (!(error && ignoreCodes.has(error.errCode))) {
      throw error;
    }
  }
}

async function listAddresses(openid) {
  await ensureCollection();
  const matcher = _.or([
    { _openid: openid },
    { client_openid: openid }
  ]);
  const res = await db.collection(COLLECTION)
    .where(matcher)
    .orderBy('is_default', 'desc')
    .orderBy('updated_at', 'desc')
    .get();
  return res.data || [];
}

async function saveAddress(openid, payload = {}) {
  const {
    id,
    contact_name,
    contact_phone,
    address,
    tag = '',
    is_default = false
  } = payload;

  if (!contact_name || !String(contact_name).trim()) {
    return { code: -1, message: '请填写联系人姓名' };
  }

  if (!/^\d{11}$/.test(String(contact_phone || '').trim())) {
    return { code: -1, message: '请输入11位手机号' };
  }

  if (!address || !String(address).trim()) {
    return { code: -1, message: '请填写详细地址' };
  }

  await ensureCollection();

  const normalized = {
    contact_name: String(contact_name).trim(),
    contact_phone: String(contact_phone).trim(),
    address: String(address).trim(),
    tag: String(tag || '').trim(),
    is_default: Boolean(is_default),
    updated_at: db.serverDate(),
    client_openid: openid
  };

  let docId = id;

  if (id) {
    const updateRes = await db.collection(COLLECTION)
      .where({ _id: id, _openid: openid })
      .update({ data: normalized });

    if (!updateRes.stats || updateRes.stats.updated === 0) {
      return { code: -1, message: '地址不存在或无权限修改' };
    }
  } else {
    const addRes = await db.collection(COLLECTION).add({
      data: {
        ...normalized,
        created_at: db.serverDate()
      }
    });
    docId = addRes._id;
  }

  if (normalized.is_default) {
    await db.collection(COLLECTION)
      .where({
        _openid: openid,
        _id: _.neq(docId)
      })
      .update({ data: { is_default: false } });
  }

  return { code: 0, message: 'success', data: { id: docId } };
}

async function deleteAddress(openid, id) {
  if (!id) {
    return { code: -1, message: '地址ID缺失' };
  }
  await ensureCollection();
  const res = await db.collection(COLLECTION)
    .where({ _id: id, _openid: openid })
    .remove();
  if (!res.stats || res.stats.removed === 0) {
    return { code: -1, message: '地址不存在或已删除' };
  }
  return { code: 0, message: 'success' };
}

async function setDefault(openid, id) {
  if (!id) {
    return { code: -1, message: '地址ID缺失' };
  }
  await ensureCollection();
  const res = await db.collection(COLLECTION)
    .where({ _id: id, _openid: openid })
    .update({ data: { is_default: true, updated_at: db.serverDate() } });

  if (!res.stats || res.stats.updated === 0) {
    return { code: -1, message: '地址不存在或无法设置默认' };
  }

  await db.collection(COLLECTION)
    .where({
      _openid: openid,
      _id: _.neq(id)
    })
    .update({ data: { is_default: false } });

  return { code: 0, message: 'success' };
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();

  if (!OPENID) {
    return { code: -1, message: '未登录' };
  }

  const action = event.action || 'list';

  try {
    switch (action) {
      case 'list': {
        const list = await listAddresses(OPENID);
        return { code: 0, data: list };
      }
      case 'save':
        return await saveAddress(OPENID, event.data || {});
      case 'delete':
        return await deleteAddress(OPENID, event.id);
      case 'setDefault':
        return await setDefault(OPENID, event.id);
      default:
        return { code: -1, message: '未知操作' };
    }
  } catch (error) {
    console.error('manageClientAddresses error', error);
    return { code: -1, message: error.message || '操作失败', error };
  }
};
