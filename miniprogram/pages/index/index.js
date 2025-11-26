// pages/index/index.js
const app = getApp();
const db = wx.cloud.database(); // 获取数据库引用

Page({
  data: {
    banners: [],
    notice: '',
    // 固定的服务网格数据
    // 你需要将 icon 路径替换为你的图片
    serviceGrid: [
      { name: '全屋清洁', icon: '/packageCommon/images/icon_move.png', bgColor: '#EEFCFF', serviceId: 'a235246468f875370029b2476ea6131c' },
      { name: '洗玻璃', icon: '/packageCommon/images/icon_glass.png', bgColor: '#ECF5FF', serviceId: 'a235246468f875370029b2476ea6134c' },
      { name: '开荒保洁', icon: '/packageCommon/images/icon_clean.png', bgColor: '#F4F0FF', serviceId: 'a235246468f875370029b2476ea6132c' },
      { name: '铲墙皮', icon: '/packageCommon/images/icon_wall.png', bgColor: '#FEF6EC', serviceId: 'a235246468f875370029b2476ea6135c' },
      { name: '油烟机清洗', icon: '/packageCommon/images/icon_hood.png', bgColor: '#EEFAF3', serviceId: 'a235246468f875370029b2476ea6133c' },
      // { name: postId:'月嫂服务', icon: '/packageCommon/images/icon_nanny.png', bgColor: '#FFF2F4', serviceId: 'a235246468f875370029b2476ea6136c' },
      // { name: '家电维修', icon: '/packageCommon/images/icon_repair.png', bgColor: '#FEF0F0', serviceId: 'a235246468f875370029b2476ea6137c' },
      // { name: '搬家服务', icon: '/packageCommon/images/icon_move.png', bgColor: '#EEFCFF', serviceId: 'a235246468f875370029b2476ea6138c' }
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

  onLoad: function () {
    this.getHotServices();
  },

  onShow: function () {
    this.loadHomeSettings();
  },

  loadHomeSettings() {
    if (app.globalData.homeSettings) {
      this.setData({
        banners: app.globalData.homeSettings.banners || [],
        notice: app.globalData.homeSettings.notice || ''
      });
    }
    // 注册回调，以便 app.js 更新配置时通知首页
    app.homeSettingsCallback = (settings) => {
      this.setData({
        banners: settings.banners || [],
        notice: settings.notice || ''
      });
    };
  },

  /**
   * 从云数据库加载热门服务
   */
  getHotServices: function () {
    // ** 注意：这里使用 where({ hot: true }) 来筛选热门服务 **
    db.collection('services').where({
      hot: true // 确保您的数据库字段是 hot，且值为 true
    }).limit(3).get({ // 限制只取3条
      success: res => {
        if (res.data && res.data.length > 0) {
          // 这里直接使用数据库返回的数据结构
          this.setData({
            // 将数据库字段名映射到前端 data 字段名（如果需要）
            // 假设前端 wxml 中使用的字段是 name, desc, price, rate, sold
            hotServices: res.data.map(item => ({
              _id: item._id,
              name: item.name,
              // 将数据库的 'desc' 映射到前端可能需要的 'description'，如果 wxml 直接用 item.desc 则不需要映射
              description: item.desc,
              price: item.price,
              rating: item.rate, // 数据库字段为 rate
              sales: item.sold,   // 数据库字段为 sold
              cover: item.cover, // 用于封面图
              unit: item.unit,
            }))
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
   * 点击服务网格
   */
  onGridItemTap: function (e) {
    const serviceId = e.currentTarget.dataset.serviceId;
    if (!serviceId) return;

    // 直接跳转到 booking 页面
    wx.navigateTo({
      url: `/subpackages/packageService/pages/booking/booking?serviceId=${serviceId}`
    });
  },

  /**
   * 点击热门推荐的 "预约"
   */
  onBookNowTap: function (e) {
    const serviceId = e.currentTarget.dataset.serviceId;
    if (!serviceId) return;

    // 直接跳转到 booking 页面
    wx.navigateTo({
      url: `/subpackages/packageService/pages/booking/booking?serviceId=${serviceId}`
    });
  },
  /**
   * 点击 "更多服务"
   */
  onMoreServiceTap: function () {
    wx.switchTab({
      url: '/pages/service-list/service-list'
    });
  },

  /**
   * 点击 "查看全部"
   */
  onViewAllTap: function () {
    wx.switchTab({
      url: '/pages/service-list/service-list'
    });
  }
});