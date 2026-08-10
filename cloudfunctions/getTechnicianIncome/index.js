const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const COLLECTION = 'bookings';

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

function extractMonthKey(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  return `${year}-${month}`;
}

function formatMonthLabel(monthKey) {
  if (!monthKey) return '';
  const [year, month] = monthKey.split('-');
  if (!year || !month) return monthKey;
  return `${year}年${month}月`;
}

function safeAmount(value) {
  if (typeof value === 'number') {
    return value >= 0 ? value : 0;
  }
  const parsed = parseFloat(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

function buildDescription(order) {
  const serviceName = order.service_name || '家政服务';
  const orderId = order._id || '';
  const shortId = orderId ? orderId.slice(-6).toUpperCase() : '';
  return shortId ? `${serviceName} (订单: ${shortId})` : serviceName;
}

exports.main = async (event = {}) => {
  const masterId = event.masterId; // 直接从前端获取
  const requestedMonth = event.month || 'all';

  if (!masterId) {
    return { code: -1, message: '缺少师傅ID' };
  }

  try {
    // 查询收入订单（使用master_id）
    const res = await db.collection(COLLECTION)
      .where({
        master_id: masterId,
        status: _.in([50, 60]),
        paid_at: _.exists(true)
      })
      .orderBy('paid_at', 'desc')
      .limit(200)
      .get();

    const orders = res.data || [];

    const now = new Date();
    const currentMonthKey = extractMonthKey(now);
    let totalIncome = 0;
    let monthIncome = 0;
    const monthSet = new Set();

    const enrichedOrders = orders.map((order) => {
      const amount = safeAmount(order.final_price);
      const paidAt = order.paid_at || order.completed_at || order.updated_at || order.created_at;
      const monthKey = extractMonthKey(paidAt);
      if (monthKey) {
        monthSet.add(monthKey);
      }
      totalIncome += amount;
      if (monthKey === currentMonthKey) {
        monthIncome += amount;
      }
      return {
        ...order,
        _computed: {
          amount,
          monthKey,
          paidAt,
          description: buildDescription(order),
          displayTime: formatDateTime(paidAt),
          amountText: `+${amount.toFixed(2)}`
        }
      };
    });

    const sortedMonths = Array.from(monthSet).filter(Boolean).sort((a, b) => (a > b ? -1 : 1));
    const monthOptions = [
      { label: '全部', value: 'all' },
      ...sortedMonths.map((key) => ({ label: formatMonthLabel(key), value: key }))
    ];

    const monthValues = new Set(monthOptions.map((item) => item.value));
    const effectiveMonth = monthValues.has(requestedMonth) ? requestedMonth : 'all';

    const filteredRecords = enrichedOrders
      .filter((order) => effectiveMonth === 'all' || order._computed.monthKey === effectiveMonth)
      .map((order) => ({
        id: order._id,
        orderId: order._id,
        description: order._computed.description,
        time: order._computed.displayTime,
        amountText: order._computed.amountText,
        amount: order._computed.amount,
        type: 'income',
        statusText: '已入账'
      }));

    return {
      code: 0,
      message: 'success',
      data: {
        summary: {
          totalIncome: totalIncome.toFixed(2),
          monthIncome: monthIncome.toFixed(2),
          completedOrders: orders.length
        },
        monthOptions,
        records: filteredRecords,
        selectedMonth: effectiveMonth
      }
    };
  } catch (error) {
    console.error('getTechnicianIncome error', error);
    return { code: -1, message: error.message || '获取收入失败', error };
  }
};
