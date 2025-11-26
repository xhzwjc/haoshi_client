// subpackages/packageService/pages/booking/booking.js
const app = getApp();
const db = wx.cloud.database();

Page({
    data: {
        serviceId: null,
        service: {
            // 占位/初始数据结构
            name: '加载中...',
            description: '专业团队, 品质保证',
            price: 0,
            unit: '次'
        },
        // 表单数据 (用于地址选择器绑定)
        address: '',
        contact_name: '',
        contact_phone: '',
        savedAddresses: [],
        notice: ''
    },

    onLoad: function (options) {
        if (options.serviceId) {
            this.setData({
                serviceId: options.serviceId
            });
            this.getServiceDetails(options.serviceId);
        } else {
            console.warn('未传入 serviceId');
            wx.showToast({ title: '服务ID缺失', icon: 'none' });
        }
    },

    onShow() {
        this.loadSavedAddresses();
        this.loadNotice();
    },

    loadNotice() {
        const app = getApp();
        if (app && app.globalData.homeSettings && app.globalData.homeSettings.notice) {
            this.setData({ notice: app.globalData.homeSettings.notice });
        }
    },

    /**
     * 根据ID获取服务详情 (增加字段映射)
     */
    getServiceDetails: function (serviceId) {
        wx.showLoading({ title: '加载中...' });
        db.collection('services').doc(serviceId).get({
            success: res => {
                const dbData = res.data;
                const serviceData = {
                    ...dbData, // 包含所有原始字段
                    // 核心映射：将数据库的 desc 字段映射为前端的 description
                    description: dbData.desc || dbData.description || '专业团队, 品质保证'
                };

                this.setData({
                    service: serviceData
                });
                wx.hideLoading();
            },
            fail: err => {
                wx.hideLoading();
                wx.showToast({ title: '服务加载失败', icon: 'none' });
                console.error('获取服务详情失败: ', err);
            }
        });
    },

    /**
     * 调起微信地址选择器
     */
    chooseAddress: function () {
        wx.chooseLocation({
            success: (res) => {
                // 将地址名称和详细地址拼接，方便用户查看
                const fullAddress = res.name ? (res.name + ' ' + res.address) : res.address;
                this.setData({
                    address: fullAddress
                });
            },
            fail: (err) => {
                console.error('选择地址失败:', err);
            }
        });
    },

    async loadSavedAddresses() {
        try {
            const clientCloud = await app.waitClientCloudReady();
            const clientId = wx.getStorageSync('client_id');
            const res = await clientCloud.callFunction({
                name: 'manageClientAddresses',
                data: { action: 'list', clientId }
            });

            if (res.result && res.result.code === 0) {
                const list = res.result.data || [];
                this.setData({ savedAddresses: list });

                if (!this.data.address && list.length) {
                    const defaultAddress = list.find(item => item.is_default) || list[0];
                    if (defaultAddress) {
                        this.applyAddress(defaultAddress);
                    }
                }
            }
        } catch (err) {
            console.warn('加载常用地址失败', err);
        }
    },

    openAddressPicker() {
        const { savedAddresses } = this.data;
        if (!savedAddresses || !savedAddresses.length) {
            wx.showToast({ title: '请先在地址管理中新增地址', icon: 'none' });
            return;
        }

        const itemList = savedAddresses.map(item => {
            const tag = item.tag ? `（${item.tag}）` : '';
            return `${item.contact_name}${tag} · ${item.contact_phone}`;
        });

        wx.showActionSheet({
            itemList,
            success: (res) => {
                const selected = savedAddresses[res.tapIndex];
                if (selected) {
                    this.applyAddress(selected);
                }
            }
        });
    },

    applyAddress(address) {
        this.setData({
            address: address.address || '',
            contact_name: address.contact_name || '',
            contact_phone: address.contact_phone || ''
        });
    },

    onFieldInput(e) {
        const field = e.currentTarget.dataset.field;
        if (!field) return;
        this.setData({ [field]: e.detail.value });
    },

    goManageAddress() {
        wx.navigateTo({
            url: '/subpackages/packageProfile/pages/address-list/address-list'
        });
    },

    /**
     * 表单提交 (仅校验和跳转到第二步)
     */
    formSubmit: function (e) {
        const formData = {
            address: this.data.address,
            contact_name: this.data.contact_name,
            contact_phone: this.data.contact_phone,
            remarks: e.detail.value.remarks || ''
        };
        const serviceData = this.data.service;

        // 基础校验 (使用表单数据，而不是 this.data)
        if (!formData.address) {
            return wx.showToast({ title: '请输入服务地址', icon: 'none' });
        }
        if (!formData.contact_name) {
            return wx.showToast({ title: '请输入联系人姓名', icon: 'none' });
        }
        if (!formData.contact_phone) {
            return wx.showToast({ title: '请输入联系电话', icon: 'none' });
        }

        // 1. 构建要传递到下一步的订单基础数据
        const bookingBaseData = {
            service_id: this.data.serviceId,
            service_name: serviceData.name,
            service_price: serviceData.price,
            service_unit: serviceData.unit,
            service_description: serviceData.description, // 传入描述

            address: formData.address,
            contact_name: formData.contact_name,
            contact_phone: formData.contact_phone,
            remarks: formData.remarks || ''
        };

        // 2. 将数据编码后跳转到第二步页面
        const bookingDataJson = JSON.stringify(bookingBaseData);

        wx.navigateTo({
            url: `/subpackages/packageService/pages/select-time/select-time?data=${encodeURIComponent(bookingDataJson)}`
        });
    }
});