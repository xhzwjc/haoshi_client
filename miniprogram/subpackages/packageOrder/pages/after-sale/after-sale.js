const db = wx.cloud.database();

const AFTER_SALE_SCENES = {
  amount: {
    title: '金额有误',
    reasonOptions: ['报价过高', '服务未完成但仍收费', '存在重复收费', '其他金额问题']
  },
  afterSale: {
    title: '售后服务',
    reasonOptions: ['服务质量不满意', '师傅迟到/未到', '物品损坏', '其他问题']
  }
};

Page({
  data: {
    orderId: '',
    scene: 'afterSale',
    sceneTitle: '',
    order: null,
    reasonOptions: [],
    selectedReason: '',
    description: '',
    contactPhone: '',
    submitting: false
  },

  onLoad(options) {
    const { id, scene } = options;
    const sceneKey = scene && AFTER_SALE_SCENES[scene] ? scene : 'afterSale';

    this.setData({
      orderId: id || '',
      scene: sceneKey,
      sceneTitle: AFTER_SALE_SCENES[sceneKey].title,
      reasonOptions: AFTER_SALE_SCENES[sceneKey].reasonOptions,
      selectedReason: AFTER_SALE_SCENES[sceneKey].reasonOptions[0] || ''
    });

    wx.setNavigationBarTitle({
      title: sceneKey === 'amount' ? '金额问题反馈' : '售后申请'
    });

    if (id) {
      this.fetchOrder(id);
    }
  },

  fetchOrder(id) {
    db.collection('bookings').doc(id).get()
      .then(res => {
        const order = res.data;
        this.setData({
          order,
          contactPhone: order.contact_phone || ''
        });
      })
      .catch(err => {
        console.error('加载订单失败', err);
        wx.showToast({ title: '订单信息获取失败', icon: 'none' });
      });
  },

  onReasonChange(e) {
    this.setData({ selectedReason: e.detail.value });
  },

  onDescriptionInput(e) {
    this.setData({ description: e.detail.value });
  },

  onPhoneInput(e) {
    this.setData({ contactPhone: e.detail.value });
  },

  submitRequest() {
    if (this.data.submitting) return;

    const { orderId, selectedReason, description, contactPhone, scene } = this.data;
    if (!orderId) {
      wx.showToast({ title: '订单信息缺失', icon: 'none' });
      return;
    }
    if (!description.trim()) {
      wx.showToast({ title: '请描述问题详情', icon: 'none' });
      return;
    }
    if (!/^\d{6,}$/.test(contactPhone)) {
      wx.showToast({ title: '请填写有效联系电话', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '提交中...', mask: true });

    const payload = {
      order_id: orderId,
      scene,
      reason: selectedReason,
      description: description.trim(),
      contact_phone: contactPhone,
      status: 'pending',
      created_at: Date.now(),
      user_openid: wx.getStorageSync('user_openid') || '',
    };

    db.collection('after_sales').add({ data: payload })
      .then(() => {
        wx.hideLoading();
        wx.showToast({ title: '提交成功', icon: 'success' });
        this.notifyPrevPage();
        setTimeout(() => wx.navigateBack({ delta: 1 }), 800);
      })
      .catch(err => {
        console.error('提交售后失败', err);
        wx.hideLoading();
        wx.showToast({ title: '提交失败，请稍后重试', icon: 'none' });
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
