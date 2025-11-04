const app = getApp();

Page({
    data: {
        showLoginModal: false,
        modalTitle: '客户登录',
        inputPlaceholder: '请输入手机号',
        currentRole: '', // 'CLIENT' or 'TECHNICIAN'
        account: '',
        password: ''
    },

    // 1. Select Role
    onSelectRole(e) {
        const role = e.currentTarget.dataset.role;
        this.setData({
            currentRole: role,
            modalTitle: role === 'CLIENT' ? '客户登录' : '家政人员登录',
            inputPlaceholder: role === 'CLIENT' ? '请输入任意手机号' : '请输入任意工号/手机号',
            showLoginModal: true,
            account: '',
            password: ''
        });
    },

    // 2. Input Handling
    onInputAccount(e) { this.setData({ account: e.detail.value }); },
    onInputPassword(e) { this.setData({ password: e.detail.value }); },

    onCancelLogin() { this.setData({ showLoginModal: false }); },

    // 3. [Core Logic] Confirm Login (Simulated Success)
    async onConfirmLogin() {
        const { currentRole, account, password } = this.data;

        // Validation: Requires any account and password input
        if (!account || !password) {
            return wx.showToast({ title: '请输入账号和密码', icon: 'none' });
        }

        this.setData({ showLoginModal: false }); // Hide modal
        wx.showLoading({ title: '登录中...', mask: true });

        // --- Simulate Login Success ---
        
        // Mock OpenID and Token (In real app, these come from backend/Cloud)
        const mockOpenid = `mock_openid_${currentRole}_${Date.now()}`;
        const mockToken = `MOCK_TOKEN_${currentRole}`;

        // Simulate network request delay
        await new Promise(resolve => setTimeout(resolve, 500)); 
        
        wx.hideLoading();

        // Store identity info locally
        wx.setStorageSync('user_token', mockToken);
        wx.setStorageSync('user_role', currentRole); // 'CLIENT' or 'TECHNICIAN'
        wx.setStorageSync('user_openid', mockOpenid); 
        
        wx.showToast({ title: '登录成功 (测试模式)', icon: 'success' });
        
        // 4. Redirect to the corresponding home page based on role
        this.redirectToHomePage(currentRole);

        // ------------------------------------
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
