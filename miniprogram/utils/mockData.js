const USERS_KEY = 'mock_users';
const TECHNICIANS_KEY = 'mock_technicians';
const ORDERS_KEY = 'mock_orders';
const SERVICES_KEY = 'mock_services';

// Initial Data
const INITIAL_USERS = [
    { id: 'u1', phone: '13800000001', name: '张三', createTime: Date.now() - 86400000 * 2 },
    { id: 'u2', phone: '13800000002', name: '李四', createTime: Date.now() - 86400000 }
];

const INITIAL_TECHNICIANS = [
    { id: 't1', phone: '13900000001', name: '王师傅', password: '6666', status: 'ACTIVE', serviceType: '保洁', createTime: Date.now() - 86400000 * 10 },
    { id: 't2', phone: '13900000002', name: '赵师傅', password: '6666', status: 'PENDING', serviceType: '维修', createTime: Date.now() - 3600000 }
];

const INITIAL_SERVICES = [
    { id: 's1', name: '日常保洁', price: 50, unit: '小时' },
    { id: 's2', name: '深度清洁', price: 80, unit: '小时' },
    { id: 's3', name: '家电维修', price: 100, unit: '次' }
];

const INITIAL_ORDERS = [
    { id: 'o1', userId: 'u1', techId: 't1', status: 'COMPLETED', amount: 200, createTime: Date.now() - 86400000 },
    { id: 'o2', userId: 'u2', techId: null, status: 'PENDING', amount: 150, createTime: Date.now() - 3600000 }
];

class MockDataService {
    constructor() {
        this._initData();
    }

    _initData() {
        if (!wx.getStorageSync(USERS_KEY)) wx.setStorageSync(USERS_KEY, INITIAL_USERS);
        if (!wx.getStorageSync(TECHNICIANS_KEY)) wx.setStorageSync(TECHNICIANS_KEY, INITIAL_TECHNICIANS);
        if (!wx.getStorageSync(SERVICES_KEY)) wx.setStorageSync(SERVICES_KEY, INITIAL_SERVICES);
        if (!wx.getStorageSync(ORDERS_KEY)) wx.setStorageSync(ORDERS_KEY, INITIAL_ORDERS);
    }

    // --- Users ---
    getUsers() { return wx.getStorageSync(USERS_KEY) || []; }
    addUser(phone) {
        const users = this.getUsers();
        const existing = users.find(u => u.phone === phone);
        if (existing) return existing;

        const newUser = { id: `u${Date.now()}`, phone, name: `用户${phone.slice(-4)}`, createTime: Date.now() };
        users.push(newUser);
        wx.setStorageSync(USERS_KEY, users);
        return newUser;
    }

    // --- Technicians ---
    getTechnicians() { return wx.getStorageSync(TECHNICIANS_KEY) || []; }
    registerTechnician(phone, password, name) {
        const techs = this.getTechnicians();
        if (techs.find(t => t.phone === phone)) throw new Error('该手机号已注册');

        const newTech = {
            id: `t${Date.now()}`,
            phone,
            password,
            name: name || `师傅${phone.slice(-4)}`,
            status: 'PENDING',
            createTime: Date.now()
        };
        techs.push(newTech);
        wx.setStorageSync(TECHNICIANS_KEY, techs);
        return newTech;
    }

    loginTechnician(phone, password) {
        const techs = this.getTechnicians();
        const tech = techs.find(t => t.phone === phone && t.password === password);
        if (!tech) throw new Error('账号或密码错误');
        if (tech.status !== 'ACTIVE') throw new Error(`账号状态：${tech.status === 'PENDING' ? '审核中' : '已禁用'}`);
        return tech;
    }

    updateTechnicianStatus(id, status) {
        const techs = this.getTechnicians();
        const index = techs.findIndex(t => t.id === id);
        if (index === -1) return false;
        techs[index].status = status;
        wx.setStorageSync(TECHNICIANS_KEY, techs);
        return true;
    }

    // --- Admin ---
    loginAdmin(account, password) {
        if (account === 'admin' && password === 'admin') {
            return { role: 'ADMIN', name: '超级管理员' };
        }
        throw new Error('管理员账号或密码错误');
    }

    // --- Stats ---
    getDashboardStats() {
        const users = this.getUsers();
        const orders = this.getOrders();
        const techs = this.getTechnicians();

        const totalRevenue = orders
            .filter(o => o.status === 'COMPLETED' || o.status === 'PAID') // Assuming PAID is also valid revenue
            .reduce((sum, o) => sum + (o.amount || 0), 0);

        return {
            totalUsers: users.length,
            totalOrders: orders.length,
            totalTechs: techs.filter(t => t.status === 'ACTIVE').length,
            totalRevenue
        };
    }

    getTodayStats() {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        const users = this.getUsers().filter(u => u.createTime >= startOfDay);
        const orders = this.getOrders().filter(o => o.createTime >= startOfDay);
        const completedOrders = orders.filter(o => o.status === 'COMPLETED');
        const revenue = completedOrders.reduce((sum, o) => sum + (o.amount || 0), 0);

        return {
            newOrders: orders.length,
            completedOrders: completedOrders.length,
            revenue,
            newUsers: users.length
        };
    }

    // --- Orders ---
    getOrders() { return wx.getStorageSync(ORDERS_KEY) || []; }

    // --- Services ---
    getServices() { return wx.getStorageSync(SERVICES_KEY) || []; }
}

export const mockData = new MockDataService();
