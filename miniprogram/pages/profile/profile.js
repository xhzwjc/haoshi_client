// pages/profile/profile.js
const app = getApp();

const DEFAULT_PROFILE = {
  name: '张三',
  phone: '138****5678',
  avatar: '',
  gender: '保密',
  birthday: '',
  address: '',
  historyOrders: 0,
  completedOrders: 0
};

Page({
  data: {
    statusBarHeight: 0,
    titleBarHeight: 0,
    userInfo: { ...DEFAULT_PROFILE },
    profileLoaded: false
  },

  onLoad: function () {
    // 获取设备信息以设置自定义导航栏高度
    const systemInfo = wx.getSystemInfoSync();
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      titleBarHeight: menuButtonInfo.height + (menuButtonInfo.top - systemInfo.statusBarHeight) * 2
    });
  },

  onShow() {
    this.loadProfileData();
  },

  /**
   * 加载用户数据
   * 推荐使用云函数
   */
  async loadProfileData() {
    try {
      const cached = wx.getStorageSync('client_profile_cache');
      if (cached) {
        this.setData({ userInfo: { ...DEFAULT_PROFILE, ...cached }, profileLoaded: true });
      }
    } catch (err) {
      console.warn('读取缓存失败', err);
    }

    try {
      const clientCloud = await app.waitClientCloudReady();
      const res = await clientCloud.callFunction({
        name: 'getClientProfile'
      });

      if (res.result && res.result.code === 0) {
        const profile = { ...DEFAULT_PROFILE, ...(res.result.data || {}) };
        this.setData({ userInfo: profile, profileLoaded: true });
        wx.setStorageSync('client_profile_cache', profile);
      } else {
        console.warn('getClientProfile 调用失败', res.result);
      }
    } catch (err) {
      console.error('加载个人资料失败', err);
      if (!this.data.profileLoaded) {
        wx.showToast({ title: '个人信息加载失败', icon: 'none' });
      }
    }
  },

  contactCustomerService() {
    wx.makePhoneCall({
      phoneNumber: '400-123-4567'
    });
  },

  submitFeedback() {
    wx.navigateTo({
      url: '/subpackages/packageProfile/pages/feedback/feedback'
    });
  },

  goToSettings() {
    wx.navigateTo({
      url: '/subpackages/packageProfile/pages/settings/settings'
    });
  },

  goToPersonalInfo() {
    wx.navigateTo({
      url: '/subpackages/packageProfile/pages/personal-info/personal-info'
    });
  },

  onEditProfile() {
    this.goToPersonalInfo();
  },

  goToAddressManage() {
    wx.navigateTo({
      url: '/subpackages/packageProfile/pages/address-list/address-list'
    });
  }
});