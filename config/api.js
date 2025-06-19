// AI API配置文件
const API_CONFIG = {
  // 阿里百炼 Qwen-Plus配置
  qwen: {
    apiKey: 'sk-6f34798d50eb455c805adf7268b1851b',
    baseURL: 'https://dashscope.aliyuncs.com/api/v1',
    model: 'qwen-plus',
    maxTokens: 1000,
    temperature: 0.7
  },
  
  // DeepSeek配置
  deepseek: {
    apiKey: 'sk-43b7a864e1c3439abc1321d8350f156d',
    baseURL: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    maxTokens: 1000,
    temperature: 0.7,
  },
  
  // 默认使用的API服务
  defaultService: 'deepseek'
};

// 获取用户自定义参数
const getUserSettings = () => {
  const temperature = wx.getStorageSync('temperature') || 0.7;
  const maxTokens = wx.getStorageSync('maxTokens') || 1000;
  return { temperature, maxTokens };
};

// 更新API配置中的参数
const updateAPIConfig = (config, userSettings) => {
  return {
    ...config,
    temperature: userSettings.temperature,
    maxTokens: userSettings.maxTokens
  };
};

// API调用函数
const callAIAPI = async (prompt, service = API_CONFIG.defaultService) => {
  const config = API_CONFIG[service];
  
  if (!config.apiKey) {
    throw new Error(`请先配置${service}的API Key`);
  }

  // 获取用户自定义参数
  const userSettings = getUserSettings();
  const updatedConfig = updateAPIConfig(config, userSettings);

  console.log(`调用${service} API，模型：${updatedConfig.model}，参数：`, {
    temperature: updatedConfig.temperature,
    maxTokens: updatedConfig.maxTokens
  });

  return await makeAPIRequest(prompt, updatedConfig, service);
};

// 流式API调用函数
const callAIAPIStream = async (prompt, service = API_CONFIG.defaultService, onChunk) => {
  const config = API_CONFIG[service];
  
  if (!config.apiKey) {
    throw new Error(`请先配置${service}的API Key`);
  }

  // 获取用户自定义参数
  const userSettings = getUserSettings();
  const updatedConfig = updateAPIConfig(config, userSettings);

  console.log(`调用${service}流式API，模型：${updatedConfig.model}，参数：`, {
    temperature: updatedConfig.temperature,
    maxTokens: updatedConfig.maxTokens
  });

  return await makeAPIRequestStream(prompt, updatedConfig, service, onChunk);
};

// 发起API请求
const makeAPIRequest = async (prompt, config, service) => {
  try {
    console.log(`准备调用${service} API:`, {
      url: `${config.baseURL}/chat/completions`,
      model: config.model,
      prompt: prompt.substring(0, 200) + '...' // 只显示前200个字符
    });

    // 解析prompt中的对话历史
    const messages = parsePromptToMessages(prompt);

    // 根据服务类型使用不同的API格式
    if (service === 'qwen') {
      return await callDashScopeAPI(messages, config, service);
    } else {
      return await callStandardAPI(messages, config, service);
    }
  } catch (error) {
    console.error(`${service} API调用异常:`, error);
    throw error;
  }
};

// 发起API请求（流式）
const makeAPIRequestStream = async (prompt, config, service, onChunk) => {
  try {
    console.log(`准备调用${service}流式API:`, {
      url: `${config.baseURL}/chat/completions`,
      model: config.model,
      prompt: prompt.substring(0, 200) + '...' // 只显示前200个字符
    });

    // 解析prompt中的对话历史
    const messages = parsePromptToMessages(prompt);

    // 根据服务类型使用不同的API格式
    if (service === 'qwen') {
      return await callDashScopeAPIStream(messages, config, service, onChunk);
    } else {
      return await callStandardAPIStream(messages, config, service, onChunk);
    }
  } catch (error) {
    console.error(`${service} API调用异常:`, error);
    throw error;
  }
};

// 解析prompt为消息数组
const parsePromptToMessages = (prompt) => {
  const messages = [];
  const lines = prompt.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('system:')) {
      const content = line.substring(7).trim();
      if (content) {
        messages.push({
          role: 'system',
          content: content
        });
      }
    } else if (line.startsWith('user:')) {
      const content = line.substring(5).trim();
      if (content) {
        messages.push({
          role: 'user',
          content: content
        });
      }
    } else if (line.startsWith('ai:')) {
      const content = line.substring(3).trim();
      if (content) {
        messages.push({
          role: 'assistant',
          content: content
        });
      }
    }
  }
  
  console.log('解析后的消息数组:', messages);
  return messages;
};

