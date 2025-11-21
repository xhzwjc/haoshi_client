// app.js
App({
  onLaunch() {
    // 1. 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        // 替换为你的环境ID
        env: 'cloud1-7g9gxakebe8535a6', 
        traceUser: true,
      });
    }

    // 2. 检查并强制跳转到登录页（如果未登录）
    this.checkLoginAndRedirect();
  },

  onShow(options) {
    // 确保在每次显示小程序时都检查身份（防止用户在未登录状态下从分享进入）
    this.checkLoginAndRedirect();
  },

  globalData: {
    // 默认的客户端首页和家政端首页路径
    clientIndexUrl: '/pages/index/index',
    technicianIndexUrl: '/subpackages/packageTech/pages/technician-index/technician-index',
    loginUrl: '/pages/login/login', // 统一登录页
    servicePhone: '400-889-8898',
  },

  /**
   * 核心：检查登录状态和重定向
   */
  checkLoginAndRedirect(isLoginPageRedirect = false) {
    const token = wx.getStorageSync('user_token');
    const role = wx.getStorageSync('user_role');

    if (isLoginPageRedirect) return;
    
    // 获取当前页面路径
    const pages = getCurrentPages();
    const currentPath = pages.length > 0 ? `/${pages[pages.length - 1].route}` : this.globalData.loginUrl;
    
    // 如果没有 Token (未登录)，且当前不在登录页，强制跳转到登录页
    if (!token && currentPath !== this.globalData.loginUrl) {
      wx.reLaunch({ url: this.globalData.loginUrl });
      return;
    }

    // 如果已登录，但身份与当前页面不匹配，尝试重定向到正确的首页
    if (token) {
      const isClientPath = currentPath.indexOf('technician-') === -1 && currentPath.indexOf('packageTech') === -1;
      const isTechnicianPath = currentPath.indexOf('technician-') > -1 || currentPath.indexOf('packageTech') > -1;

      if (role === 'TECHNICIAN' && !isTechnicianPath) {
        // 家政人员登录，但当前在客户端页面，跳转到家政端首页
        wx.reLaunch({ url: this.globalData.technicianIndexUrl });
      } else if (role === 'CLIENT' && !isClientPath) {
        // 客户端登录，但当前在家政端页面，跳转到客户端首页
        wx.reLaunch({ url: this.globalData.clientIndexUrl });
      }
      // 否则，保持在当前页面
    }
  },

  /**
   * 判断当前用户是否为家政人员
   */
  isTechnician() {
    return wx.getStorageSync('user_role') === 'TECHNICIAN';
  },

  /**
   * 等待云开发环境初始化完成（用于技师端调用客户端云函数）
   * 返回一个 Promise，确保云开发环境已初始化
   */
  waitClientCloudReady() {
    return new Promise((resolve, reject) => {
      if (wx.cloud) {
        // 云开发已初始化，直接返回
        resolve(wx.cloud);
      } else {
        // 如果云开发未初始化，等待一段时间后重试
        let retries = 0;
        const maxRetries = 10;
        const checkInterval = setInterval(() => {
          if (wx.cloud) {
            clearInterval(checkInterval);
            resolve(wx.cloud);
          } else {
            retries++;
            if (retries >= maxRetries) {
              clearInterval(checkInterval);
              reject(new Error('云开发环境初始化超时'));
            }
          }
        }, 100);
      }
    });
  },

  logout() {
    try {
      wx.removeStorageSync('user_token');
      wx.removeStorageSync('user_role');
      wx.removeStorageSync('user_openid');
      wx.removeStorageSync('client_profile_cache');
      wx.removeStorageSync('client_account_phone');
      wx.removeStorageSync('client_last_account');
      wx.removeStorageSync('technician_profile_cache');
      wx.removeStorageSync('technician_account_phone');
    } catch (err) {
      console.warn('清理登录状态失败', err);
    }

    wx.showToast({ title: '已退出登录', icon: 'none' });

    setTimeout(() => {
      wx.reLaunch({ url: this.globalData.loginUrl });
    }, 300);
  }
})
