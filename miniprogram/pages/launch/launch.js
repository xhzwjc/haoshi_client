Page({
  onLoad() {
    const token = wx.getStorageSync('user_token');
    const role = wx.getStorageSync('user_role');

    if (token && role) {
      const ROLE_ROUTES = {
        CLIENT: '/pages/index/index',
        TECHNICIAN: '/subpackages/packageTech/pages/technician-index/technician-index',
        ADMIN: '/subpackages/packageAdmin/pages/admin-dashboard/admin-dashboard'
      };

      const target = ROLE_ROUTES[role];
      if (target) {
        wx.reLaunch({ url: target });
        return;
      }
    }

    // 未登录 → 进 login
    wx.reLaunch({ url: '/pages/login/login' });
  }
});
