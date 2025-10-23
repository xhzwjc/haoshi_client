// /subpackages/packageService/pages/confirm-pay/confirm-pay.js
const db = wx.cloud.database();

Page({
    data: {
        bookingData: null, // 完整的订单数据 (包含时间/地址等)
        orderSummary: {
            service_name: '加载中...',
            service_desc: '...', // 服务描述
            service_date: '...',
            service_time_slot: '...',
            address: '...',
            contact_name: '...', // 联系人
            contact_phone: '...', // 电话
            total_price_display: '0.00', // 用于展示的格式化价格
            total_price: 0
        }
    },

    onLoad: function (options) {
        if (options.data) {
            const bookingData = JSON.parse(decodeURIComponent(options.data));
            const price = parseFloat(bookingData.service_price) || 0; // 确保价格是数字
            
            this.setData({
                bookingData: bookingData,
                orderSummary: {
                    service_name: bookingData.service_name,
                    // 从服务数据中提取描述，如果不存在则使用默认值
                    service_desc: bookingData.service_description || '全屋深度清洁，包含厨房卫生清洁', 
                    service_date: bookingData.service_date,
                    service_time_slot: bookingData.service_time_slot,
                    address: bookingData.address,
                    contact_name: bookingData.contact_name, // 提取联系人
                    contact_phone: bookingData.contact_phone, // 提取电话
                    total_price_display: price.toFixed(2), // 格式化价格
                    total_price: price 
                }
            });
        }
    },

    /**
     * 【核心修改】上一步/返回按钮逻辑：弹出确认框，并根据选择执行操作。
     */
    onPrevStep: function() {
        if (!this.data.bookingData) {
            return wx.navigateBack(); 
        }

        // 弹出确认模态框
        wx.showModal({
            title: '退出确认',
            // 提示用户订单将被保存到待支付列表
            content: '您确定要退出当前付款流程吗？退出后订单将保存到“待支付”列表。',
            cancelText: '退出',      // 对应您的“退出”按钮
            confirmText: '继续付款', // 对应您的“继续付款”按钮
            success: (res) => {
                if (res.confirm) {
                    // 用户点击“继续付款”：关闭弹窗，停留在当前页面
                    console.log('用户选择继续付款');
                } else {
                    // 用户点击“退出”：保存订单为 pending 并跳转到订单列表
                    this.saveOrderAsPendingAndExit();
                }
            }
        });
    },

    /**
     * 【新增方法】保存订单为待支付状态并跳转到待支付列表
     */
    saveOrderAsPendingAndExit: function() {
        wx.showLoading({ title: '保存中...' });

        const finalData = {
            ...this.data.bookingData,
            total_fee: this.data.orderSummary.total_price,
            status: 'pending', // 订单状态设为 'pending'
            created_at: db.serverDate()
        };

        db.collection('bookings').add({
            data: finalData
        }).then(res => {
            wx.hideLoading();
            
            wx.showToast({
                title: '订单已保存到待支付',
                icon: 'success', 
                duration: 1500,
                success: () => {
                    // 跳转到订单列表页，并选中 '待支付' Tab
                    wx.reLaunch({ 
                        url: `/pages/order/order?status=pending` 
                    });
                }
            });
        }).catch(err => {
            wx.hideLoading();
            console.error('订单保存失败:', err);
            wx.showToast({ title: '订单保存失败，已返回', icon: 'none' });
            wx.navigateBack(); 
        });
    },

    /**
     * 确认支付 (核心逻辑: 保存订单到数据库)
     */
    onConfirmPay: function() {
        if (!this.data.bookingData) {
            return wx.showToast({ title: '订单数据丢失', icon: 'error' });
        }

        wx.showLoading({ title: '支付中...' });

        // 构造要写入数据库的最终数据
        const finalData = {
            ...this.data.bookingData,
            total_fee: this.data.orderSummary.total_price,
            status: 'paid', // 支付成功，状态设为 'paid' (待服务)
            created_at: db.serverDate()
        };

        // 模拟支付成功，直接保存订单
        db.collection('bookings').add({
            data: finalData
        }).then(res => {
            wx.hideLoading();
            
            wx.showModal({
                title: '支付成功',
                content: '您的订单已成功提交，状态：待服务！',
                showCancel: false,
                confirmText: '查看订单',
                success: (modalRes) => {
                    if (modalRes.confirm) {
                        const detailUrl = `/pages/order-detail/order-detail?id=${res._id}`;
                        wx.redirectTo({
                            url: detailUrl, 
                            fail: (e) => {
                                console.error('跳转订单详情失败:', e);
                                wx.showToast({ title: '跳转失败，请查看控制台错误', icon: 'none' });
                            }
                        });
                    }
                }
            });

        }).catch(err => {
            wx.hideLoading();
            wx.showToast({ title: '订单提交失败，请重试', icon: 'none' });
            console.error('提交订单失败:', err);
        });
    }
});