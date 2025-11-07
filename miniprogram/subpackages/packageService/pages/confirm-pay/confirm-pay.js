// /subpackages/packageService/pages/confirm-pay/confirm-pay.js
const db = wx.cloud.database();

Page({
    data: {
        bookingData: null, // 完整的订单数据 (包含时间/地址等)
        orderSummary: {
            // (省略...)
            service_name: '加载中...',
            service_desc: '...', 
            service_date: '...',
            service_time_slot: '...',
            address: '...',
            contact_name: '...', 
            contact_phone: '...', 
            total_price_display: '0.00', // (这是价格范围，如 "100-250")
            service_unit: '次'
        }
    },

    onLoad: function (options) {
        // (您的 onLoad 逻辑是正确的，保留)
        if (options.data) {
            const bookingData = JSON.parse(decodeURIComponent(options.data));
            
            this.setData({
                bookingData: bookingData,
                orderSummary: {
                    service_name: bookingData.service_name,
                    service_desc: bookingData.service_description || '...', 
                    service_date: bookingData.service_date,
                    service_time_slot: bookingData.service_time_slot,
                    address: bookingData.address,
                    contact_name: bookingData.contact_name, 
                    contact_phone: bookingData.contact_phone, 
                    // 【重要】 total_price_display 现在是 价格范围 字符串
                    total_price_display: bookingData.service_price, // e.g., "100-250"
                    service_unit: bookingData.service_unit
                }
            });
        }
    },

    /**
     * 【修改】上一步/返回按钮逻辑：
     * (新流程: 预约第一步退出，不创建订单)
     */
    onPrevStep: function() {
        wx.showModal({
            title: '确认退出',
            content: '您确定要退出预约吗？（信息不会被保存）',
            cancelText: '继续预约',
            confirmText: '确认退出',
            success: (res) => {
                if (res.confirm) {
                    // 用户点击“确认退出”：直接返回上一页
                    wx.navigateBack();
                }
                // else: 用户点击“继续预约”，关闭弹窗，停留
            }
        });
    },

    /**
     * (删除 saveOrderAsPendingAndExit 方法, 新流程不再需要)
     */
    
    /**
     * 【修改】 确认预约 (核心逻辑: 保存订单为 待接单)
     */
    onConfirmPay: function() {
        if (!this.data.bookingData) {
            return wx.showToast({ title: '订单数据丢失', icon: 'error' });
        }

        wx.showLoading({ title: '提交预约...' });

        // 构造要写入数据库的最终数据
        const finalData = {
            ...this.data.bookingData,
            client_openid: wx.getStorageSync('user_openid') || '',

            // 【修改】 记录价格范围，而非固定价格
            price_range: this.data.orderSummary.total_price_display, // e.g., "100-250"
            service_unit: this.data.orderSummary.service_unit,
            
            final_price: null, // 【新增】 最终价格尚未确定
            
            status: 10, // 【核心修改】 状态设为 10 (待接单)
            
            created_at: db.serverDate()
        };

        // (清理 bookingData 中可能存在的、与 service 相关的冗余字段，如 service_price)
        delete finalData.service_price; 
        // ... (其他清理)

        db.collection('bookings').add({
            data: finalData
        }).then(res => {
            wx.hideLoading();
            
            wx.showModal({
                title: '预约成功',
                content: '您的预约已提交，请等待家政接单！',
                showCancel: false,
                confirmText: '查看订单',
                success: (modalRes) => {
                    if (modalRes.confirm) {
                        // 【修改】 跳转到订单列表页，并选中 '进行中' Tab (因为 10 属于进行中)
                        wx.reLaunch({ 
                            url: `/pages/order/order?status=running` 
                        });
                    }
                }
            });

        }).catch(err => {
            wx.hideLoading();
            wx.showToast({ title: '预约提交失败', icon: 'none' });
            console.error('提交订单失败:', err);
        });
    }
});