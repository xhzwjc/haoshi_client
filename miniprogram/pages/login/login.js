const app = getApp();

Page({
    data: {
        showLoginModal: false,
        modalTitle: '客户登录',
        inputPlaceholder: '请输入手机号或万能账号',
        currentRole: '', // 'CLIENT' or 'TECHNICIAN'
        selectedRole: '',
        account: '',
        password: ''
    },

    // 1. Select Role
    onSelectRole(e) {
        const role = e.currentTarget.dataset.role;
        const cachedPhone = role === 'CLIENT' ? (wx.getStorageSync('client_account_phone') || '') : '';
        const lastAccount = role === 'CLIENT' ? (wx.getStorageSync('client_last_account') || '') : '';
        const defaultAccount = role === 'CLIENT'
            ? (lastAccount || cachedPhone || '1')
            : '';

        this.setData({
            currentRole: role,
            modalTitle: role === 'CLIENT' ? '客户登录' : '家政人员登录',
            inputPlaceholder: role === 'CLIENT' ? '请输入手机号或万能账号' : '请输入工号/手机号',
            showLoginModal: true,
            selectedRole: role,
            account: defaultAccount,
            password: role === 'CLIENT' ? '6666' : ''
        });
    },

    // 2. Input Handling
    onInputAccount(e) { this.setData({ account: e.detail.value }); },
    onInputPassword(e) { this.setData({ password: e.detail.value }); },

    onCancelLogin() { this.setData({ showLoginModal: false, selectedRole: '' }); },

    // 3. [Core Logic] Confirm Login (Simulated Success)
    async onConfirmLogin() {
        const { currentRole } = this.data;
        const account = String(this.data.account || '').trim();
        const password = String(this.data.password || '').trim();
        const isUniversalAccount = account === '1';

        if (!currentRole) {
            return wx.showToast({ title: '请选择登录身份', icon: 'none' });
        }

        if (!account || !password) {
            return wx.showToast({ title: '请输入账号和密码', icon: 'none' });
        }

        if (currentRole === 'CLIENT' && !isUniversalAccount && !/^1\d{10}$/.test(account)) {
            return wx.showToast({ title: '请输入11位手机号或万能账号', icon: 'none' });
        }

        wx.showLoading({ title: '登录中...', mask: true });

        try {
            if (currentRole === 'CLIENT') {
                const clientCloud = await app.waitClientCloudReady();
                const res = await clientCloud.callFunction({
                    name: 'getClientProfile',
                    data: {
                        action: 'login',
                        account,
                        password
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
                wx.setStorageSync('user_role', currentRole);
                wx.setStorageSync('user_openid', openid);
                wx.setStorageSync('client_last_account', account);

                if (profile) {
                    wx.setStorageSync('client_profile_cache', profile);
                    if (profile.phone) {
                        wx.setStorageSync('client_account_phone', profile.phone);
                    }
                }

                if (!profile || !profile.phone) {
                    if (!isUniversalAccount && /^1\d{10}$/.test(account)) {
                        wx.setStorageSync('client_account_phone', account);
                    }
                }

                wx.showToast({ title: '登录成功', icon: 'success' });
            } else {
                // 家政端仍使用模拟登录，后续可接入真实认证
                const mockOpenid = `mock_openid_${currentRole}_${Date.now()}`;
                const mockToken = `MOCK_TOKEN_${currentRole}`;

                await new Promise(resolve => setTimeout(resolve, 300));

                wx.setStorageSync('user_token', mockToken);
                wx.setStorageSync('user_role', currentRole);
                wx.setStorageSync('user_openid', mockOpenid);

                wx.showToast({ title: '登录成功', icon: 'success' });
            }

            this.setData({
                showLoginModal: false,
                selectedRole: ''
            });

            this.redirectToHomePage(currentRole);
        } catch (error) {
            console.error('登录失败', error);
            wx.showToast({ title: error.message || '登录失败', icon: 'none' });
        } finally {
            wx.hideLoading();
        }
    },
    
    // 5. Redirection Logic (Relies on app.js globalData)
    redirectToHomePage(role) {
      const url = role === 'TECHNICIAN' 
          ? app.globalData.technicianIndexUrl 
          : app.globalData.clientIndexUrl;

      // 1. Critical Step: Notify app.js that this is a post-login redirect to prevent re-redirection in onShow/onLaunch
      if (app.checkLoginAndRedirect) {
          app.checkLoginAndRedirect(true); 
      }

      // 2. Execute jump with error catching
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
