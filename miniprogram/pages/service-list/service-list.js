// pages/service-list/service-list.js
const app = getApp();
const db = wx.cloud.database();

Page({
  data: {
    tabs: [
      { name: '全部' },
      { name: '保洁清洗' },
      { name: '母婴护理' },
      { name: '维修安装' },
      { name: '装修翻新' },
      { name: '搬家服务' },
    ],
    activeTab: 0,
    allServices: [
      // 原型图静态数据占位
      { _id: '1', name: '洗玻璃服务', description: '专业玻璃清洁, 内外双面清洗', price: 80, unit: '次', rating: 4.8, sales: 523, is_hot: true },
      { _id: '2', name: '开荒保洁', description: '新房装修后全面清洁', price: 199, unit: '次', rating: 4.7, sales: 632, is_hot: true },
      { _id: '3', name: '深度保洁', description: '全屋深度清洁服务', price: 299, unit: '次', rating: 4.9, sales: 1250, is_hot: true },
      { _id: '4', name: '铲墙皮', description: '旧墙面铲除翻新', price: 30, unit: '平米', rating: 4.6, sales: 234, is_hot: false },
      { _id: '5', name: '油烟机清洗', description: '深度清洁油烟机内外', price: 120, unit: '台', rating: 4.9, sales: 856, is_hot: true },
      { _id: '6', name: '空调清洗', description: '挂式/柜式空调清洗', price: 100, unit: '台', rating: 4.7, sales: 445, is_hot: false },
      { _id: '7', name: '月嫂服务', description: '专业母婴护理服务', price: 8800, unit: '月', rating: 4.9, sales: 156, is_hot: false },
      { _id: '8', name: '育儿嫂', description: '专业育儿护理', price: 6500, unit: '月', rating: 4.8, sales: 89, is_hot: false },
    ],
    filterdServices: [] // 真正显示的服务列表
  },

  onLoad: function (options) {
    // this.loadAllServices(); // 从数据库加载所有服务
  },

  onShow: function() {
    // **核心导航逻辑**
    // 检查全局标志位
    const bookingInfo = app.globalData.navigateToBookingInfo;
    if (bookingInfo && bookingInfo.serviceId) {
      // 清除标志位，防止重复跳转
      app.globalData.navigateToBookingInfo = null; 
      
      // 跳转到预约页
      wx.navigateTo({
        url: `/pages/booking/booking?serviceId=${bookingInfo.serviceId}`
      });
    }
  },

  /**
   * 加载所有服务
   */
  loadAllServices: function() {
    wx.showLoading({ title: '加载中...' });
    db.collection('services').get({
      success: res => {
        this.setData({
          allServices: res.data,
          filterdServices: res.data // 默认显示全部
        });
        wx.hideLoading();
      },
      fail: err => {
        console.error('加载服务列表失败: ', err);
        wx.hideLoading();
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
    });
  },

  /**
   * 点击Tab
   */
  onTabClick: function(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      activeTab: index
    });
    // todo: 根据 this.data.tabs[index].name 筛选 this.data.allServices
    // 并设置到 this.data.filterdServices
  },

  /**
   * 搜索输入
   */
  onSearchInput: function(e) {
    const keyword = e.detail.value;
    // todo: 实时搜索逻辑
  },

  /**
   * 点击 "立即预约"
   */
  onBookNowTap: function(e) {
    const serviceId = e.currentTarget.dataset.serviceId;
    wx.navigateTo({
      url: `/pages/booking/booking?serviceId=${serviceId}`
    });
  }
});