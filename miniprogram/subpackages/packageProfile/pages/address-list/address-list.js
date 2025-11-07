const app = getApp();

const defaultForm = () => ({
  contact_name: '',
  contact_phone: '',
  address: '',
  tag: '',
  is_default: false
});

Page({
  data: {
    addresses: [],
    loading: false,
    showEditor: false,
    editingId: '',
    form: defaultForm(),
    saving: false
  },

  onLoad() {
    this.fetchAddresses();
  },

  onPullDownRefresh() {
    this.fetchAddresses(true);
  },

  async fetchAddresses(isPullDown = false) {
    if (this.data.loading && !isPullDown) return;
    this.setData({ loading: true });

    try {
      const clientCloud = await app.waitClientCloudReady();
      const res = await clientCloud.callFunction({
        name: 'manageClientAddresses',
        data: { action: 'list' }
      });

      if (res.result && res.result.code === 0) {
        const list = (res.result.data || []).map(item => ({
          ...item,
          tag: item.tag || ''
        }));
        this.setData({ addresses: list });
      } else {
        throw new Error((res.result && res.result.message) || '加载失败');
      }
    } catch (err) {
      console.error('加载地址失败', err);
      wx.showToast({ title: '地址加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
      if (isPullDown) {
        wx.stopPullDownRefresh();
      }
    }
  },

  createAddress() {
    this.setData({
      showEditor: true,
      editingId: '',
      form: defaultForm()
    });
  },

  editAddress(e) {
    const id = e.currentTarget.dataset.id;
    const target = this.data.addresses.find(item => item._id === id);
    if (!target) return;
    this.setData({
      showEditor: true,
      editingId: id,
      form: {
        contact_name: target.contact_name || '',
        contact_phone: target.contact_phone || '',
        address: target.address || '',
        tag: target.tag || '',
        is_default: !!target.is_default
      }
    });
  },

  closeEditor() {
    if (this.data.saving) return;
    this.setData({ showEditor: false });
  },

  noop() {},

  onFieldChange(e) {
    const field = e.currentTarget.dataset.field;
    if (!field) return;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onSwitchChange(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  async submitForm() {
    if (this.data.saving) return;
    const { contact_name, contact_phone, address } = this.data.form;

    if (!contact_name || !contact_name.trim()) {
      wx.showToast({ title: '请填写联系人', icon: 'none' });
      return;
    }

    if (!/^\d{11}$/.test(String(contact_phone || '').trim())) {
      wx.showToast({ title: '手机号格式不正确', icon: 'none' });
      return;
    }

    if (!address || !address.trim()) {
      wx.showToast({ title: '请填写详细地址', icon: 'none' });
      return;
    }

    this.setData({ saving: true });
    wx.showLoading({ title: '保存中', mask: true });

    try {
      const clientCloud = await app.waitClientCloudReady();
      const res = await clientCloud.callFunction({
        name: 'manageClientAddresses',
        data: {
          action: 'save',
          data: {
            id: this.data.editingId,
            ...this.data.form
          }
        }
      });

      if (res.result && res.result.code === 0) {
        wx.showToast({ title: '保存成功', icon: 'success' });
        this.setData({ showEditor: false });
        this.fetchAddresses();
      } else {
        throw new Error((res.result && res.result.message) || '保存失败');
      }
    } catch (err) {
      console.error('保存地址失败', err);
      wx.showToast({ title: '保存失败，请稍后再试', icon: 'none' });
    } finally {
      this.setData({ saving: false });
      wx.hideLoading();
    }
  },

  async deleteAddress(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;

    wx.showModal({
      title: '删除地址',
      content: '确认删除该地址吗？',
      confirmText: '删除',
      confirmColor: '#f4212e',
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '删除中', mask: true });
        try {
          const clientCloud = await app.waitClientCloudReady();
          const result = await clientCloud.callFunction({
            name: 'manageClientAddresses',
            data: { action: 'delete', id }
          });

          if (result.result && result.result.code === 0) {
            wx.showToast({ title: '已删除', icon: 'success' });
            this.fetchAddresses();
          } else {
            throw new Error((result.result && result.result.message) || '删除失败');
          }
        } catch (error) {
          console.error('删除地址失败', error);
          wx.showToast({ title: '删除失败，请稍后再试', icon: 'none' });
        } finally {
          wx.hideLoading();
        }
      }
    });
  },

  async setDefault(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;

    wx.showLoading({ title: '设置中', mask: true });
    try {
      const clientCloud = await app.waitClientCloudReady();
      const res = await clientCloud.callFunction({
        name: 'manageClientAddresses',
        data: { action: 'setDefault', id }
      });

      if (res.result && res.result.code === 0) {
        wx.showToast({ title: '已设为默认', icon: 'success' });
        this.fetchAddresses();
      } else {
        throw new Error((res.result && res.result.message) || '设置失败');
      }
    } catch (error) {
      console.error('设置默认地址失败', error);
      wx.showToast({ title: '设置失败，请稍后重试', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  }
});
