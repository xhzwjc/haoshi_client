// pages/service-list/service-list.js
const db = wx.cloud.database();

Page({
    data: {
        tabs: [
            { name: '全部' },
            { name: '保洁清洗' },
            { name: '母婴护理' },
            { name: '维修安装' },
            { name: '装修翻新' },
            { name: '搬家服务' },
        ],
        activeTab: 0,
        // allServices 占位数据保留，但会被数据库加载的数据覆盖
        allServices: [], 
        filterdServices: [] // 真正显示的服务列表
    },

    onLoad: function (options) {
        // 将 onLoad 接收的 options 传递给 loadAllServices
        this.loadAllServices(options); 
    },

    /**
     * 辅助函数：根据分类名称筛选服务
     * @param {string} categoryName - 要筛选的分类名称 (如 '保洁清洗')
     */
    filterServices: function(categoryName) {
        const all = this.data.allServices;
        let filtered = [];

        if (categoryName === '全部') {
            // 切换到“全部”Tab，显示所有服务
            filtered = all;
        } else {
            // 切换到特定分类 Tab，根据 category 字段精确匹配
            filtered = all.filter(service => {
                // 确保服务的 category 字段值必须等于 Tab 的名称
                return service.category === categoryName;
            });
        }
      
        this.setData({
            filterdServices: filtered
        });
        // 调试信息
        console.log(`Tab: ${categoryName}, 筛选结果数量: ${filtered.length}`);
    },

    /**
     * 加载所有服务
     * @param {object} options - 从 onLoad 接收的启动参数
     */
    loadAllServices: function(options) {
        wx.showLoading({ title: '加载中...' });
        db.collection('services').get({
            success: res => {
                // 1. 进行数据映射，使数据库字段与前端占位数据字段兼容
                const mappedServices = res.data.map(item => ({
                    _id: item._id,
                    name: item.name,
                    description: item.desc || '',  // 数据库 'desc' 映射为 'description'
                    price: item.price,
                    unit: item.unit,
                    rating: item.rate || 0,        // 数据库 'rate' 映射为 'rating'
                    sales: item.sold || 0,         // 数据库 'sold' 映射为 'sales'
                    category: item.category,       // 数据库 'category' 用于分类筛选
                    is_hot: item.hot || false,
                    cover: item.cover
                }));
                
                this.setData({
                    allServices: mappedServices,
                    // 默认先设置为 mappedServices，对应 '全部' Tab
                    filterdServices: mappedServices 
                });
                wx.hideLoading();
                
                // 2. 检查是否有 URL 带来的分类参数，用于初始定位 Tab
                if (options && options.category) {
                    const categoryName = options.category;
                    const tabIndex = this.data.tabs.findIndex(tab => tab.name === categoryName);

                    if (tabIndex !== -1) {
                        // 初始设置 activeTab 并执行筛选
                        this.setData({ activeTab: tabIndex });
                        this.filterServices(categoryName);
                    }
                }
            },
            fail: err => {
                console.error('加载服务列表失败: ', err);
                wx.hideLoading();
                wx.showToast({ title: '加载失败', icon: 'none' });
            }
        });
    },

    /**
     * 点击Tab
     */
    onTabClick: function(e) {
        const index = e.currentTarget.dataset.index;
        // 获取当前点击的 Tab 名称
        const categoryName = this.data.tabs[index].name;

        // 1. 切换 Tab 选中状态
        this.setData({
            activeTab: index
        });
        
        // 2. 调用筛选函数，更新服务列表
        this.filterServices(categoryName);
    },

    /**
     * 搜索输入
     */
    onSearchInput: function(e) {
        const keyword = e.detail.value.trim().toLowerCase();
        
        if (!keyword) {
             // 搜索关键字为空时，恢复当前选中 Tab 的筛选结果
             const categoryName = this.data.tabs[this.data.activeTab].name;
             return this.filterServices(categoryName);
        }

        // 基于全部服务 allServices 进行搜索
        const searched = this.data.allServices.filter(service => {
            // 搜索逻辑：匹配服务名称或描述
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