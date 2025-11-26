// app.js
App({
  globalData: {
    // 默认的客户端首页和家政端首页路径
    clientIndexUrl: '/pages/index/index',
    technicianIndexUrl: '/subpackages/packageTech/pages/technician-index/technician-index',
    loginUrl: '/pages/login/login', // 统一登录页
    servicePhone: '400-889-8898',
    homeSettings: {
      notice: '',
      banners: []
    }
  },

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

    // 加载首页配置
    this.loadHomeSettings();

    // 2. 根据缓存的角色自动跳转到对应首页（实现持久化登录）
    this.autoNavigateByRole();
  },

  async loadHomeSettings() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getGlobalConfig',
        data: { key: 'home_settings' }
      });
      if (res.result.code === 0 && res.result.data) {
        this.globalData.homeSettings = res.result.data;
        // 通知首页更新（如果有回调）
        if (this.homeSettingsCallback) {
          this.homeSettingsCallback(res.result.data);
        }
      }
    } catch (err) {
      console.error('Load home settings failed', err);
    }
  },

  onShow(options) {
    // 小程序从后台切换到前台时触发
    // 注意：不在这里强制检查登录，避免干扰持久化登录
    // 如果需要检查特定场景（如从分享进入），可在具体页面的 onLoad 中处理
  },

  /**
   * 根据缓存的角色自动跳转到对应首页（实现持久化登录）
   * 这是启动时的核心逻辑，替代原有的强制跳转登录页
   */
  async autoNavigateByRole() {
    const token = wx.getStorageSync('user_token');
    const role = wx.getStorageSync('user_role');

    // 如果没有登录信息，跳转到登录页
    if (!token || !role) {
      console.log('[autoNavigateByRole] 未检测到登录信息，跳转登录页');
      wx.reLaunch({ url: this.globalData.loginUrl });
      return;
    }

    // 【可选】校验 token 有效性
    // 如果后端提供了 validateToken 云函数，可以取消下面的注释
    // const isValid = await this.validateToken(token);
    // if (!isValid) {
    //   console.log('[autoNavigateByRole] Token 无效，清理缓存并跳转登录页');
    //   this.logout();
    //   return;
    // }

    // 根据角色跳转到对应首页
    const ROLE_ROUTES = {
      CLIENT: this.globalData.clientIndexUrl,
      TECHNICIAN: this.globalData.technicianIndexUrl,
      ADMIN: '/subpackages/packageAdmin/pages/admin-dashboard/admin-dashboard'
    };

    const targetUrl = ROLE_ROUTES[role];
    if (targetUrl) {
      console.log(`[autoNavigateByRole] 检测到角色 ${role}，跳转到 ${targetUrl}`);
      wx.reLaunch({ url: targetUrl });
    } else {
      // 角色异常，清理并重新登录
      console.warn('[autoNavigateByRole] 角色无效，清理缓存并跳转登录页');
      this.logout();
    }
  },

  /**
   * 校验 Token 有效性（可选强化功能）
   * @param {string} token - 用户 token
   * @returns {Promise<boolean>} token 是否有效
   * 
   * 注意：此功能需要后端提供 validateToken 云函数
   * 如果暂不可用，可以跳过此步骤，仅依赖客户端缓存判断
   */
  async validateToken(token) {
    if (!token) return false;

    try {
      // 调用后端云函数校验 token
      const res = await wx.cloud.callFunction({
        name: 'validateToken', // 需要后端提供此云函数
        data: { token }
      });

      return res.result.code === 0 && res.result.valid === true;
    } catch (error) {
      console.error('[validateToken] Token 校验失败', error);
      // 校验失败（如云函数不存在）视为有效，避免阻断用户
      // 如果需要严格校验，改为 return false
      return true;
    }
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
});
