// pages/order/order.js
const db = wx.cloud.database();
const _ = db.command; // 引入数据库操作符

Page({
  data: {
    // 【修改】 客户端Tab状态栏 (根据新流程归类)
    tabs: [
      { name: '全部', status: 'all' }, // 查询所有
      { name: '待支付', status: 40 },    // 查询 40
      { name: '待服务', status: 20 },    // 查询 20
      { name: '进行中', status: 'running' }, // 查询 10, 30, 35
      { name: '已完成', status: 'completed' }, // 查询 50, 60
      { name: '已取消', status: 'cancelled' }, // 查询 0, -1
    ],
    activeTab: 0,
    filteredOrders: [], // 存储查询和格式化后的订单列表
    loading: false,     // 加载状态
  },

  onLoad: function (options) {
    // 【修改】 适配新status (e.g., 传入 40 或 'running')
    const initialStatus = options.status;
    let initialIndex = 0;

    if (initialStatus) {
        // 尝试按数字状态码匹配
        let statusNum = parseInt(initialStatus, 10);
        if (!isNaN(statusNum)) {
            initialIndex = this.data.tabs.findIndex(tab => tab.status === statusNum);
        } else {
            // 按字符串状态 (running, completed...) 匹配
            initialIndex = this.data.tabs.findIndex(tab => tab.status === initialStatus);
        }
        if (initialIndex === -1) initialIndex = 0; // 找不到则到"全部"
    }
    
    this.setData({
      activeTab: initialIndex
    }, () => {
      this.loadOrders(); // 页面加载时，根据初始Tab加载数据
    });
  },

  onShow: function() {
    // onShow时刷新数据，确保状态及时更新
    // (如果从详情页返回，状态可能已改变)
    this.loadOrders(); 
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
   * 【修改】 核心加载逻辑 (适配新状态码)
   */
  loadOrders: function() {
    if (this.data.loading) return;
    this.setData({ loading: true, filteredOrders: [] }); // 加载时清空旧数据
    wx.showLoading({ title: '加载中...' });

    const currentTab = this.data.tabs[this.data.activeTab];
    let condition = {};
    
    // 【重要】 状态归类查询
    if (currentTab.status === 'all') {
      // 全部 (无条件)
    } else if (currentTab.status === 'running') {
      // 进行中: 10(待接单), 30(服务中), 35(待确认金额)
      condition.status = _.in([10, 30, 35]);
    } else if (currentTab.status === 'completed') {
      // 已完成: 50(待评价), 60(已完成)
      condition.status = _.in([50, 60]);
    } else if (currentTab.status === 'cancelled') {
      // 已取消: 0(已取消), -1(已拒单)
      condition.status = _.in([0, -1]);
    } else {
      // 待支付(40), 待服务(20)
      condition.status = currentTab.status;
    } 
    
    // (真实项目: condition._openid = '...' )
    
    db.collection('bookings')
      .where(condition)
      .orderBy('created_at', 'desc') 
      .get()
      .then(res => {
        const rawOrders = res.data || [];
        
        const formattedOrders = rawOrders.map(order => {
          
          // 【修改】 金额显示逻辑
          let priceDisplay = '0.00';
          let isRange = false;
          // 状态 35 (待确认金额) 及以后，显示 final_price
          if (order.status >= 35) { 
            priceDisplay = (parseFloat(order.final_price) || 0).toFixed(2);
            isRange = false;
          } else {
            // 状态 35 以前，显示 price_range
            priceDisplay = order.price_range || '待核价';
            isRange = true;
          }
          
          // 【修改】 状态显示逻辑
          let statusText = '未知';
          switch (order.status) {
            case 10: statusText = '待接单'; break;
            case 20: statusText = '待服务'; break;
            case 30: statusText = '服务中'; break;
            case 35: statusText = '待确认金额'; break;
            case 40: statusText = '待支付'; break;
            case 50: statusText = '待评价'; break;
            case 60: statusText = '已完成'; break;
            case 0: statusText = '已取消'; break;
            case -1: statusText = '已拒单'; break;
          }
          
          return {
            ...order,
            payment_fmt: priceDisplay, // WXML 使用
            is_range: isRange, // 告诉 WXML 是否是范围
            status_text: statusText, 
            service_name: order.service_name || '家政服务',
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
              // (确保您的详情页路径正确)
              url: `/pages/order-detail/order-detail?id=${orderId}`
          });
      }
  },

  /**
   * 【修改】 列表按钮的统一处理器
   */
  handleListAction: function(e) {
    const { action, id } = e.currentTarget.dataset;
    const price = e.currentTarget.dataset.price; // 仅 确认金额 时需要
    e.stopPropagation(); // 阻止冒泡
    
    switch (action) {
      case '取消订单': // 状态 10(待接单), 20(待服务)
        this.cancelOrder(id);
        break;
      case '联系师傅': // 状态 20, 30
        // wx.makePhoneCall(...)
        wx.showToast({ title: '联系师傅...', icon: 'none' });
        break;
      case '确认金额': // 状态 35
        this.confirmPrice(id, price);
        break;
      case '金额有误': // 状态 35
        // wx.makePhoneCall(...) 或 open-type="contact"
        wx.showToast({ title: '联系客服...', icon: 'none' });
        break;
      case '立即支付': // 状态 40
        this.payNow(id);
        break;
      case '评价': // 状态 50
        wx.showToast({ title: '跳转评价页...', icon: 'none' });
        break;
      case '申请售后': // 状态 50, 60
        wx.showToast({ title: '联系客服...', icon: 'none' });
        break;
      case '查看详情': // 状态 60
        this.toOrderDetail(e); // 复用详情跳转
        break;
      default:
        wx.showToast({ title: '未知操作', icon: 'none' });
    }
  },

  /**
   * 【新增方法】 取消订单 (Status 10, 20 -> 0)
   */
  cancelOrder: function(id) {
    wx.showModal({ 
        title: '确认取消', 
        content: '确定要取消这个订单吗?', 
        success: (res) => {
            if (res.confirm) {
                wx.showLoading({ title: '取消中...' });
                // 【云函数调用】 建议使用云函数
                db.collection('bookings').doc(id).update({
                  data: {
                    status: 0 // 设为已取消
                  }
                }).then(() => {
                  wx.hideLoading();
                  wx.showToast({ title: '取消成功', icon: 'success' });
                  this.loadOrders(); // 刷新列表
                }).catch(err => {
                  wx.hideLoading();
                  wx.showToast({ title: '操作失败', icon: 'none' });
                });
            }
        }
    });
  },

  /**
   * 【新增方法】 确认金额 (Status 35 -> 40)
   */
  confirmPrice: function(id, price) {
    wx.showModal({ 
        title: '确认金额', 
        content: `请确认服务金额为 ¥${price} ?`, 
        success: (res) => {
            if (res.confirm) {
                wx.showLoading({ title: '确认中...' });
                // 【云函数调用】
                db.collection('bookings').doc(id).update({
                  data: {
                    status: 40 // 变为 "待支付"
                  }
                }).then(() => {
                  wx.hideLoading();
                  wx.showToast({ title: '请支付', icon: 'none' });
                  this.loadOrders(); // 刷新列表
                }).catch(err => {
                  wx.hideLoading();
                  wx.showToast({ title: '操作失败', icon: 'none' });
                });
            }
        }
    });
  },

  /**
   * 【新增方法】 立即支付 (Status 40 -> 50)
   */
  payNow: function(id) {
    wx.showLoading({ title: '正在唤起支付...' });
    // 1. 【云函数调用】 调用云函数 (e.g., 'payOrder')
    // 2. 云函数会调用微信统一下单 API
    // 3. 成功后，云函数返回支付参数
    // 4. wx.requestPayment(...)
    
    // 【模拟支付成功】
    // 真实场景下，支付成功的回调里才执行更新
    setTimeout(() => {
      // 真实支付成功后，应该由微信支付回调函数 (notify_url) 
      // 通过云函数去修改订单状态，而不是在客户端修改。
      // 这里为了演示，仍在客户端模拟修改。
      db.collection('bookings').doc(id).update({
        data: {
          status: 50 // 变为 "待评价"
        }
      }).then(() => {
        wx.hideLoading();
        wx.showToast({ title: '支付成功', icon: 'success' });
        this.loadOrders(); // 刷新列表
      }).catch(err => {
        wx.hideLoading();
        wx.showToast({ title: '支付失败', icon: 'none' });
      });
    }, 1000);
  }
});