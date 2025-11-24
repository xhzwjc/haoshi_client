Page({
    data: {
        currentStatus: 'all', // all, PENDING, ACTIVE, DISABLED
        technicians: [],
        loading: false
    },

    onLoad() {
        this.loadTechnicians('all');
    },

    onStatusChange(e) {
        const status = e.currentTarget.dataset.status;
        this.setData({ currentStatus: status });
        this.loadTechnicians(status);
    },

    async loadTechnicians(status) {
        try {
            this.setData({ loading: true });

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

    async updateStatus(e) {
        const { id, status } = e.currentTarget.dataset;

        let title = '';
        if (status === 'ACTIVE') {
            title = '确认通过审核？';
        } else if (status === 'DISABLED') {
            title = '确认禁用该师傅？';
        }

        wx.showModal({
            title: title,
            content: '此操作将改变师傅的状态',
            success: async (res) => {
                if (!res.confirm) return;

                try {
                    wx.showLoading({ title: '处理中...' });

                    const result = await wx.cloud.callFunction({
                        name: 'adminManageUsers',
                        data: {
                            action: 'updateTechnicianStatus',
                            techId: id,
                            status: status
                        }
                    });

                    if (result.result.code === 0) {
                        wx.showToast({ title: '操作成功', icon: 'success' });
                        // 刷新列表
                        this.loadTechnicians(this.data.currentStatus);
                    } else {
                        wx.showToast({ title: result.result.message, icon: 'none' });
                    }
                } catch (error) {
                    console.error('Update status failed', error);
                    wx.showToast({ title: '操作失败', icon: 'none' });
                } finally {
                    wx.hideLoading();
                }
            }
        });
    }
});
