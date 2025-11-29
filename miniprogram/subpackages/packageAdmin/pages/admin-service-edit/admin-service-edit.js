// admin-service-edit.js
const app = getApp();

Page({
    data: {
        statusBarHeight: 44,
        mode: 'add',
        pageTitle: '新增服务', // 动态标题
        serviceId: '',
        
        // 表单数据
        name: '',
        price: '',
        unit: '',
        category: '',
        desc: '',
        
        categories: [],
        categoryIndex: -1, // 默认不选中
        saving: false
    },

    onLoad(options) {
        // 1. 适配导航栏
        try {
            const sysInfo = wx.getSystemInfoSync();
            if (sysInfo.statusBarHeight) {
                this.setData({ statusBarHeight: sysInfo.statusBarHeight });
            }
        } catch (e) {
            console.error('系统信息获取失败', e);
        }

        // 2. 初始化模式和标题
        const mode = options.mode || 'add';
        const serviceId = options.id || '';
        this.setData({ 
            mode, 
            serviceId,
            pageTitle: mode === 'edit' ? '编辑服务' : '新增服务' // 【修复Bug】动态设置标题
        });

        // 3. 加载数据
        this.loadCategories();
        if (mode === 'edit' && serviceId) {
            this.loadServiceDetail(serviceId);
        }
    },

    onBack() {
        wx.navigateBack();
    },

    async loadCategories() {
        try {
            const res = await wx.cloud.callFunction({
                name: 'adminManageServices',
                data: { action: 'getServices' }
            });

            if (res.result.code === 0) {
                const services = res.result.data || [];
                const categoriesSet = new Set();
                services.forEach(s => {
                    if (s.category) categoriesSet.add(s.category);
                });
                this.setData({ categories: Array.from(categoriesSet) });
            }
        } catch (error) {
            console.error('Load categories failed', error);
        }
    },

    async loadServiceDetail(serviceId) {
        wx.showLoading({ title: '加载中...' });
        try {
            const res = await wx.cloud.callFunction({
                name: 'adminManageServices',
                data: { action: 'getServices' }
            });

            wx.hideLoading();
            if (res.result.code === 0) {
                const service = res.result.data.find(s => s._id === serviceId);
                if (service) {
                    let categoryIndex = this.data.categories.indexOf(service.category);
                    if (categoryIndex === -1 && service.category) {
                        const cats = [...this.data.categories, service.category];
                        categoryIndex = cats.length - 1;
                        this.setData({ categories: cats });
                    }

                    this.setData({
                        name: service.name || '',
                        price: service.price || '',
                        unit: service.unit || '',
                        category: service.category || '',
                        desc: service.desc || '',
                        categoryIndex: categoryIndex
                    });
                }
            }
        } catch (error) {
            wx.hideLoading();
            console.error('Load detail failed', error);
            wx.showToast({ title: '加载失败', icon: 'none' });
        }
    },

    onInputChange(e) {
        const field = e.currentTarget.dataset.field;
        this.setData({ [field]: e.detail.value });
    },

    onCategoryPickerChange(e) {
        const index = parseInt(e.detail.value);
        this.setData({
            categoryIndex: index,
            category: this.data.categories[index] || ''
        });
    },

    async onSubmit() {
        if (this.data.saving) return;

        const { mode, serviceId, name, price, unit, category, desc } = this.data;

        // 校验
        if (!name.trim()) return wx.showToast({ title: '请输入名称', icon: 'none' });
        if (!price.trim()) return wx.showToast({ title: '请输入价格', icon: 'none' });
        if (!unit.trim()) return wx.showToast({ title: '请输入单位', icon: 'none' });
        if (!category.trim()) return wx.showToast({ title: '请选择分类', icon: 'none' });

        this.setData({ saving: true });
        wx.showLoading({ title: '保存中...' });

        try {
            const data = {
                action: mode === 'add' ? 'addService' : 'updateService',
                name: name.trim(),
                price: price.trim(),
                unit: unit.trim(),
                category: category.trim(),
                desc: desc.trim()
            };

            if (mode === 'add') {
                data.rate = (4.7 + Math.random() * 0.3).toFixed(1);
                data.sold = Math.floor(50 + Math.random() * 200);
                data.hot = false;
                data.enabled = true;
            } else {
                data.serviceId = serviceId;
            }

            const res = await wx.cloud.callFunction({
                name: 'adminManageServices',
                data
            });

            wx.hideLoading();

            if (res.result.code === 0) {
                wx.showToast({ title: '保存成功', icon: 'success' });
                setTimeout(() => {
                    wx.navigateBack();
                }, 1500);
            } else {
                wx.showToast({ title: res.result.message || '保存失败', icon: 'none' });
            }
        } catch (error) {
            wx.hideLoading();
            console.error('Submit failed', error);
            wx.showToast({ title: '网络异常', icon: 'none' });
        } finally {
            this.setData({ saving: false });
        }
    }
});