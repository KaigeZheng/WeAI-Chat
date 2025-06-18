// index.js
const { callAIAPI, callAIAPIStream, setAPIKey, getAPIKey, API_CONFIG } = require('../../config/api.js');

Page({
  data: {
    messages: [],
    inputMessage: '',
    isLoading: false,
    scrollToMessage: '',
    messageId: 0,
    currentService: 'deepseek', // 当前使用的AI服务
    userInfo: {
      avatarUrl: '',
      nickName: '',
      gender: 0,
      userId: '' // 添加用户ID字段
    },
    isDarkMode: false, // 添加夜间模式状态
    forceUpdate: 0
  },

  onLoad: function (options) {
    // 获取用户信息
    this.getUserProfile();
    
    // 从本地存储加载聊天记录
    const messages = wx.getStorageSync('chat_messages') || [];
    this.setData({
      messages: messages
    });
    
    // 加载用户设置
    this.loadUserSettings();
    
    // 检查API Key是否已配置
    this.checkAPIKey();
    
    // 初始化主题
    this.initTheme();
    
    // 处理历史消息，确保有用户ID和模型ID
    this.loadMessages();
  },

  onShow: function() {
    // 每次页面显示时重新加载用户信息
    this.getUserProfile();
    
    // 更新主题状态
    this.updateThemeFromGlobal();
  },

  onUnload: function() {
    // 清理定时器
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }
  },

  // 初始化主题
  initTheme() {
    const app = getApp();
    const isDarkMode = app.globalData.isDarkMode;
    this.setData({ isDarkMode });
    this.updatePageTheme(isDarkMode);
  },

  // 从全局更新主题
  updateThemeFromGlobal() {
    const app = getApp();
    const isDarkMode = app.globalData.isDarkMode;
    if (this.data.isDarkMode !== isDarkMode) {
      this.setData({ isDarkMode });
      this.updatePageTheme(isDarkMode);
    }
  },

  // 更新页面主题
  updatePageTheme(isDarkMode) {
    // 设置页面主题属性
    wx.setPageStyle({
      style: {
        backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff'
      }
    });
    
    // 设置页面data-theme属性和主题类名
    this.setData({
      pageTheme: isDarkMode ? 'dark' : 'light',
      themeClass: isDarkMode ? 'theme-dark' : 'theme-light'
    });
    
    // 强制重新渲染页面以应用CSS变量
    this.setData({
      forceUpdate: Date.now()
    });
  },

  // 主题更新方法（供全局调用）
  updateTheme(isDarkMode) {
    this.setData({ isDarkMode });
    this.updatePageTheme(isDarkMode);
  },

  // 加载用户设置
  loadUserSettings() {
    const defaultService = wx.getStorageSync('default_service') || 0;
    const serviceOptions = ['qwen', 'deepseek'];
    const currentService = serviceOptions[defaultService];
    
    this.setData({ currentService });
    
    // 更新API配置中的默认服务
    API_CONFIG.defaultService = currentService;
  },

  // 检查API Key配置
  checkAPIKey() {
    const currentService = this.data.currentService;
    const apiKey = getAPIKey(currentService);
    
    if (!apiKey) {
      const serviceNames = {
        'qwen': 'Qwen-Plus',
        'deepseek': 'DeepSeek'
      };
      
      wx.showModal({
        title: '配置提示',
        content: `请先配置${serviceNames[currentService]}的API Key才能使用AI聊天功能`,
        showCancel: false,
        success: () => {
          this.showAPIKeyConfig();
        }
      });
    }
  },

  // 显示API Key配置界面
  showAPIKeyConfig() {
    wx.showModal({
      title: '配置API Key',
      content: '请在设置页面配置您的API Key',
      showCancel: false,
      confirmText: '我知道了',
      success: () => {
        this.goToSettings();
      }
    });
  },

  // 加载历史消息
  loadMessages() {
    const messages = wx.getStorageSync('chat_messages') || [];
    
    // 为历史消息添加默认模型信息（兼容旧版本）
    const processedMessages = messages.map(msg => {
      let processedMsg = { ...msg };
      
      if (msg.role === 'assistant' && !msg.model) {
        // 对于没有model字段的旧AI消息，默认设置为qwen
        processedMsg.model = 'qwen';
      }
      
      if (msg.role === 'user' && !msg.userId) {
        // 对于没有userId字段的旧用户消息，使用当前用户ID
        processedMsg.userId = this.data.userInfo.userId || this.generateUserId();
      }
      
      if (msg.role === 'assistant' && !msg.modelId) {
        // 对于没有modelId字段的旧AI消息，使用model字段
        processedMsg.modelId = msg.model || 'qwen';
      }
      
      return processedMsg;
    });
    
    this.setData({ messages: processedMessages });
  },

  // 保存消息到本地存储
  saveMessages() {
    wx.setStorageSync('chat_messages', this.data.messages);
  },

  // 输入框内容变化
  onInputChange(e) {
    this.setData({
      inputMessage: e.detail.value
    });
  },

  // 发送消息
  sendMessage() {
    const message = this.data.inputMessage.trim();
    if (!message) return;

    // 确保用户信息是最新的
    this.getUserProfile();

    // 检查当前服务的API Key
    const currentService = this.data.currentService;
    const apiKey = getAPIKey(currentService);
    
    if (!apiKey) {
      const serviceNames = {
        'qwen': 'Qwen-Plus',
        'deepseek': 'DeepSeek'
      };
      
      wx.showToast({
        title: `请先配置${serviceNames[currentService]}的API Key`,
        icon: 'none'
      });
      return;
    }

    // 添加用户消息
    const userMessage = {
      id: ++this.data.messageId,
      role: 'user',
      content: message,
      time: this.formatTime(new Date()),
      userId: this.data.userInfo.userId
    };

    // 添加AI消息占位符
    const aiMessage = {
      id: ++this.data.messageId,
      role: 'assistant',
      content: '',
      time: this.formatTime(new Date()),
      model: currentService,
      isStreaming: true,
      modelId: this.data.currentService
    };

    this.setData({
      messages: [...this.data.messages, userMessage, aiMessage],
      inputMessage: '',
      isLoading: true,
      scrollToMessage: `msg-${aiMessage.id}`
    });

    this.saveMessages();

    // 构建包含上下文的完整prompt
    const contextPrompt = this.buildContextPrompt(message);
    
    // 使用流式API调用
    this.requestAIResponseStream(contextPrompt, aiMessage.id)
      .then(() => {
        this.setData({ isLoading: false });
        this.scrollToBottom();
      })
      .catch((error) => {
        console.error('AI响应失败:', error);
        this.setData({ isLoading: false });
        
        // 更新错误消息
        const messages = [...this.data.messages];
        const messageIndex = messages.findIndex(msg => msg.id === aiMessage.id);
        if (messageIndex !== -1) {
          messages[messageIndex] = {
            ...messages[messageIndex],
            content: `抱歉，我遇到了一些问题：${error.message || '请检查网络连接和API配置'}`,
            isStreaming: false
          };
          this.setData({ messages });
        }
        this.saveMessages();
      });
  },

  // 构建包含上下文的prompt
  buildContextPrompt(currentMessage) {
    // 检查是否启用上下文功能
    const enableContext = wx.getStorageSync('enable_context') !== false; // 默认开启
    
    if (!enableContext) {
      // 如果不启用上下文，只发送当前消息
      let simplePrompt = 'system: 你的名字是WeAI Chat，是一个有用的AI助手，请用简洁明了的方式回答用户的问题。\n\n';
      simplePrompt += `user: ${currentMessage}\n\n`;
      simplePrompt += 'ai: ';
      return simplePrompt;
    }
    
    const messages = this.data.messages;
    const maxContextLength = 10; // 最大上下文消息数量
    
    // 获取最近的对话历史（限制数量以避免token超限）
    const recentMessages = messages.slice(-maxContextLength);
    
    // 构建完整的对话上下文
    let contextPrompt = '';
    
    // 添加系统提示词
    contextPrompt += 'system: 你的名字是WeAI Chat，是一个有用的AI助手，请用简洁明了的方式回答用户的问题。\n\n';
    
    // 添加历史对话记录
    recentMessages.forEach(msg => {
      if (msg.role === 'user') {
        contextPrompt += `user: ${msg.content}\n\n`;
      } else if (msg.role === 'assistant') {
        contextPrompt += `ai: ${msg.content}\n\n`;
      }
    });
    
    // 添加当前用户消息
    contextPrompt += `user: ${currentMessage}\n\n`;
    contextPrompt += 'ai: ';
    
    console.log('构建的上下文prompt:', contextPrompt);
    return contextPrompt;
  },

  // 请求AI响应
  async requestAIResponse(userMessage) {
    try {
      const currentService = this.data.currentService;
      console.log(`使用${currentService}服务调用API`);
      console.log(`当前服务配置:`, API_CONFIG[currentService]);
      
      // 构建包含上下文的完整prompt
      const contextPrompt = this.buildContextPrompt(userMessage);
      
      const response = await callAIAPI(contextPrompt, currentService);
      
      console.log(`API调用成功，响应:`, response);
      
      // 添加AI回复
      const aiMessage = {
        id: ++this.data.messageId,
        role: 'assistant',
        content: response,
        time: this.formatTime(new Date()),
        model: currentService, // 记录生成该消息的模型
        modelId: this.data.currentService
      };

      this.setData({
        messages: [...this.data.messages, aiMessage],
        isLoading: false,
        scrollToMessage: `msg-${aiMessage.id}`
      });

      this.saveMessages();
      
      // 确保输入框状态正确
      console.log('AI回复完成，当前输入框状态:', this.data.inputMessage);
      console.log('当前消息数量:', this.data.messages.length);
    } catch (error) {
      console.error('AI API调用失败:', error);
      
      // 显示错误消息
      const errorMessage = {
        id: ++this.data.messageId,
        role: 'assistant',
        content: `抱歉，我遇到了一些问题：${error.message || '请检查网络连接和API配置'}`,
        time: this.formatTime(new Date()),
        model: currentService, // 记录生成该消息的模型
        modelId: this.data.currentService
      };

      this.setData({
        messages: [...this.data.messages, errorMessage],
        isLoading: false,
        scrollToMessage: `msg-${errorMessage.id}`
      });

      this.saveMessages();
    }
  },

  // 清空聊天记录
  clearChat() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有聊天记录吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            messages: [],
            messageId: 0
          });
          wx.removeStorageSync('chat_messages');
          wx.showToast({
            title: '已清空',
            icon: 'success'
          });
        }
      }
    });
  },

  // 格式化时间
  formatTime(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  },

  // 页面显示时滚动到底部
  onShow() {
    // 确保用户信息是最新的
    this.getUserProfile();
    
    this.scrollToBottom();
    // 重新加载设置，以防从设置页面返回时设置已更改
    this.loadUserSettings();
  },

  // 滚动到底部
  scrollToBottom() {
    if (this.data.messages.length > 0) {
      const lastMessageId = this.data.messages[this.data.messages.length - 1].id;
      this.setData({
        scrollToMessage: `msg-${lastMessageId}`
      });
    }
  },

  // 跳转到设置页面
  goToSettings() {
    wx.navigateTo({
      url: '/pages/settings/settings'
    });
  },

  // 测试API连接
  testAPI() {
    const currentService = this.data.currentService;
    const apiKey = getAPIKey(currentService);
    
    if (!apiKey) {
      wx.showToast({
        title: '请先配置API Key',
        icon: 'none'
      });
      return;
    }

    // 添加测试用户消息
    const testUserMessage = {
      id: ++this.data.messageId,
      role: 'user',
      content: '你好，请简单回复一下测试消息。',
      time: this.formatTime(new Date()),
      userId: this.data.userInfo.userId
    };

    // 添加测试AI消息
    const testAiMessage = {
      id: ++this.data.messageId,
      role: 'assistant',
      content: '你好！我是WeAI Chat，这是一个测试回复。我可以帮助你回答各种问题，包括编程、学习、工作等方面的问题。',
      time: this.formatTime(new Date()),
      model: currentService,
      isStreaming: false,
      modelId: this.data.currentService
    };

    this.setData({
      messages: [...this.data.messages, testUserMessage, testAiMessage],
      scrollToMessage: `msg-${testAiMessage.id}`
    });

    this.saveMessages();
    
    wx.showToast({
      title: '测试消息已添加',
      icon: 'success'
    });
  },

  // 请求AI响应（流式）
  async requestAIResponseStream(userMessage, aiMessageId) {
    try {
      const currentService = this.data.currentService;
      console.log(`使用${currentService}服务调用流式API`);
      console.log(`当前服务配置:`, API_CONFIG[currentService]);
      
      let fullContent = '';
      
      // 添加超时处理
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('API调用超时')), 3000); // 3秒超时
      });
      
      const apiPromise = callAIAPIStream(userMessage, currentService, (chunk) => {
        console.log('收到流式数据块:', chunk);
        // 处理每个文本块
        fullContent += chunk;
        
        // 使用节流来减少setData调用频率
        if (!this.updateTimer) {
          this.updateTimer = setTimeout(() => {
            // 更新消息内容，使用更高效的方式
            const messages = [...this.data.messages];
            const messageIndex = messages.findIndex(msg => msg.id === aiMessageId);
            if (messageIndex !== -1) {
              messages[messageIndex] = { ...messages[messageIndex], content: fullContent };
              this.setData({ messages });
              this.scrollToBottom();
            }
            this.updateTimer = null;
          }, 100); // 100ms节流
        }
      });
      
      // 使用Promise.race来处理超时
      const response = await Promise.race([apiPromise, timeoutPromise]);
      
      console.log(`流式API调用完成，总内容:`, fullContent);
      
      // 完成流式输出，移除流式标记
      const messages = this.data.messages.map(msg => {
        if (msg.id === aiMessageId) {
          return { ...msg, isStreaming: false };
        }
        return msg;
      });
      
      this.setData({
        messages
      });

      this.saveMessages();
      
      // 确保输入框状态正确
      console.log('流式AI回复完成，当前输入框状态:', this.data.inputMessage);
      console.log('当前消息数量:', this.data.messages.length);
    } catch (error) {
      console.error('流式AI API调用失败，尝试使用非流式API:', error);
      
      // 如果流式API失败，尝试使用非流式API
      try {
        const currentService = this.data.currentService;
        console.log('尝试使用非流式API');
        
        const response = await callAIAPI(userMessage, currentService);
        
        // 更新消息内容
        const messages = this.data.messages.map(msg => {
          if (msg.id === aiMessageId) {
            return { 
              ...msg, 
              content: response,
              isStreaming: false
            };
          }
          return msg;
        });
        
        this.setData({
          messages
        });

        this.saveMessages();
        
        console.log('非流式API调用成功');
      } catch (fallbackError) {
        console.error('非流式API也失败了:', fallbackError);
        
        // 显示错误消息
        const messages = this.data.messages.map(msg => {
          if (msg.id === aiMessageId) {
            return { 
              ...msg, 
              content: `抱歉，我遇到了一些问题：${fallbackError.message || '请检查网络连接和API配置'}`,
              isStreaming: false
            };
          }
          return msg;
        });
        
        this.setData({
          messages
        });

        this.saveMessages();
        
        // 显示错误提示
        wx.showToast({
          title: 'AI回复失败，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    }
  },

  // 获取用户信息
  getUserProfile: function() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      // 如果用户信息中没有userId，则生成一个
      if (!userInfo.userId) {
        userInfo.userId = this.generateUserId();
        wx.setStorageSync('userInfo', userInfo);
      }
      this.setData({
        userInfo: userInfo
      });
    } else {
      // 如果没有用户信息，创建一个默认的用户信息
      const defaultUserInfo = {
        avatarUrl: '',
        nickName: '用户',
        gender: 0,
        userId: this.generateUserId()
      };
      wx.setStorageSync('userInfo', defaultUserInfo);
      this.setData({
        userInfo: defaultUserInfo
      });
    }
  },

  // 生成用户ID
  generateUserId: function() {
    // 生成一个简单的用户ID，格式：U + 6位随机数字
    const randomNum = Math.floor(Math.random() * 900000) + 100000;
    return `U${randomNum}`;
  },

  // 点击用户头像
  goToUserProfile: function() {
    wx.navigateTo({
      url: '/pages/user/user'
    });
  },

  // 点击设置按钮
  goToSettings: function() {
    wx.navigateTo({
      url: '/pages/settings/settings'
    });
  },

  // 测试wemark组件
  testWemark() {
    const testMessage = {
      id: ++this.data.messageId,
      role: 'user',
      content: '请测试markdown渲染功能',
      time: this.formatTime(new Date()),
      userId: this.data.userInfo.userId
    };

    const testAiMessage = {
      id: ++this.data.messageId,
      role: 'assistant',
      content: `# Markdown 测试

这是一个 **markdown** 渲染测试。

## 代码示例

\`\`\`javascript
function hello() {
  console.log("Hello, World!");
}
\`\`\`

## 列表

- 项目 1
- 项目 2
- 项目 3

## 引用

> 这是一个引用示例

## 链接

[点击这里](https://example.com)

## 表格

| 列1 | 列2 | 列3 |
|-----|-----|-----|
| 数据1 | 数据2 | 数据3 |
| 数据4 | 数据5 | 数据6 |

## 行内代码

这里有一些 \`行内代码\` 示例。`,
      time: this.formatTime(new Date()),
      model: this.data.currentService,
      isStreaming: false,
      modelId: this.data.currentService
    };

    this.setData({
      messages: [...this.data.messages, testMessage, testAiMessage],
      scrollToMessage: `msg-${testAiMessage.id}`
    });

    this.saveMessages();
  },
});
