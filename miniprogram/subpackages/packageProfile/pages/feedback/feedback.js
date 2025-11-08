const app = getApp();

Page({
  data: {
    typeOptions: ['功能建议', '体验问题', '订单相关', '其他'],
    typeIndex: 0,
    content: '',
    contact: '',
    submitting: false
  },

  onTypeChange(e) {
    this.setData({ typeIndex: Number(e.detail.value || 0) });
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value });
  },

  onContactInput(e) {
    this.setData({ contact: e.detail.value });
  },

  async submitFeedback() {
    if (this.data.submitting) return;
    const { content, contact, typeOptions, typeIndex } = this.data;

    if (!content || !content.trim()) {
      wx.showToast({ title: '请填写反馈内容', icon: 'none' });
      return;
    }

    const contactValue = (contact || '').trim();
    if (contactValue && contactValue.length < 5) {
      wx.showToast({ title: '联系方式格式不正确', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '提交中', mask: true });

    try {
      const clientCloud = await app.waitClientCloudReady();
      const res = await clientCloud.callFunction({
        name: 'submitClientFeedback',
        data: {
          type: typeOptions[typeIndex],
          content: content.trim(),
          contact: contactValue
        }
      });

      if (res.result && res.result.code === 0) {
        wx.showToast({ title: '反馈已提交', icon: 'success' });
        setTimeout(() => wx.navigateBack({ delta: 1 }), 600);
      } else {
        throw new Error((res.result && res.result.message) || '提交失败');
      }
    } catch (err) {
      console.error('提交反馈失败', err);
      wx.showToast({ title: '提交失败，请稍后再试', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ submitting: false });
    }
  }
});
