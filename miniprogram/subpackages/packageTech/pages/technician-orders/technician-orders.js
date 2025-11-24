// pages/order-list/order-list.js
const db = wx.cloud.database();
const _ = db.command;
const PAGE_SIZE = 10; // Orders per page

Page({
    data: {
        tabs: [ // Recommended Tabs
            { name: '全部', status: 'all' },
            { name: '待接单', status: 10 },
            { name: '待服务', status: 20 }, // Replaced '已接单'
            { name: '服务中', status: 30 },
            { name: '待收款', status: 'pending_payment' }, // Combined 35, 40
            { name: '已完成', status: 'completed' },       // Combined 50, 60
        ],
        activeTab: 0,
        pendingCount: 0, // For the badge on '待接单'
        orders: [],      // Displayed orders

        // Loading & Pagination
        loading: false,         // Initial loading state
        isPulling: false,       // Refresher state
        isReachingBottom: false,// Scroll to bottom loading state
        page: 1,
        pageSize: PAGE_SIZE,
        hasMore: true,
        bottomText: '正在加载...',

        // Modal
        showDetailModal: false,
        modalOrderDetail: null,
    },

    // Internal state to track initial load vs. subsequent refreshes
    _initialLoadDone: false,

    onLoad: function (options) {
        let initialIndex = 0;
        // Check if navigated with a specific status (e.g., from dashboard notification)
        if (options && options.status) {
            let statusNum = parseInt(options.status, 10);
            if (!isNaN(statusNum)) {
                initialIndex = this.data.tabs.findIndex(tab => tab.status === statusNum);
                if (initialIndex === -1) { // Handle combined statuses if needed
                    if (statusNum === 35 || statusNum === 40) initialIndex = this.data.tabs.findIndex(tab => tab.status === 'pending_payment');
                    if (statusNum === 50 || statusNum === 60) initialIndex = this.data.tabs.findIndex(tab => tab.status === 'completed');
                }
            }
            if (initialIndex === -1) initialIndex = 0;
        }

        this.setData({ activeTab: initialIndex }, () => {
            this.loadOrders(true); // Load first page on initial entry
        });
    },

    onShow: function () {
        // Refresh data if it's not the initial load and data might be dirty
        if (this._initialLoadDone && this._isDataDirty) {
            this.loadOrders(true); // Refresh first page
            this._isDataDirty = false;
        }
        this._initialLoadDone = true; // Mark initial load as done after first onShow
    },

    onHide: function () {
        this._isDataDirty = true; // Mark data as potentially dirty when page hides
    },

    // --- Pull Down Refresh & Scroll To Bottom ---
    onRefresherRefresh: function () {
        if (this.data.loading || this.data.isPulling) return;
        this.setData({ isPulling: true, isReachingBottom: false });
        this.loadOrders(true); // Load first page
    },
    onScrollToLower: function () {
        if (!this.data.hasMore || this.data.isReachingBottom || this.data.isPulling) return;
        this.setData({ isReachingBottom: true, bottomText: '正在加载...' });
        this.loadOrders(false); // Load next page
    },

    // --- Tab Click ---
    onTabClick: function (e) {
        const index = e.currentTarget.dataset.index;
        if (this.data.activeTab === index) return;
        this.setData({ activeTab: index }, () => {
            this.loadOrders(true); // Load first page for new tab
        });
    },

    // --- Data Loading ---
    loadOrders: function (reset = false) {
        if (this.data.loading && !reset) return; // Prevent concurrent loads unless resetting

        const currentPage = reset ? 1 : this.data.page;
        const skipCount = (currentPage - 1) * this.data.pageSize;

        // Set loading states
        this.setData({ loading: true });
        if (!this.data.isPulling && !this.data.isReachingBottom && reset) {
            wx.showLoading({ title: '加载中...' }); // Show global loading only on initial load/tab switch
        }

        const currentTab = this.data.tabs[this.data.activeTab];

        // 使用云函数获取订单数据（云函数会自动过滤当前技师的openid）
        const app = getApp();
        Promise.all([
            // 使用云函数获取订单
            app.waitClientCloudReady().then(clientCloud => {
                return clientCloud.callFunction({
                    name: 'getTechnicianOrders',
                    data: {
                        status: currentTab.status,
                        page: currentPage,
                        pageSize: this.data.pageSize
                    }
                });
            }).then(res => {
                console.log('云函数返回结果:', res);
                if (res.result) {
                    if (res.result.code === 0) {
                        return { data: res.result.data || [], error: null };
                    } else {
                        // 输出详细错误信息（降为 warn，不中断流程，触发本地降级）
                        console.warn('云函数返回错误:', res.result);
                        return { data: [], error: new Error(res.result.message || res.result.error || '获取订单失败') };
                    }
                } else {
                    console.warn('云函数返回格式错误');
                    return { data: [], error: new Error('云函数返回格式错误') };
                }
            }).catch(err => {
                console.warn('调用云函数失败:', err);
                return { data: [], error: err };
            }),
            // 获取待接单数量用于badge（仅重置时）
            reset ? db.collection('bookings').where({
                status: 10,
                technician_openid: _.exists(false)
            }).count() : Promise.resolve(null)
        ]).then(async ([orderRes, countRes]) => {
            let list = orderRes.data || [];

            // 云函数失败时，进行本地降级查询
            if (orderRes.error) {
                try {
                    if (currentTab.status === 'all' || currentTab.status === 10) {
                        // 本地查询：仅查询待接单（未分配）的订单，保证页面可用
                        const fallbackRes = await db.collection('bookings')
                            .where({ status: 10, technician_openid: _.exists(false) })
                            .orderBy('created_at', 'desc')
                            .skip(skipCount)
                            .limit(this.data.pageSize)
                            .get();
                        list = fallbackRes.data || [];
                    } else {
                        // 其他Tab在没有技师openid情况下无法可靠查询，返回空列表
                        list = [];
                    }
                } catch (fallbackErr) {
                    console.error('降级查询失败:', fallbackErr);
                    list = [];
                }
            }

            const formatted = list.map(order => this.formatOrderData(order));

            const newList = reset ? formatted : [...this.data.orders, ...formatted];
            const hasMore = list.length === this.data.pageSize;

            let updateData = {
                orders: newList,
                page: currentPage + 1,
                hasMore: hasMore,
                loading: false,
                isPulling: false,
                isReachingBottom: false,
                bottomText: hasMore ? '上拉加载更多' : (newList.length > 0 ? '我是有底线的' : '')
            };

            // Update badge count if it was fetched
            if (countRes !== null) {
                updateData.pendingCount = countRes.total;
            }

            this.setData(updateData);
            wx.hideLoading();
            if (reset && this.data.isPulling) { // Only stop pull down if it was triggered by it
                wx.showToast({ title: '刷新成功', icon: 'success', duration: 800 });
            }

        }).catch(err => {
            console.error('加载订单失败:', err);
            this.setData({ loading: false, isPulling: false, isReachingBottom: false, bottomText: '加载失败' });
            wx.hideLoading();
            wx.showToast({
                title: err.message && err.message.includes('初始化') ? '系统初始化中' : '加载失败',
                icon: 'none'
            });
        }).finally(() => {
            // Ensure pull-down animation stops even on error
            if (this.data.isPulling) {
                wx.stopPullDownRefresh(); // Use wx API if refresher-enabled is not stopping automatically
                this.setData({ isPulling: false });
            }
        });
    },

    // --- Order Formatting ---
    formatOrderData: function (order) {
        let priceDisplay = '0.00';
        let isRange = false;
        if (order.status >= 35) {
            priceDisplay = (parseFloat(order.final_price) || 0).toFixed(2);
            isRange = false;
        } else {
            priceDisplay = order.price_range || '待核价';
            if (order.price_range && order.service_unit) {
                priceDisplay += `/${order.service_unit}`;
            }
            isRange = true;
        }

        return {
            ...order,
            payment_fmt: priceDisplay,
            is_range: isRange,
            status_text: this.mapStatusToText(order.status),
            service_name: order.service_name || '家政服务',
            // Format date/time better if needed
            service_date: order.service_date || '',
            service_time_slot: order.service_time_slot || '',
            timeline: this.buildTimeline(order)
        };
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
    },

    mapStatusToText: function (status) {
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

    // --- Actions ---
    viewDetail: function (e) {
        this.setData({
            modalOrderDetail: e.currentTarget.dataset.order,
            showDetailModal: true
        });
    },
    hideOrderDetailModal: function () {
        this.setData({ showDetailModal: false, modalOrderDetail: null });
    },
    acceptOrder: function (e) {
        const orderId = e.currentTarget.dataset.id;
        // Optionally show modal first for confirmation, or accept directly
        this.callCloudFunction('acceptOrder', { orderId: orderId }, '接单成功', '接单失败');
    },
    startService: function (e) { // 对应“确认上门” 20 -> 30
        const orderId = e.currentTarget.dataset.id;
        this.callCloudFunction('startService', { orderId }, '操作成功', '操作失败');
    },
    completeAndQuote: function (e) {
        const orderId = e.currentTarget.dataset.id;
        wx.navigateTo({
            url: `/subpackages/packageTech/pages/quote-order/quote-order?id=${orderId}`
        });
    },
    // --- Modal Action Callbacks ---
    acceptOrderFromModal: function (e) {
        this.callCloudFunction('acceptOrder', { orderId: e.detail.orderId }, '接单成功', '接单失败', true);
    },
    rejectOrderFromModal: function (e) {
        this.callCloudFunction('rejectOrder', { orderId: e.detail.orderId }, '拒单成功', '拒单失败', true);
    },

    // --- Generic Cloud Function Caller ---
    callCloudFunction: function (name, data, successTitle, failTitle, closeModal = false) {
        wx.showLoading({ title: '请稍候...' });
        wx.cloud.callFunction({
            name: name,
            data: data
        }).then(res => {
            wx.hideLoading();
            if (res.result && res.result.code === 0) {
                wx.showToast({ title: successTitle, icon: 'success' });
                if (closeModal) this.hideOrderDetailModal();
                this.loadOrders(true); // Refresh list
            } else {
                wx.showToast({ title: res.result.message || failTitle, icon: 'none' });
            }
        }).catch(err => {
            wx.hideLoading();
            console.error(`Call ${name} failed:`, err);
            wx.showToast({ title: '网络错误', icon: 'none' });
        });
    }
});