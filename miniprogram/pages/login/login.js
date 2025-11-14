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
        inputPlaceholder: '请输入手机号或万能账号',
        account: '',
        password: '',
        clientLoginMethod: 'WECHAT'
    },

    onSelectRole(e) {
        const role = e.currentTarget.dataset.role;
        if (role === 'CLIENT') {
            const cachedPhone = wx.getStorageSync('client_account_phone') || '';
            const lastAccount = wx.getStorageSync('client_last_account') || '';
            const defaultAccount = lastAccount || cachedPhone || '1';

            this.setData({
                currentRole: role,
                modalTitle: '客户微信快捷登录',
                modalSubtitle: '授权微信手机号即可同步个人资料、常用地址与订单数据。',
                showLoginModal: true,
                selectedRole: role,
                isAuthorizing: false,
                account: defaultAccount,
                password: '6666',
                clientLoginMethod: 'WECHAT',
                inputPlaceholder: '请输入手机号或万能账号'
            });
            return;
        }

        this.setData({
            currentRole: role,
            modalTitle: '家政人员登录',
            modalSubtitle: '账号需为已登记的手机号或工号，首次默认密码 6666，万能账号为 1。',
            inputPlaceholder: '请输入手机号或工号',
            showLoginModal: true,
            selectedRole: role,
            account: '1',
            password: '6666',
            isAuthorizing: false,
            clientLoginMethod: 'WECHAT'
        });
    },

    onInputAccount(e) {
        this.setData({ account: e.detail.value });
    },

    onInputPassword(e) {
        this.setData({ password: e.detail.value });
    },

    onCancelLogin() {
        if (this.data.isAuthorizing) return;
        this.resetModalState();
    },

    onSwitchClientLoginMethod(e) {
        const method = e.currentTarget.dataset.method;
        if (!method || method === this.data.clientLoginMethod) {
            return;
        }

        const updates = {
            clientLoginMethod: method,
            isAuthorizing: false
        };

        if (method === 'PASSWORD') {
            const cachedPhone = wx.getStorageSync('client_account_phone') || '';
            const lastAccount = wx.getStorageSync('client_last_account') || '';
            updates.account = lastAccount || cachedPhone || '1';
            updates.password = '6666';
            updates.modalTitle = '客户账号登录';
            updates.modalSubtitle = '支持使用手机号或万能账号 1，默认密码 6666。';
        } else {
            updates.modalTitle = '客户微信快捷登录';
            updates.modalSubtitle = '授权微信手机号即可同步个人资料、常用地址与订单数据。';
        }

        this.setData(updates);
    },

    async onAuthorizePhone(e) {
        if (this.data.isAuthorizing) {
            return;
        }

        const { currentRole, clientLoginMethod } = this.data;
        if (!currentRole) {
            wx.showToast({ title: '请先选择登录身份', icon: 'none' });
            return;
        }

        if (currentRole !== 'CLIENT') {
            wx.showToast({ title: '请使用账号密码登录', icon: 'none' });
            return;
        }

        if (clientLoginMethod !== 'WECHAT') {
            wx.showToast({ title: '请切换到微信授权登录', icon: 'none' });
            return;
        }

        const detail = e && e.detail ? e.detail : {};
        const errMsg = detail.errMsg || '';
        if (!errMsg || errMsg.indexOf('getPhoneNumber:ok') === -1) {
            console.warn('微信手机号授权失败', detail);
            if (this.isDevtoolsEnvironment()) {
                wx.showModal({
                    title: '提示',
                    content: '开发者工具暂不支持获取微信手机号，系统将使用模拟手机号登录以便调试。',
                    showCancel: false,
                    success: async () => {
                        await this.simulateDevtoolsClientLogin();
                    }
                });
                return;
            }

            const toastMessage = errMsg.indexOf('user cancel') !== -1
                ? '您已取消授权'
                : '授权失败，请重试';
            wx.showToast({ title: toastMessage, icon: 'none' });
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

            await this.handleClientWechatLogin(phone);

            this.resetModalState();
            this.redirectToHomePage(currentRole);
        } catch (error) {
            console.error('微信手机号登录失败', error);
            wx.showToast({ title: error.message || '登录失败', icon: 'none' });
        } finally {
            this.setData({ isAuthorizing: false });
            wx.hideLoading();
        }
    },

    async onConfirmLogin() {
        const { currentRole, clientLoginMethod } = this.data;

        if (currentRole === 'TECHNICIAN') {
            const account = String(this.data.account || '').trim();
            const password = String(this.data.password || '').trim();

            if (!account || !password) {
                wx.showToast({ title: '请输入账号和密码', icon: 'none' });
                return;
            }

            wx.showLoading({ title: '登录中...', mask: true });

            try {
                const normalizedAccount = account.replace(/\s+/g, '');
                const mockOpenid = `mock_openid_TECHNICIAN_${Date.now()}`;
                const mockToken = `MOCK_TOKEN_TECHNICIAN_${Date.now()}`;

                await new Promise(resolve => setTimeout(resolve, 300));

                wx.setStorageSync('user_token', mockToken);
                wx.setStorageSync('user_role', 'TECHNICIAN');
                wx.setStorageSync('user_openid', mockOpenid);
                wx.setStorageSync('technician_account_phone', normalizedAccount);

                wx.showToast({ title: '登录成功', icon: 'success' });

                this.resetModalState();
                this.redirectToHomePage('TECHNICIAN');
            } catch (error) {
                console.error('家政端登录失败', error);
                wx.showToast({ title: error.message || '登录失败', icon: 'none' });
            } finally {
                wx.hideLoading();
            }
            return;
        }

        if (currentRole === 'CLIENT' && clientLoginMethod === 'PASSWORD') {
            const account = String(this.data.account || '').trim();
            const password = String(this.data.password || '').trim();

            if (!account || !password) {
                wx.showToast({ title: '请输入账号和密码', icon: 'none' });
                return;
            }

            wx.showLoading({ title: '登录中...', mask: true });

            try {
                await this.handleClientPasswordLogin(account, password);

                this.resetModalState();
                this.redirectToHomePage('CLIENT');
            } catch (error) {
                console.error('客户账号登录失败', error);
                wx.showToast({ title: error.message || '登录失败', icon: 'none' });
            } finally {
                wx.hideLoading();
            }
            return;
        }
    },

    async handleClientPasswordLogin(account, password) {
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

        const isUniversal = account === '1';
        this.storeClientSession({ token, openid, profile, account, isUniversal });

        wx.showToast({ title: '登录成功', icon: 'success' });
    },

    async handleClientWechatLogin(phone) {
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

        this.storeClientSession({ token, openid, profile, phone, account: phone });

        wx.showToast({ title: '登录成功', icon: 'success' });
    },

    storeClientSession({ token, openid, profile, phone = '', account = '', isUniversal = false }) {
        wx.setStorageSync('user_token', token);
        wx.setStorageSync('user_role', 'CLIENT');
        wx.setStorageSync('user_openid', openid);

        if (profile) {
            wx.setStorageSync('client_profile_cache', profile);
        }

        if (account) {
            wx.setStorageSync('client_last_account', account);
        }

        const profilePhone = profile && profile.phone;
        const resolvedPhone = phone || profilePhone;
        if (resolvedPhone) {
            wx.setStorageSync('client_account_phone', resolvedPhone);
        } else if (!isUniversal && account && /^1\d{10}$/.test(account)) {
            wx.setStorageSync('client_account_phone', account);
        }
    },

    async simulateDevtoolsClientLogin() {
        try {
            wx.showLoading({ title: '模拟登录中...', mask: true });
            await this.handleClientWechatLogin('13800000000');
            this.resetModalState();
            this.redirectToHomePage('CLIENT');
        } catch (error) {
            console.error('模拟微信授权登录失败', error);
            wx.showToast({ title: error.message || '模拟登录失败', icon: 'none' });
        } finally {
            wx.hideLoading();
        }
    },

    resetModalState() {
        this.setData({
            showLoginModal: false,
            selectedRole: '',
            currentRole: '',
            modalSubtitle: '',
            modalTitle: '客户登录',
            isAuthorizing: false,
            inputPlaceholder: '请输入手机号或万能账号',
            account: '',
            password: '',
            clientLoginMethod: 'WECHAT'
        });
    },

    isDevtoolsEnvironment() {
        try {
            const systemInfo = wx.getSystemInfoSync();
            return systemInfo && systemInfo.platform === 'devtools';
        } catch (error) {
            console.warn('getSystemInfoSync failed', error);
            return false;
        }
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
