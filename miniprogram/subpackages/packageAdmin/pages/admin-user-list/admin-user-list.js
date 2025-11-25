Page({
    data: {
        currentTab: 0, // 0: 客户列表, 1: 服务人员列表
        clients: [],
        technicians: [],
        loading: false
    },

    onLoad() {
        this.loadClients();
    },

    onTabChange(e) {
        const index = parseInt(e.currentTarget.dataset.index);
        console.log('Tab changed to:', index);

        this.setData({ currentTab: index });

        if (index === 0) {
            if (this.data.clients.length === 0) {
                this.loadClients();
            }
        } else if (index === 1) {
            if (this.data.technicians.length === 0) {
                this.loadTechnicians();
            }
        }
    },

    async loadClients() {
        try {
            this.setData({ loading: true });

            const res = await wx.cloud.callFunction({
                name: 'adminManageUsers',
                data: {
                    action: 'getClients',
                    page: 1,
                    pageSize: 100
                }
            });

            console.log('Load clients result:', res);

            if (res.result && res.result.code === 0) {
                this.setData({ clients: res.result.data.list || [] });
            } else {
                wx.showToast({ title: res.result?.message || '加载失败', icon: 'none' });
            }
        } catch (error) {
            console.error('Load clients failed', error);
            wx.showToast({ title: '加载失败', icon: 'none' });
        } finally {
            this.setData({ loading: false });
        }
    },

    async loadTechnicians() {
        try {
            this.setData({ loading: true });

            const res = await wx.cloud.callFunction({
                name: 'adminManageUsers',
                data: {
                    action: 'getTechnicians',
                    page: 1,
                    pageSize: 100
                }
            });

            console.log('Load technicians result:', res);

            if (res.result && res.result.code === 0) {
                this.setData({ technicians: res.result.data.list || [] });
            } else {
                wx.showToast({ title: res.result?.message || '加载失败', icon: 'none' });
            }
        } catch (error) {
            console.error('Load technicians failed', error);
            wx.showToast({ title: '加载失败', icon: 'none' });
        } finally {
            this.setData({ loading: false });
        }
    }
});
