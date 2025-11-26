// pages/index/index.js
const db = wx.cloud.database(); // 鑾峰彇鏁版嵁搴撳紩鐢?
Page({
  data: {
    // 鍥哄畾鐨勬湇鍔＄綉鏍兼暟鎹?    // 浣犻渶瑕佸皢 icon 璺緞鏇挎崲涓轰綘鐨勫浘鐗?    serviceGrid: [
      { name: '鍏ㄥ眿娓呮磥', icon: '/packageCommon/images/icon_move.png', bgColor: '#EEFCFF', serviceId: 'a235246468f875370029b2476ea6131c' },
      { name: '娲楃幓鐠?, icon: '/packageCommon/images/icon_glass.png', bgColor: '#ECF5FF', serviceId: 'a235246468f875370029b2476ea6134c' },
      { name: '寮€鑽掍繚娲?, icon: '/packageCommon/images/icon_clean.png', bgColor: '#F4F0FF', serviceId: 'a235246468f875370029b2476ea6132c' },
      { name: '閾插鐨?, icon: '/packageCommon/images/icon_wall.png', bgColor: '#FEF6EC', serviceId: 'a235246468f875370029b2476ea6135c' },
      { name: '娌圭儫鏈烘竻娲?, icon: '/packageCommon/images/icon_hood.png', bgColor: '#EEFAF3', serviceId: 'a235246468f875370029b2476ea6133c' },
      // { name: '鏈堝珎鏈嶅姟', icon: '/packageCommon/images/icon_nanny.png', bgColor: '#FFF2F4', serviceId: 'a235246468f875370029b2476ea6136c' },
      // { name: '瀹剁數缁翠慨', icon: '/packageCommon/images/icon_repair.png', bgColor: '#FEF0F0', serviceId: 'a235246468f875370029b2476ea6137c' },
      // { name: '鎼鏈嶅姟', icon: '/packageCommon/images/icon_move.png', bgColor: '#EEFCFF', serviceId: 'a235246468f875370029b2476ea6138c' }
      // "鏇村鏈嶅姟" 鍦╳xml涓崟鐙鐞?    ],
    // 鐑棬鎺ㄨ崘锛屼粠鏁版嵁搴撳姩鎬佽幏鍙?    hotServices: [
      // 杩欓噷鏄師鍨嬪浘鐨勯潤鎬佹暟鎹紝鐢ㄤ簬鍗犱綅
      // 鐪熷疄鏁版嵁浼氫粠 getHotServices() 鍔犺浇
      {
        _id: '1',
        name: '娣卞害淇濇磥濂楅',
        description: '鍏ㄥ眿娣卞害娓呮磥, 鍖呭惈鍘ㄥ崼娌规薄娓呯悊',
        price: 299,
        rating: 4.8,
        sales: 1250,
        is_hot: true
      },
      {
        _id: '2',
        name: '娌圭儫鏈烘竻娲?,
        description: '涓撲笟璁惧, 褰诲簳娓呮磥娌圭儫鏈哄唴澶?,
        price: 120,
        rating: 4.9,
        sales: 856,
        is_hot: true
      },
      {
        _id: '3',
        name: '寮€鑽掍繚娲?,
        description: '鏂版埧鍏ヤ綇鍓嶅叏闈㈡竻娲佹湇鍔?,
        price: 199,
        rating: 4.7,
        sales: 632,
        is_hot: true
      }
    ]
  },

  onLoad: function() {
    this.getHotServices();
  },

  /**
   * 浠庝簯鏁版嵁搴撳姞杞界儹闂ㄦ湇鍔?   */
  getHotServices:聽function()聽{
    聽聽聽聽// ** 娉ㄦ剰锛氳繖閲屼娇鐢?where({ hot: true }) 鏉ョ瓫閫夌儹闂ㄦ湇鍔?**
    聽聽聽聽db.collection('services').where({
    聽聽聽聽聽聽hot:聽true // 纭繚鎮ㄧ殑鏁版嵁搴撳瓧娈垫槸 hot锛屼笖鍊间负 true
    聽聽聽聽}).limit(3).get({ // 闄愬埗鍙彇3鏉?    聽聽聽聽聽聽success:聽res聽=>聽{
    聽聽聽聽聽聽聽聽if聽(res.data聽&&聽res.data.length聽>聽0)聽{
    聽聽聽聽聽聽聽聽聽聽// 杩欓噷鐩存帴浣跨敤鏁版嵁搴撹繑鍥炵殑鏁版嵁缁撴瀯
    聽聽聽聽聽聽聽聽聽聽this.setData({
                    // 灏嗘暟鎹簱瀛楁鍚嶆槧灏勫埌鍓嶇 data 瀛楁鍚嶏紙濡傛灉闇€瑕侊級
                    // 鍋囪鍓嶇 wxml 涓娇鐢ㄧ殑瀛楁鏄?name, desc, price, rate, sold
    聽聽聽聽聽聽聽聽聽聽聽聽hotServices:聽res.data.map(item => ({
                    _id: item._id,
                    name: item.name,
                    // 灏嗘暟鎹簱鐨?'desc' 鏄犲皠鍒板墠绔彲鑳介渶瑕佺殑 'description'锛屽鏋?wxml 鐩存帴鐢?item.desc 鍒欎笉闇€瑕佹槧灏?                    description: item.desc, 
                    price: item.price,
                    rating: item.rate, // 鏁版嵁搴撳瓧娈典负 rate
                    sales: item.sold,   // 鏁版嵁搴撳瓧娈典负 sold
                    cover: item.cover, // 鐢ㄤ簬灏侀潰鍥?                    unit: item.unit,
                }))
    聽聽聽聽聽聽聽聽聽聽});
    聽聽聽聽聽聽聽聽}
    聽聽聽聽聽聽},
    聽聽聽聽聽聽fail:聽err聽=>聽{
    聽聽聽聽聽聽聽聽console.error('鑾峰彇鐑棬鏈嶅姟澶辫触:聽',聽err);
    聽聽聽聽聽聽聽聽wx.showToast({聽title:聽'鍔犺浇澶辫触',聽icon:聽'none'聽});
    聽聽聽聽聽聽}
    聽聽聽聽});
    聽聽},

  /**
   * 鐐瑰嚮鏈嶅姟缃戞牸
   */
  onGridItemTap: function(e) {
    const serviceId = e.currentTarget.dataset.serviceId;
    if (!serviceId) return;
    
    // 鐩存帴璺宠浆鍒?booking 椤甸潰
    wx.navigateTo({
      url: `/subpackages/packageService/pages/booking/booking?serviceId=${serviceId}`
    });
  },

  /**
   * 鐐瑰嚮鐑棬鎺ㄨ崘鐨?"棰勭害"
   */
  onBookNowTap: function(e) {
    const serviceId = e.currentTarget.dataset.serviceId;
    if (!serviceId) return;

    // 鐩存帴璺宠浆鍒?booking 椤甸潰
    wx.navigateTo({
      url: `/subpackages/packageService/pages/booking/booking?serviceId=${serviceId}`
    });
  },
  /**
   * 鐐瑰嚮 "鏇村鏈嶅姟"
   */
  onMoreServiceTap: function() {
    wx.switchTab({
      url: '/pages/service-list/service-list'
    });
  },

  /**
   * 鐐瑰嚮 "鏌ョ湅鍏ㄩ儴"
   */
  onViewAllTap: function() {
    wx.switchTab({
      url: '/pages/service-list/service-list'
    });
  }
});
