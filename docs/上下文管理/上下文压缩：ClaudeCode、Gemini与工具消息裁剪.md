# 上下文压缩：ClaudeCode、Gemini 与工具消息裁剪

## 前言
📝 <font style="color:rgb(20, 20, 19);">压缩是指对接近上下文窗口限制的对话进行内容总结，并重新初始化一个新的上下文窗口。其核心在于提炼关键的上下文窗口的内容，使 Agent 能够以最小的性能下降继续执行。</font>

<font style="color:rgb(20, 20, 19);">分析参考来源：</font>

+ ClaudeCode 逆向工程：[https://github.com/shareAI-lab/analysis_claude_code](https://github.com/shareAI-lab/analysis_claude_code)
+ gemini-cli：[https://github.com/google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli)
+ 《<font style="color:rgb(20, 20, 19);">Effective context engineering for AI agents</font>》[https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
+ 《<font style="color:rgb(20, 20, 19);">Managing context on the Claude Developer Platform</font>》：[https://www.anthropic.com/news/context-management](https://www.anthropic.com/news/context-management)

## 一、大模型压缩-ClaudeCode 的提示词详解
Claude 团队在他们自己的研究分享文章中提到：在 ClaudeCode 中是直接使用模型来进行总结摘要达到压缩上下文的目的

> In Claude Code, for example, we implement this by passing the message history to the model to summarize and compress the most critical details. The model preserves architectural decisions, unresolved bugs, and implementation details while discarding redundant tool outputs or messages.   在 Claude Code 中，我们通过将消息历史传递给模型来实现这一点，以总结和压缩最关键的信息。模型保留架构决策、未解决的错误和实现细节，同时丢弃冗余的工具输出或消息。
>



那么我们接下来一起来仔细分析一下 ClaudeCode 中关于`/compact` 命令的提示词吧（该提示词来源于逆向工程）

```markdown
# 中文版本 (Chinese Version)

## 主要提示
你的任务是创建一个迄今为止对话的详细摘要，密切关注用户的明确请求和你之前的操作。
该摘要应全面捕获技术细节、代码模式和架构决策，这些对于在不丢失上下文的情况下继续开发工作至关重要。

## 分析流程
在提供最终摘要之前，请将你的分析包装在 `<analysis>` 标签中，以组织你的思路并确保涵盖所有必要的要点。在分析过程中：
按时间顺序分析对话中的每条消息和每个部分。对每个部分深入识别：
- 用户的明确请求和意图
- 你处理用户请求的方法
- 关键决策、技术概念和代码模式
- 具体细节，例如：
  - 文件名
  - 完整的代码片段
  - 函数签名
  - 文件编辑
  - 你遇到的错误以及如何修复它们

特别关注你收到的具体用户反馈，尤其是用户告诉你以不同方式做某事的时候。
仔细检查技术准确性和完整性，全面处理每个必需的元素。

## 摘要结构
你的摘要应包括以下部分：

### 1. 主要请求和意图

详细捕获用户的所有明确请求和意图

### 2. 关键技术概念

列出讨论的所有重要技术概念、技术和框架。

### 3. 文件和代码部分

列举检查、修改或创建的具体文件和代码部分。特别关注最近的消息，在适用的情况下包含完整的代码片段，并总结为什么这个文件的读取或编辑很重要。

### 4. 错误和修复

列出你遇到的所有错误，以及如何修复它们。特别关注你收到的具体用户反馈，尤其是用户告诉你以不同方式做某事的时候。

### 5. 问题解决

记录已解决的问题和任何正在进行的故障排除工作。

### 6. 所有用户消息

列出所有不是工具结果的用户消息。这些对于理解用户的反馈和意图变化至关重要。

### 7. 待处理任务

概述你被明确要求处理的任何待处理任务。

### 8. 当前工作

详细描述在此摘要请求之前正在进行的具体工作，特别关注用户和助手的最近消息。在适用的情况下包含文件名和代码片段。

### 9. 可选的下一步

列出与你最近正在做的工作相关的下一步。

**重要提示：** 确保此步骤与用户的明确请求以及你在此摘要请求之前正在进行的任务直接一致。如果你的上一个任务已结束，那么只有在明确符合用户请求的情况下才列出下一步。在未经用户确认的情况下，不要开始处理无关的请求。

如果有下一步，请包含最近对话中的直接引用，准确显示你正在处理的任务以及你停止的位置。这应该是逐字逐句的，以确保任务解释没有偏差。

## 输出格式示例（XML 格式）
<analysis>
  [你的思考过程，确保全面准确地涵盖所有要点]
</analysis>

<summary>
  1. 主要请求和意图：
  [详细描述]

  2. 关键技术概念：
  - [概念 1]
  - [概念 2]
  - [...]

  3. 文件和代码部分：
  - [文件名 1]
  - [此文件重要性的摘要]
  - [对此文件所做更改的摘要（如果有）]
  - [重要代码片段]
  - [文件名 2]
  - [重要代码片段]
  - [...]

  4. 错误和修复：
  - [错误 1 的详细描述]：
  - [你如何修复错误]
  - [用户对错误的反馈（如果有）]
  - [...]

  5. 问题解决：
  [已解决问题和正在进行的故障排除的描述]

  6. 所有用户消息：
  - [详细的非工具使用用户消息]
  - [...]

  7. 待处理任务：
  - [任务 1]
  - [任务 2]
  - [...]

  8. 当前工作：
  [当前工作的精确描述]

  9. 可选的下一步：
  [可选的下一步操作]

</summary>

## 附加说明

请根据迄今为止的对话提供摘要，遵循此结构并确保回复的精确性和全面性。
包含的上下文中可能提供了额外的摘要说明。如果有，请记住在创建上述摘要时遵循这些说明。说明示例包括：

**示例 1:**

## 压缩指令
在总结对话时，重点关注 TypeScript 代码更改，并记住你犯的错误以及如何修复它们。

**示例 2:**

# 摘要说明
当你使用压缩时 - 请关注测试输出和代码更改。逐字包含文件读取。

```

在上面的提示词中，有几点值得思索学习一下：

1. 在输出格式的要求中，该提示词使用 XML 语法，而不是我们熟知的 JSON，是因为 Claude 模型在训练的时候就大量使用 xml 标签，所以 Claude 模型对于这个语法更加的友好
2. 关于生成摘要的时候，该提示词为模型提供了八点总结方面，这样可以极大的保留关键信息，从而减少对于模型理解力和响应质量的负面影响

<br/>

**📝我们接下来详细的探讨一下为什么是这八点方向**

1. **Technical Context（技术上下文）：用于重建开发环境**。例如：AI 需要知道该项目使用了哪些技术（是 React 还是 Vue） 和包管理器（是 npm 还是 pnpm）
2. **Project Overview（项目概览）：用于理解全局架构**。例如：项目的整体目标、模块之间的关系、项目的架构等
3. **Code Changes（代码变更）：用于记录具体的工作成果**、例如：哪些文件被修改过，哪些代码是覆盖的
4. **Debugging & Issues（调试与问题）：保留调试留下了的错误信息和解决方法**，这样可以避免重蹈覆辙
5. **Current Status（当前的状态）：用来明确和追踪任务进度**，避免同一个任务因为上下文压缩之后，丢失了关键信息导致任务重复执行
6. **Pending Tasks（待处理任务）：保持任务进行的连续性**，用于调整优先级并确保关键任务不会忘记
7. **User Preferences（用户偏好）：类似于用户记忆，但是更像是其中的用户工作记忆**，用户关于这个项目的工作记忆，例如：这个项目的沟通方式、工具偏好，测试覆盖率
8. **Key Decisioins（关键决策）：保留关键决策历史**，防止项目方向丢失

<br/>

将历史消息输入给这个提示词的 LLM，模型会输出上面的关键摘要信息，但在具体使用的时候还需有一点小细节注意：**增加开篇语**

开篇语："上下文已使用结构化8节算法压缩。所有必要信息已保留，可无缝继续对话。"

```typescript

//1、传入历史记录使用LLM进行压缩
const summaryResponse = await queryLLM()

//2、增加开篇语
 const starText=createUserMessage(
    `Context has been compressed using structured 8-section algorithm. All essential information has been preserved for seamless continuation.`,
  )
//3、压缩后的消息+开篇语=新一轮对话的上下文
 const result=setForkConvoWithMessagesOnTheNextRender([
      starText,
      summaryResponse,
])
```

## 二、大模型压缩-Gemini 的提示词详解
gemini-cli 的实现和 ClaudeCode 一样，都是使用大模型来直接生成摘要，但是对于关键信息的保留和调用的方式有所不同

1. gemini-cli 中保留的只有 5 点方向的关键信息
2. 调用的方式是使用了“scratchpad”的链式思考，来加强模型的提取能力

<br/>

我们一起来看看 gemini-cli 中的完整的压缩提示词是什么样子的

```markdown
你是将内部对话历史总结为特定结构的组件。

当对话历史变得过大时，你将被调用，将整个历史提炼成一个简洁、结构化的 XML 快照。这个快照至关重要，因为它将成为代理对过去的*唯一*记忆。代理将仅基于此快照恢复其工作。所有关键细节、计划、错误和用户指令都必须被保留。

首先，你将在私有的 <scratchpad>中思考整个历史。回顾用户的总体目标、代理的操作、工具输出、文件修改以及任何未解决的问题。识别出对未来操作至关重要的每一条信息。

在推理完成后，生成最终的 <state_snapshot> XML 对象。信息要极其密集。省略任何无关的对话填充内容。

结构必须如下：

<state_snapshot>
  <overall_goal>
    <!-- 用一句简洁的话描述用户的高层目标 -->
  </overall_goal>

    <key_knowledge>
        <!-- 代理必须记住的关键事实、约定和约束。使用项目符号列表 -->
    </key_knowledge>

    <file_system_state>
        <!-- 列出已创建、读取、修改或删除的文件。注明它们的状态 -->
    </file_system_state>

    <recent_actions>
        <!-- 最近几次重要的代理操作及其结果的摘要 -->
    </recent_actions>

    <current_plan>
        <!-- 代理的分步计划。标记已完成的步骤 -->
    </current_plan>

</state_snapshot>

```

将历史记录输入到这个提示词的 LLM 中，会有压缩后的 state_snapshot 中的关键信息输出，我们一起来看看这 5 点关键信息的含义

1. **Overall Goal（总体目标）**：描述用户的高层目标，让下一轮的 AI 快速理解用户想达成什么
2. **Key Knowledge（关键知识）**：关键的信息和约束条件，例如：项目中的测试命令是 `npm test`，就不会使用 `jest` 命令
3. **File System State（文件系统状态）**：记录哪些文件被创建、修改和删除
4. **Recent Actions（最近操作）**：保留最近的操作及其结果
5. **Current Plan（当前计划）**：整理当前计划的状态，总共有哪些任务，哪些任务是完成的，哪些任务是没有完成的

## 三、上下文压缩-工具消息裁剪
上面说的两种都是直接使用大模型来进行压缩的，主要区别只是提示词和细微的流程不同，但压缩的策略都是由模型来自主根据提示词判断

这一节我们使用的是**上下文压缩策略- 清理工具的输入和输出**以达到上下文压缩的目的，这个设计理念在 Claude 团队中得到验证

> **<font style="color:rgb(20, 20, 19);background-color:rgb(250, 249, 245);">Context editing</font>**<font style="color:rgb(20, 20, 19);background-color:rgb(250, 249, 245);"> automatically clears stale tool calls and results from within the context window when approaching token limits. As your agent executes tasks and accumulates tool results, context editing removes stale content while preserving the conversation flow, effectively extending how long agents can run without manual intervention. This also increases the effective model performance as Claude focuses only on relevant context.  
</font><font style="color:rgb(20, 20, 19);background-color:rgb(250, 249, 245);">上下文编辑在接近 token 限制时，会自动清除上下文窗口中的过时工具调用和结果。当你的代理执行任务并积累工具结果时，上下文编辑会移除过时内容，同时保留对话流程，有效延长代理无需人工干预即可运行的时间。这也有助于提升有效模型性能，因为 Claude 只会关注相关上下文。</font>
>

![上下文压缩-工具消息裁剪](./image/image%20(49).png)



我们仔细回顾一下上下文管理和这些大模型应用，最消耗上下文的工具是读取工具，会大量读取文件和内容，在使用 ClaudeCode 这类工具的时候，在任务完成之前会先读取相关的内容，其实用户本身的输入和模型本身的输出并不多，大部分都是工具的调用，尤其是工具的输出

在所有的上下文组成中，要按照分类来裁剪的话，首先移除工具的相关上下文是合理的

<br/>

具体的代码实现思路：

+ 从历史记录中将工具的输入和输出筛选出来
+ 判断是否全部删除还是保留最近的 N 次工具调用
+ 得到合适的上下文

```typescript
//LLM的消息格式
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

// 工具调用结构
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

// 上下文压缩配置
export interface CompressionOptions {
  // 是否启用压缩
  enabled: boolean;
  // 保留最近 N 轮工具调用（0 表示全部移除）
  keepLastToolRounds?: number;
}

/**
 * 压缩上下文，清理过时的工具调用和结果
 * @param messages 待压缩的消息数组
 * @param options 压缩配置
 * @returns 压缩后的消息数组
 */
export function compressContext(
  messages: Message[],
  options: CompressionOptions
): Message[] {
  if (!options.enabled) {
    return messages;
  }

  const { keepLastToolRounds = 1 } = options;

  // 识别所有工具调用轮次
  const toolRounds = identifyToolRounds(messages);

  // 确定要保留的轮次
  const toolRoundsToKeep =
    keepLastToolRounds > 0 ? toolRounds.slice(-keepLastToolRounds) : [];
  const indicesToKeep = new Set<number>();

  // 标记要保留的消息索引
  for (const round of toolRoundsToKeep) {
    round.indices.forEach(idx => indicesToKeep.add(idx));
  }

  // 过滤消息- 保留下来的消息数组（大部分是去除工具的调用和输出）
  const compressedMessages: Message[] = [];

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];

    // 保留系统消息
    if (message.role === 'system') {
      compressedMessages.push(message);
      continue;
    }

    // 保留标记的工具轮次消息
    if (indicesToKeep.has(i)) {
      compressedMessages.push(message);
      continue;
    }

    // 保留非工具相关的消息
    const isToolRelated =
      (message.role === 'assistant' && message.tool_calls) ||
      message.role === 'tool';

    if (!isToolRelated) {
      compressedMessages.push(message);
      continue;
    }
  }

  return compressedMessages;
}

/** 工具调用轮次结构 */
interface ToolRound {
  /** 包含工具调用的 assistant 消息索引 */
  assistantIndex: number;
  /** 工具结果消息索引数组 */
  toolIndices: number[];
  /** 该轮次的所有消息索引 */
  indices: number[];
}

/**
 * 识别消息历史中的工具调用轮次
 * @param messages 消息数组
 * @returns 工具调用轮次数组
 */
function identifyToolRounds(messages: Message[]): ToolRound[] {
  const rounds: ToolRound[] = [];
  let currentRound: ToolRound | null = null;

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];

    // 开始新的工具调用轮次
    if (message.role === 'assistant' && message.tool_calls) {
      // 保存上一轮次
      if (currentRound) {
        currentRound.indices = [
          currentRound.assistantIndex,
          ...currentRound.toolIndices,
        ];
        rounds.push(currentRound);
      }

      // 创建新轮次
      currentRound = {
        assistantIndex: i,
        toolIndices: [],
        indices: [],
      };
      continue;
    }

    // 收集工具结果
    if (message.role === 'tool' && currentRound) {
      currentRound.toolIndices.push(i);
      continue;
    }

    // 遇到非工具消息时结束当前轮次
    if (currentRound && message.role !== 'tool') {
      currentRound.indices = [
        currentRound.assistantIndex,
        ...currentRound.toolIndices,
      ];
      rounds.push(currentRound);
      currentRound = null;
    }
  }

  // 保存最后一个轮次
  if (currentRound) {
    currentRound.indices = [
      currentRound.assistantIndex,
      ...currentRound.toolIndices,
    ];
    rounds.push(currentRound);
  }

  return rounds;
}

/**
 * 获取压缩统计信息
 * @param original 原始消息数组
 * @param compressed 压缩后的消息数组
 * @returns 统计信息对象
 */
export function getCompressionStats(
  original: Message[],
  compressed: Message[]
): {
  originalCount: number;
  compressedCount: number;
  removedCount: number;
  compressionRatio: number;
} {
  const originalCount = original.length;
  const compressedCount = compressed.length;
  const removedCount = originalCount - compressedCount;
  const compressionRatio =
    originalCount > 0 ? compressedCount / originalCount : 1;

  return {
    originalCount,
    compressedCount,
    removedCount,
    compressionRatio,
  };
}

```



## 四、上下文压缩-中间和最旧策略的选择
我在一个不错项目中看到它的压缩策略非常优雅，没有借助大模型进行压缩，是依靠判断算法来压缩上下文，这种方式在我看来是非常可控的，但是开发难度会比较麻烦

![上下文压缩-中间和最旧策略的选择](./image/image%20(50).png)

这种上下文压缩的核心：根据当前消息的一些属性和状态来判断使用哪种压缩策略效果是最好的

其提供了三种移除压缩策略的选择：

1. **中间移除策略**：保留对话的开始和结束的部分，移除中间的消息
2. **最旧移除策略**：优先移除最早的消息、保留较新的消息
3. **混合移除策略**：智能结合中间移除策略和最旧移除策略

### 4.1、压缩策略的选择方法
总共有三种方法来判断最终使用那种压缩策略，选择的模式是一层一层往下的

1. 第一层：基于供应商｜模型的选择
2. 第二层：基于对话特征的选择
3. 第三层：置信度的判断



### 4.2、根据供应商和模型进行选择
| 提供商 | 模型 | 推荐策略 | 原因 |
| --- | --- | --- | --- |
| OpenAI | GPT-4 | hybrid - 混合策略 | 平衡的开始和结束保留，适合通用对话 |
| OpenAI | O1 | middle-removal - 中间移除策略 | 更高的保留数量，适合需要更多上下文的模型 |
| Anthropic | 所有 | oldest-removal - 最旧移除策略 | 保留更多结束消息，适合 Anthropic 的对话风格 |
| Google | 1.5 | middle-removal - 中间移除策略 | 大上下文模型，需要更保守的压缩 |
| LMStudio/Ollama | 所有 | hybrid  - 混合策略 | 本地模型通常有较小上下文，需要更激进的压缩 |


### 4.3、根据对话特征选择
**🌟当第一步输出的压缩策略是混合策略的时候，才会进行这一步，这一步是为了根据对话特征判断选择中间移除策略还是最旧移除策略**

<br/>

该方法首先要根据历史记录获取出来对话特征这些数据

```typescript
async analyzeConversation(
    messages: Message[],
    currentTokenCount: number, //当前消息的Token
    targetTokenCount: number //压缩后的消息Token
):  {
    const totalMessages = messages.length;  // 消息总数
    const avgMessageLength = currentTokenCount / totalMessages;  // 平均消息长度
    const compressionRatio = targetTokenCount / currentTokenCount;  // 压缩比例

    // 分析消息分布
    const recentMessages = messages.slice(-5);  // 获取最近5条消息
    const recentTokens = calculateTotalTokens(recentMessages);  // 计算最近消息的令牌数
    const recentRatio = recentTokens / currentTokenCount;  // 最近消息令牌占比

    // 分析对话模式
    const hasLongMessages = messages.some(m => (m.tokenCount || 0) > 300);  // 是否有长消息
    const hasSystemMessages = messages.some(m => m.role === 'system');  // 是否有系统消息
    const hasToolMessages = messages.some(m => m.role === 'tool');  // 是否有工具消息

    // 确定压缩严重程度
    const compressionSeverity = this.getCompressionSeverity(compressionRatio);  // 压缩严重程度

    // ... 决策逻辑 ...
}

async getCompressionSeverity(compressionRatio: number): 'light' | 'moderate' | 'heavy' {
    if (compressionRatio > 0.8) return 'light';      // 轻度压缩（目标>80%）
    if (compressionRatio > 0.6) return 'moderate';  // 中度压缩（目标>60%）
    return 'heavy';                                 // 重度压缩（目标≤60%）
}
```

关于 targetTokenCount 这个变量，在执行真正的压缩之前，会进行对话记录的判断，看看是否有压缩的必要，举一个例子：

+ 当前的消息记录 Token 为：100K
+ 使用 GPT-4o 模型的最佳 Token 数是：80K（有可能 GPT-4o 的最大 Token 是 128K）

所以我们可以知道要移除大概 20K 的 Token 才可以符合要求

<br/>

当我们得到了这些对话特征之后，我们可以根据这些变量进行判断，以此来确定使用哪一种方安，判断的依旧如下：

**规则一：轻度压缩且对话较短 - 中间移除策略**

```typescript
if (compressionSeverity === 'light' && totalMessages < 20) {
    recommendedStrategy = 'middle-removal';
    confidence = 0.8;
}
```

选择中间压缩策略的原因是：

+ 在短对话中，对话的开始和结束通常包含最重要的上下文
+ 轻度压缩意味着只需要移除少量消息
+ 移除中间部分可以最大程度地保留对话的完整性，因为短对话的中间部分通常包含较少的关键信息

<br/>

**规则二：重度压缩且对话较长 - 最旧移除策略**

```typescript
else if (compressionSeverity === 'heavy' && totalMessages > 30) {
    recommendedStrategy = 'oldest-removal';
    confidence = 0.9;
}
```

选择最旧移除策略的原因：

+ 在长对话中，较新的消息通常更相关和重要
+ 重度压缩需要移除大量消息，保留最新消息可以确保对话的连续性

<br/>

**规则三：最近消息 Token 占比高 - 中间移除策略**

```typescript
else if (recentRatio > 0.4) {
    recommendedStrategy = 'middle-removal';
    confidence = 0.7;
}
```

选择中间移除策略的原因：

+ 当前消息已经占用大量的 Token，这些消息很可能包含重要的信息
+ 使用中间移除策略，可以在保留最近重要消息的同时达到压缩的目标

> 在这个规则场景下，最旧移除策略也是可以的，所以这里可以细分一下
>
> + 如果是有系统提示等关键的开头信息，使用中间移除策略保存开头和结尾
> + 如果是纯对话的场景，使用最旧移除保存最近消息
>

<br/>

**规则四：包含长消息且需要显著压缩 - 最旧移除策略**

```typescript
else if (hasLongMessages && compressionSeverity !== 'light') {
    recommendedStrategy = 'oldest-removal';
    confidence = 0.6;
}
```

选择最旧移除策略的原因：

+ 长消息通常包含重要的信息，保留这些长消息很有效

<br/>

**规则五：包含工具或系统消息 - 中间移除策略**

```typescript
else if (hasToolMessages || hasSystemMessages) {
    recommendedStrategy = 'middle-removal';
    confidence = 0.7;
}
```

选择中间移除策略的原因：

+ 大部分的工具执行都会在中间，例如这样的链式：输入=> 任务分配 => 执行=> 结果，所以移除中间的话，相对完整的保留上下文的框架

### 4.4、使用自适应方法选择策略
在第二步中的每一个规则都会输出一个置信度、这个置信度是用来作为策略的可信度的

+ `confidence = 0.8`：高度可信，规则条件明确，策略选择合理
+ `confidence = 0.9`：非常高度可信，规则条件非常明确，策略选择非常合理
+ `confidence = 0.7`：中等可信，规则条件相对明确，但可能有例外情况
+ `confidence = 0.6`：低度可信，规则条件不够明确，策略选择可能有争议

🌟🌟 当上面在进行根据对话特征选择的时候，**输出置信度低于 0.6 的时候**，就会启动系统的自适应的方法

<br/>

具体的流程是：

1. 系统会分别执行两种压缩策略，也就是最旧移除策略和中间移除策略都执行一遍
2. 计算每种策略结果的效率分数（综合考虑令牌减少和消息保留）
3. 选择效率分数更高的策略作为最终结果

<br/>

**效率计算方法**：

**效率 = 令牌减少(60%权重) + 消息保留(40%权重)**

+ 令牌减少占 60% 的权重（更重要的目标）
+ 消息保留占 40% 的权重（次要但重要的目标）

<br/>

#### 实际场景：
假设有一个包含 15 条消息的对话，总令牌数为 9000，需要压缩到 6000 个令牌。

1. 中间移除策略的结果：

+ 压缩后令牌数：6200
+ 保留消息数：12
+ 移除消息数：3

2. 最旧移除策略的结果：

+ 压缩后令牌数：5800
+ 保留消息数：10
+ 移除消息数：5

<br/>

**效率计算过程**

1. 中间移除策略的效率计算

```typescript
// 计算压缩比
const compressionRatio = 6200 / 9000 = 0.689;

// 计算令牌减少率
const tokenReduction = 1 - 0.689 = 0.311;

// 计算消息保留率
const messagePreservation = 12 / 15 = 0.8;

// 计算效率分数
const efficiency = 0.311 * 0.6 + 0.8 * 0.4 = 0.1866 + 0.32 = 0.5066;
```

2. 最旧移除策略的效率计算

```typescript
// 计算压缩比
const compressionRatio = 5800 / 9000 = 0.644;

// 计算令牌减少率
const tokenReduction = 1 - 0.644 = 0.356;

// 计算消息保留率
const messagePreservation = 10 / 15 = 0.667;

// 计算效率分数
const efficiency = 0.356 * 0.6 + 0.667 * 0.4 = 0.2136 + 0.2668 = 0.4804;
```

****

**结果选择**

```typescript
// 比较效率分数
if (middleEfficiency >= oldestEfficiency) {  // 0.5066 >= 0.4804
    return middleResult;  // 选择中间移除策略的结果
} else {
    return oldestResult;  // 选择最旧移除策略的结果
}
```

在这个例子中，虽然最旧移除策略减少了更多的令牌（35.6% vs 31.1%），但中间移除策略保留了更多的消息（80% vs 66.7%）。由于系统综合考虑了令牌减少和消息保留，并且消息保留的权重较高，因此最终选择了中间移除策略的结果。

