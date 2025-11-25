Page({
    data: {
        tabs: [
            { name: '全部', status: 'all' },
            { name: '待接单', status: 10 },
            { name: '待服务', status: 20 },
            { name: '服务中', status: 30 },
            { name: '待确认', status: 35 },
            { name: '待支付', status: 40 },
            { name: '待评价', status: 50 },
            { name: '已完成', status: 60 }
        ],
        activeTab: 0,
        orders: [],
        loading: false
    },

    onLoad() {
        this.loadOrders();
    },

    onTabClick(e) {
        const index = e.currentTarget.dataset.index;
        this.setData({ activeTab: index });
        this.loadOrders();
    },

    async loadOrders() {
        try {
            this.setData({ loading: true });
            const currentTab = this.data.tabs[this.data.activeTab];

            const res = await wx.cloud.callFunction({
                name: 'adminManageOrders',
                data: {
                    action: 'getOrders',
                    status: currentTab.status,
                    page: 1,
                    pageSize: 100
                }
            });

            if (res.result.code === 0) {
                const formatted = (res.result.data.list || []).map(order => this.formatOrderData(order));
                this.setData({ orders: formatted });
            } else {
                wx.showToast({ title: res.result.message, icon: 'none' });
            }
        } catch (error) {
            console.error('Load orders failed', error);
            wx.showToast({ title: '加载失败', icon: 'none' });
        } finally {
            this.setData({ loading: false });
        }
    },

    formatOrderData(order) {
        let priceDisplay = '';
        let isRange = false;

        if (order.status >= 35) {
            // Final price mode
            const price = (parseFloat(order.final_price) || 0).toFixed(2);
            priceDisplay = '¥' + price;
        } else {
            // Price range mode
            let rangeText = order.price_range || '待核价';

            // Remove ALL currency symbols
            rangeText = rangeText.replace(/¥/g, '').replace(/￥/g, '').replace(/RMB/gi, '').replace(/rmb/g, '').trim();

            if (order.service_unit && rangeText !== '待核价') {
                priceDisplay = '¥' + rangeText + '/' + order.service_unit;
            } else if (rangeText !== '待核价') {
                priceDisplay = '¥' + rangeText;
            } else {
                priceDisplay = rangeText;
            }
            isRange = true;
        }

        let statusText = '未知';
        switch (order.status) {
            case 10: statusText = '待接单'; break;
            case 20: statusText = '待服务'; break;
            case 30: statusText = '服务中'; break;
            case 35: statusText = '待确认金额'; break;
            case 40: statusText = '待支付'; break;
            case 50: statusText = '待评价'; break;
            case 60: statusText = '已完成'; break;
            case 0: statusText = '已取消'; break;
            case -1: statusText = '已拒单'; break;
        }

        return {
            ...order,
            price_display: priceDisplay,
            is_range: isRange,
            status_text: statusText
        };
    },

    toOrderDetail(e) {
        const id = e.currentTarget.dataset.id;
        wx.navigateTo({
            url: `/pages/order-detail/order-detail?id=${id}`
        });
    }
});
