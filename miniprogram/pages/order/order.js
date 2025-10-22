// pages/order/order.js
// 假设 db 已经通过 app.js 初始化
// const db = wx.cloud.database(); 

Page({
  data: {
    tabs: [
      { name: '全部', status: 'all' },
      { name: '待服务', status: 'pending' },
      { name: '进行中', status: 'running' },
      { name: '已完成', status: 'completed' },
      { name: '已取消', status: 'cancelled' },
    ],
    activeTab: 0,
    allOrders: [ // 静态数据，用于演示
      {
        service_name: '深度保洁套餐',
        order_no: 'ORD20251021001',
        status: 'completed',
        status_text: '已完成',
        address: '京山县城区幸福路123号',
        service_time: '2025-10-18 14:00-16:00',
        master_info: '张师傅 138****5678',
        payment: 299
      },
      {
        service_name: '油烟机清洗',
        order_no: 'ORD20251021002',
        status: 'pending',
        status_text: '待服务',
        address: '京山县城区建设路456号',
        service_time: '2025-10-22 10:00-12:00',
        master_info: '李师傅 139****1234',
        payment: 120
      },
      {
        service_name: '开荒保洁',
        order_no: 'ORD20251021003',
        status: 'running',
        status_text: '服务中',
        address: '京山县新市镇和平路789号',
        service_time: '2025-10-21 08:00-10:00',
        master_info: '王师傅 137****9876',
        payment: 199
      },
      {
        service_name: '洗玻璃服务',
        order_no: 'ORD20251021004',
        status: 'cancelled',
        status_text: '已取消',
        address: '京山县城区幸福路123号',
        service_time: '2025-10-15 14:00-16:00',
        master_info: '', // 取消的订单可能没有师傅信息
        payment: 80
      }
    ],
    filteredOrders: [] // 真正显示的列表
  },

  onLoad: function (options) {
    this.filterOrders(); // 页面加载时，默认显示"全部"
    // this.loadOrders(); // 真实场景应调用此函数
  },

  /**
   * 真实加载订单数据
   * 推荐使用云函数
   */
  loadOrders: function() {
    wx.showLoading({ title: '加载中...' });
    const currentStatus = this.data.tabs[this.data.activeTab].status;
  
    wx.cloud.callFunction({
      name: 'getOrders', // 你创建的云函数名
      data: {
        status: currentStatus // 向云函数传递参数
      }
    }).then(res => {
      wx.hideLoading();
      if (res.result.code === 0) {
        this.setData({
          // 注意：这里不再需要 allOrders 和 filteredOrders 了
          // filteredOrders: res.result.data 
          
          // 为了演示，我还是用旧的逻辑
          allOrders: res.result.data,
        });
        this.filterOrders(); // 假设云函数返回了所有订单，还是在本地过滤
      } else {
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error(err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  },
  
  onTabClick: function(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      activeTab: index
    });
    this.loadOrders();
    this.filterOrders();
  },

  /**
   * 根据当前 activeTab 筛选订单
   */
  filterOrders: function() {
    const currentStatus = this.data.tabs[this.data.activeTab].status;
    if (currentStatus === 'all') {
      this.setData({
        filteredOrders: this.data.allOrders
      });
    } else {
      const filtered = this.data.allOrders.filter(order => order.status === currentStatus);
      this.setData({
        filteredOrders: filtered
      });
    }
  }
});