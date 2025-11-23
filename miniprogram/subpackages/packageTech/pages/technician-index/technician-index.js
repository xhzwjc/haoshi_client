// pages/index/index.js
const app = getApp();

Page({
    data: {
        statusBarHeight: 0,
        titleBarHeight: 0,
        technicianInfo: { // Placeholder data
            name: '--',
            badge: '--',
            rating: '--',
            servedOrders: '--',
            avatar: '/packageCommon/images/default_avatar.png' 
        },
        dashboardData: { // Placeholder data
            pendingCount: '--',
            runningCount: '--',
            monthIncome: '--',
            notification: {
                title: '您有--个新订单待处理',
                desc: '请及时接单，避免订单流失'
            },
            totalPendingService: '--',
            totalCompleted: '--',
            recentOrders: [] 
        },
        showDetailModal: false,
        modalOrderDetail: null,
    },

    onLoad: function (options) {
        // Get status bar and title bar height for custom navigation
        const systemInfo = wx.getSystemInfoSync();
        const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
        this.setData({
            statusBarHeight: systemInfo.statusBarHeight,
            titleBarHeight: menuButtonInfo.height + (menuButtonInfo.top - systemInfo.statusBarHeight) * 2
        });
        
        this.loadDashboardData();
    },

    onShow: function() {
        // Refresh data when page is shown, e.g., after accepting an order elsewhere
        this.loadDashboardData();
    },

    handleLogout() {
        wx.showModal({
            title: '确认退出',
            content: '确定要退出当前账号吗？',
            confirmText: '退出',
            cancelText: '取消',
            success: (res) => {
                if (!res.confirm) return;
                this.performLogout();
            }
        });
    },

    performLogout() {
        if (app && typeof app.logout === 'function') {
            app.logout();
            return;
        }

        try {
            wx.removeStorageSync('user_token');
            wx.removeStorageSync('user_role');
            wx.removeStorageSync('user_openid');
            wx.removeStorageSync('client_profile_cache');
            wx.removeStorageSync('client_account_phone');
            wx.removeStorageSync('client_last_account');
            wx.removeStorageSync('technician_profile_cache');
            wx.removeStorageSync('technician_account_phone');
        } catch (err) {
            console.warn('技师端登出兜底逻辑异常', err);
        }

        wx.showToast({ title: '已退出登录', icon: 'none' });
        setTimeout(() => {
            wx.reLaunch({ url: app?.globalData?.loginUrl || '/pages/login/login' });
        }, 300);
    },

    /**
     * 【核心修改】 Load dashboard data from cloud function
     * 使用 app.waitClientCloudReady() 确保环境初始化完成
     */
    async loadDashboardData() {
        wx.showLoading({ title: '加载中...' });
        
        try {
            // 1. 【等待】等待 app.js 中的共享环境初始化完成
            const clientCloud = await app.waitClientCloudReady();
            
            // 2. 【调用】使用获取到的共享环境实例调用云函数
            const res = await clientCloud.callFunction({
                name: 'getTechnicianDashboard', // 客户端的云函数名
                // data: {} // 如果需要传递参数
            });

            wx.hideLoading();
            
            if (res.result && res.result.code === 0) {
                const data = res.result.data;
                // 格式化最近订单数据
                if (data.dashboardData && Array.isArray(data.dashboardData.recentOrders)) {
                    const limitedRecentOrders = data.dashboardData.recentOrders.slice(0, 5);
                    data.dashboardData.recentOrders = limitedRecentOrders.map(order => {
                        // 格式化价格显示
                        let priceDisplay = '待核价';
                        if (order.final_price) {
                            priceDisplay = parseFloat(order.final_price).toFixed(2);
                        } else if (order.price_range) {
                            priceDisplay = order.price_range;
                        }

                        const formattedOrder = {
                            ...order,
                            status_text: this.mapStatusToText(order.status),
                            service_time_display: this.formatServiceTime(order.service_date, order.service_time_slot),
                            price_display: priceDisplay
                        };
                        formattedOrder.timeline = this.buildTimeline(formattedOrder);
                        return formattedOrder;
                    });
                }
                const dashboardData = Object.assign({
                    totalPendingService: 0,
                    totalCompleted: 0
                }, data.dashboardData || {});

                this.setData({
                    dashboardData,
                    technicianInfo: data.technicianInfo
                });
            } else {
                wx.showToast({ title: (res.result && res.result.message) || '加载失败', icon: 'none' });
            }
        } catch (err) {
            wx.hideLoading();
            console.error('Failed to load dashboard data:', err);
            wx.showToast({ 
                title: err.message && err.message.includes('初始化') ? '系统初始化中' : '网络错误，请稍后重试', 
                icon: 'none' 
            });
        }
    },
    
    // --- Navigation ---
    goToTaskCenter: function() {
        wx.navigateTo({ 
            url: '/subpackages/packageTech/pages/technician-orders/technician-orders' 
        });
    },
    goToSchedule: function() {
        wx.navigateTo({ 
            url: '/subpackages/packageTech/pages/schedule/schedule' 
        });
    },
    goToIncome: function() {
        wx.navigateTo({ 
            url: '/subpackages/packageTech/pages/income/income' 
        });
    },
    goToRatings: function() {
        wx.navigateTo({ 
            url: '/subpackages/packageTech/pages/ratings/ratings' 
        });
    },

    // --- Order Actions ---
    /**
     * Show prompt before accepting order
     */
    acceptOrderPrompt: function(e) {
        let order = e.currentTarget.dataset.order;
        const id = e.currentTarget.dataset.id;
        if (!order && id && this.data.dashboardData && this.data.dashboardData.recentOrders) {
            order = this.data.dashboardData.recentOrders.find(o => o._id === id);
        }
        if (!order || order.status !== 10) return;

        this.setData({ modalOrderDetail: order, showDetailModal: true });
    },

    /**
     * View order detail (Show Modal)
     */
    viewOrderDetail: function(e) {
        let order = e.currentTarget.dataset.order;
        const id = e.currentTarget.dataset.id;
        if (!order && id && this.data.dashboardData && this.data.dashboardData.recentOrders) {
            order = this.data.dashboardData.recentOrders.find(o => o._id === id);
        }
        if (!order) return;
        this.setData({ modalOrderDetail: order, showDetailModal: true });
    },

    // --- Modal Callbacks ---
    hideOrderDetailModal: function() {
        this.setData({ showDetailModal: false, modalOrderDetail: null });
    },

    /**
     * 【核心修改】 Accept order from modal
     * 使用 app.waitClientCloudReady() 确保环境初始化完成
     */
    async acceptOrderFromModal(e) {
        const orderId = e.detail.orderId; 
        if (!orderId) return;

        wx.showLoading({ title: '正在接单...' });
        
        try {
            // 1. 【等待】等待共享环境
            const clientCloud = await app.waitClientCloudReady();

            // 2. 【调用】
            const res = await clientCloud.callFunction({
                name: 'acceptOrder', // 客户端的云函数
                data: { orderId: orderId }
            });

            wx.hideLoading();
            
            if (res.result && res.result.code === 0) {
                wx.showToast({ title: '接单成功', icon: 'success' });
                this.hideOrderDetailModal();
                this.loadDashboardData(); // Refresh list
            } else {
                wx.showToast({ title: (res.result && res.result.message) || '接单失败', icon: 'none' });
            }
        } catch (err) {
            wx.hideLoading();
            console.error('Accept order failed:', err);
            wx.showToast({ 
                title: err.message && err.message.includes('初始化') ? '系统初始化中' : '操作失败', 
                icon: 'none' 
            });
        }
    },

    /**
     * 【核心修改】 Reject order from modal
     * 使用 app.waitClientCloudReady() 确保环境初始化完成
     */
    async rejectOrderFromModal(e) {
        const orderId = e.detail.orderId;
        if (!orderId) return;
        
        wx.showLoading({ title: '正在拒单...' });
        
        try {
            // 1. 【等待】等待共享环境
            const clientCloud = await app.waitClientCloudReady();

            // 2. 【调用】
            const res = await clientCloud.callFunction({
                name: 'rejectOrder', // 客户端的云函数
                data: { orderId: orderId }
            });

            wx.hideLoading();
            
            if (res.result && res.result.code === 0) {
                wx.showToast({ title: '拒单成功', icon: 'success' });
                this.hideOrderDetailModal();
                this.loadDashboardData();
            } else {
                wx.showToast({ title: (res.result && res.result.message) || '拒单失败', icon: 'none' });
            }
        } catch (err) {
            wx.hideLoading();
            console.error('Reject order failed:', err);
            wx.showToast({ 
                title: err.message && err.message.includes('初始化') ? '系统初始化中' : '操作失败', 
                icon: 'none' 
            });
        }
    },

    // --- Helper Functions ---
    mapStatusToText: function(status) {
        switch (status) {
            case 10: return '待接单';
            case 20: return '待服务';
            case 30: return '服务中';
            case 35: return '待客户确认';
            case 40: return '待客户付款';
            case 50: return '已收款';
            case 60: return '已完成';
            case 0: return '已取消';
            case -1: return '已拒单';
            default: return '未知';
        }
    },
    
    formatServiceTime: function(date, timeSlot) {
        if (!date) return '时间待定';
        const today = new Date().toDateString();
        const orderDate = new Date(date).toDateString();
        if (orderDate === today) {
            return `今天 ${timeSlot ? timeSlot.split('-')[0] : ''}`;
        }
        // 简化日期格式
        return `${date.substring(5)} ${timeSlot ? timeSlot.split('-')[0] : ''}`;
    },
    buildTimeline(order = {}) {
        const timeline = [];
        const pushIfExists = (label, value) => {
            const formatted = this.formatTimelineTimestamp(value);
            if (formatted) {
                timeline.push({ label, value: formatted });
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

        return timeline;
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
});