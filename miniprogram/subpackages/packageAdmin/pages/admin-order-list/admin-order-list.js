Page({
    data: {
        currentStatus: 'all',
        orders: [],
        loading: false
    },

    onLoad() {
        this.loadOrders('all');
    },

    onStatusChange(e) {
        const status = e.currentTarget.dataset.status;
        this.setData({ currentStatus: status });
        this.loadOrders(status);
    },

    async loadOrders(status) {
        try {
            this.setData({ loading: true });

            const res = await wx.cloud.callFunction({
                name: 'adminManageOrders',
                data: {
                    action: 'getOrders',
                    status: status,
                    page: 1,
                    pageSize: 100
                }
            });

            if (res.result.code === 0) {
                this.setData({ orders: res.result.data.list || [] });
            } else {
                wx.showToast({ title: res.result.message, icon: 'none' });
            }
        } catch (error) {
            console.error('Load orders failed', error);
            wx.showToast({ title: '加载失败', icon: 'none' });
        } finally {
            this.setData({ loading: false });
        }
    }
});
