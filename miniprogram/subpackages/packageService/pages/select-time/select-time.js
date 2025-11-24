// /subpackages/packageService/pages/select-time/select-time.js

Page({
    data: {
        bookingData: null, // 存储从上一步带来的基础订单数据
        service: {
            name: '',
            description: '',
            price: 0,
            unit: '次'
        },
        // 时间选择相关
        dateList: [],        // 可选日期列表
        selectedDate: '',    // 当前选中日期 (YYYY-MM-DD)
        selectedTime: '',    // 当前选中时间段
        timeSlots: [
            { time: '08:00-10:00', available: true },
            { time: '10:00-12:00', available: true },
            { time: '12:00-14:00', available: true },
            { time: '14:00-16:00', available: true },
            { time: '16:00-18:00', available: true },
            { time: '18:00-20:00', available: true },
        ]
    },

    onLoad: function (options) {
        this.generateDates(); // 生成未来7天日期

        if (options.data) {
            const bookingData = JSON.parse(decodeURIComponent(options.data));
            this.setData({
                bookingData: bookingData,
                service: {
                    name: bookingData.service_name,
                    price: bookingData.service_price,
                    unit: bookingData.service_unit,
                    description: bookingData.service_description || '专业团队,  品质保证'
                }
            });
        }
    },

    /**
     * 生成未来14天的日期列表
     */
    generateDates: function () {
        const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const dateList = [];
        const today = new Date();

        for (let i = 0; i < 14; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);

            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            let label = days[date.getDay()];
            if (i === 0) label = '今天';
            if (i === 1) label = '明天';

            dateList.push({
                fullDate: dateStr,
                month: month,
                day: day,
                week: label,
                selected: i === 0 // 默认选中今天
            });
        }

        this.setData({
            dateList: dateList,
            selectedDate: dateList[0].fullDate
        });
    },

    /**
     * 选择日期
     */
    onDateSelect: function (e) {
        const selectedDate = e.currentTarget.dataset.date;
        const index = e.currentTarget.dataset.index;

        // 更新列表选中状态
        const newDateList = this.data.dateList.map((item, idx) => {
            item.selected = idx === index;
            return item;
        });

        this.setData({
            dateList: newDateList,
            selectedDate: selectedDate,
            selectedTime: '' // 切换日期重置时间
        });
    },

    /**
     * 选择时间段
     */
    onTimeSlotSelect: function (e) {
        const time = e.currentTarget.dataset.time;
        if (this.data.selectedTime === time) {
            this.setData({ selectedTime: '' });
        } else {
            this.setData({ selectedTime: time });
        }
    },

    /**
     * 上一步：返回填写信息页面
     */
    onPrevStep: function () {
        wx.navigateBack();
    },

    /**
     * 下一步：跳转到第三步（确认支付）
     */
    onNextStep: function () {
        if (!this.data.selectedDate) {
            return wx.showToast({ title: '请选择服务日期', icon: 'none' });
        }
        if (!this.data.selectedTime) {
            return wx.showToast({ title: '请选择服务时段', icon: 'none' });
        }

        const finalBookingData = {
            ...this.data.bookingData,
            service_date: this.data.selectedDate,
            service_time_slot: this.data.selectedTime
        };

        const finalDataJson = JSON.stringify(finalBookingData);
        wx.navigateTo({
            url: `/subpackages/packageService/pages/confirm-pay/confirm-pay?data=${encodeURIComponent(finalDataJson)}`
        });
    }
});