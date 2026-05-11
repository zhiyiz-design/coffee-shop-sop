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

    const options = { traceUser: true };
    if (CLOUD_ENV_ID) options.env = CLOUD_ENV_ID;
    wx.cloud.init(options);
    this.globalData.cloudReady = true;
  }
});
