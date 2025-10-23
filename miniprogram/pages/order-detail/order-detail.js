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

              switch (order.status) {
                case 'pending':
                    order.status_text = '待支付';
                    order.status_tip = '订单已创建，请在规定时间内完成支付。';
                    break;
                case 'paid':
                    order.status_text = '待服务'; // 支付成功，等待接单
                    order.status_tip = '支付已成功，系统正在为您安排服务人员。';
                    break;
                case 'running':
                    order.status_text = '进行中';
                    order.status_tip = '服务人员已开始工作，请配合服务。';
                    break;
                case 'completed':
                    order.status_text = '已完成';
                    order.status_tip = '服务已完成，期待您的评价！';
                    break;
                case 'cancelled':
                    order.status_text = '已取消';
                    order.status_tip = '订单已取消。';
                    break;
                default:
                    order.status_text = '未知状态';
                    order.status_tip = '订单状态异常。';
              }

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
              // 待支付：去付款 和 取消订单
              return [{ text: '取消订单', type: 'warn' }, { text: '去付款', type: 'primary' }];
          case 'paid':
              // 支付成功/待服务：仅显示联系客服
              return [{ text: '联系客服', type: 'default' }];
          case 'running':
              // 进行中：联系师傅、联系客服
              return [{ text: '联系客服', type: 'default' }, { text: '联系师傅', type: 'primary' }];
          case 'completed':
              // 已完成：再次预约、评价
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