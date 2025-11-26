Page({
    data: {
        notice: '',
        banners: [],
        saving: false
    },

    onLoad() {
        this.loadSettings();
    },

    async loadSettings() {
        wx.showLoading({ title: '加载中...' });
        try {
            const res = await wx.cloud.callFunction({
                name: 'getGlobalConfig',
                data: { key: 'home_settings' }
            });
            if (res.result.code === 0 && res.result.data) {
                const { notice, banners } = res.result.data;
                this.setData({
                    notice: notice || '',
                    banners: banners || []
                });
            }
        } catch (err) {
            console.error('Failed to load settings', err);
            wx.showToast({ title: '加载失败', icon: 'none' });
        } finally {
            wx.hideLoading();
        }
    },

    onNoticeInput(e) {
        this.setData({ notice: e.detail.value });
    },

    addBanner() {
        wx.chooseImage({
            count: 1,
            sizeType: ['compressed'],
            sourceType: ['album', 'camera'],
            success: async (res) => {
                const tempFilePath = res.tempFilePaths[0];
                this.uploadBanner(tempFilePath);
            }
        });
    },

    async uploadBanner(filePath) {
        wx.showLoading({ title: '上传中...' });
        try {
            const cloudPath = `banners/${Date.now()}-${Math.floor(Math.random() * 1000)}.png`;
            const res = await wx.cloud.uploadFile({
                cloudPath: cloudPath,
                filePath: filePath
            });

            const banners = [...this.data.banners, res.fileID];
            this.setData({ banners });
        } catch (err) {
            console.error('Upload failed', err);
            wx.showToast({ title: '上传失败', icon: 'none' });
        } finally {
            wx.hideLoading();
        }
    },

    deleteBanner(e) {
        const index = e.currentTarget.dataset.index;
        const banners = this.data.banners.filter((_, i) => i !== index);
        this.setData({ banners });
    },

    async saveSettings() {
        if (this.data.saving) return;
        this.setData({ saving: true });

        try {
            console.log('Calling updateGlobalConfig with:', {
                key: 'home_settings',
                data: {
                    notice: this.data.notice,
                    banners: this.data.banners
                }
            });

            const res = await wx.cloud.callFunction({
                name: 'updateGlobalConfig',
                data: {
                    key: 'home_settings',
                    data: {
                        notice: this.data.notice,
                        banners: this.data.banners
                    }
                }
            });

            console.log('Cloud function response:', res);

            if (res.result && res.result.code === 0) {
                wx.showToast({ title: '保存成功', icon: 'success' });
                // 更新 globalData，以便返回首页时立即生效
                const app = getApp();
                if (app) {
                    app.globalData.homeSettings = {
                        notice: this.data.notice,
                        banners: this.data.banners
                    };
                }
            } else {
                const errorMsg = res.result ? res.result.message : '未知错误';
                console.error('Cloud function returned error:', res.result);
                throw new Error(errorMsg);
            }
        } catch (err) {
            console.error('Save settings failed', err);
            wx.showToast({
                title: `保存失败: ${err.message || '请检查云函数是否已部署'}`,
                icon: 'none',
                duration: 3000
            });
        } finally {
            this.setData({ saving: false });
        }
    }
});
