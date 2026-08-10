const app = getApp();

const DEFAULT_SUMMARY = {
  totalIncome: '0.00',
  monthIncome: '0.00',
  completedOrders: 0
};

function normalizeRecords(records = []) {
  return records.map((item) => ({
    id: item.id,
    description: item.description || '家政服务',
    time: item.time || '',
    amountText: item.amountText || '+0.00',
    type: item.type || 'income',
    statusText: item.statusText || '已入账'
  }));
}

Page({
  data: {
    summary: { ...DEFAULT_SUMMARY },
    monthRange: [],
    monthOptions: [],
    activeMonthIndex: 0,
    loading: false,
    incomeDetails: []
  },

  onLoad() {
    this.fetchIncomeData('all');
  },

  async fetchIncomeData(monthValue = 'all') {
    this.setData({ loading: true, incomeDetails: [] });

    try {
      const masterId = wx.getStorageSync('master_id');
      const clientCloud = await app.waitClientCloudReady();

      const res = await clientCloud.callFunction({
        name: 'getTechnicianIncome',
        data: {
          masterId: masterId,
          month: monthValue
        }
      });

      const result = res && res.result;
      if (!result || result.code !== 0) {
        throw new Error((result && result.message) || '获取收入失败');
      }

      const payload = result.data || {};
      const monthOptions = payload.monthOptions || [];
      const monthRange = monthOptions.map(option => option.label);
      const selectedValue = payload.selectedMonth || 'all';
      const activeIndex = Math.max(0, monthOptions.findIndex(option => option.value === selectedValue));

      this.setData({
        summary: { ...DEFAULT_SUMMARY, ...(payload.summary || {}) },
        monthOptions,
        monthRange,
        activeMonthIndex: activeIndex,
        incomeDetails: normalizeRecords(payload.records || []),
        loading: false
      });
    } catch (error) {
      console.error('加载收入信息失败', error);
      this.setData({ loading: false });
      const message = error && error.message ? error.message : '收入加载失败';
      wx.showToast({ title: message.length > 14 ? '收入加载失败' : message, icon: 'none' });
    }
  },

  onMonthChange(e) {
    const index = Number(e.detail.value);
    const option = this.data.monthOptions[index];
    if (!option) return;
    this.setData({ activeMonthIndex: index });
    this.fetchIncomeData(option.value);
  },

  goToWithdraw() {
    wx.showToast({ title: '跳转到提现页面...', icon: 'none' });
  }
});
