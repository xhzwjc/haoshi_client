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

  submitReview() {
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

    const review = {
      rating: score,
      comment: comment.trim(),
      created_at: Date.now(),
      user_openid: wx.getStorageSync('user_openid') || '',
    };

    const collectionName = 'service_reviews';
    const addReviewRecord = () => db.collection(collectionName).add({
      data: {
        order_id: orderId,
        ...review,
        service_id: this.data.order?.service_id || '',
        service_name: this.data.order?.service_name || '',
      }
    });

    const ensureCollection = () => db.createCollection(collectionName)
      .catch(createErr => {
        if (createErr && createErr.errCode === -502006) {
          return null;
        }
        throw createErr;
      });

    addReviewRecord()
      .catch(err => {
        if (err && err.errCode === -502005) {
          return ensureCollection().then(() => addReviewRecord());
        }
        throw err;
      })
      .then(() => {
        return db.collection('bookings').doc(orderId).update({
          data: {
            status: 60,
            review,
            review_submitted_at: db.serverDate(),
            updated_at: db.serverDate()
          }
        });
      })
      .then(() => {
        wx.hideLoading();
        wx.showToast({ title: '感谢您的评价', icon: 'success' });
        this.notifyPrevPage();
        setTimeout(() => wx.navigateBack({ delta: 1 }), 800);
      })
      .catch(err => {
        console.error('提交评价失败', err);
        wx.hideLoading();
        wx.showToast({ title: '提交失败，请稍后再试', icon: 'none' });
      })
      .finally(() => {
        this.setData({ submitting: false });
      });
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
