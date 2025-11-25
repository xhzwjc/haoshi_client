// pages/order/order.js

Page({
  data: {
    tabs: [
      { name: '全部', status: 'all' },
      { name: '待支付', status: 'pending_pay' },
      { name: '待服务', status: 'pending_service' },
      { name: '进行中', status: 'running' },
      { name: '已完成', status: 'completed' },
      { name: '已取消', status: 'cancelled' },
    ],
    activeTab: 0,
    filteredOrders: [],
    loading: false,
    page: 1,
    pageSize: 10,
    hasMore: true,
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
      this.loadOrders(true);
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

  async loadOrders(reset = false, callback) {
    if (this.data.loading) {
      if (typeof callback === 'function') callback();
      return;
    }

    const { activeTab, tabs } = this.data;
    const currentTab = tabs[activeTab];

    // 【核心修改】使用client_id而非openid
    const clientId = wx.getStorageSync('client_id');

    if (!clientId) {
      this.setData({
        loading: false,
        filteredOrders: [],
        hasMore: false
      });
      wx.showToast({ title: '请先登录后查看订单', icon: 'none' });
      if (typeof callback === 'function') callback();
      return;
    }


    this.setData({ loading: true });
    if (reset) wx.showLoading({ title: '加载中...' });


    try {
      // 【核心修改】调用云函数而非直接查询数据库
      const res = await wx.cloud.callFunction({
        name: 'getOrders',
        data: {
          clientId: clientId,  // 传入client_id
          status: currentTab.status
        }
      });

      if (res.result && res.result.code === 0) {
        const list = res.result.data || [];

        // 格式化订单数据
        const formatted = list.map(order => {
          let priceDisplay = '0.00';
          let isRange = false;

          if (order.status >= 35) {
            priceDisplay = (parseFloat(order.final_price) || 0).toFixed(2);
            isRange = false;
          } else {
            priceDisplay = order.price_range || '待核价';
            if (order.price_range && order.service_unit) {
              priceDisplay += `/${order.service_unit}`;
            }
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

        this.setData({
          filteredOrders: formatted,
          hasMore: false,  // 云函数返回所有数据，不分页
          loading: false,
        });
      } else {
        throw new Error(res.result?.message || '加载失败');
      }
    } catch (err) {
      console.error('加载订单失败:', err);
      this.setData({ loading: false, filteredOrders: [] });
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      if (reset) wx.hideLoading();
      if (typeof callback === 'function') callback();
    }
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
      case '立即支付':
      case '即支付':
        this.payNow(id);
        break;
      case '评价服务':
        this.goToReview(id);
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

    if (!order) {
      wx.showToast({ title: '订单不存在', icon: 'none' });
      return;
    }

    const phone = order?.master_phone || order?.masterPhone;

    if (!phone) {
      wx.showToast({ title: '暂无师傅电话', icon: 'none' });
      return;
    }

    wx.makePhoneCall({
      phoneNumber: String(phone),
      fail: (err) => {
        // 用户主动取消，不提示
        if (err && err.errMsg && err.errMsg.includes('cancel')) {
          return;
        }

        // 其他失败才提示
        wx.showToast({
          title: '拨号失败，请稍后再试',
          icon: 'none'
        });
      }
    });
  },


  async goToReview(orderId) {
    wx.navigateTo({
      url: `/subpackages/packageOrder/pages/rate-order/rate-order?id=${orderId}`
    });
  },

  async cancelOrder(id) {
    wx.showModal({
      title: '确认取消',
      content: '确定要取消这个订单吗?',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '取消中...' });
          try {
            const result = await wx.cloud.callFunction({
              name: 'cancelOrder',
              data: { orderId: id }
            });

            if (result.result && result.result.code === 0) {
              wx.showToast({ title: '取消成功', icon: 'success' });
              await this.loadOrders(true);
            } else {
              wx.showToast({ title: result.result?.message || '取消失败', icon: 'none' });
            }
          } catch (err) {
            console.error('取消订单失败:', err);
            wx.showToast({ title: '操作失败', icon: 'none' });
          } finally {
            wx.hideLoading();
          }
        }
      }
    });
  },

  async confirmPrice(id, price) {
    wx.showModal({
      title: '确认金额',
      content: `师傅报价：${price}元，确认后将进入支付流程`,
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '确认中...' });
          try {
            const result = await wx.cloud.callFunction({
              name: 'confirmAmount', // 使用已有的云函数
              data: { orderId: id }
            });
            if (result.result && result.result.code === 0) {
              wx.showToast({ title: '确认成功', icon: 'success' });
              this.loadOrders(true); // 刷新列表
            } else {
              wx.showToast({ title: result.result?.message || '确认失败', icon: 'none' });
            }
          } catch (err) {
            console.error('确认失败', err);
            wx.showToast({ title: '操作失败', icon: 'none' });
          } finally {
            wx.hideLoading();
          }
        }
      }
    });
  },

  async payNow(id) {
    wx.showModal({
      title: '确认支付',
      content: '是否确认立即支付？(模拟支付)',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '支付中...' });
          try {
            const result = await wx.cloud.callFunction({
              name: 'payOrder',
              data: { orderId: id }
            });

            if (result.result && result.result.code === 0) {
              wx.showToast({ title: '支付成功', icon: 'success' });
              this.loadOrders(true);
            } else {
              wx.showToast({ title: result.result?.message || '支付失败', icon: 'none' });
            }
          } catch (err) {
            console.error('支付失败', err);
            wx.showToast({ title: '支付异常', icon: 'none' });
          } finally {
            wx.hideLoading();
          }
        }
      }
    });
  }
});
