const app = getApp();

const DEFAULT_SUMMARY = {
  averageScore: '0.0',
  goodRatingRate: 0,
  totalRatings: 0,
  recentGoodRatings: 0
};

function buildTabsFromCounts(counts = {}) {
  return [
    { name: '全部', type: 'all', count: counts.all || 0 },
    { name: '好评', type: 'good', count: counts.good || 0 },
    { name: '中评', type: 'neutral', count: counts.neutral || 0 },
    { name: '差评', type: 'bad', count: counts.bad || 0 }
  ];
}

Page({
  data: {
    summary: { ...DEFAULT_SUMMARY },
    tabs: buildTabsFromCounts(),
    activeTab: 'all',
    loading: false,
    ratings: [],
    hasMore: false
  },

  onLoad() {
    this.fetchRatings('all');
  },

  async fetchRatings(type = 'all') {
    if (this.data.loading) return;

    this.setData({ loading: true, ratings: [] });

    try {
      const clientCloud = await app.waitClientCloudReady();
      const res = await clientCloud.callFunction({
        name: 'getTechnicianRatings',
        data: { type }
      });

      const result = res && res.result;
      if (!result || result.code !== 0) {
        throw new Error((result && result.message) || '获取评价失败');
      }

      const payload = result.data || {};
      this.setData({
        summary: { ...DEFAULT_SUMMARY, ...(payload.summary || {}) },
        tabs: buildTabsFromCounts(payload.counts || {}),
        ratings: payload.list || [],
        hasMore: !!payload.hasMore,
        loading: false
      });
    } catch (error) {
      console.error('加载评价失败', error);
      this.setData({ loading: false });
      const message = error && error.message ? error.message : '评价加载失败';
      wx.showToast({ title: message.length > 14 ? '评价加载失败' : message, icon: 'none' });
    }
  },

  onTabClick(e) {
    const type = e.currentTarget.dataset.type;
    if (!type || type === this.data.activeTab) {
      return;
    }

    this.setData({ activeTab: type });
    this.fetchRatings(type);
  },

  replyRating(e) {
    const ratingId = e.currentTarget.dataset.id;
    if (!ratingId) return;

    wx.showModal({
      title: '回复评价',
      editable: true,
      placeholderText: '请输入回复内容（200字以内）',
      success: async (res) => {
        if (!res.confirm || !res.content) {
          return;
        }

        const content = res.content.trim();
        if (!content) {
          wx.showToast({ title: '回复内容不能为空', icon: 'none' });
          return;
        }

        await this.submitReply(ratingId, content);
      }
    });
  },

  async submitReply(ratingId, replyContent) {
    const index = this.data.ratings.findIndex(item => item.id === ratingId);
    if (index === -1) {
      wx.showToast({ title: '评价已更新，请刷新', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '提交中...', mask: true });

    try {
      const clientCloud = await app.waitClientCloudReady();
      const res = await clientCloud.callFunction({
        name: 'replyServiceReview',
        data: { reviewId: ratingId, reply: replyContent }
      });

      const result = res && res.result;
      if (!result || result.code !== 0) {
        throw new Error((result && result.message) || '回复失败');
      }

      const updated = [...this.data.ratings];
      updated[index] = {
        ...updated[index],
        reply: replyContent
      };
      this.setData({ ratings: updated });

      wx.showToast({ title: '回复成功', icon: 'success' });

      setTimeout(() => {
        this.fetchRatings(this.data.activeTab);
      }, 300);
    } catch (error) {
      console.error('回复评价失败', error);
      const message = error && error.message ? error.message : '回复失败';
      wx.showToast({
        title: message.length > 14 ? '回复失败' : message,
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  }
});
