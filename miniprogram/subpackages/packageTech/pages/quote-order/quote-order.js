const app = getApp();

Page({
  data: {
    orderId: '',
    finalPrice: '',
    remark: '',
    submitting: false
  },

  onLoad(options) {
    if (options && options.id) {
      this.setData({ orderId: options.id });
    } else {
      wx.showToast({ title: '缺少订单信息', icon: 'none' });
      setTimeout(() => wx.navigateBack({ delta: 1 }), 800);
    }
  },

  onPriceInput(e) {
    this.setData({ finalPrice: e.detail.value });
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  handleSubmit() {
    if (this.data.submitting) return;

    const price = parseFloat(this.data.finalPrice);
    if (isNaN(price) || price <= 0) {
      wx.showToast({ title: '请输入正确的金额', icon: 'none' });
      return;
    }

    const normalizedPrice = Math.round(price * 100) / 100;

    this.setData({ submitting: true });
    wx.showLoading({ title: '提交中...' });

    const payload = {
      orderId: this.data.orderId,
      finalPrice: normalizedPrice,
      remark: this.data.remark.trim()
    };

    app.waitClientCloudReady().then(clientCloud => {
      return clientCloud.callFunction({
        name: 'completeServiceAndQuote',
        data: payload
      });
    }).then(res => {
      if (res.result && res.result.code === 0) {
        wx.showToast({ title: '提交成功', icon: 'success' });
        setTimeout(() => {
          wx.navigateBack({ delta: 1 });
        }, 500);
      } else {
        wx.showToast({ title: (res.result && res.result.message) || '提交失败', icon: 'none' });
      }
    }).catch(err => {
      console.error('completeServiceAndQuote 调用失败', err);
      wx.showToast({ title: '网络错误，请稍后再试', icon: 'none' });
    }).finally(() => {
      wx.hideLoading();
      this.setData({ submitting: false });
    });
  }
});
