
# LLM服务层的实现设计

自己在项目中实现一个 LLM 的服务商集成的思路主要是：设计 LLM 服务的统一接口，工厂函数的创建，消息的格式化这三种，

1. 每一种类型的供应商**输出的结果的格式都不一样**，所以需要将这些不同的外部输出格式转换为内部传递的消息格式
2. 每一种类型的供应商**要求的参数的 message 和 tool 的格式也不一样**，所以也需要根据不同的供应商将内部的消息格式和工具格式转换为这些供应商需要的参数格式



这样自定义封装实现的优势是：

+ 定制化功能：添加重试机制、上下文压缩、直接生成模式等特定功能
+ 系统集成：将 LLM 的调用与系统的其他组件无缝集成
+ 轻量级与性能：更加轻量级，只包含必要的功能，性能开销更小
+ 避免供应商锁定：更加的灵活，可以更容易地替换或修改底层实现



那么架构设计解决的问题是：

1. 多供应商的支持：通过工厂模式和统一接口，系统可以轻松支持多个LLM提供商，并根据配置动态切换。
2. 上下文管理：`<u>ContextManager</u>`通过消息持久化、令牌感知压缩和消息格式化解决了上下文管理的复杂性。
3. 工具调用优化：封装层提供了统一的工具调用接口，处理不同LLM提供商的工具调用差异。
4. 错误处理与弹性：封装层提供了健壮的错误处理和弹性机制，包括重试逻辑、上下文长度处理和工具执行错误处理



整体的架构设计的关系图如下：

