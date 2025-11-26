Page({
    data: {
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
        loading: true
    },

    onLoad() {
        this.loadDashboardData();
    },

    onShow() {
        // 刷新数据
        this.loadDashboardData();
    },

    async loadDashboardData() {
        try {
            wx.showLoading({ title: '加载中...', mask: true });

            // 获取总体统计
            const statsRes = await wx.cloud.callFunction({
                name: 'adminDashboard',
                data: { action: 'getStats' }
            });

            // 获取今日统计
            const todayRes = await wx.cloud.callFunction({
                name: 'adminDashboard',
                data: { action: 'getTodayStats' }
            });

            if (statsRes.result.code === 0) {
                this.setData({ stats: statsRes.result.data });
            }

            if (todayRes.result.code === 0) {
                this.setData({ todayStats: todayRes.result.data });
            }

            this.setData({ loading: false });

        } catch (error) {
            console.error('Load dashboard failed', error);
            wx.showToast({ title: '加载失败', icon: 'none' });
            this.setData({ loading: false });
        } finally {
            wx.hideLoading();
        }
    },

    goToUserManagement() {
        wx.navigateTo({
            url: '/subpackages/packageAdmin/pages/admin-user-list/admin-user-list'
        });
    },

    goToOrderManagement() {
        wx.navigateTo({
            url: '/subpackages/packageAdmin/pages/admin-order-list/admin-order-list'
        });
    },

    goToServiceManagement() {
        wx.navigateTo({
            url: '/subpackages/packageAdmin/pages/admin-service-list/admin-service-list'
        });
    },

    goToPersonnelAudit() {
        wx.navigateTo({
            url: '/subpackages/packageAdmin/pages/admin-personnel-audit/admin-personnel-audit'
        });
    },

    goToHomeSettings() {
        wx.navigateTo({
            url: '/subpackages/packageAdmin/pages/admin-home-settings/admin-home-settings'
        });
    },

    // ================== 退出登录 ==================
    onLogout() {
      wx.showModal({
          title: '退出登录',
          content: '确定要退出管理员账号吗？',
          success: (res) => {
              if (res.confirm) {
                  this.doLogout();
              }
          }
      });
    },

    doLogout() {
      // 清除所有登录相关缓存
      wx.removeStorageSync('user_token');
      wx.removeStorageSync('user_role');
      wx.removeStorageSync('user_openid');
      wx.removeStorageSync('user_info');

      // 强制跳回登录页（避免自动登录）
      wx.reLaunch({
          url: '/pages/login/login'
      });
    }

});
