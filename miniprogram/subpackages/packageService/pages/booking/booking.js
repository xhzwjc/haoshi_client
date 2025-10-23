// subpackages/packageService/pages/booking/booking.js
const db = wx.cloud.database();

Page({
  data: {
    serviceId: null,
    service: {
      // 占位
      name: '深度保洁套餐',
      description: '专业团队, 品质保证',
      price: 299
    },
    // 表单数据
    address: '',
    contact_name: '',
    contact_phone: ''
  },

  onLoad: function (options) {
    if (options.serviceId) {
      this.setData({
        serviceId: options.serviceId
      });
      this.getServiceDetails(options.serviceId);
    } else {
      // 兜底，如果没传ID，使用占位数据
      console.warn('未传入 serviceId');
    }
  },

  /**
   * 根据ID获取服务详情
   */
  getServiceDetails: function(serviceId) {
    wx.showLoading({ title: '加载中...' });
    db.collection('services').doc(serviceId).get({
      success: res => {
        this.setData({
          service: res.data
        });
        wx.hideLoading();
      },
      fail: err => {
        wx.hideLoading();
        wx.showToast({ title: '服务加载失败', icon: 'none' });
        console.error('获取服务详情失败: ', err);
      }
    });
  },

  /**
   * 表单提交
   */
  formSubmit: function(e) {
    const formData = e.detail.value;

    // 基础校验
    if (!formData.address) {
      return wx.showToast({ title: '请输入服务地址', icon: 'none' });
    }
    if (!formData.contact_name) {
      return wx.showToast({ title: '请输入联系人姓名', icon: 'none' });
    }
    if (!formData.contact_phone) {
      return wx.showToast({ title: '请输入联系电话', icon: 'none' });
    }

    wx.showLoading({ title: '提交中...' });
    
    // 写入数据库
    db.collection('bookings').add({
      data: {
        service_id: this.data.serviceId,
        service_name: this.data.service.name,
        service_price: this.data.service.price,
        address: formData.address,
        contact_name: formData.contact_name,
        contact_phone: formData.contact_phone,
        remarks: formData.remarks || '',
        status: 'pending', // 待处理
        created_at: db.serverDate() // 使用服务端时间
      }
    }).then(res => {
      wx.hideLoading();
      // res._id 是新创建的订单ID
      wx.showToast({ title: '提交成功' });
      
      // 跳转到原型图的步骤2：选择时间
      // wx.navigateTo({
      //   url: `/pages/select-time/select-time?bookingId=${res._id}`
      // });
      
    }).catch(err => {
      wx.hideLoading();
      wx.showToast({ title: '提交失败,请重试', icon: 'none' });
      console.error('提交订单失败: ', err);
    });
  }
});