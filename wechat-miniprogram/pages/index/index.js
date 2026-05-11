const { cloneDrinks } = require('../../data/default-drinks');

const STORAGE_KEY = 'coffee_sop_miniprogram';
const STATUS = {
  loading: {
    chip: '同步中',
    cls: 'sync',
    title: '正在读取云端 SOP',
    text: '如果云端暂时不可用，会先显示本机缓存。'
  },
  synced: {
    chip: '云端同步',
    cls: 'sync',
    title: '正在查看共享 SOP',
    text: '编辑后点保存，其他员工刷新后会看到最新版本。'
  },
  dirty: {
    chip: '有修改',
    cls: 'warn',
    title: '本机有未保存修改',
    text: '确认无误后点保存云端，当前采用最后一次保存生效。'
  },
  local: {
    chip: '本机缓存',
    cls: 'local',
    title: '暂时使用本机版本',
    text: '云端不可用时可以先查看，恢复网络后再刷新。'
  },
  error: {
    chip: '同步失败',
    cls: 'error',
    title: '云端连接失败',
    text: '请确认已开通云开发、上传云函数并创建数据库集合。'
  }
};

function normalizeDrink(item, index) {
  const id = Number(item && item.id) || index + 1;
  return {
    id,
    sort: Number(item && item.sort) || id,
    emoji: item && item.emoji ? String(item.emoji) : '☕',
    name: item && item.name ? String(item.name) : `饮品 ${index + 1}`,
    price: item && item.price ? String(item.price) : '¥--',
    img: item && item.img ? String(item.img) : '',
    ingredients: Array.isArray(item && item.ingredients)
      ? item.ingredients.map(ing => ({
        name: String(ing && ing.name || ''),
        amount: String(ing && ing.amount || '')
      }))
      : [{ name: '', amount: '' }],
    steps: Array.isArray(item && item.steps)
      ? item.steps.map(step => String(step || ''))
      : [''],
    notes: Array.isArray(item && item.notes)
      ? item.notes.map(note => String(note || ''))
      : []
  };
}

