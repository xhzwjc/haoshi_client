const app = getApp();

const DEFAULT_PROFILE = {
  name: '',
  phone: '',
  gender: '保密',
  birthday: '',
  address: '',
  avatar: ''
};

Page({
  data: {
    profile: { ...DEFAULT_PROFILE },
    genderOptions: ['保密', '女士', '先生'],
    genderIndex: 0,
    saving: false,
    defaultAvatar: '/packageCommon/images/default_avatar.png'
  },

  onLoad() {
    this.loadProfile();
  },

  async loadProfile() {
    wx.showLoading({ title: '加载中', mask: true });
    try {
      const clientCloud = await app.waitClientCloudReady();
      const res = await clientCloud.callFunction({ name: 'getClientProfile' });
      if (res.result && res.result.code === 0) {
        const profile = { ...DEFAULT_PROFILE, ...(res.result.data || {}) };
        const genderIndex = this.data.genderOptions.indexOf(profile.gender || '保密');
        this.setData({
          profile,
          genderIndex: genderIndex >= 0 ? genderIndex : 0
        });
      }
    } catch (err) {
      console.error('加载个人信息失败', err);
      wx.showToast({ title: '信息加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  onInputChange(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    if (!field) return;
    this.setData({ [`profile.${field}`]: value });
  },

  onGenderChange(e) {
    const index = Number(e.detail.value || 0);
    const gender = this.data.genderOptions[index] || '保密';
    this.setData({
      genderIndex: index,
      'profile.gender': gender
    });
  },

  onDateChange(e) {
    this.setData({ 'profile.birthday': e.detail.value });
  },

  async chooseAvatar() {
    try {
      const chooseRes = await wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      });
      if (!chooseRes.tempFilePaths || !chooseRes.tempFilePaths.length) return;

      const tempPath = chooseRes.tempFilePaths[0];
      wx.showLoading({ title: '上传中', mask: true });
      await app.waitClientCloudReady();
      const cloudPath = `avatars/${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`;
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath: tempPath
      });

      if (uploadRes && uploadRes.fileID) {
        this.setData({ 'profile.avatar': uploadRes.fileID });
      }
    } catch (err) {
      if (err && err.errMsg && err.errMsg.includes('cancel')) {
        return;
      }
      console.error('头像选择失败', err);
      wx.showToast({ title: '头像选择失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  validateProfile() {
    const { name, phone } = this.data.profile;
    if (!name || !name.trim()) {
      wx.showToast({ title: '请填写姓名', icon: 'none' });
      return false;
    }
    if (!/^\d{11}$/.test(phone || '')) {
      wx.showToast({ title: '请填写11位手机号', icon: 'none' });
      return false;
    }
    return true;
  },

  async submitProfile() {
    if (this.data.saving) return;
    if (!this.validateProfile()) return;

    this.setData({ saving: true });
    wx.showLoading({ title: '保存中', mask: true });

    try {
      const clientCloud = await app.waitClientCloudReady();
      const payload = { ...this.data.profile };
      const res = await clientCloud.callFunction({
        name: 'saveClientProfile',
        data: payload
      });

      if (res.result && res.result.code === 0) {
        try {
          const latest = await clientCloud.callFunction({ name: 'getClientProfile' });
          if (latest.result && latest.result.code === 0) {
            const freshProfile = { ...DEFAULT_PROFILE, ...(latest.result.data || {}) };
            const genderIndex = this.data.genderOptions.indexOf(freshProfile.gender || '保密');
            this.setData({
              profile: freshProfile,
              genderIndex: genderIndex >= 0 ? genderIndex : 0
            });
            wx.setStorageSync('client_profile_cache', freshProfile);
            if (freshProfile.phone) {
              wx.setStorageSync('client_account_phone', freshProfile.phone);
            }
          } else {
            const cached = wx.getStorageSync('client_profile_cache') || {};
            const merged = { ...cached, ...payload };
            const genderIndex = this.data.genderOptions.indexOf(merged.gender || '保密');
            this.setData({
              profile: merged,
              genderIndex: genderIndex >= 0 ? genderIndex : 0
            });
            wx.setStorageSync('client_profile_cache', merged);
          }
        } catch (refreshErr) {
          console.warn('刷新个人资料缓存失败', refreshErr);
          const cached = wx.getStorageSync('client_profile_cache') || {};
          const merged = { ...cached, ...payload };
          const genderIndex = this.data.genderOptions.indexOf(merged.gender || '保密');
          this.setData({
            profile: merged,
            genderIndex: genderIndex >= 0 ? genderIndex : 0
          });
          wx.setStorageSync('client_profile_cache', merged);
        }
        wx.showToast({ title: '保存成功', icon: 'success' });
        setTimeout(() => {
          wx.navigateBack({ delta: 1 });
        }, 600);
      } else {
        throw new Error((res.result && res.result.message) || '保存失败');
      }
    } catch (err) {
      console.error('保存个人信息失败', err);
      wx.showToast({ title: '保存失败，请稍后再试', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ saving: false });
    }
  }
});