// 调用阿里百炼API
const callDashScopeAPI = async (messages, config, service) => {
  try {
    const response = await new Promise((resolve, reject) => {
      wx.request({
        url: `${config.baseURL}/services/aigc/text-generation/generation`,
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        data: {
          model: config.model,
          input: {
            messages: messages
          },
          parameters: {
            max_tokens: config.maxTokens,
            temperature: config.temperature,
            result_format: 'message'
          }
        },
        success: (res) => {
          console.log(`${service} API响应成功:`, {
            statusCode: res.statusCode,
            data: res.data
          });
          
          if (res.statusCode === 200) {
            const content = extractContent(res.data, service);
            resolve(content);
          } else {
            reject(new Error(`${service} API调用失败: ${res.statusCode} - ${res.data?.message || '未知错误'}`));
          }
        },
        fail: (err) => {
          console.error(`${service} API调用失败:`, {
            errMsg: err.errMsg,
            statusCode: err.statusCode,
            data: err.data
          });
          reject(new Error(`网络请求失败: ${err.errMsg}`));
        }
      });
    });
    
    return response;
  } catch (error) {
    console.error(`${service} API调用异常:`, error);
    throw error;
  }
};

// 调用标准OpenAI格式API
const callStandardAPI = async (messages, config, service) => {
  try {
    const response = await new Promise((resolve, reject) => {
      wx.request({
        url: `${config.baseURL}/chat/completions`,
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        data: {
          model: config.model,
          messages: messages,
          max_tokens: config.maxTokens,
          temperature: config.temperature,
          stream: false
        },
        success: (res) => {
          console.log(`${service} API响应成功:`, {
            statusCode: res.statusCode,
            data: res.data
          });
          
          if (res.statusCode === 200) {
            const content = extractContent(res.data, service);
            resolve(content);
          } else {
            reject(new Error(`${service} API调用失败: ${res.statusCode} - ${res.data?.error?.message || '未知错误'}`));
          }
        },
        fail: (err) => {
          console.error(`${service} API调用失败:`, {
            errMsg: err.errMsg,
            statusCode: err.statusCode,
            data: err.data
          });
          reject(new Error(`网络请求失败: ${err.errMsg}`));
        }
      });
    });
    
    return response;
  } catch (error) {
    console.error(`${service} API调用异常:`, error);
    throw error;
  }
};

// 调用阿里百炼API（流式）
const callDashScopeAPIStream = async (messages, config, service, onChunk) => {
  try {
    return new Promise((resolve, reject) => {
      const requestTask = wx.request({
        url: `${config.baseURL}/services/aigc/text-generation/generation`,
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        data: {
          model: config.model,
          input: {
            messages: messages
          },
          parameters: {
            max_tokens: config.maxTokens,
            temperature: config.temperature,
            result_format: 'message',
            incremental_output: true // 启用增量输出
          }
        },
        success: (res) => {
          console.log(`${service}流式API响应成功:`, {
            statusCode: res.statusCode,
            data: res.data
          });
          
          if (res.statusCode === 200) {
            // 处理流式响应
            processStreamResponse(res.data, onChunk, resolve, service);
          } else {
            reject(new Error(`${service} API调用失败: ${res.statusCode} - ${res.data?.message || '未知错误'}`));
          }
        },
        fail: (err) => {
          console.error(`${service}流式API调用失败:`, {
            errMsg: err.errMsg,
            statusCode: err.statusCode,
            data: err.data
          });
          reject(new Error(`网络请求失败: ${err.errMsg}`));
        }
      });
    });
  } catch (error) {
    console.error(`${service}流式API调用异常:`, error);
    throw error;
  }
};

// 调用标准OpenAI格式API（流式）
const callStandardAPIStream = async (messages, config, service, onChunk) => {
  try {
    return new Promise((resolve, reject) => {
      const requestTask = wx.request({
        url: `${config.baseURL}/chat/completions`,
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        data: {
          model: config.model,
          messages: messages,
          max_tokens: config.maxTokens,
          temperature: config.temperature,
          stream: true // 启用流式输出
        },
        success: (res) => {
          console.log(`${service}流式API响应成功:`, {
            statusCode: res.statusCode,
            data: res.data
          });
          
          if (res.statusCode === 200) {
            // 处理流式响应
            processStreamResponse(res.data, onChunk, resolve, service);
          } else {
            reject(new Error(`${service} API调用失败: ${res.statusCode} - ${res.data?.error?.message || '未知错误'}`));
          }
        },
        fail: (err) => {
          console.error(`${service}流式API调用失败:`, {
            errMsg: err.errMsg,
            statusCode: err.statusCode,
            data: err.data
          });
          reject(new Error(`网络请求失败: ${err.errMsg}`));
        }
      });
    });
  } catch (error) {
    console.error(`${service}流式API调用异常:`, error);
    throw error;
  }
};

