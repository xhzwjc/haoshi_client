// pages/income/income.js
Page({
  data: {
      // 模拟数据
      summary: {
          totalIncome: '98,765.00',
          monthIncome: '12,580.00',
          completedOrders: 56
      },
      monthRange: ['2025年10月', '2025年9月', '2025年8月', '历史记录'],
      activeMonthIndex: 0,
      loading: false,
      
      incomeDetails: [ // 模拟明细数据
          { id: 1, description: '深度保洁 (订单: 1234)', time: '10-25 15:30', amount: 299.00, amountText: '+299.00', type: 'income', status: 'completed', statusText: '已入账' },
          { id: 2, description: '提现至银行卡', time: '10-24 10:00', amount: -500.00, amountText: '-500.00', type: 'expense', status: 'pending', statusText: '处理中' },
          { id: 3, description: '洗衣机清洗 (订单: 1235)', time: '10-23 09:00', amount: 150.00, amountText: '+150.00', type: 'income', status: 'completed', statusText: '已入账' }
      ]
  },

  onLoad: function (options) {
      this.loadIncomeSummary();
      this.loadIncomeDetails(this.data.monthRange[this.data.activeMonthIndex]);
  },

  loadIncomeSummary: function() {
      // Call cloud function to get summary (total/month/orders)
      // wx.cloud.callFunction({ name: 'getIncomeSummary' }).then(...)
      // Assume mock data is sufficient for now
  },

  loadIncomeDetails: function(month) {
      this.setData({ loading: true, incomeDetails: [] });
      
      // 1. Call cloud function to get transaction details for the month
      // wx.cloud.callFunction({ name: 'getIncomeDetails', data: { month: month } }).then(...)
      
      // 2. Mock delay and data
      setTimeout(() => {
           // Mock data filtering based on 'month'
          const mockData = month === '2025年10月' ? [
               { id: 1, description: '深度保洁 (订单: 1234)', time: '10-25 15:30', amount: 299.00, amountText: '+299.00', type: 'income', status: 'completed', statusText: '已入账' },
               { id: 2, description: '提现至银行卡', time: '10-24 10:00', amount: -500.00, amountText: '-500.00', type: 'expense', status: 'pending', statusText: '处理中' },
               { id: 3, description: '洗衣机清洗 (订单: 1235)', time: '10-23 09:00', amount: 150.00, amountText: '+150.00', type: 'income', status: 'completed', statusText: '已入账' }
          ] : (month === '2025年9月' ? [{ id: 4, description: '9月收入结算', time: '09-30 18:00', amount: 9800.00, amountText: '+9,800.00', type: 'income', status: 'completed', statusText: '已入账' }] : []);
          
          this.setData({
              incomeDetails: mockData,
              loading: false
          });
      }, 800);
  },
  
  onMonthChange: function(e) {
      const index = e.detail.value;
      this.setData({ activeMonthIndex: index });
      this.loadIncomeDetails(this.data.monthRange[index]);
  },

  goToWithdraw: function() {
      wx.showToast({ title: '跳转到提现页面...', icon: 'none' });
      // wx.navigateTo({ url: '/pages/withdraw/withdraw' });
  }
});