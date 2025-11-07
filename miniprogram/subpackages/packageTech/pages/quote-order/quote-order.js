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

  async handleSubmit() {
    if (this.data.submitting) return;

    const price = Number(this.data.finalPrice);
    if (isNaN(price) || price <= 0) {
      wx.showToast({ title: '请输入正确的金额', icon: 'none' });
      return;
    }

    const normalizedPrice = Math.round(price * 100) / 100;

    this.setData({ submitting: true });
    wx.showLoading({ title: '提交中...', mask: true });

    const payload = {
      orderId: this.data.orderId,
      finalPrice: normalizedPrice,
      remark: this.data.remark.trim()
    };

    try {
      await app.waitClientCloudReady();
      const res = await wx.cloud.callFunction({
        name: 'completeServiceAndQuote',
        data: payload
      });

      if (res.result && res.result.code === 0) {
        wx.showToast({ title: '提交成功', icon: 'success' });

        const pages = getCurrentPages();
        if (pages.length > 1) {
          const prevPage = pages[pages.length - 2];
          if (prevPage) {
            prevPage._isDataDirty = true;
          }
        }

        setTimeout(() => {
          wx.navigateBack({ delta: 1 });
        }, 400);
      } else {
        const message = (res.result && res.result.message) || '提交失败';
        wx.showToast({ title: message, icon: 'none' });
      }
    } catch (err) {
      console.error('completeServiceAndQuote 调用失败', err);
      const rawMsg = (err && err.errMsg) ? err.errMsg.replace(/^cloud\.callFunction:fail\s*/, '') : '';
      const displayMsg = rawMsg && rawMsg.length <= 20 ? rawMsg : '网络错误，请稍后再试';
      wx.showToast({ title: displayMsg, icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ submitting: false });
    }
  }
});
