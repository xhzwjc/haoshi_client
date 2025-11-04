// pages/ratings/ratings.js
Page({
  data: {
      // 模拟评分概览数据
      summary: {
          averageScore: '4.9',
          goodRatingRate: 98,
          totalRatings: 856,
          recentGoodRatings: 52
      },
      tabs: [
          { name: '全部', type: 'all', count: 580 },
          { name: '好评', type: 'good', count: 560 },
          { name: '中评', type: 'neutral', count: 15 },
          { name: '差评', type: 'bad', count: 5 }
      ],
      activeTab: 'all',
      loading: false,
      
      ratings: [ // 模拟评价数据
          { id: 1, avatar: '/images/default_avatar.png', nickname: '客户***01', score: 5, time: '2025-10-25', content: '师傅专业，服务态度非常好，效率很高！', serviceName: '深度保洁', orderId: 'O20251025001', reply: '感谢您的认可，我们会继续努力！' },
          { id: 2, avatar: '/images/default_avatar.png', nickname: '匿名用户', score: 4, time: '2025-10-20', content: '服务不错，就是时间稍微晚了一点。', serviceName: '洗衣机清洗', orderId: 'O20251020005', reply: '' },
          { id: 3, avatar: '/images/default_avatar.png', nickname: '客户***03', score: 1, time: '2025-10-18', content: '清洁不彻底，不满意。', serviceName: '深度保洁', orderId: 'O20251018002', reply: '' },
      ]
  },

  onLoad: function (options) {
      this.loadRatingSummary();
      this.loadRatings('all');
  },

  loadRatingSummary: function() {
      // Call cloud function to get summary stats
      // wx.cloud.callFunction({ name: 'getRatingSummary' }).then(...)
  },

  loadRatings: function(type) {
      this.setData({ loading: true, ratings: [] });
      
      // 1. Call cloud function to get ratings based on type ('all', 'good', 'neutral', 'bad')
      // wx.cloud.callFunction({ name: 'getRatingsList', data: { type: type } }).then(...)
      
      // 2. Mock delay and data filtering
      setTimeout(() => {
          let mockData = [];
          if (type === 'good' || type === 'all') {
              mockData.push(this.data.ratings[0]);
              mockData.push(this.data.ratings[1]);
          }
          if (type === 'neutral') {
               mockData = [{ id: 4, avatar: '/images/default_avatar.png', nickname: '客户***04', score: 3, time: '2025-10-15', content: '还行吧，没什么亮点。', serviceName: '油烟机清洗', orderId: 'O20251015001', reply: '' }];
          }
          if (type === 'bad') {
               mockData.push(this.data.ratings[2]);
          }

          this.setData({
              ratings: mockData,
              loading: false
          });
      }, 800);
  },
  
  onTabClick: function(e) {
      const type = e.currentTarget.dataset.type;
      this.setData({ activeTab: type });
      this.loadRatings(type);
  },

  replyRating: function(e) {
      const ratingId = e.currentTarget.dataset.id;
      
      wx.showModal({
          title: '回复评价',
          editable: true,
          placeholderText: '请输入回复内容（200字以内）',
          success: (res) => {
              if (res.confirm && res.content) {
                  wx.showLoading({ title: '提交中...' });
                  // Call cloud function to submit reply
                  // wx.cloud.callFunction({ name: 'submitReply', data: { ratingId: ratingId, content: res.content } }).then(...)
                  
                  // Mock success: Find and update the rating locally
                  const index = this.data.ratings.findIndex(r => r.id === ratingId);
                  if (index !== -1) {
                       const updatedRating = { ...this.data.ratings[index], reply: res.content };
                       this.data.ratings.splice(index, 1, updatedRating);
                       this.setData({ ratings: this.data.ratings });
                  }
                  
                  wx.hideLoading();
                  wx.showToast({ title: '回复成功', icon: 'success' });
              }
          }
      });
  }
});