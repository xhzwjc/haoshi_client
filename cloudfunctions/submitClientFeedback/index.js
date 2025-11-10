const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const COLLECTION = 'client_feedbacks';

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

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { code: -1, message: '未登录' };
  }

  const { type, content, contact = '' } = event;

  if (!content || !String(content).trim()) {
    return { code: -1, message: '反馈内容不能为空' };
  }

  try {
    await ensureCollection(COLLECTION);
    await db.collection(COLLECTION).add({
      data: {
        type: type || '其他',
        content: String(content).trim(),
        contact: String(contact || '').trim(),
        status: 'pending',
        created_at: db.serverDate(),
        updated_at: db.serverDate(),
        user_openid: OPENID
      }
    });

    return { code: 0, message: 'success' };
  } catch (error) {
    console.error('submitClientFeedback error', error);
    return { code: -1, message: error.message || '提交失败', error };
  }
};
