var CLOUD_ENV_ID = '';

App({
  globalData: {
    cloudReady: false
  },

  onLaunch: function () {
  },

  onShow: function () {
    var app = this;
    if (app.globalData.cloudReady) return;
    if (!wx.cloud) {
      app.globalData.cloudReady = false;
      return;
    }

    setTimeout(function () {
      try {
        var options = { traceUser: true };
        if (CLOUD_ENV_ID) options.env = CLOUD_ENV_ID;
        wx.cloud.init(options);
        app.globalData.cloudReady = true;
      } catch (error) {
        app.globalData.cloudReady = false;
        console.warn('云开发初始化失败，先使用本机 SOP。', error);
      }
    }, 100);
  }
});
