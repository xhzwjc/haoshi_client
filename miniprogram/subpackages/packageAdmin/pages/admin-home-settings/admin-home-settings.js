// admin-home-settings.js
const app = getApp();

Page({
    data: {
        statusBarHeight: 44, // 默认安全高度
        notice: '',
        banners: [],
        saving: false
    },

    onLoad() {
        // 1. 适配导航栏
        try {
            const sysInfo = wx.getSystemInfoSync();
            if (sysInfo.statusBarHeight) {
                this.setData({ statusBarHeight: sysInfo.statusBarHeight });
            }
        } catch (e) {
            console.error('系统信息获取失败', e);
        }

        this.loadSettings();
    },

    onBack() {
        wx.navigateBack();
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

            if (res.result && res.result.code === 0) {
                wx.showToast({ title: '已保存', icon: 'success' });
                // 更新全局状态
                const app = getApp();
                if (app) {
                    app.globalData.homeSettings = {
                        notice: this.data.notice,
                        banners: this.data.banners
                    };
                }
                // 延迟返回，给用户反馈时间
                setTimeout(() => {
                    wx.navigateBack();
                }, 800);
            } else {
                throw new Error(res.result ? res.result.message : '保存异常');
            }
        } catch (err) {
            console.error('Save failed', err);
            wx.showToast({ title: '保存失败', icon: 'none' });
        } finally {
            this.setData({ saving: false });
        }
    }
});