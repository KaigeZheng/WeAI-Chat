const { callAIAPI, setAPIKey, getAPIKey, API_CONFIG } = require('../../config/api.js');

Page({
  data: {
    dashScopeKey: '',
    deepseekKey: '',
    defaultServiceIndex: 0,
    serviceOptions: ['Qwen-Plus', 'DeepSeek'],
    saveHistory: true,
    enableContext: true,
    showDashScopeKey: false,
    showDeepSeekKey: false,
    temperature: 0.7,
    maxTokens: 1024,
    appVersion: '1.4.4',
    isDarkMode: false,
    pageTheme: 'light',
    themeClass: 'theme-light',
    userInfo: {
      userId: ''
    }
  },

  onLoad() {
    this.loadSettings();
    this.initTheme();
  },

  onShow() {
    // 更新主题状态
    this.updateThemeFromGlobal();
  },

  // 加载设置
  loadSettings() {
    // 加载API Keys
    const dashScopeKey = getAPIKey('qwen') || '';
    const deepseekKey = getAPIKey('deepseek');
    
    // 加载其他设置
    const saveHistory = wx.getStorageSync('save_history') !== false; // 默认开启
    const enableContext = wx.getStorageSync('enable_context') !== false; // 默认开启上下文
    const defaultServiceIndex = wx.getStorageSync('default_service') || 0;
    
    // 加载高级设置
    const temperature = wx.getStorageSync('temperature') || 0.7;
    const maxTokens = wx.getStorageSync('maxTokens') || 1024;
    
    // 加载版本号
    const appVersion = wx.getStorageSync('app_version') || '1.4.4';
    
    // 加载夜间模式设置
    const app = getApp();
    const isDarkMode = app.globalData.isDarkMode;
    
    // 加载用户信息
    const userInfo = wx.getStorageSync('userInfo') || { userId: '' };
    
    this.setData({
      dashScopeKey: dashScopeKey || '',
      deepseekKey: deepseekKey || '',
      saveHistory,
      enableContext,
      defaultServiceIndex,
      temperature,
      maxTokens,
      appVersion,
      isDarkMode,
      userInfo
    });
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

  // 夜间模式切换
  onDarkModeChange(e) {
    const isDarkMode = e.detail.value;
    this.setData({ isDarkMode });
    
    // 调用全局的夜间模式切换方法
    const app = getApp();
    app.toggleDarkMode();
    
    wx.showToast({
      title: isDarkMode ? '已启用夜间模式' : '已关闭夜间模式',
      icon: 'success'
    });
  },

  // 阿里百炼 Key变化
  onDashScopeKeyChange(e) {
    this.setData({
      dashScopeKey: e.detail.value
    });
  },

  // DeepSeek Key变化
  onDeepSeekKeyChange(e) {
    this.setData({
      deepseekKey: e.detail.value
    });
  },

  // 切换阿里百炼 Key显示状态
  toggleDashScopeKeyVisibility() {
    this.setData({
      showDashScopeKey: !this.data.showDashScopeKey
    });
  },

  // 切换DeepSeek Key显示状态
  toggleDeepSeekKeyVisibility() {
    this.setData({
      showDeepSeekKey: !this.data.showDeepSeekKey
    });
  },

  // 服务选择变化
  onServiceChange(e) {
    const index = e.detail.value;
    this.setData({
      defaultServiceIndex: index
    });
    
    // 立即保存服务选择
    wx.setStorageSync('default_service', index);
    
    // 使用Modal显示完整的提示信息，避免Toast字符限制
    wx.showModal({
      title: '服务切换成功',
      content: `已切换到${this.data.serviceOptions[index]}`,
      showCancel: false,
      confirmText: '确定'
    });
  },

  // 保存历史变化
  onSaveHistoryChange(e) {
    this.setData({
      saveHistory: e.detail.value
    });
  },

  // 上下文对话变化
  onEnableContextChange(e) {
    this.setData({
      enableContext: e.detail.value
    });
  },

  // Temperature变化
  onTemperatureChange(e) {
    this.setData({
      temperature: e.detail.value
    });
  },

  // Max Tokens变化
  onMaxTokensChange(e) {
    this.setData({
      maxTokens: e.detail.value
    });
  },

  // 重置高级设置
  resetAdvancedSettings() {
    wx.showModal({
      title: '确认重置',
      content: '确定要重置高级设置为默认值吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            temperature: 0.7,
            maxTokens: 1024
          });
          wx.showToast({
            title: '已重置',
            icon: 'success'
          });
        }
      }
    });
  },

  // 清空所有历史
  clearAllHistory() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有聊天记录吗？此操作不可恢复。',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('chat_messages');
          wx.showToast({
            title: '已清空',
            icon: 'success'
          });
        }
      }
    });
  },

  // 测试API连接
  testAPI() {
    const serviceOptions = ['qwen', 'deepseek'];
    const currentService = serviceOptions[this.data.defaultServiceIndex];
    
    // 根据当前选择的服务获取对应的API Key
    let apiKey;
    if (currentService === 'qwen') {
      apiKey = this.data.dashScopeKey;
    } else if (currentService === 'deepseek') {
      apiKey = this.data.deepseekKey;
    }
    
    if (!apiKey) {
      wx.showToast({
        title: `请先配置${this.data.serviceOptions[this.data.defaultServiceIndex]}的API Key`,
        icon: 'none'
      });
      return;
    }

    // 先保存API Key到配置中
    setAPIKey(currentService, apiKey);

    console.log(`开始测试${currentService} API连接`);
    console.log(`API Key: ${apiKey.substring(0, 10)}...`);

    wx.showLoading({
      title: '测试API连接...'
    });

    // 调用API测试
    callAIAPI('Hello!', currentService)
      .then((response) => {
        wx.hideLoading();
        console.log(`API测试成功，响应:`, response);
        wx.showModal({
          title: 'API测试成功',
          content: `服务：${this.data.serviceOptions[this.data.defaultServiceIndex]}\n回复：${response}`,
          showCancel: false
        });
      })
      .catch((error) => {
        wx.hideLoading();
        console.error(`API测试失败:`, error);
        wx.showModal({
          title: 'API测试失败',
          content: `服务：${this.data.serviceOptions[this.data.defaultServiceIndex]}\n错误：${error.message}\n\n请检查：\n1. 网络连接\n2. API Key是否正确\n3. 域名是否已添加到合法域名列表`,
          showCancel: false
        });
      });
  },

  // 测试网络连接
  testNetwork() {
    const serviceOptions = ['qwen', 'deepseek'];
    const currentService = serviceOptions[this.data.defaultServiceIndex];
    const serviceNames = ['Qwen-Plus', 'DeepSeek'];
    const currentServiceName = serviceNames[this.data.defaultServiceIndex];
    
    // 根据当前选择的服务获取对应的API Key
    let apiKey;
    let testUrl;
    
    if (currentService === 'qwen') {
      apiKey = this.data.dashScopeKey;
      testUrl = 'https://dashscope.aliyuncs.com/api/v1/models';
    } else if (currentService === 'deepseek') {
      apiKey = this.data.deepseekKey;
      testUrl = 'https://api.deepseek.com/v1/models';
    }
    
    if (!apiKey) {
      wx.showToast({
        title: `请先配置${currentServiceName}的API Key`,
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: `测试${currentServiceName}网络连接...`
    });

    // 测试对应服务的网络连接
    wx.request({
      url: testUrl,
      method: 'GET',
      header: {
        'Authorization': `Bearer ${apiKey}`
      },
      success: (res) => {
        wx.hideLoading();
        console.log(`${currentServiceName}网络测试成功:`, res);
        wx.showModal({
          title: '网络连接正常',
          content: `状态码: ${res.statusCode}\n可以访问${currentServiceName} API`,
          showCancel: false
        });
      },
      fail: (err) => {
        wx.hideLoading();
        console.error(`${currentServiceName}网络测试失败:`, err);
        wx.showModal({
          title: '网络连接失败',
          content: `错误: ${err.errMsg}\n\n可能原因:\n1. 域名未添加到合法域名列表\n2. 网络连接问题\n3. ${currentServiceName} API服务不可用`,
          showCancel: false
        });
      }
    });
  },

  // 返回上一页
  goBack() {
    wx.navigateBack();
  },

  // 显示开源协议
  showLicense() {
    const licenseText = `MIT License

Copyright (c) 2025 Kambri

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

    wx.showModal({
      title: 'MIT License 开源协议',
      content: licenseText,
      showCancel: false,
      confirmText: '确定'
    });
  },

  // 打开GitHub仓库
  openGitHub() {
    wx.showModal({
      title: '访问GitHub仓库',
      content: '由于微信小程序限制，无法直接跳转到外部链接。将为您复制GitHub仓库链接到剪贴板。',
      success: (res) => {
        if (res.confirm) {
          // 复制GitHub仓库链接到剪贴板
          wx.setClipboardData({
            data: 'https://github.com/KaigeZheng/WeAI-Chat',
            success: () => {
              wx.showModal({
                title: '链接已复制',
                content: 'GitHub仓库链接已复制到剪贴板！\n\n请在浏览器中粘贴访问，或直接搜索"WeAI-Chat"项目。',
                showCancel: false,
                confirmText: '知道了'
              });
            },
            fail: (err) => {
              console.error('复制链接失败:', err);
              wx.showToast({
                title: '复制失败',
                icon: 'none'
              });
            }
          });
        }
      }
    });
  },

  // 保存设置
  saveSettings() {
    // 保存API Keys
    setAPIKey('qwen', this.data.dashScopeKey);
    setAPIKey('deepseek', this.data.deepseekKey);
    
    // 保存其他设置
    wx.setStorageSync('save_history', this.data.saveHistory);
    wx.setStorageSync('enable_context', this.data.enableContext);
    wx.setStorageSync('default_service', this.data.defaultServiceIndex);
    
    // 保存高级设置
    wx.setStorageSync('temperature', this.data.temperature);
    wx.setStorageSync('maxTokens', this.data.maxTokens);
    
    wx.showToast({
      title: '设置已保存',
      icon: 'success'
    });
  },

  // 复制用户ID
  copyUserId() {
    const userId = this.data.userInfo.userId;
    if (userId) {
      wx.setClipboardData({
        data: userId,
        success: () => {
          wx.showToast({
            title: '用户ID已复制',
            icon: 'success'
          });
        },
        fail: () => {
          wx.showToast({
            title: '复制失败',
            icon: 'none'
          });
        }
      });
    } else {
      wx.showToast({
        title: '用户ID不存在',
        icon: 'none'
      });
    }
  }
}); 