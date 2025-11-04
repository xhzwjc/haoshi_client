// cloudbase_auth 云函数代码
const cloud = require('wx-server-sdk')

// 初始化云环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  // 这个云函数用于环境共享的鉴权
  // 返回的数据可以在安全规则中通过 auth.custom 获取
  return {
    errCode: 0,
    errMsg: 'success',
    auth: JSON.stringify({
      // 这里可以设置一些自定义权限信息
      // 比如根据业务需要返回用户角色、权限等级等
      uid: wxContext.OPENID, // 用户OpenID
      appid: wxContext.APPID, // 小程序AppID
      role: 'user', // 用户角色，可根据需要修改
      permission: 'read' // 权限级别
    }),
  }
}