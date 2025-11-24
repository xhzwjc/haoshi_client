const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const agg = db.command.aggregate;

const COLLECTION = 'service_reviews';
const DEFAULT_AVATAR = '/packageCommon/images/default_avatar.png';

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

function pad(num) {
  return num < 10 ? `0${num}` : `${num}`;
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function maskPhone(phone) {
  if (!phone) return '匿名客户';
  const str = phone.toString();
  if (str.length !== 11) {
    return `${str.substr(0, 3)}****`;
  }
  return `${str.substr(0, 3)}****${str.substr(7)}`;
}

function buildNickname(doc) {
  if (doc.client_name && doc.client_name.trim()) {
    return doc.client_name.trim();
  }
  if (doc.client_phone) {
    return maskPhone(doc.client_phone);
  }
  return '匿名客户';
}

function normalizeRatingValue(value) {
  const num = Number(value);
  if (Number.isNaN(num)) {
    return 0;
  }
  if (num < 0) return 0;
  if (num > 5) return 5;
  return Math.round(num);
}

function formatReview(doc) {
  const score = normalizeRatingValue(doc.rating);
  return {
    id: doc._id,
    avatar: doc.client_avatar || DEFAULT_AVATAR,
    nickname: buildNickname(doc),
    score,
    time: formatDateTime(doc.created_at),
    content: doc.comment || '',
    serviceName: doc.service_name || '家政服务',
    orderId: doc.order_id || doc._id,
    reply: doc.reply || ''
  };
}

exports.main = async (event = {}) => {
  const masterId = event.masterId; // 直接从前端获取

  if (!masterId) {
    return { code: -1, message: '缺少师傅ID' };
  }

  const type = event.type || 'all';
  const page = Number(event.page) > 0 ? Number(event.page) : 1;
  const pageSize = Number(event.pageSize) > 0 ? Math.min(Number(event.pageSize), 50) : 20;
  const skip = (page - 1) * pageSize;

  try {
    await ensureCollection();

    const masterIdStr = masterId.toString();

    // 使用master_id查询评价
    const baseMatch = { technician_id: masterIdStr };
    if (type === 'good') {
      baseMatch.rating = _.gte(4);
    } else if (type === 'neutral') {
      baseMatch.rating = 3;
    } else if (type === 'bad') {
      baseMatch.rating = _.lte(2);
    }

    const listPromise = db.collection(COLLECTION)
      .where(baseMatch)
      .orderBy('created_at', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();

    const summaryPromise = db.collection(COLLECTION)
      .aggregate()
      .match({ technician_id: masterIdStr })
      .group({
        _id: null,
        total: agg.sum(1),
        totalScore: agg.sum('$rating'),
        good: agg.sum(agg.cond({
          if: agg.gte(['$rating', 4]),
          then: 1,
          else: 0
        })),
        neutral: agg.sum(agg.cond({
          if: agg.eq(['$rating', 3]),
          then: 1,
          else: 0
        })),
        bad: agg.sum(agg.cond({
          if: agg.lte(['$rating', 2]),
          then: 1,
          else: 0
        }))
      })
      .end();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentGoodPromise = db.collection(COLLECTION)
      .where({
        technician_id: masterIdStr,
        rating: _.gte(4),
        created_at: _.gte(thirtyDaysAgo)
      })
      .count();

    const [listRes, summaryRes, recentGoodRes] = await Promise.all([
      listPromise,
      summaryPromise,
      recentGoodPromise
    ]);

    const documents = listRes.data || [];
    const formattedList = documents.map(formatReview);
    const hasMore = documents.length === pageSize;

    const summaryDoc = summaryRes.list && summaryRes.list.length ? summaryRes.list[0] : null;
    const totalRatings = summaryDoc ? summaryDoc.total : 0;
    const totalScore = summaryDoc ? summaryDoc.totalScore : 0;
    const goodCount = summaryDoc ? summaryDoc.good : 0;
    const neutralCount = summaryDoc ? summaryDoc.neutral : 0;
    const badCount = summaryDoc ? summaryDoc.bad : 0;

    const averageScore = totalRatings > 0 ? (totalScore / totalRatings) : 0;
    const goodRate = totalRatings > 0 ? Math.round((goodCount / totalRatings) * 100) : 0;

    return {
      code: 0,
      message: 'success',
      data: {
        summary: {
          averageScore: averageScore.toFixed(1),
          goodRatingRate: goodRate,
          totalRatings,
          recentGoodRatings: recentGoodRes.total || 0
        },
        counts: {
          all: totalRatings,
          good: goodCount,
          neutral: neutralCount,
          bad: badCount
        },
        list: formattedList,
        hasMore
      }
    };
  } catch (error) {
    console.error('getTechnicianRatings error', error);
    return { code: -1, message: error.message || '获取评价失败', error };
  }
};
