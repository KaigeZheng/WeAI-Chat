// index.js
const { callAIAPI, callAIAPIStream, setAPIKey, getAPIKey, API_CONFIG } = require('../../config/api.js');

Page({
  data: {
    messages: [],
    inputMessage: '',
    isLoading: false,
    scrollToMessage: '',
    messageId: 0,
    currentService: 'openai', // 当前使用的AI服务
    userInfo: {
      avatarUrl: '',
      nickName: '',
      gender: 0
    }
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
  },

  onShow: function() {
    // 每次页面显示时重新加载用户信息
    this.getUserProfile();
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
      if (msg.role === 'assistant' && !msg.model) {
        // 对于没有model字段的旧AI消息，默认设置为qwen
        return { ...msg, model: 'qwen' };
      }
      return msg;
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
      time: this.formatTime(new Date())
    };

    // 创建AI消息占位符
    const aiMessage = {
      id: ++this.data.messageId,
      role: 'assistant',
      content: '',
      time: this.formatTime(new Date()),
      model: currentService,
      isStreaming: true // 标记为流式输出
    };

    this.setData({
      messages: [...this.data.messages, userMessage, aiMessage],
      inputMessage: '',
      scrollToMessage: `msg-${aiMessage.id}`
    });

    this.saveMessages();

    // 调用流式AI API
    this.requestAIResponseStream(message, aiMessage.id);
  },

  // 请求AI响应
  async requestAIResponse(userMessage) {
    try {
      const currentService = this.data.currentService;
      console.log(`使用${currentService}服务调用API`);
      console.log(`当前服务配置:`, API_CONFIG[currentService]);
      
      const response = await callAIAPI(userMessage, currentService);
      
      console.log(`API调用成功，响应:`, response);
      
      // 添加AI回复
      const aiMessage = {
        id: ++this.data.messageId,
        role: 'assistant',
        content: response,
        time: this.formatTime(new Date()),
        model: currentService // 记录生成该消息的模型
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
        model: currentService // 记录生成该消息的模型
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

    wx.showLoading({
      title: '测试API连接...'
    });

    // 创建测试消息
    const testMessage = {
      id: ++this.data.messageId,
      role: 'user',
      content: '你好，请简单回复一下测试消息。',
      time: this.formatTime(new Date())
    };

    const testAiMessage = {
      id: ++this.data.messageId,
      role: 'assistant',
      content: '',
      time: this.formatTime(new Date()),
      model: currentService,
      isStreaming: true
    };

    this.setData({
      messages: [...this.data.messages, testMessage, testAiMessage]
    });

    // 使用流式API进行测试
    this.requestAIResponseStream('你好，请简单回复一下测试消息。', testAiMessage.id)
      .then(() => {
        wx.hideLoading();
        wx.showToast({
          title: 'API连接成功',
          icon: 'success'
        });
      })
      .catch((error) => {
        wx.hideLoading();
        wx.showModal({
          title: 'API测试失败',
          content: `错误信息：${error.message}`,
          showCancel: false
        });
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
        
        // 更新消息内容
        const messages = this.data.messages.map(msg => {
          if (msg.id === aiMessageId) {
            return { ...msg, content: fullContent };
          }
          return msg;
        });
        
        this.setData({ messages });
        this.scrollToBottom();
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
      this.setData({
        userInfo: userInfo
      });
    }
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
});
