// pages/index/index.js
const app = getApp();
const db = wx.cloud.database(); // 获取数据库引用

Page({
  data: {
    // 固定的服务网格数据
    // 你需要将 icon 路径替换为你的图片
    serviceGrid: [
      { name: '洗玻璃', icon: '/images/icon_glass.png', bgColor: '#ECF5FF', serviceId: 'service_glass' },
      { name: '开荒保洁', icon: '/images/icon_clean.png', bgColor: '#F4F0FF', serviceId: 'service_clean' },
      { name: '铲墙皮', icon: '/images/icon_wall.png', bgColor: '#FEF6EC', serviceId: 'service_wall' },
      { name: '油烟机清洗', icon: '/images/icon_hood.png', bgColor: '#EEFAF3', serviceId: 'service_hood' },
      { name: '月嫂服务', icon: '/images/icon_nanny.png', bgColor: '#FFF2F4', serviceId: 'service_nanny' },
      { name: '家电维修', icon: '/images/icon_repair.png', bgColor: '#FEF0F0', serviceId: 'service_repair' },
      { name: '搬家服务', icon: '/images/icon_move.png', bgColor: '#EEFCFF', serviceId: 'service_move' }
      // "更多服务" 在wxml中单独处理
    ],
    // 热门推荐，从数据库动态获取
    hotServices: [
      // 这里是原型图的静态数据，用于占位
      // 真实数据会从 getHotServices() 加载
      {
        _id: '1',
        name: '深度保洁套餐',
        description: '全屋深度清洁, 包含厨卫油污清理',
        price: 299,
        rating: 4.8,
        sales: 1250,
        is_hot: true
      },
      {
        _id: '2',
        name: '油烟机清洗',
        description: '专业设备, 彻底清洁油烟机内外',
        price: 120,
        rating: 4.9,
        sales: 856,
        is_hot: true
      },
      {
        _id: '3',
        name: '开荒保洁',
        description: '新房入住前全面清洁服务',
        price: 199,
        rating: 4.7,
        sales: 632,
        is_hot: true
      }
    ]
  },

  onLoad: function() {
    // this.getHotServices(); // 从云数据库加载热门服务
  },

  /**
   * 从云数据库加载热门服务
   */
  getHotServices: function() {
    db.collection('services').where({
      is_hot: true
    }).limit(3).get({
      success: res => {
        if (res.data && res.data.length > 0) {
          this.setData({
            hotServices: res.data
          });
        }
      },
      fail: err => {
        console.error('获取热门服务失败: ', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
    });
  },

  /**
   * 统一的预约跳转逻辑
   */
  navigateToBooking: function(serviceId) {
    if (!serviceId) return;

    // 1. 设置全局标志位，带上服务ID
    app.globalData.navigateToBookingInfo = {
      serviceId: serviceId
    };

    // 2. 切换到服务列表Tab
    // service-list 页面将在 onShow 时检查这个标志位
    wx.switchTab({
      url: '/pages/service-list/service-list'
    });
  },

  /**
   * 点击服务网格
   */
  onGridItemTap: function(e) {
    const serviceId = e.currentTarget.dataset.serviceId;
    this.navigateToBooking(serviceId);
  },

  /**
   * 点击热门推荐的 "预约"
   */
  onBookNowTap: function(e) {
    const serviceId = e.currentTarget.dataset.serviceId;
    this.navigateToBooking(serviceId);
  },

  /**
   * 点击 "更多服务"
   */
  onMoreServiceTap: function() {
    wx.switchTab({
      url: '/pages/service-list/service-list'
    });
  },

  /**
   * 点击 "查看全部"
   */
  onViewAllTap: function() {
    wx.switchTab({
      url: '/pages/service-list/service-list'
    });
  }
});