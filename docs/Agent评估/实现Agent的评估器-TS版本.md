# 实现Agent的评估器-TS版本

## 一、Agent 评估器核心设计
文件链接：[https://ai.feishu.cn/file/SQpqbUWqdoTnwkxNYmRc2wqQnIg](https://ai.feishu.cn/file/SQpqbUWqdoTnwkxNYmRc2wqQnIg)

![Agent评估器核心设计](./image/image%20(48).png)

在上面这张思维设计图中可以看到，有以下几个关键的模块在 Agent 评估器中

1. 评估测试数据集：我们要准备好“合适的问题”和“标准答案”，当然这个可以是大模型生成的，也可以是人工手动写的，最好是人工的方式，这种数据集评估效果最佳
2. Agent：就是我们要评估的那个 Agent，评估该 Agent 的设计如何?，输出的结果如何?
3. 事件系统：这个是用来收集 Agent 的执行状态使用的
4. 评估函数：根据“测试数据集”和“实际收到的数据”进行判断和计算

<br/>

## 二、评估测试数据集
评估测试数据集的格式类型：

+ id：测试用例的 ID
+ description：测试用例的描述
+ input：用户的输入，准备输入到 Agent 中执行的
+ expected：期望的 Agent 的结果

<br/>

正常的评估器需要评估的是 Agent 两个关键的地方

+ 单 Agent：对于单 Agent 来说，最重要的评估 Agent 是否能挣正确调用工具，所以需要收集工具调用的状态
+ 多 Agent：对于多 Agent 来说，除了子 Agent 调用工具的情况，还有主 Agent 是否能正确协调子 Agent

以此我们可以得到 expected 中的属性值：一个是 Agent 的执行列表、一个是工具调用列表 

```typescript
/**
 * 测试用例定义
 */
export interface TestCase {
  id: string; // 测试用例ID
  description: string; // 用例描述
  input: string; // 用户输入
  expected: ExpectedBehavior; // 期望结果
}

/**
 * 期望行为定义
 */
export interface ExpectedBehavior {
  // 期望调用的子Agent列表
  agents: string[];
  // 每个子Agent期望调用的工具
  tools: {
    [agentName: string]: string[];
  };
}

/**
 * 测试用例
 */
export const TEST_CASES: TestCase[] = [
  // 1. 单工具测试 - 天气查询
  {
    id: 'T1',
    description: '单工具调用 - 天气查询',
    input: '北京今天天气怎么样？',
    expected: {
      agents: ['simple_agent'],
      tools: { simple_agent: ['get_weather'] },
    },
  },

  // 2. 单工具测试 - 翻译
  {
    id: 'T2',
    description: '单工具调用 - 翻译',
    input: '把"你好世界"翻译成英文',
    expected: {
      agents: ['simple_agent'],
      tools: { simple_agent: ['translate'] },
    },
  },
];
```

## 三、事件系统
在简单的 Agent 中，可以不需要事件系统来收集 Agent 的执行情况，可以让 Agent 函数直接返回执行情况

但是如果是多于复杂的 Agent 的设计，例如：大量的工具调用、多智能体的架构设计，在这种情况下，采用事件系统，也就是发布-订阅的方式来收集 Agent 的执行情况就非常有效了

<br/>

对于事件系统的实现，最关键的是定义到事件类型，下面是完整的事件系统实现

::: details 点击展开完整代码
```typescript
/**
 * 事件总线 + 数据收集器（合并版本）
 * 负责事件的发射、监听，以及收集执行过程中的数据
 */
import { EventEmitter } from 'events';
import { CollectedData } from './types.js';

/**
 * 事件类型
 */
export type EventType =
  | 'agent:call' // 子Agent被调用
  | 'tool:call' // 工具被调用
  | 'edit:complete'; // 编辑节点完成

/**
 * 事件数据类型
 */
export interface AgentCallEvent {
  agentName: string;
}

export interface ToolCallEvent {
  agentName: string;
  toolName: string;
}

export interface EditCompleteEvent {
  successCount: number;
  failCount: number;
}

/**
 * 事件总线 - 单例模式
 * 合并了事件发射和数据收集功能
 */
class EventBus {
  private emitter = new EventEmitter();
  private static instance: EventBus;

  // 数据收集（原 Collector 功能）
  private agents: string[] = [];
  private tools: Map<string, string[]> = new Map();
  private editResult: { success: number; fail: number } | null = null;

  constructor() {
    this.setupListeners();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): EventBus {
    if (!this.instance) {
      this.instance = new EventBus();
    }
    return this.instance;
  }

  /**
   * 设置内部事件监听器（用于数据收集）
   */
  private setupListeners() {
    // 监听子Agent调用事件
    this.emitter.on('agent:call', (data: AgentCallEvent) => {
      this.agents.push(data.agentName);
      // 为该Agent初始化工具列表
      if (!this.tools.has(data.agentName)) {
        this.tools.set(data.agentName, []);
      }
    });

    // 监听工具调用事件
    this.emitter.on('tool:call', (data: ToolCallEvent) => {
      const agentTools = this.tools.get(data.agentName);
      if (agentTools) {
        // 去重添加
        if (!agentTools.includes(data.toolName)) {
          agentTools.push(data.toolName);
        }
      } else {
        this.tools.set(data.agentName, [data.toolName]);
      }
    });

    // 监听编辑完成事件
    this.emitter.on('edit:complete', (data: EditCompleteEvent) => {
      this.editResult = {
        success: data.successCount,
        fail: data.failCount,
      };
    });
  }

  /**
   * 发射事件
   */
  emit(event: EventType, data: AgentCallEvent | ToolCallEvent | EditCompleteEvent) {
    this.emitter.emit(event, data);
  }

  /**
   * 监听事件（供外部使用）
   */
  on(event: EventType, handler: (data: any) => void) {
    this.emitter.on(event, handler);
  }

  /**
   * 获取收集到的数据
   */
  getData(): CollectedData {
    return {
      agents: [...new Set(this.agents)], // 去重
      tools: Object.fromEntries(this.tools),
      editResult: this.editResult,
    };
  }

  /**
   * 重置收集器（每次测试前调用）
   */
  reset() {
    this.agents = [];
    this.tools = new Map();
    this.editResult = null;
  }

  /**
   * 重置实例（用于测试）
   */
  static resetInstance() {
    if (this.instance) {
      this.instance.emitter.removeAllListeners();
      this.instance = new EventBus();
    }
  }
}

// 导出单例
export const eventBus = EventBus.getInstance();
```
:::

## 四、Agent 的执行情况收集
在 Agent 中，我们使用事件系统来收集 Agent 的执行情况，在需要收集的地方，使用 `emit`来触发相应的事件函数

::: details 点击展开完整代码
```typescript
/**
 * 简单Agent实现
 * 使用OpenAI SDK调用DeepSeek，包含工具定义、执行函数和调用循环
 * 通过事件系统收集执行数据
 */
import OpenAI from 'openai';
import { DeepSeekBaseURL } from '../../constant/modelConstant.js';
import { eventBus } from './EventBus.js';

// 初始化OpenAI客户端（指向DeepSeek）
const client = new OpenAI({
  apiKey: process.env.deepseekAPI,
  baseURL: DeepSeekBaseURL,
});


const tools: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: '获取指定城市的天气信息',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: '城市名称' },
        },
        required: ['city'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'translate',
      description: '将文本翻译成指定语言',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: '要翻译的文本' },
          targetLang: { type: 'string', description: '目标语言，如 english、chinese、japanese' },
        },
        required: ['text', 'targetLang'],
      },
    },
  },
];

function executeTool(name: string, args: Record<string, any>): string {
  switch (name) {
    case 'get_weather':
      return JSON.stringify({
        city: args.city,
        temperature: '25°C',
        weather: '晴',
        humidity: '60%',
      });

    case 'translate':
      return JSON.stringify({
        original: args.text,
        translated: `[${args.targetLang}] ${args.text}`,
        targetLang: args.targetLang,
      });
    default:
      return JSON.stringify({ error: `未知工具: ${name}` });
  }
}

type Message = OpenAI.ChatCompletionMessageParam;

// ============ Agent主函数 ============

export interface AgentResult {
  agents: string[];
  tools: Record<string, string[]>;
  finalResponse: string;
}

const AGENT_NAME = 'simple_agent';
const MAX_ITERATIONS = 10;

export async function simpleAgent(userInput: string): Promise<AgentResult> {
  // 发射Agent调用事件
  eventBus.emit('agent:call', { agentName: AGENT_NAME });

  // 初始化消息
  const messages: Message[] = [
    { role: 'system', content: '你是一个有用的助手，可以使用工具来帮助用户完成任务。' },
    { role: 'user', content: userInput },
  ];

  let iterations = 0;
  let finalResponse = '';

  // 工具调用循环
  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages,
      tools,
      tool_choice: 'auto',
    });

    const assistantMessage = response.choices[0].message;

    // 添加助手消息到历史
    messages.push(assistantMessage);

    // 如果没有工具调用，结束循环
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      finalResponse = assistantMessage.content || '';
      break;
    }

    // 执行所有工具调用
    for (const toolCall of assistantMessage.tool_calls) {
      const toolName = toolCall.function.name;
      const toolArgs = JSON.parse(toolCall.function.arguments);

      // 发射工具调用事件
      eventBus.emit('tool:call', { agentName: AGENT_NAME, toolName });

      // 执行工具
      const toolResult = executeTool(toolName, toolArgs);

      // 添加工具结果到消息
      messages.push({
        role: 'tool',
        content: toolResult,
        tool_call_id: toolCall.id,
      });
    }
  }

  // 从事件系统获取收集的数据
  const collected = eventBus.getData();

  return {
    agents: collected.agents,
    tools: collected.tools,
    finalResponse,
  };
}

```
:::



## 五、评估函数
评估函数就是根据事件系统收集到的实际的 Agent 执行数据，参考测试数据集中的“标准输入”和“标准输出”进行计算和判断

简单的一些的评估函数如下，只是做了一层简单的判断

::: details 点击展开完整代码
```typescript
/**
 * 评估函数 - 简化版本
 * 比较期望行为和实际执行数据
 */
import { TestCase, CollectedData, EvaluateResult } from './types.js';

/**
 * 评估函数
 * @param testCase 测试用例
 * @param actual 实际收集到的数据
 * @returns 评估结果
 */
export function evaluate(testCase: TestCase, actual: CollectedData): EvaluateResult {
  const expected = testCase.expected;

  // 1. 评估Agent调用
  const missedAgents = expected.agents.filter((a) => !actual.agents.includes(a));
  const extraAgents = actual.agents.filter((a) => !expected.agents.includes(a));
  const agentMatch = missedAgents.length === 0 && extraAgents.length === 0;

  // 2. 评估工具调用
  const missedTools: { agent: string; tool: string }[] = [];
  const extraTools: { agent: string; tool: string }[] = [];

  // 检查遗漏的工具
  for (const [agent, tools] of Object.entries(expected.tools)) {
    const actualTools = actual.tools[agent] || [];
    for (const tool of tools) {
      if (!actualTools.includes(tool)) {
        missedTools.push({ agent, tool });
      }
    }
  }

  // 检查多余的工具
  for (const [agent, tools] of Object.entries(actual.tools)) {
    const expectedTools = expected.tools[agent] || [];
    for (const tool of tools) {
      if (!expectedTools.includes(tool)) {
        extraTools.push({ agent, tool });
      }
    }
  }

  const toolMatch = missedTools.length === 0 && extraTools.length === 0;

  // 3. 综合判断
  const passed = agentMatch && toolMatch;

  return {
    passed,
    agentMatch,
    toolMatch,
    details: {
      agents: {
        expected: expected.agents,
        actual: actual.agents,
        missed: missedAgents,
        extra: extraAgents,
      },
      tools: {
        expected: expected.tools,
        actual: actual.tools,
        missed: missedTools,
        extra: extraTools,
      },
    },
  };
}

/**
 * 格式化评估结果为可读字符串
 */
export function formatResult(result: EvaluateResult): string {
  let output = '';

  // Agent评估
  if (result.agentMatch) {
    output += `✅ Agent调用正确\n`;
  } else {
    output += `❌ Agent调用错误\n`;
    output += `   期望: ${result.details.agents.expected.join(', ') || '无'}\n`;
    output += `   实际: ${result.details.agents.actual.join(', ') || '无'}\n`;
    if (result.details.agents.missed.length > 0) {
      output += `   遗漏: ${result.details.agents.missed.join(', ')}\n`;
    }
    if (result.details.agents.extra.length > 0) {
      output += `   多余: ${result.details.agents.extra.join(', ')}\n`;
    }
  }

  // 工具评估
  if (result.toolMatch) {
    output += `✅ 工具调用正确\n`;
  } else {
    output += `❌ 工具调用错误\n`;
    if (result.details.tools.missed.length > 0) {
      const missed = result.details.tools.missed.map((t) => `${t.agent}.${t.tool}`).join(', ');
      output += `   遗漏: ${missed}\n`;
    }
    if (result.details.tools.extra.length > 0) {
      const extra = result.details.tools.extra.map((t) => `${t.agent}.${t.tool}`).join(', ');
      output += `   多余: ${extra}\n`;
    }
  }

  return output;
}


```
:::



## 六、完整的代码文件链接：
[https://ai.feishu.cn/drive/folder/HLAWfyjKLlWkJedR5Yycm4ZhnLe](https://ai.feishu.cn/drive/folder/HLAWfyjKLlWkJedR5Yycm4ZhnLe)

