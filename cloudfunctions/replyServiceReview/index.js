const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const COLLECTION = 'service_reviews';
const IGNORE_CODES = new Set([-502006, -501001, -502005]);

async function ensureCollection() {
  try {
    await db.createCollection(COLLECTION);
  } catch (error) {
    if (!error || !IGNORE_CODES.has(error.errCode)) {
      throw error;
    }
  }
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { code: -1, message: '未登录' };
  }

  const reviewId = event.reviewId || event.id || '';
  const reply = typeof event.reply === 'string' ? event.reply.trim() : '';

  if (!reviewId) {
    return { code: -1, message: '缺少评价ID' };
  }
  if (!reply) {
    return { code: -1, message: '回复内容不能为空' };
  }

  try {
    await ensureCollection();

    const reviewRes = await db.collection(COLLECTION).doc(reviewId).get();
    const review = reviewRes.data;
    if (!review) {
      return { code: -1, message: '评价不存在或已删除' };
    }

    const targetTechnician = review.technician_openid || '';
    if (targetTechnician && targetTechnician !== OPENID) {
      return { code: -1, message: '无权限回复该评价' };
    }

    const now = db.serverDate();
    const updateRes = await db.collection(COLLECTION).doc(reviewId).update({
      data: {
        reply,
        reply_at: now,
        updated_at: now
      }
    });

    if (!updateRes.stats || updateRes.stats.updated === 0) {
      return { code: -1, message: '回复失败，请稍后重试' };
    }

    return {
      code: 0,
      message: 'success',
      data: {
        reply,
        replyAt: now
      }
    };
  } catch (error) {
    console.error('replyServiceReview error', error);
    return { code: -1, message: error?.message || '回复失败', error };
  }
};
