// /pages/order-detail/order-detail.js
const db = wx.cloud.database();

function getCurrentClientOpenid() {
    return wx.getStorageSync('user_openid') || '';
}

function orderBelongsToClient(order = {}, openid) {
    if (!openid) return false;
    const candidates = new Set();
    if (order.client_openid) candidates.add(order.client_openid);
    if (order._openid) candidates.add(order._openid);
    if (order.clientOpenid) candidates.add(order.clientOpenid);
    if (Array.isArray(order.bound_openids)) {
        order.bound_openids.forEach((value) => value && candidates.add(value));
    }
    if (Array.isArray(order.client_bound_openids)) {
        order.client_bound_openids.forEach((value) => value && candidates.add(value));
    }
    return candidates.has(openid);
}

function toDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'number') {
        return new Date(value);
    }
    if (typeof value === 'string') {
        const parsed = new Date(value);
        return isNaN(parsed.getTime()) ? null : parsed;
    }
    if (value && typeof value === 'object') {
        if (typeof value.toDate === 'function') {
            return value.toDate();
        }
        if (value.$date) {
            const parsed = new Date(value.$date);
            return isNaN(parsed.getTime()) ? null : parsed;
        }
    }
    return null;
}

function formatTimestamp(value) {
    const dateObj = toDate(value);
    if (!dateObj || isNaN(dateObj.getTime())) return '';
    const pad = (num) => (num < 10 ? `0${num}` : `${num}`);
    const y = dateObj.getFullYear();
    const m = pad(dateObj.getMonth() + 1);
    const d = pad(dateObj.getDate());
    const hh = pad(dateObj.getHours());
    const mm = pad(dateObj.getMinutes());
    return `${y}-${m}-${d} ${hh}:${mm}`;
}

function buildTimeline(order = {}) {
    const timeline = [];
    const pushIfExists = (label, value, extra = {}) => {
        const formatted = formatTimestamp(value);
        if (formatted) {
            timeline.push({ label, value: formatted, ...extra });
        }
    };

    pushIfExists('下单', order.created_at);
    pushIfExists('师傅接单', order.accepted_at);
    pushIfExists('确认上门', order.service_started_at);
    pushIfExists('完成服务', order.service_completed_at);
    pushIfExists('提交报价', order.quote_submitted_at);
    pushIfExists('确认金额', order.amount_confirmed_at);
    pushIfExists('支付', order.paid_at);

    const review = order.review || {};
    if (order.review_submitted_at) {
        const reviewExtra = {};
        const comment = review.comment || order.review_comment || '';
        if (comment) {
            reviewExtra.comment = comment;
        }
        const rating = review.rating !== undefined && review.rating !== null
            ? review.rating
            : order.review_rating;
        if (rating !== undefined && rating !== null && rating !== '') {
            const numericRating = typeof rating === 'number' ? rating : Number(rating);
            reviewExtra.rating = Number.isNaN(numericRating) ? rating : numericRating;
        }
        const replyContent = review.reply || order.review_reply;
        if (replyContent) {
            reviewExtra.reply = replyContent;
            const replyTime = review.reply_at || order.review_reply_at;
            const formattedReplyTime = formatTimestamp(replyTime);
            if (formattedReplyTime) {
                reviewExtra.reply_at = formattedReplyTime;
            }
        }
        pushIfExists('评价', order.review_submitted_at, reviewExtra);
    } else {
        pushIfExists('评价', order.review_submitted_at);
    }

    pushIfExists('售后申请', order.after_sale_submitted_at);
    pushIfExists('取消', order.cancelled_at);

    return timeline;
}

