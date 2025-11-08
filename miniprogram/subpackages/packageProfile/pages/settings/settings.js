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
        if (res.confirm) {
          app.logout();
        }
      }
    });
  }
});
