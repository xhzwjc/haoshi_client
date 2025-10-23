// pages/order/order.js
const db = wx.cloud.database();
const _ = db.command; // 引入数据库操作符

Page({
  data: {
    tabs: [
      { name: '全部', status: 'all' },
      { name: '待支付', status: 'pending' },
      { name: '待服务', status: 'paid' },
      { name: '进行中', status: 'running' },
      { name: '已完成', status: 'completed' },
      { name: '已取消', status: 'cancelled' },
    ],
    activeTab: 0,
    filteredOrders: [], // 存储查询和格式化后的订单列表
    loading: false,     // 加载状态
  },

  onLoad: function (options) {
    // 检查是否有传入状态参数（例如从其他页面跳转过来）
    const initialStatus = options.status;
    let initialIndex = 0;
    if (initialStatus) {
      initialIndex = this.data.tabs.findIndex(tab => tab.status === initialStatus) || 0;
    }
    
    this.setData({
      activeTab: initialIndex
    }, () => {
      this.loadOrders(); // 页面加载时，根据初始Tab加载数据
    });
  },

  onShow: function() {
    // 考虑到用户可能从详情页返回，或者数据状态发生变化，建议在 onShow 刷新数据
    // this.loadOrders(); 
    // 为了性能考虑，如果您确定订单数据不常变，可以不在这里调用
  },
  
  onTabClick: function(e) {
    const index = e.currentTarget.dataset.index;
    if (this.data.activeTab === index) return;

    this.setData({
      activeTab: index
    }, () => {
      this.loadOrders(); // 切换 Tab 后加载新数据
    });
  },

  /**
   * 真实加载订单数据 (使用数据库查询)
   */
  loadOrders: function() {
    this.setData({ loading: true });
    const currentStatus = this.data.tabs[this.data.activeTab].status;
    
    let condition = {};
    if (currentStatus !== 'all') {
      // 如果不是“全部”，则根据状态查询
      condition.status = currentStatus;
    } 
    
    db.collection('bookings')
      .where(condition)
      .orderBy('created_at', 'desc') // 按创建时间倒序排列
      .get()
      .then(res => {
        const rawOrders = res.data || [];
        
        // 格式化数据，使 WXML 可以直接使用
        const formattedOrders = rawOrders.map(order => {
          const payment = parseFloat(order.total_fee) || 0; // 假设 total_fee 是实际付款金额
          
          // 状态显示逻辑（可根据实际项目状态进行调整）
          let statusText = '未知';
          if (order.status === 'pending') statusText = '待支付';
          else if (order.status === 'paid') statusText = '待服务'; // 支付成功，等待接单
          else if (order.status === 'running') statusText = '进行中';
          else if (order.status === 'completed') statusText = '已完成';
          else if (order.status === 'cancelled') statusText = '已取消';
          
          return {
            ...order,
            // 【重要】 WXML 中直接使用的字段
            payment_fmt: payment.toFixed(2), // 格式化金额
            order_no: order._id, // 暂时用云数据库的 _id 作为订单号展示
            status_text: statusText, 
            service_name: order.service_name || '家政服务',
            // master_info 和 service_time 等字段需要确保在 order 对象中存在
            master_info: order.master_info || '待分配',
          };
        });

        this.setData({
          filteredOrders: formattedOrders,
          loading: false
        });
        wx.hideLoading();
      })
      .catch(err => {
        console.error('加载订单失败:', err);
        this.setData({ loading: false });
        wx.hideLoading();
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
  },
  
  /**
   * 跳转到订单详情页
   */
  toOrderDetail: function(e) {
      const orderId = e.currentTarget.dataset.id;
      if (orderId) {
          wx.navigateTo({
              url: `/pages/order-detail/order-detail?id=${orderId}`
          });
      }
  },

  handleListAction: function(e) {
    const { action, id } = e.currentTarget.dataset;
    
    // 阻止事件冒泡，避免点击按钮时同时触发卡片的 toOrderDetail
    e.stopPropagation(); 
    
    if (action === '去付款') {
        wx.showToast({ title: '跳转到支付页...', icon: 'none' });
        // 实际应跳转到重新支付页面：wx.navigateTo({ url: `/subpackages/.../confirm-pay/confirm-pay?id=${id}` })
        return;
    }
    if (action === '取消订单') {
      // 【！！！核心修改：替换错误的 '...' ！！！】
      wx.showModal({ 
          title: '确认取消', 
          content: `确定取消订单 ${id} 吗?`, 
          // 建议加上 success/fail 回调，这里仅作为示例
          success: (res) => {
              if (res.confirm) {
                  // 用户点击确定，执行取消逻辑
                  wx.showToast({ title: '开始执行取消...', icon: 'none' });
                  // TODO: 调用云函数或数据库更新订单状态为 'cancelled'
              }
          }
      });
      return;
    }
    if (action === '评价') {
         wx.showToast({ title: '跳转到评价页...', icon: 'none' });
         return;
    }

    // ... 其他操作 (联系客服等) 逻辑
    wx.showToast({ title: `对订单 ${id} 执行 ${action}`, icon: 'none' });
}
});