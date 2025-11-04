// components/order-detail-modal/order-detail-modal.js
Component({
  properties: {
    order: { // Receive order object from parent page
      type: Object,
      value: null
    }
  },
  data: {},
  methods: {
    closeModal() {
      this.triggerEvent('close'); // Trigger close event for parent
    },
    acceptOrder() {
      // Trigger accept event, passing orderId back
      this.triggerEvent('accept', { orderId: this.data.order._id }); 
    },
    rejectOrder() {
       // Trigger reject event, passing orderId back
      this.triggerEvent('reject', { orderId: this.data.order._id });
    }
  }
})