// components/order-detail-modal/order-detail-modal.js
Component({
  properties: {
    order: { // Receive order object from parent page
      type: Object,
      value: null
    }
  },
  data: {
    timeline: []
  },
  observers: {
    order(order) {
      if (!order) {
        this.setData({ timeline: [] });
        return;
      }
      this.setData({ timeline: this.buildTimeline(order) });
    }
  },
  methods: {
    closeModal() {
      this.triggerEvent('close'); // Trigger close event for parent
    },
    acceptOrder() {
      // Trigger accept event, passing orderId back
      this.triggerEvent('accept', { orderId: this.data.order._id });
    },
    rejectOrder() {
      // Trigger reject event, passing orderId back
      this.triggerEvent('reject', { orderId: this.data.order._id });
    },
    /**
     * 导航到服务地址
     * 调起微信地图导航功能
     */
    navigateToAddress() {
      const { order } = this.data;

      // 安全检查：确保有经纬度数据
      if (!order || !order.latitude || !order.longitude) {
        wx.showToast({
          title: '该订单缺少位置信息',
          icon: 'none'
        });
        return;
      }

      // 调用微信地图导航
      wx.openLocation({
        latitude: parseFloat(order.latitude),
        longitude: parseFloat(order.longitude),
        name: order.address || '服务地址',
        address: '服务地址', // 详细地址栏显示"服务地址"作为说明，或者留空
        scale: 15, // 地图缩放级别（1-28）
        success: () => {
          console.log('导航成功');
        },
        fail: (err) => {
          console.error('导航失败:', err);
          wx.showToast({
            title: '打开地图失败',
            icon: 'none'
          });
        }
      });
    },
    buildTimeline(order = {}) {
      const items = [];
      const pushIfExists = (label, value) => {
        const formatted = this.formatTimelineTimestamp(value);
        if (formatted) {
          items.push({ label, value: formatted });
        }
      };

      pushIfExists('下单', order.created_at);
      pushIfExists('师傅接单', order.accepted_at);
      pushIfExists('确认上门', order.service_started_at);
      pushIfExists('完成服务', order.service_completed_at);
      pushIfExists('提交报价', order.quote_submitted_at);
      pushIfExists('客户确认金额', order.amount_confirmed_at);
      pushIfExists('客户支付', order.paid_at);
      pushIfExists('客户评价', order.review_submitted_at);
      pushIfExists('售后申请', order.after_sale_submitted_at);
      pushIfExists('订单取消', order.cancelled_at);

      return items;
    },
    formatTimelineTimestamp(value) {
      if (!value) return '';
      let dateObj = null;
      if (value instanceof Date) {
        dateObj = value;
      } else if (typeof value === 'number') {
        dateObj = new Date(value);
      } else if (typeof value === 'string') {
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) dateObj = parsed;
      } else if (value && typeof value === 'object') {
        if (typeof value.toDate === 'function') {
          dateObj = value.toDate();
        } else if (value.$date) {
          dateObj = new Date(value.$date);
        }
      }

      if (!dateObj || isNaN(dateObj.getTime())) return '';

      const pad = (num) => (num < 10 ? `0${num}` : `${num}`);
      const y = dateObj.getFullYear();
      const m = pad(dateObj.getMonth() + 1);
      const d = pad(dateObj.getDate());
      const hh = pad(dateObj.getHours());
      const mm = pad(dateObj.getMinutes());
      return `${y}-${m}-${d} ${hh}:${mm}`;
    }
  }
});