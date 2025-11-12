// pages/service-list/service-list.js
const db = wx.cloud.database();
const PAGE_SIZE = 10; // 定义每页加载数量

Page({
    data: {
        tabs: [
            { name: '全部' },
            { name: '保洁清洗' },
            { name: '家电清洗' },
            { name: '维修与保养' }
        ],
        activeTab: 0,
        allServices: [],
        filterdServices: [], // 真正显示的服务列表

        // 【修改/新增】分页和加载状态
        loading: false,         // 首次加载状态 (用于控制列表中央 Loading)
        isPulling: false,       // 下拉刷新动画状态 (对应 scroll-view 的 refresher-triggered)
        isReachingBottom: false,// 上拉加载中状态 (用于控制列表底部 Loading)
        page: 1,                // 当前页码
        pageSize: PAGE_SIZE,    // 每页数量
        hasMore: true,          // 是否还有更多数据
        bottomText: '正在加载...', // 底部提示文案
    },

    onLoad: function (options) {
        this.options = options;
        // 首次加载时，不使用 isPulling 标志
        this.loadServicesForCurrentTab(options);
    },

    // 【新增】监听 scroll-view 的下拉刷新事件
    onRefresherRefresh: function() {
        if (this.data.loading) return;
        this.setData({
            isPulling: true, // 触发下拉动画
            isReachingBottom: false,
        });
        // 传入 isRefresher = true
        this.loadServicesForCurrentTab(this.options, true);
    },

    /**
     * 【新增】监听 scroll-view 滚动到底部事件 (上拉加载)
     */
    onScrollToLower: function() {
        if (!this.data.hasMore || this.data.isReachingBottom) {
            console.log('没有更多数据或正在加载中');
            return;
        }
        
        this.setData({
            isReachingBottom: true,
            bottomText: '正在加载...'
        });
        
        // 调用加载下一页的函数
        this.loadServicesForCurrentTab(null, false, true);
    },

    /**
     * 辅助函数：切换 Tab 时重置状态并加载数据
     * @param {string} categoryName - 要筛选的分类名称 (如 '保洁清洗')
     */
    filterServices: function(categoryName) {
        this.setData({
            page: 1, // 切换 Tab 时重置页码
            hasMore: true, // 重置 hasMore
            filterdServices: [], // 清空当前列表
            bottomText: '正在加载...',
        }, () => {
            this.loadServicesForCurrentTab();
        });
    },

    /**
     * 加载当前选中 Tab 的服务列表
     * @param {object} options - 从 onLoad 接收的启动参数
     * @param {boolean} isRefresher - 是否是下拉刷新触发
     * @param {boolean} isScrollToLower - 是否是上拉加载触发
     */
    loadServicesForCurrentTab: function(options = {}, isRefresher = false, isScrollToLower = false) {
        if (this.data.loading && !isRefresher && !isScrollToLower) return;

        // 确定要加载的页码和跳过的数量
        let currentPage = this.data.page;
        if (isRefresher || !isScrollToLower) {
            // 下拉刷新和非上拉加载（如切换 Tab 或首次加载）从第一页开始
            currentPage = 1; 
        }

        const skip = (currentPage - 1) * this.data.pageSize;
        const limit = this.data.pageSize;
        
        // 只有首次加载且列表为空时显示中央 Loading
        if (!isRefresher && !isScrollToLower && currentPage === 1) {
            this.setData({ loading: true });
            wx.showLoading({ title: '加载中...' }); // 保持全局 Loading 提示
        }

        // 确定筛选条件
        const currentTabName = this.data.tabs[this.data.activeTab].name;
        let whereCondition = {};
        if (currentTabName !== '全部') {
            whereCondition = { category: currentTabName };
        }
        
        db.collection('services')
            .where(whereCondition)
            .skip(skip)
            .limit(limit)
            .get()
            .then(res => {
                const newServices = res.data;
                const mappedServices = newServices.map(item => ({
                    _id: item._id,
                    name: item.name,
                    description: item.desc || '',
                    price: item.price,
                    unit: item.unit,
                    rating: item.rate || 0,
                    sales: item.sold || 0,
                    category: item.category,
                    is_hot: item.hot || false,
                    cover: item.cover
                }));

                let list = isRefresher || (!isScrollToLower && currentPage === 1) 
                    ? mappedServices // 刷新或首次加载：覆盖列表
                    : this.data.filterdServices.concat(mappedServices); // 上拉加载：追加数据
                
                const hasMore = mappedServices.length === limit;
                
                this.setData({
                    filterdServices: list,
                    page: currentPage + 1,
                    hasMore: hasMore,
                    loading: false,
                    isPulling: false, // 停止下拉刷新动画
                    isReachingBottom: false,
                    bottomText: hasMore ? '上拉加载更多' : (list.length > 0 ? '我是有底线的' : ''),
                });

                wx.hideLoading(); // 隐藏全局 loading
                if (isRefresher) {
                    wx.showToast({ title: '刷新成功', icon: 'success', duration: 800 });
                }

                // 2. 检查是否有 URL 带来的分类参数，用于初始定位 Tab (仅在 onLoad 时处理)
                if (!isRefresher && !isScrollToLower && options && options.category) {
                    const categoryName = options.category;
                    const tabIndex = this.data.tabs.findIndex(tab => tab.name === categoryName);

                    if (tabIndex !== -1 && tabIndex !== this.data.activeTab) {
                        this.setData({ activeTab: tabIndex });
                        // 因为 loadServicesForCurrentTab 已经完成加载，这里不需要额外操作
                    }
                }
            })
            .catch(err => {
                console.error('加载服务列表失败: ', err);
                wx.hideLoading();
                this.setData({ 
                    loading: false, 
                    isPulling: false, 
                    isReachingBottom: false,
                    bottomText: '加载失败，请重试'
                });
                wx.showToast({ title: '加载失败', icon: 'none' });
            });
    },

    /**
     * 点击Tab
     */
    onTabClick: function(e) {
        const index = e.currentTarget.dataset.index;
        if (this.data.activeTab === index) return;
        
        this.setData({
            activeTab: index
        });
        
        this.filterServices(this.data.tabs[index].name);
    },

    /**
     * 搜索输入
     * 【注意】：由于列表已改为分页加载，这里搜索将不再基于全量数据，而是基于当前已加载的列表进行筛选。
     * 如果要实现全量搜索，需要额外调用云函数或使用数据库搜索。
     */
    onSearchInput: function(e) {
        const keyword = e.detail.value.trim().toLowerCase();
        
        if (!keyword) {
             // 搜索关键字为空时，重新加载当前 Tab 的数据 (保证列表回到分页状态)
             this.loadServicesForCurrentTab();
             return;
        }

        // 基于当前已加载的列表进行搜索（如果用户切换 Tab，filterdServices 会是新 Tab 的分页结果）
        const searched = this.data.filterdServices.filter(service => {
            return service.name.toLowerCase().includes(keyword) || 
                   (service.description && service.description.toLowerCase().includes(keyword));
        });
        
        this.setData({
            filterdServices: searched
        });
    },

    /**
     * 点击 "立即预约"
     */
    onBookNowTap: function(e) {
        const serviceId = e.currentTarget.dataset.serviceId;
        wx.navigateTo({
            url: `/subpackages/packageService/pages/booking/booking?serviceId=${serviceId}`
        });
    }
});