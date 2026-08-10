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
        inputPlaceholder: '请输入手机号',
        account: '',
        password: '',
        verificationCode: '',
        countdown: 0,
        isRegistering: false,
        registerName: '',
        loginMethod: 'code' // 'code' or 'password'
    },

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
    },

    onSelectRole(e) {
        const role = e.currentTarget.dataset.role;
        this.openLoginModal(role);
    },

    onAdminLoginEntry() {
        this.openLoginModal('ADMIN');
    },

    openLoginModal(role) {
        let title = '';
        let subtitle = '';
        let placeholder = '';
        let loginMethod = 'code';

        if (role === 'CLIENT') {
            title = '客户手机号登录';
            subtitle = '未注册手机号验证通过后将自动注册';
            placeholder = '请输入手机号';
            loginMethod = 'code'; // 客户端只支持验证码登录
        } else if (role === 'TECHNICIAN') {
            title = '家政人员登录';
            subtitle = '请选择登录方式';
            placeholder = '请输入手机号';
            loginMethod = 'password'; // 默认密码登录
        } else if (role === 'ADMIN') {
            title = '管理员登录';
            subtitle = '请输入管理员账号和密码';
            placeholder = '请输入管理员账号';
            loginMethod = 'password';
        }

        this.setData({
            currentRole: role,
            selectedRole: role !== 'ADMIN' ? role : '',
            modalTitle: title,
            modalSubtitle: subtitle,
            inputPlaceholder: placeholder,
            showLoginModal: true,
            account: '',
            password: '',
            verificationCode: '',
            isRegistering: false,
            registerName: '',
            loginMethod
        });
    },

    onInputAccount(e) {
        this.setData({ account: e.detail.value });
    },

    onInputPassword(e) {
        this.setData({ password: e.detail.value });
    },

    onInputCode(e) {
        this.setData({ verificationCode: e.detail.value });
    },

    onInputName(e) {
        this.setData({ registerName: e.detail.value });
    },

    onToggleRegister() {
        this.setData({
            isRegistering: !this.data.isRegistering,
            modalTitle: !this.data.isRegistering ? '家政人员注册' : '家政人员登录',
            modalSubtitle: !this.data.isRegistering ? '提交注册信息，审核通过后即可接单' : '请选择登录方式'
        });
    },

    onSwitchLoginMethod(e) {
        const method = e.currentTarget.dataset.method;
        this.setData({
            loginMethod: method,
            modalSubtitle: method === 'code' ? '输入手机号和验证码登录' : '输入手机号和密码登录'
        });
    },

    onGetCode() {
        if (this.data.countdown > 0) return;

        const phone = this.data.account;
        if (!/^1\d{10}$/.test(phone)) {
            wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
            return;
        }

        wx.showToast({ title: '验证码已发送: 6666', icon: 'none' });
        this.setData({ countdown: 60 });

        const timer = setInterval(() => {
            if (this.data.countdown <= 0) {
                clearInterval(timer);
            } else {
                this.setData({ countdown: this.data.countdown - 1 });
            }
        }, 1000);
    },

    onCancelLogin() {
        this.setData({
            showLoginModal: false,
            selectedRole: '',
            currentRole: '',
            account: '',
            password: '',
            verificationCode: '',
            countdown: 0
        });
    },

    async onConfirmLogin() {
        const { currentRole, account, password, verificationCode, loginMethod } = this.data;

        try {
            wx.showLoading({ title: '登录中...', mask: true });

            if (currentRole === 'CLIENT') {
                // 客户端：手机号 + 验证码登录
                await this.handleClientLogin(account, verificationCode);

            } else if (currentRole === 'TECHNICIAN') {
                // 师傅端：支持密码和验证码两种方式
                await this.handleTechnicianLogin(account, password, verificationCode, loginMethod);

            } else if (currentRole === 'ADMIN') {
                // 管理员：账号密码登录
                await this.handleAdminLogin(account, password);
            }

        } catch (error) {
            wx.showToast({ title: error.message || '登录失败', icon: 'none' });
        } finally {
            wx.hideLoading();
        }
    },

    async onConfirmRegister() {
        const { account, password, registerName } = this.data;

        try {
            if (!/^1\d{10}$/.test(account)) throw new Error('请输入正确的手机号');
            if (!password) throw new Error('请设置密码');
            if (!registerName) throw new Error('请输入真实姓名');

            wx.showLoading({ title: '提交中...', mask: true });

            // 调用真实云函数注册
            const res = await wx.cloud.callFunction({
                name: 'technicianAuth',
                data: {
                    action: 'register',
                    phone: account,
                    password: password,
                    name: registerName
                }
            });

            if (res.result.code !== 0) {
                throw new Error(res.result.message || '注册失败');
            }

            wx.showModal({
                title: '提交成功',
                content: '您的注册申请已提交，请等待管理员审核通过后登录。',
                showCancel: false,
                success: () => {
                    this.onToggleRegister(); // 切换回登录
                }
            });

        } catch (error) {
            wx.showToast({ title: error.message || '注册失败', icon: 'none' });
        } finally {
            wx.hideLoading();
        }
    },

    async handleClientLogin(phone, code) {
        if (!/^1\d{10}$/.test(phone)) throw new Error('请输入正确的手机号');
        if (code !== '6666') throw new Error('验证码错误');

        // 调用真实云函数登录
        const res = await wx.cloud.callFunction({
            name: 'getClientProfile',
            data: {
                action: 'wechatPhoneLogin',
                phone: phone
            }
        });

        if (res.result.code !== 0) {
            throw new Error(res.result.message || '登录失败');
        }

        const { token, openid, profile } = res.result.data;

        // 存储登录信息
        wx.setStorageSync('user_token', token);
        wx.setStorageSync('user_openid', openid);
        wx.setStorageSync('user_role', 'CLIENT');
        wx.setStorageSync('user_info', profile);
        wx.setStorageSync('client_id', profile.id); // 【关键修改】存储client_id

        wx.showToast({ title: '登录成功', icon: 'success' });

        setTimeout(() => {
            this.onCancelLogin();
            this.redirectToHomePage('CLIENT');
        }, 1000);
    },

    async handleTechnicianLogin(phone, password, code, method) {
        if (!/^1\d{10}$/.test(phone)) throw new Error('请输入正确的手机号');

        let res;
        if (method === 'password') {
            // 密码登录
            if (!password) throw new Error('请输入密码');

            res = await wx.cloud.callFunction({
                name: 'technicianAuth',
                data: {
                    action: 'loginWithPassword',
                    phone: phone,
                    password: password
                }
            });
        } else {
            // 验证码登录
            if (code !== '6666') throw new Error('验证码错误');

            res = await wx.cloud.callFunction({
                name: 'technicianAuth',
                data: {
                    action: 'loginWithCode',
                    phone: phone,
                    code: code
                }
            });
        }

        if (res.result.code !== 0) {
            throw new Error(res.result.message || '登录失败');
        }

        const { token, openid, technician } = res.result.data;

        // 存储登录信息 - 关键：存储master_id用于数据隔离
        wx.setStorageSync('user_token', token);
        wx.setStorageSync('user_openid', openid);
        wx.setStorageSync('user_role', 'TECHNICIAN');
        wx.setStorageSync('user_info', technician);
        wx.setStorageSync('master_id', technician.id); // 存储师傅ID用于查询

        wx.showToast({ title: '登录成功', icon: 'success' });

        setTimeout(() => {
            this.onCancelLogin();
            this.redirectToHomePage('TECHNICIAN');
        }, 1000);
    },

    async handleAdminLogin(username, password) {
        if (!username || !password) throw new Error('请输入账号和密码');

        const res = await wx.cloud.callFunction({
            name: 'adminAuth',
            data: {
                username: username,
                password: password
            }
        });

        if (res.result.code !== 0) {
            throw new Error(res.result.message || '登录失败');
        }

        const { token, openid, admin } = res.result.data;

        // 存储登录信息
        wx.setStorageSync('user_token', token);
        wx.setStorageSync('user_openid', openid);
        wx.setStorageSync('user_role', 'ADMIN');
        wx.setStorageSync('user_info', admin);

        wx.showToast({ title: '登录成功', icon: 'success' });

        setTimeout(() => {
            this.onCancelLogin();
            this.redirectToHomePage('ADMIN');
        }, 1000);
    },

    redirectToHomePage(role) {
        let url = '';
        if (role === 'TECHNICIAN') {
            url = app.globalData.technicianIndexUrl || '/subpackages/packageTech/pages/technician-index/technician-index';
        } else if (role === 'CLIENT') {
            url = app.globalData.clientIndexUrl || '/pages/index/index';
        } else if (role === 'ADMIN') {
            url = '/subpackages/packageAdmin/pages/admin-dashboard/admin-dashboard';
        }

        wx.reLaunch({
            url,
            fail: (e) => {
                console.error('Redirect failed', e);
                wx.showToast({ title: '跳转失败', icon: 'none' });
            }
        });
    }
});
