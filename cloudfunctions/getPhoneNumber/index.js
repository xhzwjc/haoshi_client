const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event = {}) => {
  const code = (event.code || event.phoneCode || '').trim();

  if (!code) {
    return { code: -1, message: '缺少手机号授权凭证' };
  }

  try {
    const res = await cloud.openapi.wxa.business.getUserPhoneNumber({ code });
    const phoneInfo = res && res.phoneInfo ? res.phoneInfo : {};

    const phoneNumber = phoneInfo.phoneNumber || phoneInfo.purePhoneNumber || '';

    if (!phoneNumber) {
      return { code: -1, message: '未能获取手机号信息', data: res };
    }

    return {
      code: 0,
      message: 'success',
      data: {
        phoneNumber,
        purePhoneNumber: phoneInfo.purePhoneNumber || phoneNumber,
        countryCode: phoneInfo.countryCode || '86'
      }
    };
  } catch (error) {
    console.error('getPhoneNumber error', error);
    return {
      code: -1,
      message: error?.errMsg || error?.message || '获取手机号失败',
      error
    };
  }
};
