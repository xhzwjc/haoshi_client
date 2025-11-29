// pages/order-list/order-list.js
const db = wx.cloud.database();
const _ = db.command;
const PAGE_SIZE = 10;

Page({
    data: {
        tabs: [
            { name: '全部', status: 'all' },
            { name: '待接单', status: 10 },
            { name: '待服务', status: 20 },
            { name: '服务中', status: 30 },
            { name: '待收款', status: 'pending_payment' },
            { name: '已完成', status: 'completed' },
        ],
        activeTab: 0,
        pendingCount: 0,
        orders: [],
        loading: false,
        isPulling: false,
        isReachingBottom: false,
        page: 1,
        pageSize: PAGE_SIZE,
        hasMore: true,
        bottomText: '正在加载...',
        showDetailModal: false,
        modalOrderDetail: null,
    },

    _initialLoadDone: false,

    onLoad: function (options) {
        let initialIndex = 0;
        if (options && options.status) {
            let statusNum = parseInt(options.status, 10);
            if (!isNaN(statusNum)) {
                initialIndex = this.data.tabs.findIndex(tab => tab.status === statusNum);
                if (initialIndex === -1) {
                    if (statusNum === 35 || statusNum === 40) initialIndex = this.data.tabs.findIndex(tab => tab.status === 'pending_payment');
                    if (statusNum === 50 || statusNum === 60) initialIndex = this.data.tabs.findIndex(tab => tab.status === 'completed');
                }
            }
            if (initialIndex === -1) initialIndex = 0;
        }

        this.setData({ activeTab: initialIndex }, () => {
            this.loadOrders(true);
        });
    },

    onShow: function () {
        if (this._initialLoadDone && this._isDataDirty) {
            this.loadOrders(true);
            this._isDataDirty = false;
        }
        this._initialLoadDone = true;
    },

    onHide: function () {
        this._isDataDirty = true;
    },

    onRefresherRefresh: function () {
        if (this.data.loading || this.data.isPulling) return;
        this.setData({ isPulling: true, isReachingBottom: false });
        this.loadOrders(true);
    },

    onScrollToLower: function () {
        if (!this.data.hasMore || this.data.isReachingBottom || this.data.isPulling) return;
        this.setData({ isReachingBottom: true, bottomText: '正在加载...' });
        this.loadOrders(false);
    },

    onTabClick: function (e) {
        const index = e.currentTarget.dataset.index;
        if (this.data.activeTab === index) return;
        this.setData({ activeTab: index }, () => {
            this.loadOrders(true);
        });
    },

    loadOrders: function (reset = false) {
        if (this.data.loading && !reset) return;

        const currentPage = reset ? 1 : this.data.page;
        const skipCount = (currentPage - 1) * this.data.pageSize;

        this.setData({ loading: true });
        if (!this.data.isPulling && !this.data.isReachingBottom && reset) {
            wx.showLoading({ title: '加载中...' });
        }

        const currentTab = this.data.tabs[this.data.activeTab];
        const app = getApp();

        Promise.all([
            app.waitClientCloudReady().then(clientCloud => {
                const masterId = wx.getStorageSync('master_id');
                return clientCloud.callFunction({
                    name: 'getTechnicianOrders',
                    data: {
                        masterId: masterId,
                        status: currentTab.status,
                        page: currentPage,
                        pageSize: this.data.pageSize
                    }
                });
            }).then(res => {
                console.log('云函数返回结果:', res);
                if (res.result && res.result.code === 0) {
                    return { data: res.result.data?.list || [], error: null };
                } else {
                    console.warn('云函数返回错误:', res.result);
                    return { data: [], error: new Error(res.result?.message || '获取订单失败') };
                }
            }).catch(err => {
                console.warn('调用云函数失败:', err);
                return { data: [], error: err };
            }),
            reset ? db.collection('bookings').where({
                status: 10,
                technician_openid: _.exists(false)
            }).count() : Promise.resolve(null)
        ]).then(([orderRes, countRes]) => {
            let list = orderRes.data || [];

            if (orderRes.error) {
                console.error('获取订单失败:', orderRes.error);
                list = [];
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

            if (countRes !== null) {
                updateData.pendingCount = countRes.total;
            }

            this.setData(updateData);
            wx.hideLoading();
            if (reset && this.data.isPulling) {
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
            if (this.data.isPulling) {
                wx.stopPullDownRefresh();
                this.setData({ isPulling: false });
            }
        });
    },

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
            price_display: priceDisplay,
            is_range: isRange,
            status_text: this.mapStatusToText(order.status),
            service_name: order.service_name || '家政服务',
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
        const masterId = wx.getStorageSync('master_id');
        this.callCloudFunction('acceptOrder', { orderId, masterId }, '接单成功', '接单失败');
    },

    startService: function (e) {
        const orderId = e.currentTarget.dataset.id;
        const masterId = wx.getStorageSync('master_id');
        this.callCloudFunction('startService', { orderId, masterId }, '操作成功', '操作失败');
    },

    completeAndQuote: function (e) {
        const orderId = e.currentTarget.dataset.id;
        wx.navigateTo({
            url: `/subpackages/packageTech/pages/quote-order/quote-order?id=${orderId}`
        });
    },

    acceptOrderFromModal: function (e) {
        const masterId = wx.getStorageSync('master_id');
        this.callCloudFunction('acceptOrder', { orderId: e.detail.orderId, masterId }, '接单成功', '接单失败', true);
    },

    rejectOrderFromModal: function (e) {
        this.callCloudFunction('rejectOrder', { orderId: e.detail.orderId }, '拒单成功', '拒单失败', true);
    },

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
                this.loadOrders(true);
            } else {
                wx.showToast({ title: res.result?.message || failTitle, icon: 'none' });
            }
        }).catch(err => {
            wx.hideLoading();
            console.error(`Call ${name} failed:`, err);
            wx.showToast({ title: '网络错误', icon: 'none' });
        });
    }
});