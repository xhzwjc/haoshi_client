const app = getApp();
const db = wx.cloud.database();

Page({
  data: {
    orderId: '',
    order: null,
    score: 5,
    comment: '',
    submitting: false
  },

  onLoad(options) {
    const { id } = options;
    this.setData({ orderId: id || '' });
    if (id) {
      this.fetchOrder(id);
    }
  },

  fetchOrder(id) {
    db.collection('bookings').doc(id).get()
      .then(res => {
        this.setData({ order: res.data });
      })
      .catch(err => {
        console.error('加载订单失败', err);
        wx.showToast({ title: '订单信息获取失败', icon: 'none' });
      });
  },

  changeScore(e) {
    const score = Number(e.currentTarget.dataset.score);
    this.setData({ score });
  },

  onCommentInput(e) {
    this.setData({ comment: e.detail.value });
  },

  async submitReview() {
    if (this.data.submitting) return;

    const { orderId, score, comment } = this.data;
    if (!orderId) {
      wx.showToast({ title: '订单信息缺失', icon: 'none' });
      return;
    }
    if (!comment.trim()) {
      wx.showToast({ title: '请填写评价内容', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '提交中...', mask: true });

    try {
      const currentOrder = this.data.order || {};
      const clientCloud = await app.waitClientCloudReady();
      const res = await clientCloud.callFunction({
        name: 'submitServiceReview',
        data: {
          orderId,
          rating: score,
          comment: comment.trim(),
          serviceId: currentOrder.service_id || '',
          serviceName: currentOrder.service_name || '',
          userOpenId: wx.getStorageSync('user_openid') || ''
        }
      });

      const result = res && res.result;
      if (!result || result.code !== 0) {
        throw new Error((result && result.message) || '提交失败');
      }

      wx.showToast({ title: '感谢您的评价', icon: 'success' });
      this.notifyPrevPage();
      setTimeout(() => wx.navigateBack({ delta: 1 }), 800);
    } catch (err) {
      console.error('提交评价失败', err);
      wx.showToast({ title: '提交评价失败', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ submitting: false });
    }
  },

  notifyPrevPage() {
    const pages = getCurrentPages();
    if (pages.length < 2) return;
    const prevPage = pages[pages.length - 2];
    if (prevPage?.loadOrders) {
      prevPage.loadOrders(true);
    }
    if (prevPage?.fetchOrderDetail && prevPage.data?.orderId) {
      prevPage.fetchOrderDetail(prevPage.data.orderId);
    }
  }
});
