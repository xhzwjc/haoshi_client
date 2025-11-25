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
            } else {
                wx.showToast({ title: res.result.message, icon: 'none' });
            }
        } catch (error) {
            console.error('Load services failed', error);
            wx.showToast({ title: '加载失败', icon: 'none' });
        } finally {
            this.setData({ loading: false });
        }
    },

    addService() {
        console.log('addService clicked - navigating to edit page');
        wx.navigateTo({
            url: '/subpackages/packageAdmin/pages/admin-service-edit/admin-service-edit?mode=add',
            fail: (err) => {
                console.error('Navigation failed:', err);
                wx.showToast({
                    title: '页面跳转失败',
                    icon: 'none'
                });
            }
        });
    },

    editService(e) {
        const id = e.currentTarget.dataset.id;
        wx.navigateTo({
            url: `/subpackages/packageAdmin/pages/admin-service-edit/admin-service-edit?mode=edit&id=${id}`
        });
    },

    async toggleService(e) {
        const id = e.currentTarget.dataset.id;
        const currentEnabled = e.currentTarget.dataset.enabled;
        const newEnabled = !currentEnabled;

        try {
            wx.showLoading({ title: '操作中...' });
            const res = await wx.cloud.callFunction({
                name: 'adminManageServices',
                data: {
                    action: 'toggleStatus',
                    serviceId: id,
                    enabled: newEnabled
                }
            });

            wx.hideLoading();

            if (res.result.code === 0) {
                wx.showToast({
                    title: res.result.message,
                    icon: 'success'
                });
                // 更新本地数据
                const services = this.data.services.map(service => {
                    if (service._id === id) {
                        return { ...service, enabled: newEnabled };
                    }
                    return service;
                });
                this.setData({ services });
            } else {
                wx.showToast({ title: res.result.message, icon: 'none' });
            }
        } catch (error) {
            wx.hideLoading();
            console.error('Toggle service failed', error);
            wx.showToast({ title: '操作失败', icon: 'none' });
        }
    }
});
