// pages/profile/profile.js
const app = getApp();

Page({
  data: {
    statusBarHeight: 0,
    titleBarHeight: 0,
    userInfo: {
      name: '张三',
      phone: '138****5678',
      coupons: 5,
      favorites: 12,
      historyOrders: 8
    }
  },

  onLoad: function (options) {
    // 获取设备信息以设置自定义导航栏高度
    const systemInfo = wx.getSystemInfoSync();
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      titleBarHeight: menuButtonInfo.height + (menuButtonInfo.top - systemInfo.statusBarHeight) * 2
    });

    // this.loadProfileData(); // 真实场景调用
  },
  
  /**
   * 加载用户数据
   * 推荐使用云函数
   */
  loadProfileData: function() {
    wx.cloud.callFunction({
      name: 'getProfile'
    }).then(res => {
      this.setData({
        userInfo: res.result.data
      });
    }).catch(console.error);
  },

  // 添加联系客服函数
  contactCustomerService: function() {
    wx.makePhoneCall({
    phoneNumber: '400-123-4567'
    })
    },
    
    // 添加意见反馈函数
    submitFeedback: function() {
    wx.openFeedbackShare()
    }
});