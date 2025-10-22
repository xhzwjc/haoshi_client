// index.js
const db = wx.cloud.database(); // 获取数据库引用

Page({
  // ...
  onLoad: function() {
    this.getHotServices();
  },
  getHotServices: function() {
    db.collection('services').where({
      is_hot: true
    }).limit(3).get({ // 只获取3条热门
      success: res => {
        this.setData({
          hotServices: res.data
        });
      },
      fail: console.error
    });
  }
  // ...
});