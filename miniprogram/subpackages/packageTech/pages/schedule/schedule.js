// pages/schedule/schedule.js
Page({
  data: {
      weekNames: ['日', '一', '二', '三', '四', '五', '六'],
      currentYear: new Date().getFullYear(),
      currentMonth: new Date().getMonth() + 1,
      selectedDate: new Date().toLocaleDateString('zh-CN'), // YYYY/MM/DD format
      selectedDateText: new Date().toLocaleDateString('zh-CN'),

      calendarDates: [], // Generated dates array
      
      // 模拟排班状态数据 (key is YYYY/MM/DD)
      scheduleMap: { 
          // '2025/10/28': { status: 1, hasOrders: true },
          // '2025/10/29': { status: 0, hasOrders: false },
      },
      
      // 排班设置选项
      scheduleOptions: {
          0: { label: '休息', desc: '不接任何新单' },
          1: { label: '可接单', desc: '正常派单' },
          2: { label: '忙碌', desc: '只接急单/高价单' }
      },
      currentStatus: { label: '可接单', value: 1 }, // 默认状态
      
      // 模拟当日订单列表
      todayOrders: [
           { _id: 'o3', time: '14:00', service: '深度保洁', status: 20, status_text: '待服务' },
           { _id: 'o4', time: '18:30', service: '洗衣机清洗', status: 30, status_text: '服务中' },
      ] 
  },

  onLoad: function (options) {
      this.generateCalendar(this.data.currentYear, this.data.currentMonth);
      this.loadScheduleData(); // Load real schedule data
  },
  
  // --- Calendar Logic ---
  generateCalendar: function(year, month) {
      const dates = [];
      const today = new Date();
      const todayStr = today.getFullYear() + '/' + (today.getMonth() + 1) + '/' + today.getDate();
      
      // Get first day of the month
      const firstDay = new Date(year, month - 1, 1);
      const firstDayWeek = firstDay.getDay(); // 0 (Sunday) to 6 (Saturday)
      
      // Get last day of the month
      const lastDay = new Date(year, month, 0);
      const daysInMonth = lastDay.getDate();
      
      // Fill previous month dates (for offset)
      const prevMonthDays = new Date(year, month - 1, 0).getDate();
      for (let i = firstDayWeek; i > 0; i--) {
          dates.push({
              day: prevMonthDays - i + 1,
              date: '', // Not needed for display
              isCurrentMonth: false
          });
      }
      
      // Fill current month dates
      for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = `${year}/${month}/${day}`;
          const schedule = this.data.scheduleMap[dateStr] || {};
          
          dates.push({
              day: day,
              date: dateStr,
              isCurrentMonth: true,
              isToday: dateStr === todayStr,
              isScheduled: schedule.status === 1 || schedule.status === 2,
              isDayOff: schedule.status === 0,
              hasOrders: schedule.hasOrders || false // Check if the day has orders
          });
      }
      
      // Fill next month dates (until a full 6 weeks if necessary)
      const totalCells = 42;
      const remainingCells = totalCells - dates.length;
      for (let day = 1; day <= remainingCells && dates.length < totalCells; day++) {
          dates.push({
              day: day,
              date: '', 
              isCurrentMonth: false
          });
      }
      
      this.setData({ calendarDates: dates });
  },
  
  prevMonth: function() {
      let { currentYear, currentMonth } = this.data;
      if (currentMonth === 1) {
          currentYear -= 1;
          currentMonth = 12;
      } else {
          currentMonth -= 1;
      }
      this.setData({ currentYear, currentMonth }, () => {
          this.generateCalendar(currentYear, currentMonth);
          this.loadScheduleData();
      });
  },
  
  nextMonth: function() {
      let { currentYear, currentMonth } = this.data;
      if (currentMonth === 12) {
          currentYear += 1;
          currentMonth = 1;
      } else {
          currentMonth += 1;
      }
      this.setData({ currentYear, currentMonth }, () => {
          this.generateCalendar(currentYear, currentMonth);
          this.loadScheduleData();
      });
  },
  
  goToToday: function() {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      this.setData({ currentYear: year, currentMonth: month }, () => {
          this.generateCalendar(year, month);
          this.onDateSelect({ currentTarget: { dataset: { date: this.data.selectedDate } } }); // Re-select today
      });
  },

  onDateSelect: function(e) {
      const dateStr = e.currentTarget.dataset.date;
      if (!dateStr) return; // Ignore previous/next month days
      
      // 格式化展示文本 (e.g., 2025年10月28日)
      const [y, m, d] = dateStr.split('/').map(Number);
      const dateText = `${y}年${m}月${d}日`;
      
      const schedule = this.data.scheduleMap[dateStr] || {};
      const statusValue = schedule.status !== undefined ? schedule.status : 1; // Default to '可接单'
      
      this.setData({
          selectedDate: dateStr,
          selectedDateText: dateText,
          currentStatus: {
              label: this.data.scheduleOptions[statusValue].label,
              value: statusValue
          }
      });
      this.loadDayOrders(dateStr);
  },

  // --- Schedule Data & Actions ---
  loadScheduleData: function() {
      // 1. Load monthly schedule from Cloud Function
      // wx.cloud.callFunction({ name: 'getMonthlySchedule', data: { year: this.data.currentYear, month: this.data.currentMonth } }).then(...)
      
      // 2. Mock Data Update: Assume API returns an object for the month
      const mockScheduleMap = {
           '2025/10/28': { status: 1, hasOrders: true },
           '2025/10/29': { status: 0, hasOrders: false },
           '2025/11/01': { status: 2, hasOrders: true },
           '2025/11/05': { status: 1, hasOrders: false },
      };
      this.setData({ scheduleMap: mockScheduleMap });
      this.generateCalendar(this.data.currentYear, this.data.currentMonth);
      this.onDateSelect({ currentTarget: { dataset: { date: this.data.selectedDate } } }); // Refresh detail panel
  },
  
  loadDayOrders: function(dateStr) {
      // 1. Load orders for the selected date from Cloud Function
      // wx.cloud.callFunction({ name: 'getDayOrders', data: { date: dateStr } }).then(...)
      
      // 2. Mock Orders
      let orders = [];
      if (dateStr === this.data.selectedDate) {
          orders = [
               { _id: 'o3', time: '14:00', service: '深度保洁', status: 20, status_text: '待服务' },
               { _id: 'o4', time: '18:30', service: '洗衣机清洗', status: 30, status_text: '服务中' },
          ];
      } 
      
      this.setData({ todayOrders: orders });
  },

  onStatusChange: function(e) {
      const newStatus = parseInt(e.currentTarget.dataset.status);
      const { selectedDate, scheduleOptions } = this.data;
      
      if (newStatus === this.data.currentStatus.value) return;
      
      wx.showModal({
          title: '确认设置',
          content: `确定将 ${selectedDateOptions.label} 设置为 ${scheduleOptions[newStatus].label} 吗？`,
          success: (res) => {
              if (res.confirm) {
                  // Call API to set schedule
                  // wx.cloud.callFunction({ name: 'setDailySchedule', data: { date: selectedDate, status: newStatus } }).then(...)
                  
                  // Mock success: Update local data and UI
                  const scheduleMap = this.data.scheduleMap;
                  scheduleMap[selectedDate] = { status: newStatus, hasOrders: this.data.todayOrders.length > 0 };
                  
                  this.setData({
                      currentStatus: { label: scheduleOptions[newStatus].label, value: newStatus },
                      scheduleMap: scheduleMap
                  }, () => {
                      this.generateCalendar(this.data.currentYear, this.data.currentMonth);
                      wx.showToast({ title: '设置成功', icon: 'success' });
                  });
              }
          }
      });
  }
});