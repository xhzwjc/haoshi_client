// app.js
App({
  onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        // 替换为你的环境ID
        env: 'cloud1-7g9gxakebe8535a6', // 示例 'homex-service-1g2x3y4z'
        traceUser: true,
      });
    }

    // 全局变量，用于处理首页 -> 列表 -> 预约的导航
    this.globalData = {
      navigateToBookingInfo: null 
    };
  }
})