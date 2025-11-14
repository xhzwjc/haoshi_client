const app = getApp();

function normalizePhone(phone = '') {
    return String(phone).replace(/\s+/g, '').trim();
}

Page({
    data: {
        showLoginModal: false,
        modalTitle: '客户登录',
        modalSubtitle: '',
        currentRole: '',
        selectedRole: '',
        isAuthorizing: false,
    },

    onSelectRole(e) {
        const role = e.currentTarget.dataset.role;
        const modalTitle = role === 'CLIENT' ? '客户微信快捷登录' : '师傅微信快捷登录';
        const modalSubtitle = role === 'CLIENT'
            ? '授权微信手机号即可同步个人资料、常用地址与订单数据。'
            : '授权微信手机号后，将绑定至对应师傅账号并拉取个人任务数据。';

        this.setData({
            currentRole: role,
            modalTitle,
            modalSubtitle,
            showLoginModal: true,
            selectedRole: role,
        });
    },

    onCancelLogin() {
        if (this.data.isAuthorizing) return;
        this.setData({ showLoginModal: false, selectedRole: '', currentRole: '', modalSubtitle: '' });
    },

    async onAuthorizePhone(e) {
        if (this.data.isAuthorizing) {
            return;
        }

        const { currentRole } = this.data;
        if (!currentRole) {
            wx.showToast({ title: '请先选择登录身份', icon: 'none' });
            return;
        }

        const detail = e && e.detail ? e.detail : {};
        if (!detail.errMsg || detail.errMsg.indexOf('getPhoneNumber:ok') === -1) {
            wx.showToast({ title: '已取消授权', icon: 'none' });
            return;
        }

        const authCode = detail.code || '';
        if (!authCode) {
            wx.showToast({ title: '无法获取手机号凭证', icon: 'none' });
            return;
        }

        this.setData({ isAuthorizing: true });
        wx.showLoading({ title: '登录中...', mask: true });

        try {
            const phoneRes = await wx.cloud.callFunction({
                name: 'getPhoneNumber',
                data: { code: authCode }
            });

            if (!phoneRes.result || phoneRes.result.code !== 0) {
                throw new Error((phoneRes.result && phoneRes.result.message) || '获取手机号失败');
            }

            const phone = normalizePhone(phoneRes.result.data && phoneRes.result.data.phoneNumber);
            if (!phone) {
                throw new Error('手机号解析失败');
            }

            if (currentRole === 'CLIENT') {
                await this.handleClientLogin(phone);
            } else {
                await this.handleTechnicianLogin(phone);
            }

            this.setData({
                showLoginModal: false,
                selectedRole: '',
                currentRole: '',
                modalSubtitle: ''
            });

            this.redirectToHomePage(currentRole);
        } catch (error) {
            console.error('微信手机号登录失败', error);
            wx.showToast({ title: error.message || '登录失败', icon: 'none' });
        } finally {
            this.setData({ isAuthorizing: false });
            wx.hideLoading();
        }
    },

    async handleClientLogin(phone) {
        const clientCloud = await app.waitClientCloudReady();
        const res = await clientCloud.callFunction({
            name: 'getClientProfile',
            data: {
                action: 'wechatPhoneLogin',
                phone
            }
        });

        if (!res.result || res.result.code !== 0) {
            throw new Error((res.result && res.result.message) || '登录失败');
        }

        const { token, openid, profile } = res.result.data || {};
        if (!token || !openid) {
            throw new Error('登录信息不完整');
        }

        wx.setStorageSync('user_token', token);
        wx.setStorageSync('user_role', 'CLIENT');
        wx.setStorageSync('user_openid', openid);
        wx.setStorageSync('client_account_phone', phone);

        if (profile) {
            wx.setStorageSync('client_profile_cache', profile);
        }

        wx.showToast({ title: '登录成功', icon: 'success' });
    },

    async handleTechnicianLogin(phone) {
        const res = await wx.cloud.callFunction({
            name: 'technicianAuthLogin',
            data: {
                action: 'wechatPhoneLogin',
                phone
            }
        });

        if (!res.result || res.result.code !== 0) {
            throw new Error((res.result && res.result.message) || '登录失败');
        }

        const { token, openid, profile } = res.result.data || {};
        if (!token || !openid) {
            throw new Error('登录信息不完整');
        }

        wx.setStorageSync('user_token', token);
        wx.setStorageSync('user_role', 'TECHNICIAN');
        wx.setStorageSync('user_openid', openid);
        wx.setStorageSync('technician_account_phone', phone);

        if (profile) {
            wx.setStorageSync('technician_profile_cache', profile);
        }

        wx.showToast({ title: '登录成功', icon: 'success' });
    },

    redirectToHomePage(role) {
      const url = role === 'TECHNICIAN'
          ? app.globalData.technicianIndexUrl
          : app.globalData.clientIndexUrl;

      if (app.checkLoginAndRedirect) {
          app.checkLoginAndRedirect(true);
      }

      wx.reLaunch({
          url,
          success: () => {
              console.log(`Successfully redirected to: ${url}`);
          },
          fail: (e) => {
              console.error('Login redirection failed, check path:', url, e);
              wx.showModal({
                  title: '跳转失败',
                  content: `请检查路径配置是否正确: ${url}\n错误信息: ${e.errMsg || '未知错误'}`,
                  showCancel: false
              });
          }
      });
    }
});