Page({
    data: {
        orderId: '',
        orderDetail: null,
        loading: true
    },

    ensureOwned() {
        const openid = getCurrentClientOpenid();
        const order = this.data.orderDetail;
        if (order && orderBelongsToClient(order, openid)) {
            return true;
        }
        wx.showToast({ title: '无权操作该订单', icon: 'none' });
        return false;
    },

    onLoad: function (options) {
        if (options.id) {
            this.setData({
                orderId: options.id
            });
            this.fetchOrderDetail(options.id);
        } else {
            wx.showToast({ title: '订单ID丢失', icon: 'none' });
            this.setData({ loading: false });
        }
    },

    onShow: function () {
        // 从其他页面返回（如支付成功后），需要刷新订单状态
        if (this.data.orderId) {
            this.fetchOrderDetail(this.data.orderId);
        }
    },

    /**
     * 【修改】根据订单ID从数据库获取详情
     */
    fetchOrderDetail: function (id) {
        this.setData({ loading: true });
        db.collection('bookings').doc(id).get({
            success: (res) => {
                const order = res.data;

                const openid = getCurrentClientOpenid();
                if (!orderBelongsToClient(order, openid)) {
                    wx.showToast({ title: '无权查看该订单', icon: 'none' });
                    this.setData({ orderDetail: null, loading: false });
                    return;
                }

                // 核心修改：价格显示逻辑
                let finalFee = parseFloat(order.final_price) || 0;
                let isFinalPrice = order.status >= 35;
                order.is_final_price = isFinalPrice;
                order.price_display = isFinalPrice ? finalFee.toFixed(2) : (order.price_range || '待核价');

                if (!isFinalPrice && order.price_range && order.service_unit) {
                    order.price_display += `/${order.service_unit}`;
                }

                switch (order.status) {
                    case 10:
                        order.status_text = '待接单';
                        order.status_tip = '订单已提交，正在等待家政人员接单。';
                        break;
                    case 20:
                        order.status_text = '待服务';
                        order.status_tip = `${order.master_info || '家政人员'}已接单，请等待按约定时间上门服务。`;
                        break;
                    case 30:
                        order.status_text = '服务中';
                        order.status_tip = `${order.master_info || '家政人员'}已上门，正在提供服务中。`;
                        break;
                    case 35:
                        order.status_text = '待确认金额'; // 新状态
                        order.status_tip = `${order.master_info || '家政人员'}已服务完毕并提交报价，请您确认最终金额。`;
                        break;
                    case 40:
                        order.status_text = '待支付';
                        order.status_tip = '金额已确认，请在规定时间内完成支付。';
                        break;
                    case 50:
                        order.status_text = '待评价';
                        order.status_tip = '支付成功！请您对本次服务进行评价。';
                        break;
                    case 60:
                        order.status_text = '已完成';
                        order.status_tip = '订单已完成，期待您的再次预约！';
                        break;
                    case 0:
                        order.status_text = '已取消';
                        order.status_tip = '订单已取消。';
                        break;
                    case -1:
                        order.status_text = '已拒单';
                        order.status_tip = '家政人员未接单，订单已关闭。';
                        break;
                    default:
                        order.status_text = '状态异常';
                        order.status_tip = '订单状态异常，请联系客服。';
                }

                this.setData({
                    orderDetail: order,
                    loading: false
                });
            },
            fail: (err) => {
                console.error('获取订单详情失败:', err);
                wx.showToast({ title: '加载失败', icon: 'error' });
                this.setData({ loading: false });
            }
        });
    },

    contactMaster() {
        if (!this.ensureOwned()) return;
        const phone = this.data.orderDetail?.master_phone || this.data.orderDetail?.masterPhone;
        if (!phone) {
            wx.showToast({ title: '暂无师傅电话', icon: 'none' });
            return;
        }
        wx.makePhoneCall({
            phoneNumber: phone.toString(),
            fail: () => wx.showToast({ title: '拨号失败，请稍后再试', icon: 'none' })
        });
    },

    // 复制订单编号功能
    copyContent: function (e) {
        const content = e.currentTarget.dataset.content;
        wx.setClipboardData({
            data: content,
            success: () => {
                wx.showToast({ title: '复制成功', icon: 'success' });
            }
        });
    }
});