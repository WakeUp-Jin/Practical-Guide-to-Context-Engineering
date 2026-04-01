# Cipher的LLM 服务架构分析文档 -TS版本
**🤖 本文档是由AI大模型整理，作为LLM模块Ts版本的实现具体的参考**
## 目录
1. [概述](#概述)
2. [核心接口定义](#核心接口定义)
3. [Factory 工厂模式实现](#factory-工厂模式实现)
4. [各 LLM 服务类详细分析](#各-llm-服务类详细分析)
5. [数据格式化规范](#数据格式化规范)
6. [配置结构](#配置结构)


## 概述

Cipher 项目采用统一的 LLM 服务架构，支持多种 LLM 提供商。所有服务类都实现了 `ILLMService` 接口，通过工厂模式进行实例化和管理。

**支持的 LLM 提供商：**
- OpenAI
- Anthropic (Claude)
- AWS Bedrock
- Azure OpenAI
- Google Gemini
- Qwen (通义千问)
- Ollama (本地)
- OpenRouter
- LM Studio (本地)
- DeepSeek

---

## 核心接口定义

### ILLMService 接口

所有 LLM 服务必须实现以下接口：

```typescript
export interface ILLMService {
  // 主要生成方法 - 使用会话上下文
  generate(userInput: string, imageData?: ImageData, stream?: boolean): Promise<string>;
  
  // 直接生成方法 - 不使用会话上下文，用于内部工具操作
  directGenerate(userInput: string, systemPrompt?: string): Promise<string>;
  
  // 获取所有可用工具
  getAllTools(): Promise<ToolSet>;
  
  // 获取服务配置
  getConfig(): LLMServiceConfig;
}
```

### LLMServiceConfig 类型

```typescript
export type LLMServiceConfig = {
  provider: string;  // 提供商名称
  model: string;     // 模型名称
};
```

---

## Factory 工厂模式实现

### createLLMService 方法

公共方法，用于创建并配置 LLM 服务实例。

```typescript
export function createLLMService(
  config: LLMConfig,
  mcpManager: MCPManager,
  contextManager: ContextManager,
  unifiedToolManager?: UnifiedToolManager,
  eventManager?: any
): ILLMService {
  // 1. 调用内部方法创建服务实例
  const service = _createLLMService(config, mcpManager, contextManager, unifiedToolManager);

  // 2. 设置事件管理器（如果提供）
  if (eventManager && typeof (service as any).setEventManager === 'function') {
    (service as any).setEventManager(eventManager);
  }

  // 3. 配置 token-aware 压缩
  configureCompressionForService(config, contextManager);

  return service;
}
```

**关键功能：**
1. 创建服务实例
2. 注入事件管理器用于监控和日志
3. 配置上下文压缩以优化 token 使用

### _createLLMService 方法

内部方法，根据配置创建具体的 LLM 服务实例。

::: details 点击展开完整代码
```typescript
function _createLLMService(
  config: LLMConfig,
  mcpManager: MCPManager,
  contextManager: ContextManager,
  unifiedToolManager?: UnifiedToolManager
): ILLMService {
  // 1. 提取并验证 API Key
  const apiKey = extractApiKey(config);

  // 2. 根据 provider 创建对应服务
  switch (config.provider.toLowerCase()) {
    case 'openai': {
      const baseURL = getOpenAICompatibleBaseURL(config);
      const OpenAIClass = require('openai');
      const openai = new OpenAIClass({ apiKey, ...(baseURL ? { baseURL } : {}) });
      return new OpenAIService(
        openai,
        config.model,
        mcpManager,
        contextManager,
        config.maxIterations,
        unifiedToolManager
      );
    }
    
    case 'anthropic': {
      const AnthropicClass = require('@anthropic-ai/sdk');
      const anthropic = new AnthropicClass({ apiKey });
      return new AnthropicService(
        anthropic,
        config.model,
        mcpManager,
        contextManager,
        config.maxIterations,
        unifiedToolManager
      );
    }
    
    case 'gemini': {
      return new GeminiService(
        apiKey,
        config.model,
        mcpManager,
        contextManager,
        config.maxIterations,
        unifiedToolManager
      );
    }
    
    case 'aws': {
      return new AwsService(
        config.model,
        mcpManager,
        contextManager,
        unifiedToolManager,
        config.maxIterations,
        config.aws
      );
    }
    
    case 'azure': {
      return new AzureService(
        config.model,
        mcpManager,
        contextManager,
        unifiedToolManager,
        config.maxIterations,
        config.azure
      );
    }
    
    case 'qwen': {
      const baseURL = config.baseURL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
      const OpenAIClass = require('openai');
      const openai = new OpenAIClass({ apiKey, baseURL });
      const qwenOptions: QwenOptions = {
        ...(config.qwenOptions?.enableThinking !== undefined && {
          enableThinking: config.qwenOptions.enableThinking,
        }),
        ...(config.qwenOptions?.thinkingBudget !== undefined && {
          thinkingBudget: config.qwenOptions.thinkingBudget,
        }),
        ...(config.qwenOptions?.temperature !== undefined && {
          temperature: config.qwenOptions.temperature,
        }),
        ...(config.qwenOptions?.top_p !== undefined && { 
          top_p: config.qwenOptions.top_p 
        }),
      };
      return new QwenService(
        openai,
        config.model,
        mcpManager,
        contextManager,
        config.maxIterations,
        qwenOptions,
        unifiedToolManager
      );
    }
    
    case 'ollama': {
      const baseURL = getOpenAICompatibleBaseURL(config);
      const OpenAIClass = require('openai');
      const openai = new OpenAIClass({
        apiKey: 'not-required',
        baseURL,
      });
      return new OllamaService(
        openai,
        config.model,
        mcpManager,
        contextManager,
        config.maxIterations,
        unifiedToolManager
      );
    }
    
    case 'openrouter': {
      const baseURL = getOpenAICompatibleBaseURL(config);
      const OpenAIClass = require('openai');
      const openai = new OpenAIClass({
        apiKey,
        baseURL,
        defaultHeaders: {
          'HTTP-Referer': 'https://github.com/byterover/cipher',
          'X-Title': 'Cipher Memory Agent',
        },
      });
      return new OpenRouterService(
        openai,
        config.model,
        mcpManager,
        contextManager,
        config.maxIterations,
        unifiedToolManager
      );
    }
    
    case 'lmstudio': {
      const baseURL = getOpenAICompatibleBaseURL(config);
      const OpenAIClass = require('openai');
      const openai = new OpenAIClass({
        apiKey: 'lm-studio',
        baseURL,
      });
      return new LMStudioService(
        openai,
        config.model,
        mcpManager,
        contextManager,
        config.maxIterations,
        unifiedToolManager
      );
    }
    
    case 'deepseek': {
      const baseURL = getOpenAICompatibleBaseURL(config);
      const OpenAIClass = require('openai');
      const openai = new OpenAIClass({ apiKey, baseURL });
      return new DeepseekService(
        openai,
        config.model,
        mcpManager,
        contextManager,
        config.maxIterations,
        unifiedToolManager
      );
    }
    
    default:
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
  }
}
```
:::

### 辅助工具函数

#### extractApiKey
提取并验证 API Key。

```typescript
function extractApiKey(config: LLMConfig): string {
  const provider = config.provider.toLowerCase();

  // 无需 API Key 的提供商
  if (
    provider === 'ollama' ||
    provider === 'lmstudio' ||
    provider === 'aws' ||
    provider === 'azure'
  ) {
    return 'not-required';
  }

  let apiKey = config.apiKey || '';
  if (!apiKey) {
    throw new Error(`Error: API key for ${provider} not found`);
  }
  
  return apiKey;
}
```

#### getOpenAICompatibleBaseURL
获取兼容 OpenAI API 的 Base URL。

```typescript
function getOpenAICompatibleBaseURL(llmConfig: LLMConfig): string {
  if (llmConfig.baseURL) {
    let baseUrl = llmConfig.baseURL.replace(/\/$/, '');
    
    // 为 Ollama 确保 /v1 后缀
    const provider = llmConfig.provider.toLowerCase();
    if (provider === 'ollama' && !baseUrl.endsWith('/v1') && !baseUrl.endsWith('/api')) {
      baseUrl = baseUrl + '/v1';
    }
    
    return baseUrl;
  }

  const provider = llmConfig.provider.toLowerCase();

  // 提供商默认值
  if (provider === 'openrouter') {
    return 'https://openrouter.ai/api/v1';
  }
  
  if (provider === 'ollama') {
    let baseUrl = env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
    if (!baseUrl.endsWith('/v1') && !baseUrl.endsWith('/api')) {
      baseUrl = baseUrl.replace(/\/$/, '') + '/v1';
    }
    return baseUrl;
  }
  
  if (provider === 'lmstudio') {
    return env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1';
  }
  
  if (provider === 'openai' && env.OPENAI_BASE_URL) {
    return env.OPENAI_BASE_URL.replace(/\/$/, '');
  }
  
  if (provider === 'deepseek') {
    return 'https://api.deepseek.com';
  }

  return '';
}
```

#### getDefaultContextWindow
获取默认上下文窗口大小。

```typescript
function getDefaultContextWindow(provider: string, model?: string): number {
  const defaults: Record<string, Record<string, number>> = {
    openai: {
      'gpt-3.5-turbo': 16385,
      'gpt-4': 8192,
      'gpt-4-32k': 32768,
      'gpt-4-turbo': 128000,
      'gpt-4o': 128000,
      'gpt-4o-mini': 128000,
      'o1-preview': 128000,
      'o1-mini': 128000,
      default: 8192,
    },
    anthropic: {
      'claude-3-opus': 200000,
      'claude-3-sonnet': 200000,
      'claude-3-haiku': 200000,
      'claude-3-5-sonnet': 200000,
      'claude-2.1': 200000,
      'claude-2.0': 100000,
      'claude-instant-1.2': 100000,
      default: 200000,
    },
    gemini: {
      'gemini-pro': 32760,
      'gemini-pro-vision': 16384,
      'gemini-ultra': 32760,
      'gemini-1.5-pro': 1000000,
      'gemini-1.5-flash': 1000000,
      'gemini-1.5-pro-latest': 2000000,
      'gemini-1.5-flash-latest': 1000000,
      'gemini-2.0-flash': 1000000,
      'gemini-2.0-flash-exp': 1000000,
      'gemini-2.5-pro': 2000000,
      'gemini-2.5-flash': 1000000,
      'gemini-2.5-flash-lite': 1000000,
      default: 1000000,
    },
    deepseek: {
      default: 128000,
    },
    ollama: {
      default: 8192,
    },
    openrouter: {
      default: 8192,
    },
  };

  const providerDefaults = defaults[provider];
  if (!providerDefaults) {
    return 8192; // 全局默认值
  }

  return providerDefaults[model || 'default'] || providerDefaults.default || 8192;
}
```

---

## 各 LLM 服务类详细分析

### 1. OpenAI Service

**支持的提供商:** OpenAI, OpenRouter, Ollama, LM Studio, DeepSeek

**工具格式化 (OpenAI 标准格式):**
```typescript
{
  type: 'function',
  function: {
    name: string,
    description: string,
    parameters: JSONSchema
  }
}
```

**API 调用格式:**
```typescript
await openai.chat.completions.create({
  model: this.model,
  messages: formattedMessages,  // 标准消息数组
  tools: tools,                  // 工具数组
  tool_choice: 'auto'           // 工具选择策略
});
```

**消息格式:**
```typescript
{
  role: 'system' | 'user' | 'assistant' | 'tool',
  content: string,
  tool_calls?: Array<{
    id: string,
    type: 'function',
    function: {
      name: string,
      arguments: string  // JSON 字符串
    }
  }>,
  tool_call_id?: string,  // 仅用于 tool 角色
  name?: string           // 仅用于 tool 角色
}
```

**特性:**
- ✅ 支持工具调用 (Function Calling)
- ✅ 支持图像输入
- ✅ 重试机制 (最多 3 次)
- ✅ 上下文压缩
- ✅ 事件发射 (开始、思考、完成、错误)

### 2. Anthropic Service

**工具格式化 (Anthropic 格式):**
```typescript
{
  name: string,
  description: string,
  input_schema: {
    type: 'object',
    properties: { ... },
    required: string[]
  }
}
```

**API 调用格式:**
```typescript
await anthropic.messages.create({
  model: this.model,
  messages: nonSystemMessages,  // 不包含 system 的消息
  system: systemPrompt,         // 单独的 system 字段
  tools: tools,
  max_tokens: 4096
});
```

**消息格式:**
```typescript
{
  role: 'user' | 'assistant',
  content: Array<{
    type: 'text' | 'tool_use' | 'tool_result',
    text?: string,
    id?: string,
    name?: string,
    input?: object,
    tool_use_id?: string,
    content?: string
  }>
}
```

**特殊处理:**
- System prompt 独立处理，不在消息数组中
- Tool use 和 tool result 作为 content blocks
- 需要将 tool_use 转换为标准 tool_calls 格式

**重试策略:**
```typescript
// 可重试错误
- 429 (Rate Limit)
- 500+ (Server Errors)
- 529 (Overloaded)
- Network errors

// 不可重试错误
- 400 (Invalid Request)
- 401 (Authentication)
- 403 (Permission Denied)
- 404 (Not Found)

// 指数退避 + 抖动
delay = min(2^attempt * baseDelay * jitter, 30000ms)
```

### 3. Google Gemini Service

**工具格式化 (类 OpenAI 格式，但使用提示词注入):**

Gemini 不使用原生 Function Calling API，而是通过特殊格式的提示词来实现工具调用：

```typescript
// 提示词中的工具描述格式
Tool: tool_name
Description: tool description
Parameters: {json_schema}

// 工具调用响应格式
{
  "tool": "tool_name",
  "arguments": {
    "param1": "value1"
  }
}
```

**消息转换:**
```typescript
// 将消息数组转换为文本提示
User: {user_message}
Assistant: {assistant_message}
System: {system_message}
```

**工具调用解析:**
```typescript
private parseGeminiResponse(text: string): any {
  // 1. 查找工具调用代码块
  const toolCallPattern = /```tool_code\s*\n?([^`]*)\n?```/gi;
  
  // 2. 解析 JSON
  const toolCallData = JSON.parse(match[1].trim());
  
  // 3. 转换为标准格式
  return {
    id: `gemini_${Date.now()}_${randomId}`,
    type: 'function',
    function: {
      name: toolCallData.tool,
      arguments: JSON.stringify(toolCallData.arguments)
    }
  };
}
```

**特殊功能:**
- 清理工具元数据 (cleanToolMetadata)
- 防止重复工具调用
- 自定义工具调用格式

### 4. AWS Bedrock Service

**支持的模型系列:**
```typescript
enum ModelFamily {
  ANTHROPIC = 'anthropic',
  META_LLAMA = 'meta',
  AMAZON_TITAN = 'amazon.titan',
  AMAZON_NOVA = 'amazon.nova',
  AI21_LABS = 'ai21',
  COHERE = 'cohere',
  DEEPSEEK = 'deepseek',
  LUMA_AI = 'luma',
  MISTRAL_AI = 'mistral',
  STABILITY_AI = 'stability',
  TWELVELABS = 'twelvelabs',
  WRITER = 'writer',
}
```

**根据模型系列选择不同的格式化器:**
```typescript
switch (this.modelFamily) {
  case ModelFamily.ANTHROPIC:
    this.formatter = new BedrockAnthropicMessageFormatter();
    break;
  case ModelFamily.META_LLAMA:
    this.formatter = new BedrockLlamaMessageFormatter();
    break;
  case ModelFamily.AMAZON_TITAN:
    this.formatter = new BedrockTitanMessageFormatter();
    break;
  case ModelFamily.DEEPSEEK:
    this.formatter = new BedrockDeepSeekMessageFormatter();
    break;
  case ModelFamily.AI21_LABS:
    this.formatter = new BedrockAI21MessageFormatter();
    break;
  default:
    this.formatter = new BedrockAnthropicMessageFormatter();
}
```

**API 调用 (Anthropic 格式示例):**
```typescript
const request = {
  messages: formattedMessages,
  anthropic_version: 'bedrock-2023-05-31',
  max_tokens: 4096,
  temperature: 0.7,
  ...(systemPrompt ? { system: systemPrompt } : {}),
  ...(tools.length > 0 ? { 
    tools: tools,
    tool_choice: { type: 'auto' }
  } : {})
};

const command = new InvokeModelCommand({
  modelId: this.model,
  contentType: 'application/json',
  accept: 'application/json',
  body: JSON.stringify(request),
  ...(inferenceProfileArn ? { 
    inferenceConfig: { profileId: inferenceProfileArn } 
  } : {})
});
```

**AWS 配置:**
```typescript
{
  region: 'us-east-1',
  credentials: {
    accessKeyId: string,
    secretAccessKey: string,
    sessionToken?: string  // 可选
  },
  inferenceProfileArn?: string  // 预置吞吐量 ARN
}
```

### 5. Azure OpenAI Service

**工具格式化 (OpenAI 兼容):**
```typescript
{
  type: 'function',
  function: {
    name: string,
    description: string,
    parameters: JSONSchema
  }
}
```

**API 调用 (使用 Azure SDK):**
```typescript
await this.client.getChatCompletions(
  this.deploymentName,  // Azure 部署名称
  formattedMessages,
  {
    temperature: 0.7,
    maxTokens: 4096,
    topP: 1,
    tools: tools,
    toolChoice: 'auto'  // 注意：Azure 使用 toolChoice 而非 tool_choice
  }
);
```

**消息格式归一化:**
```typescript
// Azure 可能返回不同格式的 tool calls
const normalizedMessage = {
  ...message,
  tool_calls: 
    message.toolCalls ||        // Azure 格式
    message.tool_calls ||       // OpenAI 格式
    (message.functionCall ? [{  // 旧版 function call 格式
      id: `call_${Date.now()}`,
      type: 'function',
      function: {
        name: message.functionCall.name,
        arguments: message.functionCall.arguments,
      },
    }] : undefined)
};
```

**配置要求:**
```typescript
{
  endpoint: 'https://{resource-name}.openai.azure.com',
  deploymentName: string,  // 部署名称，默认使用 model
  apiKey: string           // AZURE_OPENAI_API_KEY
}
```

### 6. Qwen Service

**特殊配置选项:**
```typescript
interface QwenOptions {
  enableThinking?: boolean,      // 启用思考模式
  thinkingBudget?: number,       // 思考 token 预算
  temperature?: number,           // 温度参数 [0-2]
  top_p?: number                  // Top-P 参数 [0-1]
}
```

**配置转换 (camelCase → snake_case):**
```typescript
const apiOptions: any = {
  enable_thinking: this.qwenOptions.enableThinking ?? false,
  thinking_budget: this.qwenOptions.thinkingBudget,
  temperature: this.qwenOptions.temperature,
  top_p: this.qwenOptions.top_p
};
```

**API 调用:**
```typescript
await this.openai.chat.completions.create({
  model: this.model,
  messages: formattedMessages,
  tools: tools,
  tool_choice: 'auto',
  ...apiOptions  // Qwen 特定选项
});
```

**特性:**
- 使用 OpenAI SDK (兼容格式)
- 默认 endpoint: `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`
- 支持思考模式 (thinking mode)

---

## 数据格式化规范

### 统一工具调用格式

所有服务都将工具调用转换为以下标准格式：

```typescript
{
  id: string,           // 工具调用 ID
  type: 'function',     // 固定为 'function'
  function: {
    name: string,       // 工具名称
    arguments: string   // JSON 字符串化的参数
  }
}
```

### 工具结果格式

```typescript
{
  role: 'tool',
  tool_call_id: string,  // 对应的工具调用 ID
  name: string,          // 工具名称
  content: string        // 结果内容 (JSON 或文本)
}
```


### 消息格式转换流程

```
1. 用户输入 → addUserMessage()
   ↓
2. 获取格式化消息 → getFormattedMessage()
   ↓
3. 添加系统提示 → getSystemPrompt()
   ↓
4. 压缩历史记录 → compressHistory() (如果超出限制)
   ↓
5. 转换为提供商格式 → 各服务的格式化方法
   ↓
6. 调用 LLM API
   ↓
7. 解析响应 → 标准化工具调用格式
   ↓
8. 添加助手消息 → addAssistantMessage()
   ↓
9. 执行工具 (如果有)
   ↓
10. 添加工具结果 → addToolResult()
   ↓
11. 循环 (直到无工具调用或达到最大迭代)
```

### 各提供商工具格式对比

| 提供商 | 工具定义格式 | 特殊处理 |
|--------|------------|---------|
| OpenAI | `{type: 'function', function: {...}}` | 标准格式 |
| Anthropic | `{name, description, input_schema}` | System prompt 独立 |
| Gemini | 提示词注入 | 解析 tool_code 代码块 |
| AWS Bedrock | 根据模型系列不同 | 多种格式化器 |
| Azure | OpenAI 兼容 | toolChoice vs tool_choice |
| Qwen | OpenAI 兼容 | 特殊选项转换 |
| Ollama | OpenAI 兼容 | 本地无 API Key |
| OpenRouter | OpenAI 兼容 | 自定义 headers |
| LM Studio | OpenAI 兼容 | 本地，API Key 固定 |
| DeepSeek | OpenAI 兼容 | 标准格式 |

---

## 配置结构

### LLMConfig Schema

```typescript
{
  provider: string,        // 提供商名称
  model: string,          // 模型名称
  apiKey?: string,        // API Key (可选，支持 $VAR 环境变量)
  maxIterations?: number, // 最大迭代次数 (默认 50)
  baseURL?: string,       // 自定义 Base URL
  
  // Qwen 特定配置
  qwenOptions?: {
    enableThinking?: boolean,
    thinkingBudget?: number,
    temperature?: number,
    top_p?: number
  },
  
  // AWS 特定配置
  aws?: {
    region?: string,
    accessKeyId?: string,
    secretAccessKey?: string,
    sessionToken?: string,
    inferenceProfileArn?: string
  },
  
  // Azure 特定配置
  azure?: {
    endpoint: string,           // 必需
    deploymentName?: string     // 可选，默认使用 model
  }
}
```

### 验证规则

```typescript
// 支持的提供商
const supportedProviders = [
  'openai', 'anthropic', 'openrouter', 'ollama', 
  'lmstudio', 'qwen', 'aws', 'azure', 'gemini', 'deepseek'
];

// 无需 API Key 的提供商
const noApiKeyRequired = ['ollama', 'lmstudio', 'aws'];

// AWS 必须提供 aws 配置对象
// Azure 必须提供 azure 配置对象和 endpoint
// 其他提供商必须提供 apiKey
```

### 环境变量支持

```bash
# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Gemini
GEMINI_API_KEY=...

# Qwen
QWEN_API_KEY=sk-...

# AWS
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_SESSION_TOKEN=...
AWS_DEFAULT_REGION=us-east-1
AWS_BEDROCK_INFERENCE_PROFILE_ARN=...

# Azure
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=https://...

# Ollama
OLLAMA_BASE_URL=http://localhost:11434

# LM Studio
LMSTUDIO_BASE_URL=http://localhost:1234/v1

# OpenRouter
OPENROUTER_API_KEY=...

# DeepSeek
DEEPSEEK_API_KEY=...
```

---

## 关键设计模式

### 1. 工厂模式
所有服务通过 Factory 创建，统一配置和初始化流程。

### 2. 策略模式
不同提供商实现相同接口，但有不同的实现策略。

### 3. 适配器模式
- OpenAI SDK 适配 → Ollama, OpenRouter, LM Studio, Qwen, DeepSeek
- Azure SDK 适配 → Azure OpenAI
- Gemini SDK 适配 → Google Gemini
- AWS SDK 适配 → AWS Bedrock (多模型)

### 4. 模板方法模式
所有服务共享相同的 generate 流程：
1. 添加用户消息
2. 获取工具
3. 循环直到完成或达到最大迭代
4. 处理工具调用
5. 返回结果

### 5. 观察者模式
事件发射机制允许外部监控：
- LLM_RESPONSE_STARTED
- LLM_THINKING
- LLM_RESPONSE_COMPLETED
- LLM_RESPONSE_ERROR

---

## 最佳实践

### 1. 错误处理
```typescript
// 重试机制
const MAX_ATTEMPTS = 3;
for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  try {
    // API 调用
  } catch (error) {
    if (attempt === MAX_ATTEMPTS) throw error;
    await sleep(500 * attempt);  // 指数退避
  }
}
```

### 2. 上下文管理
```typescript
// 自动压缩长上下文
if (tokenCount > contextWindow * 0.8) {
  await contextManager.compressHistory();
}
```

### 3. 工具调用优化
```typescript
// 首次尝试提供工具，重试时禁用工具
tools: attempt === 1 ? tools : [],
tool_choice: attempt === 1 ? 'auto' : 'none'
```

### 4. 日志记录
```typescript
logger.debug('发送消息到 LLM');
logger.info('🔧 使用工具: tool_name');
logger.silly('完整响应:', response);
logger.error('API 调用失败', error);
```

---

## 总结

Cipher 的 LLM 服务架构具有以下优势：

✅ **统一接口** - 所有提供商实现相同接口  
✅ **灵活配置** - 支持多种配置方式和环境变量  
✅ **强大兼容性** - 支持 10+ LLM 提供商  
✅ **智能重试** - 内置重试机制和错误处理  
✅ **上下文优化** - 自动压缩和 token 管理  
✅ **工具集成** - 统一的工具调用接口  
✅ **事件驱动** - 完整的监控和日志系统  
✅ **可扩展性** - 易于添加新的提供商

该架构为构建复杂的 AI Agent 应用提供了坚实的基础。
