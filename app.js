// app.js
App({
  onLaunch() {
    // 初始化应用版本号
    const currentVersion = '1.0.0';
    const storedVersion = wx.getStorageSync('app_version');
    
    if (!storedVersion) {
      wx.setStorageSync('app_version', currentVersion);
    }
    
    console.log('WeAI Chat 启动成功，版本:', currentVersion);
  }
})
