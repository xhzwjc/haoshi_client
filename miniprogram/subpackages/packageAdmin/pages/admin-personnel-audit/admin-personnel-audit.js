// admin-personnel-audit.js
const app = getApp();

Page({
    data: {
        statusBarHeight: 44, // 默认安全高度
        currentStatus: 'all', // 筛选状态
        technicians: [],
        loading: false,
        // 映射筛选器的索引到具体状态值
        tabs: [
            { label: '全部', value: 'all' },
            { label: '待审核', value: 'PENDING' },
            { label: '正常', value: 'ACTIVE' },
            { label: '已禁用', value: 'DISABLED' }
        ],
        activeTabIndex: 0
    },

    onLoad() {
        // 1. 获取系统信息以适配导航栏
        try {
            const sysInfo = wx.getSystemInfoSync();
            if (sysInfo.statusBarHeight) {
                this.setData({ statusBarHeight: sysInfo.statusBarHeight });
            }
        } catch (e) {
            console.error('系统信息获取失败', e);
        }

        this.loadTechnicians('all');
    },

    // 返回上一页
    onBack() {
        wx.navigateBack();
    },

    // 切换 Tab
    onTabChange(e) {
        const index = e.currentTarget.dataset.index;
        const status = this.data.tabs[index].value;
        
        if (this.data.activeTabIndex === index) return;

        this.setData({ 
            activeTabIndex: index,
            currentStatus: status 
        });
        this.loadTechnicians(status);
    },

    async loadTechnicians(status) {
        if (this.data.loading) return;
        this.setData({ loading: true });

        try {
            const params = {
                action: 'getTechnicians',
                page: 1,
                pageSize: 100
            };
            if (status !== 'all') {
                params.status = status;
            }

            const res = await wx.cloud.callFunction({
                name: 'adminManageUsers',
                data: params
            });

            if (res.result.code === 0) {
                this.setData({ technicians: res.result.data.list || [] });
            } else {
                wx.showToast({ title: res.result.message, icon: 'none' });
            }
        } catch (error) {
            console.error('Load technicians failed', error);
            wx.showToast({ title: '加载失败', icon: 'none' });
        } finally {
            this.setData({ loading: false });
        }
    },

    updateStatus(e) {
        const { id, status } = e.currentTarget.dataset;
        let title = '提示';
        let content = '确认执行此操作？';
        let confirmColor = '#007AFF';

        if (status === 'ACTIVE') {
            title = '通过审核';
            content = '确认批准该师傅加入平台？';
            confirmColor = '#34C759'; // Green
        } else if (status === 'DISABLED') {
            title = '禁用账号';
            content = '禁用后该师傅将无法接单，确认操作？';
            confirmColor = '#FF3B30'; // Red
        }

        wx.showModal({
            title,
            content,
            confirmColor,
            success: async (res) => {
                if (!res.confirm) return;
                
                wx.showLoading({ title: '处理中...' });
                try {
                    const result = await wx.cloud.callFunction({
                        name: 'adminManageUsers',
                        data: {
                            action: 'updateTechnicianStatus',
                            techId: id,
                            status: status
                        }
                    });

                    wx.hideLoading();
                    if (result.result.code === 0) {
                        wx.showToast({ title: '操作成功', icon: 'success' });
                        // 重新加载当前列表
                        this.loadTechnicians(this.data.currentStatus);
                    } else {
                        wx.showToast({ title: result.result.message, icon: 'none' });
                    }
                } catch (error) {
                    wx.hideLoading();
                    // 处理云函数超时但实际成功的情况
                    if (error.errMsg && error.errMsg.includes('TIME_LIMIT_EXCEEDED')) {
                        wx.showToast({ title: '操作成功', icon: 'success' });
                        this.loadTechnicians(this.data.currentStatus);
                    } else {
                        wx.showToast({ title: '操作失败', icon: 'none' });
                    }
                }
            }
        });
    }
});