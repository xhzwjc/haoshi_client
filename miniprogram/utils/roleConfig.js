/**
 * 角色路由配置
 * 统一管理三种角色到对应首页的映射关系
 */

// 角色常量
const ROLES = {
    CLIENT: 'CLIENT',           // 客户端
    TECHNICIAN: 'TECHNICIAN',   // 家政人员端
    ADMIN: 'ADMIN'              // 管理端
};

// 角色到首页的路由映射表
const ROLE_ROUTES = {
    CLIENT: '/pages/index/index',
    TECHNICIAN: '/subpackages/packageTech/pages/technician-index/technician-index',
    ADMIN: '/subpackages/packageAdmin/pages/admin-dashboard/admin-dashboard'
};

// 登录页路径
const LOGIN_URL = '/pages/login/login';

/**
 * 根据角色获取对应的首页路径
 * @param {string} role - 用户角色
 * @returns {string|null} 首页路径，如果角色无效则返回 null
 */
function getHomePageByRole(role) {
    return ROLE_ROUTES[role] || null;
}

/**
 * 验证角色是否合法
 * @param {string} role - 用户角色
 * @returns {boolean} 是否为合法角色
 */
function isValidRole(role) {
    return Object.values(ROLES).includes(role);
}

module.exports = {
    ROLES,
    ROLE_ROUTES,
    LOGIN_URL,
    getHomePageByRole,
    isValidRole
};
