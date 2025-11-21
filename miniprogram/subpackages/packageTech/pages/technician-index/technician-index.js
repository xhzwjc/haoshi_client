// pages/index/index.js
const app = getApp();

Page({
    data: {
        statusBarHeight: 0,
        titleBarHeight: 0,
        technicianInfo: { // Placeholder data
            name: '李师傅',
            badge: '金牌',
            rating: 4.9,
            servedOrders: 856,
            avatar: '/packageCommon/images/default_avatar.png' 
        },
        dashboardData: { // Placeholder data
            pendingCount: 3,
            runningCount: 5,
            monthIncome: '12,580',
            notification: {
                title: '您有3个新订单待处理',
                desc: '请及时接单，避免订单流失'
            },
            todayPendingService: 2,
            todayCompleted: 3,
            todayIncome: 540,
            recentOrders: [ // Example recent orders
                { _id: 'order1', service_name: '深度保洁', status: 20, status_text: '待服务', service_time_display: '今天 14:00', address: '幸福路123号', final_price: 299 },
                { _id: 'order2', service_name: '油烟机清洗', status: 10, status_text: '待接单', service_time_display: '今天 16:00', address: '建设路456号', price_range: '120-150' },
            ] 
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
                if (data.dashboardData && data.dashboardData.recentOrders) {
                    data.dashboardData.recentOrders = data.dashboardData.recentOrders.map(order => {
                        // 格式化价格显示
                        let priceDisplay = '待核价';
                        if (order.final_price) {
                            priceDisplay = parseFloat(order.final_price).toFixed(2);
                        } else if (order.price_range) {
                            priceDisplay = order.price_range;
                        }
                        
                        return {
                            ...order,
                            status_text: this.mapStatusToText(order.status),
                            service_time_display: this.formatServiceTime(order.service_date, order.service_time_slot),
                            price_display: priceDisplay
                        };
                    });
                }
                this.setData({ 
                    dashboardData: data.dashboardData, 
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
    }
});