Excalidraw 文件：[https://gcntfv628ebr.feishu.cn/file/EdQObfoV0oR6IHx48CGcPWPnnEb](https://gcntfv628ebr.feishu.cn/file/EdQObfoV0oR6IHx48CGcPWPnnEb)

![LLM服务层的实现设计](./image/image%20(30).png)



## 一、LLM 服务接口统一设计
LLM 服务接口定义了统一的契约，包含四个核心方法

+ **generate()**: 主要生成方法，支持流式输出和图像输入
+ **directGenerate**(): 直接生成，绕过对话上下文
+ **getAllTools**(): 获取所有可用工具
+ **getConfig**(): 获取服务配置信息

```typescript
export interface ILLMService {
	generate(userInput: string, imageData?: ImageData, stream?: boolean): Promise<string>;
	directGenerate(userInput: string, systemPrompt?: string): Promise<string>;
	getAllTools(): Promise<ToolSet>;
	getConfig(): LLMServiceConfig;
}
```



还有一些在具体实现的时候的辅助方法

+ getAIResponseWithRetries：重试机制，处理网络波动和错误
+ formatToolsForProvider：工具格式转换
+ isRetryableError：错误处理

```typescript
  // 重试机制 - 处理API波动和错误
  private async getAIResponseWithRetries(tools: any[], userInput:string): Promise<{response: any}>

  // 工具格式转换 - 适配不同API格式
  private formatToolsForProvider(tools: ToolSet): any[]

  // 错误处理 - 可选，复杂提供商需要
  private isRetryableError?(status: number, errorType: string):boolean
  private calculateRetryDelay?(attempt: number, status: number):number
```



还有每一个具体的 LLM 服务类需要实现的核心属性

```typescript
  export class NewProviderService implements ILLMService {
      // 必需的核心组件
      private client: ProviderClient;           // 提供商SDK客户端
      private model: string;                    // 模型名称
      private mcpManager: MCPManager;           // MCP工具管理
      private contextManager: ContextManager;   // 对话上下文管理  
      private maxIterations: number;            // 最大工具调用次数
      private unifiedToolManager?: UnifiedToolManager; // 可选：统一工具管理
  }
```



例如 openAIService 的实现

```typescript
import { ToolSet } from '../../../mcp/types.js';
import { MCPManager } from '../../../mcp/manager.js';
import { UnifiedToolManager, CombinedToolSet } from '../../tools/unified-tool-manager.js';
import { ContextManager } from '../messages/manager.js';
import { ImageData } from '../messages/types.js';
import { ILLMService, LLMServiceConfig } from './types.js';
import OpenAI from 'openai';
import { logger } from '../../../logger/index.js';
import { formatToolResult } from '../utils/tool-result-formatter.js';

export class OpenAIService implements ILLMService {
	private openai: OpenAI;
	private model: string;
	private mcpManager: MCPManager;
	private unifiedToolManager: UnifiedToolManager | undefined;
	private contextManager: ContextManager;
	private maxIterations: number;

	constructor(
		openai: OpenAI,
		model: string,
		mcpManager: MCPManager,
		contextManager: ContextManager,
		maxIterations: number = 5,
		unifiedToolManager?: UnifiedToolManager
	) {
		this.openai = openai;
		this.model = model;
		this.mcpManager = mcpManager;
		this.unifiedToolManager = unifiedToolManager;
		this.contextManager = contextManager;
		this.maxIterations = maxIterations;
	}
	async generate(userInput: string, imageData?: ImageData): Promise<string> {
		await this.contextManager.addUserMessage(userInput, imageData);

		// Use unified tool manager if available, otherwise fall back to MCP manager
		let formattedTools: any[];
		if (this.unifiedToolManager) {
			formattedTools = await this.unifiedToolManager.getToolsForProvider('openai');
		} else {
			const rawTools = await this.mcpManager.getAllTools();
			formattedTools = this.formatToolsForOpenAI(rawTools);
		}

		logger.silly(`Formatted tools: ${JSON.stringify(formattedTools, null, 2)}`);

		let iterationCount = 0;
		try {
			while (iterationCount < this.maxIterations) {
				iterationCount++;

				// Attempt to get a response, with retry logic
				const { message } = await this.getAIResponseWithRetries(formattedTools, userInput);

				// If there are no tool calls, we're done
				if (!message.tool_calls || message.tool_calls.length === 0) {
					const responseText = message.content || '';
					// Add assistant message to history
					await this.contextManager.addAssistantMessage(responseText);
					return responseText;
				}

				// Log thinking steps when assistant provides reasoning before tool calls
				if (message.content && message.content.trim()) {
					logger.info(`💭 ${message.content.trim()}`);
				}

				// Add assistant message with tool calls to history
				await this.contextManager.addAssistantMessage(message.content, message.tool_calls);

				// Handle tool calls
				for (const toolCall of message.tool_calls) {
					logger.debug(`Tool call initiated: ${JSON.stringify(toolCall, null, 2)}`);
					logger.info(`🔧 Using tool: ${toolCall.function.name}`);
					const toolName = toolCall.function.name;
					let args: any = {};

					try {
						args = JSON.parse(toolCall.function.arguments);
					} catch (e) {
						logger.error(`Error parsing arguments for ${toolName}:`, e);
						await this.contextManager.addToolResult(toolCall.id, toolName, {
							error: `Failed to parse arguments: ${e}`,
						});
						continue;
					}

					// Execute tool
					try {
						let result: any;
						if (this.unifiedToolManager) {
							result = await this.unifiedToolManager.executeTool(toolName, args);
						} else {
							result = await this.mcpManager.executeTool(toolName, args);
						}

						// Display formatted tool result
						const formattedResult = formatToolResult(toolName, result);
						logger.info(`📋 Tool Result:\n${formattedResult}`);

						// Add tool result to message manager
						await this.contextManager.addToolResult(toolCall.id, toolName, result);
					} catch (error) {
						// Handle tool execution error
						const errorMessage = error instanceof Error ? error.message : String(error);
						logger.error(`Tool execution error for ${toolName}: ${errorMessage}`);

						// Add error as tool result
						await this.contextManager.addToolResult(toolCall.id, toolName, {
							error: errorMessage,
						});
					}
				}
			}

			// If we reached max iterations, return a message
			logger.warn(`Reached maximum iterations (${this.maxIterations}) for task.`);
			const finalResponse = 'Task completed but reached maximum tool call iterations.';
			await this.contextManager.addAssistantMessage(finalResponse);
			return finalResponse;
		} catch (error) {
			// Handle API errors
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error(`Error in OpenAI service API call: ${errorMessage}`, { error });
			await this.contextManager.addAssistantMessage(`Error processing request: ${errorMessage}`);
			return `Error processing request: ${errorMessage}`;
		}
	}

	/**
	 * Direct generate method that bypasses conversation context
	 * Used for internal tool operations that shouldn't pollute conversation history
	 * @param userInput - The input to generate a response for
	 * @param systemPrompt - Optional system prompt to use
	 * @returns Promise<string> - The generated response
	 */
	async directGenerate(userInput: string, systemPrompt?: string): Promise<string> {
		try {
			logger.debug('OpenAIService: Direct generate call (bypassing conversation context)', {
				inputLength: userInput.length,
				hasSystemPrompt: !!systemPrompt,
			});

			// Create a minimal message array for direct API call
			const messages: any[] = [];

			if (systemPrompt) {
				messages.push({
					role: 'system',
					content: systemPrompt,
				});
			}

			messages.push({
				role: 'user',
				content: userInput,
			});

			// Make direct API call without adding to conversation context
			const response = await this.openai.chat.completions.create({
				model: this.model,
				messages: messages,
				// No tools for direct calls - this is for simple text generation
			});

			const responseText = response.choices[0]?.message?.content || '';

			logger.debug('OpenAIService: Direct generate completed', {
				responseLength: responseText.length,
			});

			return responseText;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error('OpenAIService: Direct generate failed', {
				error: errorMessage,
				inputLength: userInput.length,
			});
			throw new Error(`Direct generate failed: ${errorMessage}`);
		}
	}

	async getAllTools(): Promise<ToolSet | CombinedToolSet> {
		if (this.unifiedToolManager) {
			return await this.unifiedToolManager.getAllTools();
		}
		return this.mcpManager.getAllTools();
	}

	getConfig(): LLMServiceConfig {
		return {
			provider: 'openai',
			model: this.model,
		};
	}

	// Helper methods
	private async getAIResponseWithRetries(
		tools: any[],
		userInput: string
	): Promise<{ message: any }> {
		let attempts = 0;
		const MAX_ATTEMPTS = 3;

		// Add a log of the number of tools in response
		logger.debug(`Tools in response: ${tools.length}`);

		while (attempts < MAX_ATTEMPTS) {
			attempts++;
			try {
				// Use the new method that implements proper flow: get system prompt, compress history, format messages
				const formattedMessages = await this.contextManager.getFormattedMessage({
					role: 'user',
					content: userInput,
				});

				// Debug log: Show exactly what messages are being sent to OpenAI
				logger.debug(`Sending ${formattedMessages.length} formatted messages to OpenAI:`, {
					messages: formattedMessages.map((msg, idx) => ({
						index: idx,
						role: msg.role,
						hasContent: !!msg.content,
						hasToolCalls: !!msg.tool_calls,
						toolCallId: msg.tool_call_id,
						name: msg.name,
					})),
				});

				// Call OpenAI API
				const response = await this.openai.chat.completions.create({
					model: this.model,
					messages: formattedMessages,
					tools: attempts === 1 ? tools : [], // Only offer tools on first attempt
					tool_choice: attempts === 1 ? 'auto' : 'none', // Disable tool choice on retry
				});

				logger.silly('OPENAI CHAT COMPLETION RESPONSE: ', JSON.stringify(response, null, 2));

				// Get the response message
				const message = response.choices[0]?.message;
				if (!message) {
					throw new Error('Received empty message from OpenAI API');
				}

				return { message };
			} catch (error) {
				const apiError = error as any;
				logger.error(
					`Error in OpenAI API call (Attempt ${attempts}/${MAX_ATTEMPTS}): ${apiError.message || JSON.stringify(apiError, null, 2)}`,
					{ status: apiError.status, headers: apiError.headers }
				);

				if (apiError.status === 400 && apiError.error?.code === 'context_length_exceeded') {
					logger.warn(
						`Context length exceeded. ContextManager compression might not be sufficient. Error details: ${JSON.stringify(apiError.error)}`
					);
				}

				if (attempts >= MAX_ATTEMPTS) {
					logger.error(`Failed to get response from OpenAI after ${MAX_ATTEMPTS} attempts.`);
					throw error;
				}

				await new Promise(resolve => setTimeout(resolve, 500 * attempts));
			}
		}

		throw new Error('Failed to get response after maximum retry attempts');
	}

	private formatToolsForOpenAI(tools: ToolSet): any[] {
		// Keep the existing implementation
		// Convert the ToolSet object to an array of tools in OpenAI's format
		return Object.entries(tools).map(([name, tool]) => {
			return {
				type: 'function',
				function: {
					name,
					description: tool.description,
					parameters: tool.parameters,
				},
			};
		});
	}
}

```

## 二、LLM 工厂函数的创建
1. 辅助函数的创建：key 和 url 的获取
2. 主函数的创建：创建 LLM 类的方法

### 2.1、URL 和 Key 的获取封装
对于 LLM 类的实例化，最重要的就是两个参数：

+ apiKey： API 密钥
+ baseURL：服务端点 URL

基于此需求，实现两个方法：

+ extractAPIKey 函数：区分需要和不需要 api 密钥的供应商，并且返回 APIKey
+ getOpenAICompatibleBaseURL 函数：处理不同供应商的 URL 配置

```typescript
  function extractApiKey(config: LLMConfig): string {
    const provider = config.provider.toLowerCase();

    // 免API密钥的提供商
    if (provider === 'ollama' || provider === 'lmstudio' ||
        provider === 'aws' || provider === 'azure') {
      return 'not-required';
    }

    let apiKey = config.apiKey || '';
    if (!apiKey) {
      // 详细的错误提示
      const errorMsg = `Error: API key for ${provider} not found`;
      logger.error(errorMsg);
      logger.error(`Please set your ${provider} API key in the config file or .env 
  file`);
      throw new Error(errorMsg);
    }
    return apiKey;
  }

  function getOpenAICompatibleBaseURL(llmConfig: LLMConfig): string {
    // 1. 优先使用配置中的baseURL
    if (llmConfig.baseURL) {
      let baseUrl = llmConfig.baseURL.replace(/\/$/, ''); // 移除末尾斜杠

      // Ollama特殊处理：确保/v1后缀
      const provider = llmConfig.provider.toLowerCase();
      if (provider === 'ollama' && !baseUrl.endsWith('/v1') &&
  !baseUrl.endsWith('/api')) {
        baseUrl = baseUrl + '/v1';
      }
      return baseUrl;
    }

    // 2. 根据提供商返回默认URL
    const provider = llmConfig.provider.toLowerCase();

    if (provider === 'openrouter') {
      return 'https://openrouter.ai/api/v1';
    }

    if (provider === 'ollama') {
      // 环境变量 > 默认值
      let baseUrl = env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
      // 确保v1后缀
      if (!baseUrl.endsWith('/v1') && !baseUrl.endsWith('/api')) {
        baseUrl = baseUrl.replace(/\/$/, '') + '/v1';
      }
      return baseUrl;
    }

    if (provider === 'lmstudio') {
      return env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1';
    }

    // OpenAI的环境变量回退
    if (provider === 'openai' && env.OPENAI_BASE_URL) {
      return env.OPENAI_BASE_URL.replace(/\/$/, '');
    }

    return ''; // 空字符串表示使用SDK默认
  }
```



### 2.2、核心创建方法的实现
根据传入不同的参数，来实例化不同的类

+ 传入 openai，实例化 new OpenAIService()
+ 传入 openrouter，实例化 new OpenRouterService()
+ 传入 ollama，实例化 new OllamaService()
+ 传入 lmstudio，实例化 new LMStudioService()
+ 传入 qwen，实例化 new QwenService()
+ 传入 anthropic，实例化 new AnthropicService()
+ 传入 aws，实例化 new AwsService()
+ 传入 azure，实例化 new AzureService()
+ 传入 gemini，实例化 new GeminiService()



设计核心就是：

+ **如果能使用 OpenAI SDK 就使用这个，可以大幅减少依赖**
+ Anthropic 是专用的 SDK
+ Gemini 也是专用的 SDK



```typescript
function _createLLMService(
	config: LLMConfig,
	mcpManager: MCPManager,
	contextManager: ContextManager,
	unifiedToolManager?: UnifiedToolManager
): ILLMService {
	// Extract and validate API key
	const apiKey = extractApiKey(config);

	switch (config.provider.toLowerCase()) {
		case 'openai': {
			const baseURL = getOpenAICompatibleBaseURL(config);
			// Use require for OpenAI SDK for compatibility
			// @ts-ignore

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
		case 'openrouter': {
			const baseURL = getOpenAICompatibleBaseURL(config);
			// Use require for OpenAI SDK for compatibility
			// @ts-ignore

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
			// Use require for OpenAI SDK for compatibility
			// @ts-ignore

			const OpenAIClass = require('openai');
			const openai = new OpenAIClass({
				apiKey: 'lm-studio', // LM Studio uses "lm-studio" as the API key
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
		case 'anthropic': {
			// Use require for Anthropic SDK for compatibility
			// @ts-ignore

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
		case 'ollama': {
			const baseURL = getOpenAICompatibleBaseURL(config);
			// Use require for OpenAI SDK for compatibility
			// @ts-ignore

			const OpenAIClass = require('openai');
			// Ollama uses OpenAI-compatible API but runs locally
			const openai = new OpenAIClass({
				apiKey: 'not-required', // Ollama doesn't require an API key
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
			// QwenService: OpenAI-compatible endpoint for Alibaba Cloud Qwen
			// Accepts Qwen-specific options via config.qwenOptions
			// Default endpoint: https://dashscope-intl.aliyuncs.com/compatible-mode/v1
			const baseURL = config.baseURL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
			// Use require for OpenAI SDK for compatibility
			// @ts-ignore

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
				...(config.qwenOptions?.top_p !== undefined && { top_p: config.qwenOptions.top_p }),
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
		case 'gemini': {
			logger.debug('Creating Gemini service', { model: config.model, hasApiKey: !!apiKey });
			try {
				return new GeminiService(
					apiKey,
					config.model,
					mcpManager,
					contextManager,
					config.maxIterations,
					unifiedToolManager
				);
			} catch (error) {
				logger.error('Failed to create Gemini service', {
					error: error instanceof Error ? error.message : String(error),
					model: config.model,
				});
				throw error;
			}
		}
		default:
			throw new Error(`Unsupported LLM provider: ${config.provider}`);
	}
}
```

## 三、消息格式化器
![](https://cdn.nlark.com/yuque/0/2025/png/29674456/1757262665033-12c578b7-af03-44f4-8c74-42f3b0a5abd6.png)



1、 统一的内部格式为：

```typescript
interface InternalMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | null | Array<TextSegment | ImageSegment>;  // 支持多模态
    toolCalls?: Array<{...}>;    // 工具调用
    toolCallId?: string;         // 工具结果ID
    name?: string;               // 工具名称
  }
```

里面对于工具部分的定义参数

+ toolCalls：是模型发起工具调用请求的参数，里面有工具名称、参数等信息
+ toolCallId：是工具执行结果的唯一标识符
+ name：被调用的工具名称



2、 供应商特定的格式：

```typescript
  // 1. 工厂函数根据provider选择格式化器
  function getFormatter(provider: string): IMessageFormatter {
    switch (provider.toLowerCase()) {
      case 'openai':
      case 'openrouter':
      case 'ollama':
      case 'lmstudio':
      case 'qwen':
      case 'gemini':
        return new OpenAIMessageFormatter();  // 6个提供商共用

      case 'anthropic':
      case 'aws':
        return new AnthropicMessageFormatter();  // 2个提供商共用

      case 'azure':
        return new AzureMessageFormatter();
    }
  }
```



3、使用示例

```typescript
//1、创建格式化器

const config = { provider: 'openai', model: 'gpt-4' };
const formatter = getFormatter(config.provider);  // OpenAIMessageFormatter
const contextManager = new ContextManager(formatter, ...);

//2、格式化消息

const internalMessage: InternalMessage = {
  role: 'user',
  content: 'Hello, world!'
};

const formatted = formatter.format(internalMessage);
// OpenAI: [{ role: 'user', content: 'Hello, world!' }]
// Anthropic: [{ role: 'user', content: 'Hello, world!' }]

//3、带系统提示的格式化

const formatted = formatter.format(internalMessage, 'You are a helpful assistant');
// OpenAI: [
//   { role: 'system', content: 'You are a helpful assistant' },
//   { role: 'user', content: 'Hello, world!' }
// ]
// Anthropic: [{ role: 'user', content: 'Hello, world!' }] (系统提示单独处理)
```

