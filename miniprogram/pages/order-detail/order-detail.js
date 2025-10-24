// /pages/order-detail/order-detail.js
const db = wx.cloud.database();
const _ = db.command; // 引入数据库操作符

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

    onShow: function() {
        // 从其他页面返回（如支付成功后），需要刷新订单状态
        if (this.data.orderId) {
             this.fetchOrderDetail(this.data.orderId);
        }
    },

    /**
     * 【修改】根据订单ID从数据库获取详情
     */
    fetchOrderDetail: function(id) {
        this.setData({ loading: true });
        db.collection('bookings').doc(id).get({
          success: (res) => {
              const order = res.data;
              
              // 【核心修改】 价格显示逻辑
              let finalFee = parseFloat(order.final_price) || 0; // 最终价格
              let isFinalPrice = order.status >= 35; // 状态 35 及以后显示最终价格
              
              order.is_final_price = isFinalPrice; 
              order.price_display = isFinalPrice ? finalFee.toFixed(2) : (order.price_range || '待核价');
              
              order.created_at_fmt = new Date(order.created_at).toLocaleString();
              // 如果有支付时间，也可以格式化 order.paid_at

              // 【核心修改】 状态文案逻辑
              switch (order.status) {
                case 10:
                    order.status_text = '待接单';
                    order.status_tip = '订单已提交，正在等待家政人员接单。';
                    break;
                case 20:
                    order.status_text = '待服务';
                    order.status_tip = `${order.master_info || '家政人员'}已接单，请等待按约定时间上门服务。`;
                    break;
                case 30:
                    order.status_text = '服务中';
                    order.status_tip = `${order.master_info || '家政人员'}已上门，正在提供服务中。`;
                    break;
                case 35:
                    order.status_text = '待确认金额'; // 新状态
                    order.status_tip = `${order.master_info || '家政人员'}已服务完毕并提交报价，请您确认最终金额。`;
                    break;
                case 40:
                    order.status_text = '待支付';
                    order.status_tip = '金额已确认，请在规定时间内完成支付。';
                    break;
                case 50:
                    order.status_text = '待评价';
                    order.status_tip = '支付成功！请您对本次服务进行评价。';
                    break;
                case 60:
                    order.status_text = '已完成';
                    order.status_tip = '订单已完成，期待您的再次预约！';
                    break;
                case 0:
                    order.status_text = '已取消';
                    order.status_tip = '订单已取消。';
                    break;
                case -1:
                    order.status_text = '已拒单';
                    order.status_tip = '家政人员未接单，订单已关闭。';
                    break;
                default:
                    order.status_text = '状态异常';
                    order.status_tip = '订单状态异常，请联系客服。';
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
     * 【修改】 根据订单状态获取操作按钮组
     */
    getActions: function(status) {
        if (!status) return [];
        
        switch (status) {
          case 10: // 待接单
              return [{ text: '联系客服', type: 'default' }, { text: '取消订单', type: 'warn' }];
          case 20: // 待服务
              return [{ text: '联系师傅', type: 'default' }, { text: '取消订单', type: 'warn' }];
          case 30: // 服务中
              return [{ text: '联系客服', type: 'default' }, { text: '联系师傅', type: 'primary' }];
          case 35: // 待确认金额 (新状态)
              return [{ text: '金额有误', type: 'warn' }, { text: '确认金额', type: 'primary' }];
          case 40: // 待支付
              return [{ text: '联系客服', type: 'default' }, { text: '立即支付', type: 'primary' }];
          case 50: // 待评价
              return [{ text: '申请售后', type: 'default' }, { text: '评价服务', type: 'primary' }];
          case 60: // 已完成
              return [{ text: '再次预约', type: 'default' }, { text: '申请售后', type: 'default' }];
          case 0: // 已取消
          case -1: // 已拒单
              return [{ text: '再次预约', type: 'primary' }];
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
        const finalPrice = this.data.orderDetail.final_price;
        
        // 确保不会触发其他元素
        e.stopPropagation();

        switch (action) {
            case '取消订单':
                this.cancelOrder(orderId);
                break;
            case '确认金额':
                this.confirmPrice(orderId, finalPrice);
                break;
            case '立即支付':
                this.payNow(orderId);
                break;
            case '联系客服':
            case '金额有误':
            case '申请售后':
                // 建议使用 open-type="contact" 或 wx.makePhoneCall
                wx.showToast({ title: `唤起 ${action} 服务`, icon: 'none' });
                break;
            case '联系师傅':
                // wx.makePhoneCall(this.data.orderDetail.master_phone)
                wx.showToast({ title: '联系师傅...', icon: 'none' });
                break;
            case '评价服务':
                // 跳转到评价页
                wx.showToast({ title: '跳转评价页...', icon: 'none' });
                break;
            case '再次预约':
                // 跳转到服务详情页
                wx.showToast({ title: '跳转服务详情页...', icon: 'none' });
                break;
            default:
                wx.showToast({ title: '未知操作', icon: 'none' });
        }
    },

    /**
     * 【重用方法】 取消订单 (Status 10, 20 -> 0)
     */
    cancelOrder: function(id) {
        wx.showModal({ 
            title: '确认取消', 
            content: '确定要取消这个订单吗?', 
            success: (res) => {
                if (res.confirm) {
                    wx.showLoading({ title: '取消中...' });
                    db.collection('bookings').doc(id).update({
                      data: {
                        status: 0 
                      }
                    }).then(() => {
                      wx.hideLoading();
                      wx.showToast({ title: '取消成功', icon: 'success' });
                      this.fetchOrderDetail(id); // 刷新详情页状态
                    }).catch(err => {
                      wx.hideLoading();
                      wx.showToast({ title: '操作失败', icon: 'none' });
                    });
                }
            }
        });
    },
    
    /**
     * 【新增方法】 确认金额 (Status 35 -> 40)
     */
    confirmPrice: function(id, price) {
        wx.showModal({ 
            title: '确认金额', 
            content: `请确认服务金额为 ¥${parseFloat(price).toFixed(2)} ?`, 
            success: (res) => {
                if (res.confirm) {
                    wx.showLoading({ title: '确认中...' });
                    db.collection('bookings').doc(id).update({
                      data: {
                        status: 40 // 变为 "待支付"
                      }
                    }).then(() => {
                      wx.hideLoading();
                      wx.showToast({ title: '请支付', icon: 'none' });
                      this.fetchOrderDetail(id); // 刷新详情页状态
                    }).catch(err => {
                      wx.hideLoading();
                      wx.showToast({ title: '操作失败', icon: 'none' });
                    });
                }
            }
        });
    },

    /**
     * 【重用方法】 立即支付 (Status 40 -> 50)
     */
    payNow: function(id) {
        wx.showLoading({ title: '正在唤起支付...' });
        
        // 【模拟支付成功】
        setTimeout(() => {
          db.collection('bookings').doc(id).update({
            data: {
              status: 50 // 变为 "待评价"
            }
          }).then(() => {
            wx.hideLoading();
            wx.showToast({ title: '支付成功', icon: 'success' });
            this.fetchOrderDetail(id); // 刷新详情页状态
          }).catch(err => {
            wx.hideLoading();
            wx.showToast({ title: '支付失败', icon: 'none' });
          });
        }, 1000);
    },

    // 复制订单编号功能
    copyContent: function(e) {
        const content = e.currentTarget.dataset.content;
        wx.setClipboardData({
            data: content,
            success: () => {
                wx.showToast({ title: '复制成功', icon: 'success' });
            }
        });
    }
});