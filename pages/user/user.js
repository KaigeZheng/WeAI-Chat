Page({
  data: {
    userInfo: {
      avatarUrl: '',
      nickName: '',
      gender: 0
    },
    genderOptions: ['未知', '男', '女'],
    isDarkMode: false,
    pageTheme: 'light',
    themeClass: 'theme-light'
  },

  onLoad: function (options) {
    // 加载用户信息
    this.loadUserInfo();
    // 初始化主题
    this.initTheme();
  },

  onShow() {
    // 更新主题状态
    this.updateThemeFromGlobal();
  },

  // 初始化主题
  initTheme() {
    const app = getApp();
    const isDarkMode = app.globalData.isDarkMode;
    this.setData({ 
      isDarkMode,
      pageTheme: isDarkMode ? 'dark' : 'light',
      themeClass: isDarkMode ? 'theme-dark' : 'theme-light'
    });
  },

  // 从全局更新主题
  updateThemeFromGlobal() {
    const app = getApp();
    const isDarkMode = app.globalData.isDarkMode;
    if (this.data.isDarkMode !== isDarkMode) {
      this.setData({ 
        isDarkMode,
        pageTheme: isDarkMode ? 'dark' : 'light',
        themeClass: isDarkMode ? 'theme-dark' : 'theme-light'
      });
    }
  },

  // 主题更新方法（供全局调用）
  updateTheme(isDarkMode) {
    this.setData({ 
      isDarkMode,
      pageTheme: isDarkMode ? 'dark' : 'light',
      themeClass: isDarkMode ? 'theme-dark' : 'theme-light'
    });
  },

  // 加载用户信息
  loadUserInfo: function() {
    const userInfo = wx.getStorageSync('userInfo') || {
      avatarUrl: '',
      nickName: '',
      gender: 0
    };
    this.setData({
      userInfo: userInfo
    });
  },

  // 选择头像
  chooseAvatar: function() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        this.setData({
          'userInfo.avatarUrl': tempFilePath
        });
        
        // 立即保存头像到本地存储
        const currentUserInfo = this.data.userInfo;
        currentUserInfo.avatarUrl = tempFilePath;
        wx.setStorageSync('userInfo', currentUserInfo);
        
        // 通知主页面更新用户信息
        const pages = getCurrentPages();
        const mainPage = pages.find(page => page.route === 'pages/index/index');
        if (mainPage) {
          mainPage.getUserProfile();
        }
      }
    });
  },

  // 昵称输入
  onNickNameInput: function(e) {
    this.setData({
      'userInfo.nickName': e.detail.value
    });
  },

  // 性别选择
  onGenderChange: function(e) {
    this.setData({
      'userInfo.gender': parseInt(e.detail.value)
    });
  },

  // 保存用户信息
  saveUserInfo: function() {
    const userInfo = this.data.userInfo;
    
    // 验证昵称
    if (!userInfo.nickName.trim()) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none'
      });
      return;
    }

    // 保存到本地存储
    wx.setStorageSync('userInfo', userInfo);
    
    // 通知主页面更新用户信息
    const pages = getCurrentPages();
    const mainPage = pages.find(page => page.route === 'pages/index/index');
    if (mainPage) {
      mainPage.getUserProfile();
    }
    
    wx.showToast({
      title: '保存成功',
      icon: 'success'
    });

    // 延迟返回上一页
    setTimeout(() => {
      wx.navigateBack();
    }, 1500);
  },

  // 重置用户信息
  resetUserInfo: function() {
    wx.showModal({
      title: '确认重置',
      content: '确定要重置所有用户信息吗？',
      success: (res) => {
        if (res.confirm) {
          const defaultUserInfo = {
            avatarUrl: '',
            nickName: '',
            gender: 0
          };
          this.setData({
            userInfo: defaultUserInfo
          });
          wx.setStorageSync('userInfo', defaultUserInfo);
          
          // 通知主页面更新用户信息
          const pages = getCurrentPages();
          const mainPage = pages.find(page => page.route === 'pages/index/index');
          if (mainPage) {
            mainPage.getUserProfile();
          }
          
          wx.showToast({
            title: '重置成功',
            icon: 'success'
          });
        }
      }
    });
  }
}); 