// 提取响应内容
const extractContent = (data, service) => {
  // 如果是流式响应，先分割处理
  if (typeof data === 'string' && data.includes('data: ')) {
    const chunks = data.split('\n\n').filter(chunk => chunk.trim() && chunk !== 'data: [DONE]');
    let fullContent = '';
    
    for (const chunk of chunks) {
      try {
        const chunkData = chunk.startsWith('data: ') ? chunk.substring(6) : chunk;
        const json = JSON.parse(chunkData);
        
        // 提取单个 chunk 的内容
        if (json.choices && json.choices[0] && json.choices[0].delta) {
          if (json.choices[0].delta.content) {
            fullContent += json.choices[0].delta.content;
          }
        }
      } catch (e) {
        console.error('解析 chunk 失败:', e);
      }
    }
    
    return fullContent;
  }
  
  // 非流式响应处理逻辑
  if (data.output) {
    if (data.output.text) {
      return data.output.text;
    } else if (data.output.choices && data.output.choices[0] && data.output.choices[0].message) {
      return data.output.choices[0].message.content;
    } else if (data.output.message && data.output.message.content) {
      return data.output.message.content;
    }
  }
  
  if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
    return data.choices[0].message.content;
  }
  
  if (data.text) return data.text;
  if (data.content) return data.content;
  if (data.message) return data.message;
  
  console.log('未识别的响应格式:', JSON.stringify(data, null, 2));
  return '';
};

// 处理流式响应
const processStreamResponse = (data, onChunk, resolve, service) => {
  console.log('处理流式响应数据:', data);
  let fullContent = '';
  
  // 检查是否是真正的流式响应
  if (data.output && data.output.choices && data.output.choices[0] && data.output.choices[0].delta) {
    // 阿里百炼增量输出格式
    const delta = data.output.choices[0].delta;
    if (delta.content) {
      onChunk(delta.content);
      fullContent += delta.content;
    }
  } else if (data.choices && data.choices[0] && data.choices[0].delta) {
    // OpenAI流式格式
    const delta = data.choices[0].delta;
    if (delta.content) {
      onChunk(delta.content);
      fullContent += delta.content;
    }
  } else {
    // 如果不是真正的流式响应，使用模拟流式输出
    const content = extractContent(data, service);
    if (content) {
      simulateStreamOutput(content, onChunk, resolve);
      return;
    }
  }
  
  // 检查是否完成
  if (data.output && data.output.choices && data.output.choices[0] && data.output.choices[0].finish_reason) {
    console.log('流式输出完成，总内容:', fullContent);
    resolve(fullContent);
  } else if (data.choices && data.choices[0] && data.choices[0].finish_reason) {
    console.log('流式输出完成，总内容:', fullContent);
    resolve(fullContent);
  }
};

// 模拟流式输出（当API不支持真正的流式时使用）
const simulateStreamOutput = (content, onChunk, resolve) => {
  console.log('使用模拟流式输出，内容长度:', content.length);
  
  if (content.length === 0) {
    console.log('响应内容为空');
    resolve('');
    return;
  }
  
  const chunkSize = Math.max(1, Math.floor(content.length / 20)); // 分20块输出
  let fullContent = '';
  
  for (let i = 0; i < content.length; i += chunkSize) {
    const chunk = content.slice(i, i + chunkSize);
    setTimeout(() => {
      console.log('发送数据块:', chunk);
      onChunk(chunk);
      fullContent += chunk;
      
      if (i + chunkSize >= content.length) {
        console.log('模拟流式输出完成，总内容:', fullContent);
        resolve(fullContent);
      }
    }, (i / chunkSize) * 30); // 每30ms发送一块，更流畅
  }
};

// 设置API Key
const setAPIKey = (service, apiKey) => {
  if (API_CONFIG[service]) {
    API_CONFIG[service].apiKey = apiKey;
    // 保存到本地存储非流式API调用成功
    wx.setStorageSync(`api_key_${service}`, apiKey);
  }
};

// 获取API Key
const getAPIKey = (service) => {
  return API_CONFIG[service]?.apiKey || '';
};

// 从本地存储加载API Key
const loadAPIKeys = () => {
  Object.keys(API_CONFIG).forEach(service => {
    if (service !== 'defaultService') {
      const savedKey = wx.getStorageSync(`api_key_${service}`);
      if (savedKey) {
        API_CONFIG[service].apiKey = savedKey;
      }
    }
  });
};

// 初始化时加载API Key
loadAPIKeys();

module.exports = {
  API_CONFIG,
  callAIAPI,
  callAIAPIStream,
  setAPIKey,
  getAPIKey
}; 