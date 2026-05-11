const CLOUD_ENV_ID = '';

App({
  globalData: {
    cloudReady: false
  },

  onLaunch() {
    if (!wx.cloud) {
      this.globalData.cloudReady = false;
      return;
    }

    try {
      const options = { traceUser: true };
      if (CLOUD_ENV_ID) options.env = CLOUD_ENV_ID;
      wx.cloud.init(options);
      this.globalData.cloudReady = true;
    } catch (error) {
      this.globalData.cloudReady = false;
      console.warn('云开发初始化失败，先使用本机 SOP。', error);
    }
  }
});