function normalizeData(source) {
  const list = Array.isArray(source) ? source : [];
  return list
    .map(normalizeDrink)
    .sort((left, right) => {
      if (left.sort === right.sort) return left.id - right.id;
      return left.sort - right.sort;
    });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

Page({
  data: {
    drinks: [],
    visibleDrinks: [],
    query: '',
    openMap: {},
    editMode: false,
    dirty: false,
    loading: false,
    status: STATUS.loading
  },

  onLoad() {
    this.loadLocal();
    this.refreshCloud();
  },

  onPullDownRefresh() {
    this.refreshCloud().finally(() => wx.stopPullDownRefresh());
  },

  onShareAppMessage() {
    return {
      title: '咖啡店 SOP',
      path: '/pages/index/index'
    };
  },

  loadLocal() {
    const saved = wx.getStorageSync(STORAGE_KEY);
    const drinks = normalizeData(saved || cloneDrinks());
    const openMap = {};
    drinks.forEach(drink => { openMap[drink.id] = true; });
    this.setData({ drinks, openMap });
    this.updateVisible();
  },

  persistLocal(drinks) {
    wx.setStorageSync(STORAGE_KEY, normalizeData(drinks));
  },

  setStatus(name) {
    this.setData({ status: STATUS[name] || STATUS.local });
  },

  updateVisible() {
    const query = String(this.data.query || '').trim().toLowerCase();
    const visibleDrinks = this.data.drinks
      .filter(drink => {
        if (!query) return true;
        const haystack = [
          drink.name,
          drink.price,
          ...(drink.ingredients || []).map(item => `${item.name} ${item.amount}`),
          ...(drink.steps || []),
          ...(drink.notes || [])
        ].join(' ').toLowerCase();
        return haystack.includes(query);
      })
      .map(drink => ({
        ...drink,
        open: !!this.data.openMap[drink.id],
        hasNotes: Array.isArray(drink.notes) && drink.notes.length > 0
      }));
    this.setData({ visibleDrinks });
  },

  async refreshCloud() {
    const app = getApp();
    if (!app.globalData.cloudReady) {
      this.setStatus('local');
      return;
    }

    this.setData({ loading: true });
    this.setStatus('loading');
    try {
      const result = await wx.cloud.callFunction({
        name: 'sopApi',
        data: { action: 'list' }
      });
      const drinks = normalizeData(result && result.result && result.result.drinks);
      if (!drinks.length) throw new Error('empty cloud result');
      const openMap = {};
      drinks.forEach(drink => { openMap[drink.id] = true; });
      this.persistLocal(drinks);
      this.setData({ drinks, openMap, dirty: false, loading: false });
      this.setStatus('synced');
      this.updateVisible();
    } catch (error) {
      this.setData({ loading: false });
      this.setStatus(this.data.drinks.length ? 'local' : 'error');
      wx.showToast({ title: '云端读取失败', icon: 'none' });
    }
  },

  async saveCloud() {
    const app = getApp();
    if (!app.globalData.cloudReady) {
      wx.showToast({ title: '请先开通云开发', icon: 'none' });
      return;
    }

    const drinks = normalizeData(this.data.drinks);
    this.setData({ loading: true });
    this.setStatus('loading');
    try {
      await wx.cloud.callFunction({
        name: 'sopApi',
        data: { action: 'saveAll', drinks }
      });
      this.persistLocal(drinks);
      this.setData({ drinks, dirty: false, loading: false });
      this.setStatus('synced');
      this.updateVisible();
      wx.showToast({ title: '已保存云端', icon: 'success' });
    } catch (error) {
      this.setData({ loading: false });
      this.setStatus('error');
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  markDirty(drinks) {
    const normalized = normalizeData(drinks);
    this.persistLocal(normalized);
    this.setData({ drinks: normalized, dirty: true });
    this.setStatus('dirty');
    this.updateVisible();
  },

  onSearch(event) {
    this.setData({ query: event.detail.value || '' });
    this.updateVisible();
  },

  clearSearch() {
    this.setData({ query: '' });
    this.updateVisible();
  },

  toggleEdit() {
    this.setData({ editMode: !this.data.editMode });
    this.updateVisible();
  },

  toggleCard(event) {
    const id = Number(event.currentTarget.dataset.id);
    const openMap = { ...this.data.openMap, [id]: !this.data.openMap[id] };
    this.setData({ openMap });
    this.updateVisible();
  },

  expandAll() {
    const openMap = {};
    this.data.drinks.forEach(drink => { openMap[drink.id] = true; });
    this.setData({ openMap });
    this.updateVisible();
  },

  updateDrinkField(event) {
    const id = Number(event.currentTarget.dataset.id);
    const field = event.currentTarget.dataset.field;
    const value = event.detail.value;
    const drinks = clone(this.data.drinks);
    const drink = drinks.find(item => item.id === id);
    if (!drink || !['emoji', 'name', 'price'].includes(field)) return;
    drink[field] = value;
    this.markDirty(drinks);
  },

  updateIngredient(event) {
    const id = Number(event.currentTarget.dataset.id);
    const index = Number(event.currentTarget.dataset.index);
    const field = event.currentTarget.dataset.field;
    const drinks = clone(this.data.drinks);
    const drink = drinks.find(item => item.id === id);
    if (!drink || !drink.ingredients[index] || !['name', 'amount'].includes(field)) return;
    drink.ingredients[index][field] = event.detail.value;
    this.markDirty(drinks);
  },

  updateStep(event) {
    const id = Number(event.currentTarget.dataset.id);
    const index = Number(event.currentTarget.dataset.index);
    const drinks = clone(this.data.drinks);
    const drink = drinks.find(item => item.id === id);
    if (!drink || !drink.steps[index] && drink.steps[index] !== '') return;
    drink.steps[index] = event.detail.value;
    this.markDirty(drinks);
  },

  updateNote(event) {
    const id = Number(event.currentTarget.dataset.id);
    const index = Number(event.currentTarget.dataset.index);
    const drinks = clone(this.data.drinks);
    const drink = drinks.find(item => item.id === id);
    if (!drink || !drink.notes[index] && drink.notes[index] !== '') return;
    drink.notes[index] = event.detail.value;
    this.markDirty(drinks);
  },

  addDrink() {
    const nextId = this.data.drinks.reduce((max, drink) => Math.max(max, Number(drink.id) || 0), 0) + 1;
    const drinks = clone(this.data.drinks);
    drinks.push({
      id: nextId,
      sort: nextId,
      emoji: '☕',
      name: '新饮品',
      price: '¥--',
      img: '',
      ingredients: [{ name: '', amount: '' }],
      steps: [''],
      notes: []
    });
    const openMap = { ...this.data.openMap, [nextId]: true };
    this.setData({ openMap, editMode: true });
    this.markDirty(drinks);
  },

  deleteDrink(event) {
    const id = Number(event.currentTarget.dataset.id);
    wx.showModal({
      title: '删除饮品',
      content: '确认删除这款 SOP 吗？',
      confirmColor: '#b42318',
      success: res => {
        if (!res.confirm) return;
        const drinks = this.data.drinks.filter(drink => drink.id !== id);
        const openMap = { ...this.data.openMap };
        delete openMap[id];
        this.setData({ openMap });
        this.markDirty(drinks);
      }
    });
  },

  addIngredient(event) {
    this.addListItem(event, 'ingredients', { name: '', amount: '' });
  },

  removeIngredient(event) {
    this.removeListItem(event, 'ingredients');
  },

  addStep(event) {
    this.addListItem(event, 'steps', '');
  },

  removeStep(event) {
    this.removeListItem(event, 'steps');
  },

  addNote(event) {
    this.addListItem(event, 'notes', '');
  },

  removeNote(event) {
    this.removeListItem(event, 'notes');
  },

  addListItem(event, field, value) {
    const id = Number(event.currentTarget.dataset.id);
    const drinks = clone(this.data.drinks);
    const drink = drinks.find(item => item.id === id);
    if (!drink) return;
    if (!Array.isArray(drink[field])) drink[field] = [];
    drink[field].push(value);
    this.markDirty(drinks);
  },

  removeListItem(event, field) {
    const id = Number(event.currentTarget.dataset.id);
    const index = Number(event.currentTarget.dataset.index);
    const drinks = clone(this.data.drinks);
    const drink = drinks.find(item => item.id === id);
    if (!drink || !Array.isArray(drink[field])) return;
    drink[field].splice(index, 1);
    if (!drink[field].length && field !== 'notes') drink[field].push(field === 'ingredients' ? { name: '', amount: '' } : '');
    this.markDirty(drinks);
  },

  exportBackup() {
    wx.setClipboardData({
      data: JSON.stringify(normalizeData(this.data.drinks), null, 2),
      success: () => wx.showToast({ title: '已复制备份', icon: 'success' })
    });
  },

  importBackup() {
    wx.getClipboardData({
      success: res => {
        try {
          const drinks = normalizeData(JSON.parse(res.data));
          if (!drinks.length) throw new Error('empty backup');
          this.markDirty(drinks);
          wx.showToast({ title: '已导入本机', icon: 'success' });
        } catch (error) {
          wx.showToast({ title: '剪贴板不是备份', icon: 'none' });
        }
      }
    });
  },

  resetDefault() {
    wx.showModal({
      title: '恢复默认',
      content: '会覆盖本机内容，保存云端后才会影响其他员工。',
      confirmColor: '#b7791f',
      success: res => {
        if (!res.confirm) return;
        this.markDirty(cloneDrinks());
      }
    });
  }
});
