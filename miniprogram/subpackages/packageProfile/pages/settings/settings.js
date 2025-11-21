const app = getApp();

Page({
  handleLogout() {
    wx.showModal({
      title: '确认退出登录',
      content: '退出后将清空登录信息，确定继续吗？',
      confirmText: '退出',
      cancelText: '取消',
      confirmColor: '#d14343',
      success(res) {
        if (!res.confirm) return;

        if (app && typeof app.logout === 'function') {
          app.logout();
          return;
        }

        try {
          wx.removeStorageSync('user_token');
          wx.removeStorageSync('user_role');
          wx.removeStorageSync('user_openid');
          wx.removeStorageSync('client_profile_cache');
          wx.removeStorageSync('client_account_phone');
          wx.removeStorageSync('client_last_account');
          wx.removeStorageSync('technician_profile_cache');
          wx.removeStorageSync('technician_account_phone');
        } catch (e) {
          console.warn('本地登出兜底逻辑异常', e);
        }

        wx.showToast({ title: '已退出登录', icon: 'none' });
        setTimeout(() => {
          wx.reLaunch({ url: app?.globalData?.loginUrl || '/pages/login/login' });
        }, 300);
      }
    });
  }
});
