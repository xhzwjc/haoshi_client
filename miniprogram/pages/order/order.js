// pages/order/order.js
const db = wx.cloud.database();
const _ = db.command;

Page({
  data: {
    tabs: [
      { name: '全部', status: 'all' },
      { name: '待支付', status: 40 },
      { name: '待服务', status: 20 },
      { name: '进行中', status: 'running' },
      { name: '已完成', status: 'completed' },
      { name: '已取消', status: 'cancelled' },
    ],
    activeTab: 0,
    filteredOrders: [],
    loading: false,
    page: 1,              // 当前页数
    pageSize: 10,         // 每页数量
    hasMore: true,        // 是否还有更多数据
  },

  onLoad(options) {
    const initialStatus = options.status;
    let initialIndex = 0;

    if (initialStatus) {
      let statusNum = parseInt(initialStatus, 10);
      if (!isNaN(statusNum)) {
        initialIndex = this.data.tabs.findIndex(tab => tab.status === statusNum);
      } else {
        initialIndex = this.data.tabs.findIndex(tab => tab.status === initialStatus);
      }
      if (initialIndex === -1) initialIndex = 0;
    }

    this.setData({ activeTab: initialIndex }, () => {
      this.loadOrders(true); // 初次加载第一页
    });
  },

  onShow() {
    this.loadOrders(true);
  },

  onScrollRefresh() {
    this.setData({ refreshing: true });
    this.loadOrders(true, () => {
      this.setData({ refreshing: false });
    });
  },

  // scroll-view 上滑触底
  onScrollToLower() {
    if (!this.data.loading && this.data.hasMore) {
      this.loadOrders(false);
    }
  },

  onTabClick(e) {
    const index = e.currentTarget.dataset.index;
    if (this.data.activeTab === index) return;
    this.setData({ activeTab: index }, () => this.loadOrders(true));
  },

  /**
   * 分页加载订单
   * @param {boolean} reset 是否重置列表（true=第一页）
   * @param {function} callback 加载完成后的回调
   */
  loadOrders(reset = false, callback) {
    if (this.data.loading) return;

    const { page, pageSize, activeTab, tabs } = this.data;
    const currentTab = tabs[activeTab];

    const currentPage = reset ? 1 : page; // 页码
    const skipCount = (currentPage - 1) * pageSize;

    this.setData({ loading: true });
    if (reset) wx.showLoading({ title: '加载中...' });

    let condition = {};
    if (currentTab.status === 'all') {
      // 全部订单不过滤
    } else if (currentTab.status === 'running') {
      condition.status = _.in([10, 30, 35]);
    } else if (currentTab.status === 'completed') {
      condition.status = _.in([50, 60]);
    } else if (currentTab.status === 'cancelled') {
      condition.status = _.in([0, -1]);
    } else {
      condition.status = currentTab.status;
    }

    // 分页查询
    db.collection('bookings')
      .where(condition)
      .orderBy('created_at', 'desc')
      .skip(skipCount)
      .limit(pageSize)
      .get()
      .then(res => {
        const list = res.data || [];
        const formatted = list.map(order => {
          let priceDisplay = '0.00';
          let isRange = false;
          if (order.status >= 35) {
            priceDisplay = (parseFloat(order.final_price) || 0).toFixed(2);
            isRange = false;
          } else {
            priceDisplay = order.price_range || '待核价';
            isRange = true;
          }

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
            payment_fmt: priceDisplay,
            is_range: isRange,
            status_text: statusText,
            service_name: order.service_name || '家政服务',
            master_info: order.master_info || '待分配',
          };
        });

        const newList = reset
          ? formatted
          : [...this.data.filteredOrders, ...formatted];

        this.setData({
          filteredOrders: newList,
          page: currentPage + 1,
          hasMore: list.length === pageSize,
          loading: false,
        });
        wx.hideLoading();
        if (callback) callback();
      })
      .catch(err => {
        console.error('加载订单失败:', err);
        this.setData({ loading: false });
        wx.hideLoading();
        wx.showToast({ title: '加载失败', icon: 'none' });
        if (callback) callback();
      });
  },

  toOrderDetail(e) {
    const orderId = e.currentTarget.dataset.id;
    if (orderId) {
      wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${orderId}` });
    }
  },

  handleListAction(e) {
    const { action, id, price } = e.currentTarget.dataset;
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }

    switch (action) {
      case '取消订单':
        this.cancelOrder(id);
        break;
      case '联系师傅':
        this.contactMasterFromList(id);
        break;
      case '确认金额':
        this.confirmPrice(id, price);
        break;
      case '金额有误':
        this.goToAfterSale(id, 'amount');
        break;
      case '立即支付':
        this.payNow(id);
        break;
      case '评价服务':
        this.goToReview(id);
        break;
      case '申请售后':
        this.goToAfterSale(id, 'afterSale');
        break;
      case '查看详情':
        this.toOrderDetail(e);
        break;
      default:
        wx.showToast({ title: '未知操作', icon: 'none' });
    }
  },

  contactMasterFromList(orderId) {
    const order = this.data.filteredOrders.find(item => item._id === orderId);
    const phone = order?.master_phone || order?.masterPhone;
    if (!phone) {
      wx.showToast({ title: '暂无师傅电话', icon: 'none' });
      return;
    }
    wx.makePhoneCall({
      phoneNumber: phone.toString(),
      fail: () => {
        wx.showToast({ title: '拨号失败，请稍后再试', icon: 'none' });
      }
    });
  },

  goToAfterSale(orderId, scene = 'afterSale') {
    wx.navigateTo({
      url: `/subpackages/packageOrder/pages/after-sale/after-sale?id=${orderId}&scene=${scene}`
    });
  },

  goToReview(orderId) {
    wx.navigateTo({
      url: `/subpackages/packageOrder/pages/rate-order/rate-order?id=${orderId}`
    });
  },

  cancelOrder(id) {
    wx.showModal({
      title: '确认取消',
      content: '确定要取消这个订单吗?',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '取消中...' });
          db.collection('bookings').doc(id).update({
            data: { status: 0 }
          }).then(() => {
            wx.hideLoading();
            wx.showToast({ title: '取消成功', icon: 'success' });
            this.loadOrders(true);
          }).catch(() => {
            wx.hideLoading();
            wx.showToast({ title: '操作失败', icon: 'none' });
          });
        }
      }
    });
  },

  confirmPrice(id, price) {
    wx.showModal({
      title: '确认金额',
      content: `请确认服务金额为 ¥${price} ?`,
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '确认中...' });
          db.collection('bookings').doc(id).update({
            data: { status: 40 }
          }).then(() => {
            wx.hideLoading();
            wx.showToast({ title: '请支付', icon: 'none' });
            this.loadOrders(true);
          }).catch(() => {
            wx.hideLoading();
            wx.showToast({ title: '操作失败', icon: 'none' });
          });
        }
      }
    });
  },

  payNow(id) {
    wx.showLoading({ title: '正在唤起支付...' });
    setTimeout(() => {
      db.collection('bookings').doc(id).update({
        data: { status: 50 }
      }).then(() => {
        wx.hideLoading();
        wx.showToast({ title: '支付成功', icon: 'success' });
        this.loadOrders(true);
      }).catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '支付失败', icon: 'none' });
      });
    }, 1000);
  }
});
