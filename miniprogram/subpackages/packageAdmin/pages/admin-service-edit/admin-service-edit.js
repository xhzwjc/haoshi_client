Page({
    data: {
        mode: 'add',
        serviceId: '',
        name: '',
        price: '',
        unit: '',
        category: '',
        desc: '',
        categories: [], // 可选分类列表
        showCategoryPicker: false,
        categoryIndex: 0
    },

    onLoad(options) {
        const mode = options.mode || 'add';
        const serviceId = options.id || '';

        this.setData({ mode, serviceId });

        // 加载分类列表
        this.loadCategories();

        if (mode === 'edit' && serviceId) {
            this.loadServiceDetail(serviceId);
        }
    },

    async loadCategories() {
        try {
            // 从现有服务中获取所有分类
            const res = await wx.cloud.callFunction({
                name: 'adminManageServices',
                data: { action: 'getServices' }
            });

            if (res.result.code === 0) {
                const services = res.result.data || [];
                // 提取唯一分类
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
        try {
            wx.showLoading({ title: '加载中...' });
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
                        // 如果分类不在列表中，添加它
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
                        categoryIndex: Math.max(0, categoryIndex)
                    });
                }
            }
        } catch (error) {
            wx.hideLoading();
            console.error('Load service detail failed', error);
            wx.showToast({ title: '加载失败', icon: 'none' });
        }
    },

    onInputChange(e) {
        const field = e.currentTarget.dataset.field;
        this.setData({
            [field]: e.detail.value
        });
    },

    onCategoryTap() {
        if (this.data.categories.length === 0) {
            wx.showToast({ title: '暂无分类，请手动输入', icon: 'none' });
            return;
        }
        this.setData({ showCategoryPicker: true });
    },

    onCategoryPickerChange(e) {
        const index = parseInt(e.detail.value);
        this.setData({
            categoryIndex: index,
            category: this.data.categories[index] || ''
        });
    },

    onCategoryPickerCancel() {
        this.setData({ showCategoryPicker: false });
    },

    onCategoryPickerConfirm() {
        this.setData({ showCategoryPicker: false });
    },

    async onSubmit() {
        const { mode, serviceId, name, price, unit, category, desc } = this.data;

        // 前端校验
        if (!name || !name.trim()) {
            wx.showToast({ title: '请输入服务名称', icon: 'none' });
            return;
        }

        if (!price || !price.trim()) {
            wx.showToast({ title: '请输入价格', icon: 'none' });
            return;
        }

        if (!unit || !unit.trim()) {
            wx.showToast({ title: '请输入单位', icon: 'none' });
            return;
        }

        if (!category || !category.trim()) {
            wx.showToast({ title: '请选择分类', icon: 'none' });
            return;
        }

        if (!desc || !desc.trim()) {
            wx.showToast({ title: '请输入服务介绍', icon: 'none' });
            return;
        }

        try {
            wx.showLoading({ title: mode === 'add' ? '添加中...' : '保存中...' });

            const data = {
                action: mode === 'add' ? 'addService' : 'updateService',
                name: name.trim(),
                price: price.trim(),
                unit: unit.trim(),
                category: category.trim(),
                desc: desc.trim()
            };

            // 新增时添加随机字段
            if (mode === 'add') {
                // rate: 4.6-5.0之间随机
                data.rate = (4.6 + Math.random() * 0.4).toFixed(1);

                // sold: 111-321之间随机整数
                data.sold = Math.floor(111 + Math.random() * 211);

                // hot: 默认false
                data.hot = false;
            }

            if (mode === 'edit') {
                data.serviceId = serviceId;
            }

            const res = await wx.cloud.callFunction({
                name: 'adminManageServices',
                data
            });

            wx.hideLoading();

            if (res.result.code === 0) {
                wx.showToast({
                    title: mode === 'add' ? '添加成功' : '保存成功',
                    icon: 'success'
                });
                setTimeout(() => {
                    wx.navigateBack();
                }, 1500);
            } else {
                wx.showToast({ title: res.result.message, icon: 'none' });
            }
        } catch (error) {
            wx.hideLoading();
            console.error('Submit service failed', error);
            wx.showToast({ title: '操作失败', icon: 'none' });
        }
    }
});
