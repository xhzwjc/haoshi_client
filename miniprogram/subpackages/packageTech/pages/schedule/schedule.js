const app = getApp();
const db = wx.cloud.database();
const _ = db.command;

const WEEK_NAMES = ['日', '一', '二', '三', '四', '五', '六'];
const STATUS_OPTIONS = {
  0: { label: '休息', desc: '不接任何新单' },
  1: { label: '可接单', desc: '正常派单' },
  2: { label: '忙碌', desc: '仅接重点订单' }
};

function pad(num) {
  return num < 10 ? `0${num}` : `${num}`;
}

function formatDateKey(date) {
  const target = date instanceof Date ? date : new Date(date);
  const year = target.getFullYear();
  const month = pad(target.getMonth() + 1);
  const day = pad(target.getDate());
  return `${year}-${month}-${day}`;
}

function formatDisplayText(dateKey) {
  if (!dateKey) return '';
  const [year, month, day] = dateKey.split('-');
  return `${year}年${Number(month)}月${Number(day)}日`;
}

function getMonthKey(year, month) {
  return `${year}-${pad(month)}`;
}

Page({
  data: {
    weekNames: WEEK_NAMES,
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth() + 1,
    selectedDate: formatDateKey(new Date()),
    selectedDateText: formatDisplayText(formatDateKey(new Date())),
    calendarDates: [],
    scheduleMap: {},
    scheduleOptions: STATUS_OPTIONS,
    currentStatus: { label: STATUS_OPTIONS[1].label, value: 1 },
    todayOrders: [],
    loading: false
  },

  async onLoad() {
    const today = new Date();
    const dateKey = formatDateKey(today);
    this.setData({
      currentYear: today.getFullYear(),
      currentMonth: today.getMonth() + 1,
      selectedDate: dateKey,
      selectedDateText: formatDisplayText(dateKey)
    });
    this.generateCalendar(today.getFullYear(), today.getMonth() + 1);
    const ensured = await this.ensureScheduleCollection();
    if (!ensured) {
      wx.showToast({ title: '排班数据暂不可用', icon: 'none' });
      return;
    }
    this.loadScheduleData();
  },

  async ensureScheduleCollection() {
    if (this._scheduleCollectionReady) {
      return true;
    }

    try {
      const cloud = await app.waitClientCloudReady();
      await cloud.callFunction({
        name: 'technicianScheduleOps',
        data: { action: 'ensureCollection' }
      });
      this._scheduleCollectionReady = true;
      return true;
    } catch (error) {
      console.warn('ensureScheduleCollection error', error);
      return false;
    }
  },

  ensureTechnicianMasterId() {
    if (this._masterId) {
      return this._masterId;
    }
    const cached = wx.getStorageSync('master_id');
    if (!cached) {
      wx.showToast({ title: '登录信息已失效', icon: 'none' });
      return '';
    }
    this._masterId = cached;
    return cached;
  },

  generateCalendar(year, month) {
    const dates = [];
    const todayKey = formatDateKey(new Date());

    const firstDay = new Date(year, month - 1, 1);
    const firstWeekday = firstDay.getDay();
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();

    const prevMonthDays = new Date(year, month - 1, 0).getDate();
    for (let i = firstWeekday; i > 0; i--) {
      dates.push({ day: prevMonthDays - i + 1, date: '', isCurrentMonth: false });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${year}-${pad(month)}-${pad(day)}`;
      const schedule = this.data.scheduleMap[dateKey] || {};
      dates.push({
        day,
        date: dateKey,
        isCurrentMonth: true,
        isToday: dateKey === todayKey,
        isScheduled: schedule.status === 1 || schedule.status === 2,
        isDayOff: schedule.status === 0,
        hasOrders: !!schedule.hasOrders
      });
    }

    while (dates.length < 42) {
      dates.push({ day: dates.length - daysInMonth - firstWeekday + 1, date: '', isCurrentMonth: false });
    }

    this.setData({ calendarDates: dates });
  },

  prevMonth() {
    let { currentYear, currentMonth } = this.data;
    if (currentMonth === 1) {
      currentYear -= 1;
      currentMonth = 12;
    } else {
      currentMonth -= 1;
    }
    this.setData({ currentYear, currentMonth });
    this.generateCalendar(currentYear, currentMonth);
    this.loadScheduleData();
  },

  nextMonth() {
    let { currentYear, currentMonth } = this.data;
    if (currentMonth === 12) {
      currentYear += 1;
      currentMonth = 1;
    } else {
      currentMonth += 1;
    }
    this.setData({ currentYear, currentMonth });
    this.generateCalendar(currentYear, currentMonth);
    this.loadScheduleData();
  },

  goToToday() {
    const today = new Date();
    const dateKey = formatDateKey(today);
    this.setData({
      currentYear: today.getFullYear(),
      currentMonth: today.getMonth() + 1,
      selectedDate: dateKey,
      selectedDateText: formatDisplayText(dateKey)
    });
    this.generateCalendar(today.getFullYear(), today.getMonth() + 1);
    this.onDateSelect({ currentTarget: { dataset: { date: dateKey } } });
  },

  onDateSelect(e) {
    const dateKey = e.currentTarget.dataset.date;
    if (!dateKey) {
      return;
    }

    const schedule = this.data.scheduleMap[dateKey] || { status: 1 };
    const statusMeta = this.data.scheduleOptions[schedule.status] || this.data.scheduleOptions[1];

    this.setData({
      selectedDate: dateKey,
      selectedDateText: formatDisplayText(dateKey),
      currentStatus: { label: statusMeta.label, value: schedule.status }
    });

    this.loadDayOrders(dateKey);
  },

  async loadScheduleData() {
    const masterId = this.ensureTechnicianMasterId();
    if (!masterId) {
      return;
    }

    const ensured = await this.ensureScheduleCollection();
    if (!ensured) {
      wx.showToast({ title: '排班数据暂不可用', icon: 'none' });
      return;
    }

    const { currentYear, currentMonth } = this.data;
    const monthKey = getMonthKey(currentYear, currentMonth);

    this.setData({ loading: true });

    try {
      const [scheduleRes, monthlyOrders] = await Promise.all([
        db.collection('technician_schedules')
          .where({ master_id: masterId, month_key: monthKey })
          .limit(200)
          .get(),
        this.fetchMonthOrderDates(masterId, currentYear, currentMonth)
      ]);

      const scheduleMap = {};
      (scheduleRes.data || []).forEach((item) => {
        const dateKey = item.date_key || item.date || '';
        if (!dateKey) return;
        scheduleMap[dateKey] = {
          status: typeof item.status === 'number' ? item.status : 1,
          hasOrders: Boolean(item.has_orders)
        };
      });

      monthlyOrders.forEach((dateKey) => {
        if (!scheduleMap[dateKey]) {
          scheduleMap[dateKey] = { status: 1, hasOrders: true };
        } else {
          scheduleMap[dateKey].hasOrders = true;
        }
      });

      this.setData({ scheduleMap }, () => {
        this.generateCalendar(currentYear, currentMonth);
      });

      const selectedDate = this.data.selectedDate || formatDateKey(new Date());
      this.onDateSelect({ currentTarget: { dataset: { date: selectedDate } } });
    } catch (error) {
      console.error('loadScheduleData error', error);
      wx.showToast({ title: '排班加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async fetchMonthOrderDates(masterId, year, month) {
    const startKey = `${year}-${pad(month)}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endKey = `${year}-${pad(month)}-${pad(lastDay)}`;

    try {
      const res = await db.collection('bookings')
        .where({
          master_id: masterId,
          status: _.nin([0, -1]),
          service_date: _.gte(startKey)
        })
        .field({ service_date: true })
        .limit(200)
        .get();

      const set = new Set();
      (res.data || []).forEach((item) => {
        if (!item.service_date) return;
        if (item.service_date >= startKey && item.service_date <= endKey) {
          set.add(item.service_date);
        }
      });
      return Array.from(set);
    } catch (error) {
      console.warn('fetchMonthOrderDates error', error);
      return [];
    }
  },

  async loadDayOrders(dateKey) {
    const masterId = this.ensureTechnicianMasterId();
    if (!masterId || !dateKey) {
      return;
    }

    try {
      const res = await db.collection('bookings')
        .where({
          master_id: masterId,
          service_date: dateKey,
          status: _.nin([0, -1])
        })
        .orderBy('service_time_slot', 'asc')
        .limit(100)
        .get();

      const orders = (res.data || []).map((item) => ({
        _id: item._id,
        time: item.service_time_slot || '待定',
        service: item.service_name || '家政服务',
        status: item.status,
        status_text: this.mapStatusToText(item.status)
      }));

      const updatedMap = {
        ...this.data.scheduleMap,
        [dateKey]: {
          status: (this.data.scheduleMap[dateKey] && this.data.scheduleMap[dateKey].status) || 1,
          hasOrders: orders.length > 0
        }
      };

      this.setData({ todayOrders: orders, scheduleMap: updatedMap }, () => {
        this.generateCalendar(this.data.currentYear, this.data.currentMonth);
      });
    } catch (error) {
      console.error('loadDayOrders error', error);
      this.setData({ todayOrders: [] });
    }
  },

  onStatusChange(e) {
    const newStatus = Number(e.currentTarget.dataset.status);
    if (Number.isNaN(newStatus) || !this.data.scheduleOptions[newStatus]) {
      return;
    }

    if (newStatus === this.data.currentStatus.value) {
      return;
    }

    const dateKey = this.data.selectedDate;
    if (!dateKey) {
      wx.showToast({ title: '请先选择日期', icon: 'none' });
      return;
    }

    const label = this.data.scheduleOptions[newStatus].label;
    wx.showModal({
      title: '确认设置',
      content: `确定将 ${this.data.selectedDateText} 设置为${label}吗？`,
      success: (res) => {
        if (res.confirm) {
          this.updateScheduleStatus(dateKey, newStatus);
        }
      }
    });
  },

  async updateScheduleStatus(dateKey, status) {
    const masterId = this.ensureTechnicianMasterId();
    if (!masterId) {
      return;
    }

    const ensured = await this.ensureScheduleCollection();
    if (!ensured) {
      wx.showToast({ title: '设置失败，请稍后重试', icon: 'none' });
      return;
    }

    const hasOrders = !!(this.data.scheduleMap[dateKey] && this.data.scheduleMap[dateKey].hasOrders);
    const monthKey = dateKey.slice(0, 7);
    const now = db.serverDate();

    try {
      const existing = await db.collection('technician_schedules')
        .where({ master_id: masterId, date_key: dateKey })
        .limit(1)
        .get();

      if (existing.data && existing.data.length) {
        await db.collection('technician_schedules').doc(existing.data[0]._id).update({
          data: {
            status,
            has_orders: hasOrders,
            updated_at: now
          }
        });
      } else {
        await db.collection('technician_schedules').add({
          data: {
            master_id: masterId,
            date_key: dateKey,
            month_key: monthKey,
            status,
            has_orders: hasOrders,
            created_at: now,
            updated_at: now
          }
        });
      }

      const statusMeta = this.data.scheduleOptions[status];
      const scheduleMap = {
        ...this.data.scheduleMap,
        [dateKey]: { status, hasOrders }
      };
      this.setData({
        currentStatus: { label: statusMeta.label, value: status },
        scheduleMap
      }, () => {
        this.generateCalendar(this.data.currentYear, this.data.currentMonth);
      });

      wx.showToast({ title: '设置成功', icon: 'success' });
    } catch (error) {
      console.error('updateScheduleStatus error', error);
      wx.showToast({ title: '设置失败，请稍后重试', icon: 'none' });
    }
  },

  mapStatusToText(status) {
    switch (status) {
      case 10: return '待接单';
      case 20: return '待服务';
      case 30: return '服务中';
      case 35: return '待确认';
      case 40: return '待支付';
      case 45: return '待评价';
      case 50: return '待支付';
      case 60: return '已完成';
      case -1: return '已拒单';
      case 0: return '已取消';
      default: return '处理中';
    }
  }
});
