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

function ownerMatcher(clientId) {
  return { client_id: clientId };
}

async function listAddresses(clientId) {
  await ensureCollection();
  const matcher = ownerMatcher(clientId);
  const res = await db.collection(COLLECTION)
    .where(matcher)
    .orderBy('is_default', 'desc')
    .orderBy('updated_at', 'desc')
    .get();
  return res.data || [];
}

async function saveAddress(clientId, payload = {}) {
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
    client_id: clientId
  };

  let docId = id;

  if (id) {
    const updateRes = await db.collection(COLLECTION)
      .where(
        _.and([
          { _id: id },
          ownerMatcher(clientId)
        ])
      )
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
      .where(
        _.and([
          ownerMatcher(clientId),
          { _id: _.neq(docId) }
        ])
      )
      .update({ data: { is_default: false } });
  }

  return { code: 0, message: 'success', data: { id: docId } };
}

async function deleteAddress(clientId, id) {
  if (!id) {
    return { code: -1, message: '地址ID缺失' };
  }
  await ensureCollection();
  const res = await db.collection(COLLECTION)
    .where(
      _.and([
        { _id: id },
        ownerMatcher(clientId)
      ])
    )
    .remove();
  if (!res.stats || res.stats.removed === 0) {
    return { code: -1, message: '地址不存在或已删除' };
  }
  return { code: 0, message: 'success' };
}

async function setDefault(clientId, id) {
  if (!id) {
    return { code: -1, message: '地址ID缺失' };
  }
  await ensureCollection();
  const res = await db.collection(COLLECTION)
    .where(
      _.and([
        { _id: id },
        ownerMatcher(clientId)
      ])
    )
    .update({ data: { is_default: true, updated_at: db.serverDate() } });

  if (!res.stats || res.stats.updated === 0) {
    return { code: -1, message: '地址不存在或无法设置默认' };
  }

  await db.collection(COLLECTION)
    .where(
      _.and([
        ownerMatcher(clientId),
        { _id: _.neq(id) }
      ])
    )
    .update({ data: { is_default: false } });

  return { code: 0, message: 'success' };
}

exports.main = async (event = {}) => {
  const clientId = event.clientId;

  if (!clientId) {
    return { code: -1, message: '缺少客户ID' };
  }

  const action = event.action || 'list';

  try {
    switch (action) {
      case 'list': {
        const list = await listAddresses(clientId);
        return { code: 0, data: list };
      }
      case 'save':
        return await saveAddress(clientId, event.data || {});
      case 'delete':
        return await deleteAddress(clientId, event.id);
      case 'setDefault':
        return await setDefault(clientId, event.id);
      default:
        return { code: -1, message: '未知操作' };
    }
  } catch (error) {
    console.error('manageClientAddresses error', error);
    return { code: -1, message: error.message || '操作失败', error };
  }
};
