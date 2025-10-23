// /pages/order-detail/order-detail.js
const db = wx.cloud.database();

Page({
    data: {
        orderId: '',
        orderDetail: null,
        loading: true
    },

    onLoad: function (options) {
        if (options.id) {
            this.setData({
                orderId: options.id
            });
            this.fetchOrderDetail(options.id);
        } else {
            wx.showToast({ title: '订单ID丢失', icon: 'none' });
            this.setData({ loading: false });
        }
    },

    /**
     * 根据订单ID从数据库获取详情
     */
    fetchOrderDetail: function(id) {
        this.setData({ loading: true });
        db.collection('bookings').doc(id).get({
          success: (res) => {
              const order = res.data;
              const totalFee = parseFloat(order.total_fee) || 0;
              const servicePrice = parseFloat(order.service_price) || 0;

              // 【！！！核心修改：在JS中格式化价格！！！】
              order.created_at_fmt = new Date(order.created_at).toLocaleString();
              order.total_fee_fmt = totalFee.toFixed(2);
              order.service_price_fmt = servicePrice.toFixed(2);
              
              // 确保 status_text 和 status_tip 也有默认值或已处理
              order.status_text = order.status_text || (order.status === 'pending' ? '待支付' : '待服务'); 
              order.status_tip = order.status_tip || (order.status === 'pending' ? '订单已创建，请尽快支付' : '服务已提交，等待人员接单');

              this.setData({
                  orderDetail: order,
                  loading: false
              });
            },
            fail: (err) => {
                console.error('获取订单详情失败:', err);
                wx.showToast({ title: '加载失败', icon: 'error' });
                this.setData({ loading: false });
            }
        });
    },

    /**
     * 根据订单状态获取操作按钮组
     */
    getActions: function(status) {
        // 实际应用中会根据状态返回不同的操作，例如：
        switch (status) {
            case 'pending':
                return [{ text: '取消订单', type: 'warn' }, { text: '立即支付', type: 'primary' }];
            case 'confirmed':
                return [{ text: '联系客服', type: 'default' }];
            case 'completed':
                return [{ text: '再次预约', type: 'primary' }, { text: '评价服务', type: 'default' }];
            default:
                return [];
        }
    },

    /**
     * 统一处理底部按钮点击事件
     */
    handleAction: function(e) {
        const action = e.currentTarget.dataset.action;
        const orderId = this.data.orderId;
        
        // 这里是操作逻辑（如调用云函数取消订单、跳转支付等）
        wx.showToast({ title: `执行操作: ${action}`, icon: 'none' });
    }
}); 