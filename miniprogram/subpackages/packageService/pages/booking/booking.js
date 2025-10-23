// subpackages/packageService/pages/booking/booking.js
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
        contact_phone: ''
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

    /**
     * 根据ID获取服务详情 (增加字段映射)
     */
    getServiceDetails: function(serviceId) {
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
    chooseAddress: function() {
        wx.chooseLocation({
            success: (res) => {
                // 将地址名称和详细地址拼接，方便用户查看
                const fullAddress = res.name ? (res.name + ' ' + res.address) : res.address;
                this.setData({
                    address: fullAddress
                });
            },
            fail: (err) => {
                // 如果用户拒绝授权，可以提示手动输入
                console.error('选择地址失败:', err);
                // 这里不做 toast 提示，用户可选择手动输入
            }
        });
    },

    /**
     * 表单提交 (仅校验和跳转到第二步)
     */
    formSubmit: function(e) {
        const formData = e.detail.value;
        const serviceData = this.data.service;
        const phoneReg = /^1[3-9]\d{9}$/;

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

        // 手机号码格式校验
        if (!phoneReg.test(formData.contact_phone)) {
            return wx.showToast({ title: '联系电话格式不正确', icon: 'none' });
        }
        
        // 确保 price 是数字类型
        const servicePrice = parseFloat(serviceData.price);

        // 1. 构建要传递到下一步的订单基础数据
        const bookingBaseData = {
            service_id: this.data.serviceId,
            service_name: serviceData.name,
            service_price: servicePrice,
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

        // 🚨 订单写入数据库的逻辑已移动到第三步（确认支付）页面
    }
});