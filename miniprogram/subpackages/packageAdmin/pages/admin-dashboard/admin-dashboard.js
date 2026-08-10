// admin-dashboard.js
const app = getApp();

Page({
    data: {
        statusBarHeight: 44, 
        stats: {
            totalUsers: 0,
            totalOrders: 0,
            totalTechs: 0,
            totalRevenue: '0.00'
        },
        todayStats: {
            newOrders: 0,
            completedOrders: 0,
            revenue: '0.00',
            newUsers: 0
        },
        todayDate: ''
    },

    onLoad() {
        // 1. 获取状态栏高度
        try {
            const sysInfo = wx.getSystemInfoSync();
            if (sysInfo.statusBarHeight) {
                this.setData({ statusBarHeight: sysInfo.statusBarHeight });
            }
        } catch (e) {
            console.error('获取系统信息失败', e);
        }

        // 2. 设置日期
        this.setTodayDate();

        // 3. 加载数据
        this.loadDashboardData();
    },

    onShow() {
        this.loadDashboardData();
    },

    setTodayDate() {
        const now = new Date();
        const month = now.getMonth() + 1;
        const date = now.getDate();
        const weeks = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const day = weeks[now.getDay()];
        this.setData({
            todayDate: `${month}月${date}日 ${day}`
        });
    },

    async loadDashboardData() {
        try {
            const [statsRes, todayRes] = await Promise.all([
                wx.cloud.callFunction({ name: 'adminDashboard', data: { action: 'getStats' } }),
                wx.cloud.callFunction({ name: 'adminDashboard', data: { action: 'getTodayStats' } })
            ]);

            if (statsRes.result.code === 0) this.setData({ stats: statsRes.result.data });
            if (todayRes.result.code === 0) this.setData({ todayStats: todayRes.result.data });
        } catch (error) {
            console.error('Load dashboard failed', error);
        } finally {
            wx.stopPullDownRefresh();
        }
    },

    onPullDownRefresh() {
        this.loadDashboardData();
    },

    // --- 页面跳转 ---
    goToUserManagement() { wx.navigateTo({ url: '/subpackages/packageAdmin/pages/admin-user-list/admin-user-list' }); },
    goToOrderManagement() { wx.navigateTo({ url: '/subpackages/packageAdmin/pages/admin-order-list/admin-order-list' }); },
    goToServiceManagement() { wx.navigateTo({ url: '/subpackages/packageAdmin/pages/admin-service-list/admin-service-list' }); },
    goToPersonnelAudit() { wx.navigateTo({ url: '/subpackages/packageAdmin/pages/admin-personnel-audit/admin-personnel-audit' }); },
    goToHomeSettings() { wx.navigateTo({ url: '/subpackages/packageAdmin/pages/admin-home-settings/admin-home-settings' }); },

    // --- 退出登录 (核心修复) ---
    onLogout() {
      wx.showModal({
          title: '退出登录',
          content: '确定要退出管理员账号吗？',
          confirmColor: '#FF3B30', // iOS 红色警示风格
          success: (res) => {
              if (res.confirm) {
                  // 【还原您的原始逻辑】精确清除，不误删其他缓存
                  wx.removeStorageSync('user_token');
                  wx.removeStorageSync('user_role');
                  wx.removeStorageSync('user_openid');
                  wx.removeStorageSync('user_info');

                  // 强制跳回登录页
                  wx.reLaunch({
                      url: '/pages/login/login'
                  });
              }
          }
      });
    }
});