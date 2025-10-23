// /subpackages/packageService/pages/confirm-pay/confirm-pay.js
const db = wx.cloud.database();

Page({
    data: {
        bookingData: null, // 完整的订单数据 (包含时间/地址等)
        orderSummary: {
            service_name: '加载中...',
            service_desc: '...', // 新增：服务描述
            service_date: '...',
            service_time_slot: '...',
            address: '...',
            contact_name: '...', // 新增：联系人
            contact_phone: '...', // 新增：电话
            total_price_display: '0.00', // 优化：用于展示的格式化价格
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
                    service_desc: bookingData.service_description || '专业服务，品质保障', // 从 bookingData 提取描述
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
     * 上一步：返回选择时间页面
     */
    onPrevStep: function() {
        // 优化：确保返回时携带必要信息，或者直接使用 wx.navigateBack()
        wx.navigateBack();
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
            total_fee: this.data.orderSummary.total_price, // 实际支付金额
            status: 'pending', // 初始状态为待处理/待支付
            created_at: db.serverDate()
            // 实际支付集成后，这里会调用 wx.cloud.callFunction({name: 'pay'})
        };

        // 模拟支付成功，直接保存订单
        db.collection('bookings').add({
            data: finalData
        }).then(res => {
            wx.hideLoading();
            
            // 模拟支付成功提示和跳转
            wx.showModal({
                title: '支付成功',
                content: '您的订单已成功提交，请等待服务人员确认！',
                showCancel: false,
                confirmText: '查看订单',
                success: (modalRes) => {
                    if (modalRes.confirm) {
                        // 跳转到订单详情或订单列表
                        wx.redirectTo({
                            url: `/pages/order-detail/order-detail?id=${res._id}` // 假设存在订单详情页
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