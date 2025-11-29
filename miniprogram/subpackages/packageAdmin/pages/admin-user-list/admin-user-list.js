// admin-user-list.js
const app = getApp();

Page({
    data: {
        statusBarHeight: 44, // 默认高度，防抖动
        currentTab: 0, // 0: 客户, 1: 服务人员
        clients: [],
        technicians: [],
        loading: false
    },

    onLoad() {
        // 1. 获取系统信息适配导航栏
        try {
            const sysInfo = wx.getSystemInfoSync();
            if (sysInfo.statusBarHeight) {
                this.setData({ statusBarHeight: sysInfo.statusBarHeight });
            }
        } catch (e) {
            console.error('系统信息获取失败', e);
        }

        this.loadClients();
    },

    // 返回上一页
    onBack() {
        wx.navigateBack();
    },

    onTabChange(e) {
        const index = parseInt(e.currentTarget.dataset.index);
        if (this.data.currentTab === index) return;

        this.setData({ currentTab: index });

        // 切换时如果没数据则加载
        if (index === 0 && this.data.clients.length === 0) {
            this.loadClients();
        } else if (index === 1 && this.data.technicians.length === 0) {
            this.loadTechnicians();
        }
    },

    async loadClients() {
        if (this.data.loading) return;
        this.setData({ loading: true });

        try {
            const res = await wx.cloud.callFunction({
                name: 'adminManageUsers',
                data: { action: 'getClients', page: 1, pageSize: 100 }
            });

            if (res.result && res.result.code === 0) {
                this.setData({ clients: res.result.data.list || [] });
            } else {
                wx.showToast({ title: '加载失败', icon: 'none' });
            }
        } catch (error) {
            console.error('Load clients failed', error);
        } finally {
            this.setData({ loading: false });
        }
    },

    async loadTechnicians() {
        if (this.data.loading) return;
        this.setData({ loading: true });

        try {
            const res = await wx.cloud.callFunction({
                name: 'adminManageUsers',
                data: { action: 'getTechnicians', page: 1, pageSize: 100 }
            });

            if (res.result && res.result.code === 0) {
                this.setData({ technicians: res.result.data.list || [] });
            } else {
                wx.showToast({ title: '加载失败', icon: 'none' });
            }
        } catch (error) {
            console.error('Load technicians failed', error);
        } finally {
            this.setData({ loading: false });
        }
    }
});