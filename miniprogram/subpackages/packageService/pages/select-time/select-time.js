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
      today: '',           // 必须用于 picker 的 start 属性
      selectedDate: '',
      selectedTime: '',
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
      // 🚨 修正点：只调用一次，确保 today 在任何数据加载前设置
      this.setInitialDate(); 
      
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
   * 设置日期选择器的最小可选日期为今天
   */
  setInitialDate: function() {
      const today = new Date();
      const year = today.getFullYear();
      // 月份和日期必须补零
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      
      this.setData({
          today: `${year}-${month}-${day}` 
      });
      console.log('>>> 初始化：今日起始日期设置:', this.data.today); 
  },

  /**
   * 选择日期
   */
  onDateSelect: function(e) {
      // 关键：确保选中后清空时段，并设置日期
      this.setData({
          selectedDate: e.detail.value,
          selectedTime: '' 
      });
      console.log('>>> 用户操作：选中日期:', this.data.selectedDate); 
  },

  /**
   * 选择时间段
   */
  onTimeSlotSelect: function(e) {
      const time = e.currentTarget.dataset.time;
      // 检查时间是否可用，这里简化，只检查是否已选中
      if (this.data.selectedTime === time) {
          // 取消选择
          this.setData({ selectedTime: '' });
      } else {
          // 选中
          this.setData({ selectedTime: time });
      }
      console.log('>>> 用户操作：选中时段:', this.data.selectedTime);
  },

  /**
   * 上一步：返回填写信息页面
   */
  onPrevStep: function() {
      wx.navigateBack();
  },

  /**
   * 下一步：跳转到第三步（确认支付）
   */
  onNextStep: function() {
      // ⚠️ 核心校验：如果前面的步骤都没有成功设置 this.data.selectedDate 或 selectedTime，就会在这里被拦截。
      if (!this.data.selectedDate) {
          console.error('校验失败：未选择日期');
          return wx.showToast({ title: '请选择服务日期', icon: 'none' });
      }
      if (!this.data.selectedTime) {
          console.error('校验失败：未选择时段');
          return wx.showToast({ title: '请选择服务时段', icon: 'none' });
      }

      console.log('>>> 准备跳转：数据校验通过，尝试跳转到确认支付页面。');

      // 验证通过，构建最终数据并跳转
      const finalBookingData = {
          ...this.data.bookingData,
          service_date: this.data.selectedDate,
          service_time_slot: this.data.selectedTime
      };

      // 跳转到第三步（确认支付），并传递完整的订单数据
      const finalDataJson = JSON.stringify(finalBookingData);
      wx.navigateTo({
          url: `/subpackages/packageService/pages/confirm-pay/confirm-pay?data=${encodeURIComponent(finalDataJson)}`
      });
  }
});