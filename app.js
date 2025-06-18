// app.js
App({
  globalData: {
    isDarkMode: false
  },

  onLaunch() {
    // 初始化应用版本号
    const currentVersion = '1.3.0';
    const storedVersion = wx.getStorageSync('app_version');
    
    if (!storedVersion) {
      wx.setStorageSync('app_version', currentVersion);
    }
    
    // 加载夜间模式设置
    this.loadDarkModeSetting();
    
    console.log('WeAI Chat 启动成功，版本:', currentVersion);
  },

  // 加载夜间模式设置
  loadDarkModeSetting() {
    const isDarkMode = wx.getStorageSync('dark_mode') || false;
    this.globalData.isDarkMode = isDarkMode;
    this.updateDarkMode(isDarkMode);
  },

  // 切换夜间模式
  toggleDarkMode() {
    const newMode = !this.globalData.isDarkMode;
    this.globalData.isDarkMode = newMode;
    wx.setStorageSync('dark_mode', newMode);
    this.updateDarkMode(newMode);
    
    // 通知所有页面更新主题
    const pages = getCurrentPages();
    pages.forEach(page => {
      if (page.updateTheme) {
        page.updateTheme(newMode);
      }
    });
  },

  // 更新夜间模式状态
  updateDarkMode(isDarkMode) {
    // 设置系统状态栏样式
    if (isDarkMode) {
      wx.setNavigationBarColor({
        frontColor: '#ffffff',
        backgroundColor: '#1a1a1a'
      });
    } else {
      wx.setNavigationBarColor({
        frontColor: '#000000',
        backgroundColor: '#ffffff'
      });
    }
  }
})
