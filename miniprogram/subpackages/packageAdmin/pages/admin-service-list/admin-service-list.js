Page({
    data: {
        services: [],
        loading: false
    },

    onLoad() {
        this.loadServices();
    },

    async loadServices() {
        try {
            this.setData({ loading: true });
            const res = await wx.cloud.callFunction({
                name: 'adminManageServices',
                data: { action: 'getServices' }
            });

            if (res.result.code === 0) {
                this.setData({ services: res.result.data || [] });
            }
        } catch (error) {
            console.error('Load services failed', error);
            wx.showToast({ title: '加载失败', icon: 'none' });
        } finally {
            this.setData({ loading: false });
        }
    },

    addService() {
        wx.showToast({ title: '功能待实现', icon: 'none' });
    }
});
