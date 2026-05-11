var defaultData = require('../../data/default-drinks');
var cloneDrinks = defaultData.cloneDrinks;

var STORAGE_KEY = 'coffee_sop_miniprogram';
var STATUS = {
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
  var id = Number(item && item.id) || index + 1;
  return {
    id: id,
    sort: Number(item && item.sort) || id,
    emoji: item && item.emoji ? String(item.emoji) : '☕',
    name: item && item.name ? String(item.name) : '饮品 ' + (index + 1),
    price: item && item.price ? String(item.price) : '¥--',
    img: item && item.img ? String(item.img) : '',
    ingredients: Array.isArray(item && item.ingredients)
      ? item.ingredients.map(function (ing) {
        return {
          name: String(ing && ing.name || ''),
          amount: String(ing && ing.amount || '')
        };
      })
      : [{ name: '', amount: '' }],
    steps: Array.isArray(item && item.steps)
      ? item.steps.map(function (step) { return String(step || ''); })
      : [''],
    notes: Array.isArray(item && item.notes)
      ? item.notes.map(function (note) { return String(note || ''); })
      : []
  };
}

function normalizeData(source) {
  var list = Array.isArray(source) ? source : [];
  return list.map(normalizeDrink).sort(function (left, right) {
    if (left.sort === right.sort) return left.id - right.id;
    return left.sort - right.sort;
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function copyMap(source) {
  var target = {};
  Object.keys(source || {}).forEach(function (key) {
    target[key] = source[key];
  });
  return target;
}

function findDrink(drinks, id) {
  for (var index = 0; index < drinks.length; index += 1) {
    if (drinks[index].id === id) return drinks[index];
  }
  return null;
}

Page({
  data: {
    drinks: [],
    visibleDrinks: [],
    query: '',
    openMap: {},
    editMode: false,
    viewMode: true,
    dirty: false,
    loading: false,
    status: STATUS.loading
  },

  onLoad: function () {
    this.loadLocal();
    this.setStatus('local');
  },

  onReady: function () {
    var page = this;
    setTimeout(function () {
      page.refreshCloud();
    }, 1200);
  },

  onPullDownRefresh: function () {
    this.refreshCloud();
    wx.stopPullDownRefresh();
  },

  onShareAppMessage: function () {
    return {
      title: '咖啡店 SOP',
      path: '/pages/index/index'
    };
  },

  loadLocal: function () {
    var saved = null;
    try {
      saved = wx.getStorageSync(STORAGE_KEY);
    } catch (error) {
      console.warn('本机缓存读取失败，使用内置 SOP。', error);
    }
    var drinks = normalizeData(saved || cloneDrinks());
    var openMap = {};
    drinks.forEach(function (drink) {
      openMap[drink.id] = true;
    });
    this.setData({ drinks: drinks, openMap: openMap });
    this.updateVisible();
  },

  persistLocal: function (drinks) {
    try {
      wx.setStorageSync(STORAGE_KEY, normalizeData(drinks));
    } catch (error) {
      console.warn('本机缓存保存失败。', error);
    }
  },

  setStatus: function (name) {
    this.setData({ status: STATUS[name] || STATUS.local });
  },

  updateVisible: function () {
    var query = String(this.data.query || '').trim().toLowerCase();
    var openMap = this.data.openMap;
    var editMode = this.data.editMode;
    var visibleDrinks = this.data.drinks.filter(function (drink) {
      if (!query) return true;
      var haystack = [drink.name, drink.price]
        .concat((drink.ingredients || []).map(function (item) {
          return String(item.name || '') + ' ' + String(item.amount || '');
        }))
        .concat(drink.steps || [])
        .concat(drink.notes || [])
        .join(' ')
        .toLowerCase();
      return haystack.indexOf(query) !== -1;
    }).map(function (drink) {
      var viewDrink = {};
      Object.keys(drink).forEach(function (key) {
        viewDrink[key] = drink[key];
      });
      viewDrink.open = !!openMap[drink.id];
      viewDrink.openClass = viewDrink.open ? 'open' : '';
      viewDrink.hasNotes = Array.isArray(drink.notes) && drink.notes.length > 0;
      viewDrink.showNotes = viewDrink.hasNotes || editMode;
      viewDrink.ingredientViews = (drink.ingredients || []).map(function (ingredient, index) {
        return {
          uid: drink.id + '-ing-' + index,
          index: index,
          name: String(ingredient && ingredient.name || ''),
          amount: String(ingredient && ingredient.amount || '')
        };
      });
      viewDrink.stepViews = (drink.steps || []).map(function (step, index) {
        return {
          uid: drink.id + '-step-' + index,
          index: index,
          no: String(index + 1),
          text: String(step || '')
        };
      });
      viewDrink.noteViews = (drink.notes || []).map(function (note, index) {
        return {
          uid: drink.id + '-note-' + index,
          index: index,
          text: String(note || '')
        };
      });
      return viewDrink;
    });
    this.setData({ visibleDrinks: visibleDrinks });
  },

  refreshCloud: function () {
    var app = getApp();
    var page = this;
    if (!app.globalData.cloudReady) {
      page.setStatus('local');
      return;
    }

    page.setData({ loading: true });
    page.setStatus('loading');
    wx.cloud.callFunction({
      name: 'sopApi',
      data: { action: 'list' },
      success: function (result) {
        var drinks = normalizeData(result && result.result && result.result.drinks);
        if (!drinks.length) {
          page.setStatus('error');
          wx.showToast({ title: '云端无数据', icon: 'none' });
          return;
        }
        var openMap = {};
        drinks.forEach(function (drink) {
          openMap[drink.id] = true;
        });
        page.persistLocal(drinks);
        page.setData({
          drinks: drinks,
          openMap: openMap,
          dirty: false,
          loading: false
        });
        page.setStatus('synced');
        page.updateVisible();
      },
      fail: function (error) {
        console.warn('云端读取失败', error);
        page.setStatus(page.data.drinks.length ? 'local' : 'error');
        wx.showToast({ title: '云端读取失败', icon: 'none' });
      },
      complete: function () {
        page.setData({ loading: false });
      }
    });
  },

  saveCloud: function () {
    var app = getApp();
    var page = this;
    if (!app.globalData.cloudReady) {
      wx.showToast({ title: '请先开通云开发', icon: 'none' });
      return;
    }

    var drinks = normalizeData(page.data.drinks);
    page.setData({ loading: true });
    page.setStatus('loading');
    wx.cloud.callFunction({
      name: 'sopApi',
      data: { action: 'saveAll', drinks: drinks },
      success: function () {
        page.persistLocal(drinks);
        page.setData({ drinks: drinks, dirty: false });
        page.setStatus('synced');
        page.updateVisible();
        wx.showToast({ title: '已保存云端', icon: 'success' });
      },
      fail: function (error) {
        console.warn('云端保存失败', error);
        page.setStatus('error');
        wx.showToast({ title: '保存失败', icon: 'none' });
      },
      complete: function () {
        page.setData({ loading: false });
      }
    });
  },

  exportPdf: function () {
    var app = getApp();
    var page = this;
    if (!app.globalData.cloudReady) {
      wx.showToast({ title: '请先连接云端', icon: 'none' });
      return;
    }

    var drinks = normalizeData(page.data.drinks);
    page.setData({ loading: true });
    wx.showLoading({ title: '生成PDF中' });
    wx.cloud.callFunction({
      name: 'sopApi',
      data: {
        action: 'exportPdf',
        drinks: drinks
      },
      success: function (result) {
        var fileID = result && result.result && result.result.fileID;
        if (!fileID) {
          wx.hideLoading();
          page.setData({ loading: false });
          wx.showToast({ title: 'PDF生成失败', icon: 'none' });
          return;
        }
        wx.cloud.downloadFile({
          fileID: fileID,
          success: function (downloadResult) {
            wx.openDocument({
              filePath: downloadResult.tempFilePath,
              fileType: 'pdf',
              showMenu: true,
              fail: function (error) {
                console.warn('PDF打开失败', error);
                wx.showToast({ title: 'PDF打开失败', icon: 'none' });
              }
            });
          },
          fail: function (error) {
            console.warn('PDF下载失败', error);
            wx.showToast({ title: 'PDF下载失败', icon: 'none' });
          },
          complete: function () {
            wx.hideLoading();
            page.setData({ loading: false });
          }
        });
      },
      fail: function (error) {
        console.warn('PDF导出失败', error);
        wx.hideLoading();
        page.setData({ loading: false });
        wx.showToast({ title: 'PDF导出失败', icon: 'none' });
      }
    });
  },

  markDirty: function (drinks) {
    var normalized = normalizeData(drinks);
    this.persistLocal(normalized);
    this.setData({ drinks: normalized, dirty: true });
    this.setStatus('dirty');
    this.updateVisible();
  },

  onSearch: function (event) {
    this.setData({ query: event.detail.value || '' });
    this.updateVisible();
  },

  clearSearch: function () {
    this.setData({ query: '' });
    this.updateVisible();
  },

  toggleEdit: function () {
    var nextEditMode = !this.data.editMode;
    this.setData({ editMode: nextEditMode, viewMode: !nextEditMode });
    this.updateVisible();
  },

  toggleCard: function (event) {
    var id = Number(event.currentTarget.dataset.id);
    var openMap = copyMap(this.data.openMap);
    openMap[id] = !this.data.openMap[id];
    this.setData({ openMap: openMap });
    this.updateVisible();
  },

  expandAll: function () {
    var openMap = {};
    this.data.drinks.forEach(function (drink) {
      openMap[drink.id] = true;
    });
    this.setData({ openMap: openMap });
    this.updateVisible();
  },

  updateDrinkField: function (event) {
    var id = Number(event.currentTarget.dataset.id);
    var field = event.currentTarget.dataset.field;
    var value = event.detail.value;
    var drinks = clone(this.data.drinks);
    var drink = findDrink(drinks, id);
    if (!drink || ['emoji', 'name', 'price'].indexOf(field) === -1) return;
    drink[field] = value;
    this.markDirty(drinks);
  },

  updateIngredient: function (event) {
    var id = Number(event.currentTarget.dataset.id);
    var index = Number(event.currentTarget.dataset.index);
    var field = event.currentTarget.dataset.field;
    var drinks = clone(this.data.drinks);
    var drink = findDrink(drinks, id);
    if (!drink || !drink.ingredients[index] || ['name', 'amount'].indexOf(field) === -1) return;
    drink.ingredients[index][field] = event.detail.value;
    this.markDirty(drinks);
  },

  updateStep: function (event) {
    var id = Number(event.currentTarget.dataset.id);
    var index = Number(event.currentTarget.dataset.index);
    var drinks = clone(this.data.drinks);
    var drink = findDrink(drinks, id);
    if (!drink || (!drink.steps[index] && drink.steps[index] !== '')) return;
    drink.steps[index] = event.detail.value;
    this.markDirty(drinks);
  },

  updateNote: function (event) {
    var id = Number(event.currentTarget.dataset.id);
    var index = Number(event.currentTarget.dataset.index);
    var drinks = clone(this.data.drinks);
    var drink = findDrink(drinks, id);
    if (!drink || (!drink.notes[index] && drink.notes[index] !== '')) return;
    drink.notes[index] = event.detail.value;
    this.markDirty(drinks);
  },

  addDrink: function () {
    var nextId = this.data.drinks.reduce(function (max, drink) {
      return Math.max(max, Number(drink.id) || 0);
    }, 0) + 1;
    var drinks = clone(this.data.drinks);
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
    var openMap = copyMap(this.data.openMap);
    openMap[nextId] = true;
    this.setData({ openMap: openMap, editMode: true, viewMode: false });
    this.markDirty(drinks);
  },

  deleteDrink: function (event) {
    var id = Number(event.currentTarget.dataset.id);
    var page = this;
    wx.showModal({
      title: '删除饮品',
      content: '确认删除这款 SOP 吗？',
      confirmColor: '#b42318',
      success: function (res) {
        if (!res.confirm) return;
        var drinks = page.data.drinks.filter(function (drink) {
          return drink.id !== id;
        });
        var openMap = copyMap(page.data.openMap);
        delete openMap[id];
        page.setData({ openMap: openMap });
        page.markDirty(drinks);
      }
    });
  },

  addIngredient: function (event) {
    this.addListItem(event, 'ingredients', { name: '', amount: '' });
  },

  removeIngredient: function (event) {
    this.removeListItem(event, 'ingredients');
  },

  addStep: function (event) {
    this.addListItem(event, 'steps', '');
  },

  removeStep: function (event) {
    this.removeListItem(event, 'steps');
  },

  addNote: function (event) {
    this.addListItem(event, 'notes', '');
  },

  removeNote: function (event) {
    this.removeListItem(event, 'notes');
  },

  addListItem: function (event, field, value) {
    var id = Number(event.currentTarget.dataset.id);
    var drinks = clone(this.data.drinks);
    var drink = findDrink(drinks, id);
    if (!drink) return;
    if (!Array.isArray(drink[field])) drink[field] = [];
    drink[field].push(value);
    this.markDirty(drinks);
  },

  removeListItem: function (event, field) {
    var id = Number(event.currentTarget.dataset.id);
    var index = Number(event.currentTarget.dataset.index);
    var drinks = clone(this.data.drinks);
    var drink = findDrink(drinks, id);
    if (!drink || !Array.isArray(drink[field])) return;
    drink[field].splice(index, 1);
    if (!drink[field].length && field !== 'notes') {
      drink[field].push(field === 'ingredients' ? { name: '', amount: '' } : '');
    }
    this.markDirty(drinks);
  },

  exportBackup: function () {
    wx.setClipboardData({
      data: JSON.stringify(normalizeData(this.data.drinks), null, 2),
      success: function () {
        wx.showToast({ title: '已复制备份', icon: 'success' });
      }
    });
  },

  importBackup: function () {
    var page = this;
    wx.getClipboardData({
      success: function (res) {
        try {
          var drinks = normalizeData(JSON.parse(res.data));
          if (!drinks.length) throw new Error('empty backup');
          page.markDirty(drinks);
          wx.showToast({ title: '已导入本机', icon: 'success' });
        } catch (error) {
          wx.showToast({ title: '剪贴板不是备份', icon: 'none' });
        }
      }
    });
  },

  resetDefault: function () {
    var page = this;
    wx.showModal({
      title: '恢复默认',
      content: '会覆盖本机内容，保存云端后才会影响其他员工。',
      confirmColor: '#b7791f',
      success: function (res) {
        if (!res.confirm) return;
        page.markDirty(cloneDrinks());
      }
    });
  }
});
