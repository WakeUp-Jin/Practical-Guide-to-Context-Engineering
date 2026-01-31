# Anthropic 黑客马拉松冠军- ClaudeCode配置整理和补充

## 前言
分析参考来源：
- 黑客马拉松冠军 Claude Code 配置合集：https://github.com/affaan-m/everything-claude-code
- Anthropic官方Skill配置说明：https://github.com/anthropics/skills
- ClaudeCode配置文件：https://code.claude.com/docs/en/sub-agents

## 一、跨会话共享内存
文件链接：https://my.feishu.cn/file/JBMBbeZXVofxEyx5sS3caNopntg

![跨会话共享内存](./image/image%20(64).png)

在使用 ClaudeCode 的过程中，会话记录虽然可以被保存到本地文件中，也可以使用 resume 指令继续上一次对话，但是完整会话记录会被压缩，如果经过多次压缩，关键的决策信息会被不断的稀释，直到完全忘记，那么我理解的关键信息就是如下四点：

1. **哪些方法是有效的（有证据可以验证）**
2. **哪些尝试过的方法是无效的**
3. **哪些方法尚未尝试**
4. **哪些未完成的工作**



🪐所以为了保证上面四点关键的信息能够在多个会话共享，就需要有一个**单独的中间态的临时会话文件**

这个时候是需要完整的**文件创建和保存的自动化流程，还有填充内容的指令**，可以采用三种 hook 来解决这个文件的创建、加载、保存的问题，

1. 预压缩钩子（**PreCompact Hook）**：在上下文压缩发生之前，将重要状态保存至文件
2. 会话完成钩子（**SessionComplete Hook）**：会话结束时，将学习成果持久化至文件或初始化文件
3. 会话开始钩子（**SessionStart Hook）**：新会话启动时，自动加载先前上下文，并输出最新文件的路径



那么这个临时文件（会话记录文件）我们要填充什么内容进去？，怎么填充？

- 填充的内容：可以根据上面四点信息方向来让 Claude 总结会话历史、你也可以手动编写该文件，整理写入你认为重要的会话关键信息
- 填充的方式：你可以在聊天会话中主动提及，也可以创建相应的 Skill 和 Command 来使用



🌴 这个模式下使用到的文件 hook 为：

+ scripts/hooks/session-start.js：会话开始钩子
+ scripts/hooks/pre-compact.js：会话压缩钩子
+ scripts/hooks/session-end.js：会话完成钩子

## 二、持续学习并更新记忆
文件链接：https://my.feishu.cn/file/POoGb5SQtov2uex2hvocXAEjn0d
![持续学习流程](./image/image%20(65).png)

关于持续学习并更新记忆的触发方式有两种：**一种是 Hook 的挂载脚本自动执行的方式、另外一种是 Command 命令手动执行的方式**



🧩关于 Hook 的挂载脚本自动执行的方式，该方式使用了三种不同时机的 Hook 来触发

1. **Stop** 的 Hook 的具体逻辑：
    1. 简单的对于会话列表的长度进行判断
    2. 如果长度达标、那么输出提示词信息给用户看
2. **Sessionend** 的 Hook 的具体逻辑：
    1. 读取完整的会话历史记录
    2. 通过claude -p "xxx"，来调用claude生成学习记录
3. **PostToolUse** 的 Hook 的具体逻辑：
    1. 简单的进行会话列表的长度判断
    2. 将“总结学习记录的指令”放入到工具返回结果，以此输入给Claude触发判断



🧩关于 Cmmand 命令手动执行的方式、该方式设计了/learn 指令来执行

当用户在会话中完成任务的时候，发现有一些设计方案非常值得保存到记忆中，这个时候就可以触发/learn 指令



**所有总结下来的学习记录都存放在/skill/learn 文件夹中，这样或许 Agent 可以自动根据具体情况使用 Skill 的学习记录的技能**

****

🌴 模式下使用到的文件 Command 和 Skill 为：

+ commands/learn.md
+ skills/continuous-learning


👉 小拓展：
关于会话记录文件(Session Tmp)和学习记录文件(Learn Skill)的区别
+ 学习记录文件（Learn Skill）：全局的、永久的、抽象的知识规则，**目的是避免重复犯错，积累经验**
+ 会话记录文件（Session Tmp）：局部的、临时的、具体的工作状态，**目的是用于跨会话的连续性**
****
文件所在的位置也不同：
 + 学习记录文件（Learn Skill）：<font style="color:rgb(50, 50, 50);">/.claude/skills/learned/jsonwebtoken-v9-migration.md</font>
 + <font style="color:rgb(50, 50, 50);">会话记录文件（Session Tmp）：/.claude/sessions/2026-01-20-auth-feature.tmp</font>
 ****
 <font style="color:rgb(50, 50, 50);">学习记录文件的例子：</font>
+ <font style="color:rgb(50, 50, 50);">工具的描述要说明"何时使用"而不只是"做什么"</font>
+ <font style="color:rgb(50, 50, 50);">工具参数的设计中必填参数尽量少，可选参数提供默认值</font>
+ <font style="color:rgb(50, 50, 50);">件路径参数要说明是相对路径还是绝对路径</font>
****
<font style="color:rgb(50, 50, 50);">会话记录文件的例子：</font>
+ 创建了 `database_query` 工具的基础定义
+ 在工具描述中明确说明"优先使用 simple_query，只有必要时才用 complex_query"



## 二、提高项目可维护性 - 检测评估+冗余代码清理
### 3.1、基于检查点的评估

![检查点评估](./image/image%20(66).png)

使用基于检查点评估的方式，流程就是：**开始 -> 实现 -> 验证**这三步循环，每一个功能都由这三步来约束

1. **开始**：在功能实现之前，先运行一下开始步骤的指令，这样可以保证代码库的工作空间是干净的
2. **实现**：这个时候就可以开始编写功能代码了，你自己编写或使用 AI 编写都可以
3. **验证**：在这个功能完成的差不多了，或者已经编写一段时间的代码啦，可以运行验证指令，进行简单的代码评估，评估验证你这段时间写的代码如何，是否合格，是否符合要求规范



🧩 那么我们来细细的说一下开始指令( /checkpoints create )

1. 执行/verify quick 的指令，只检查构建和类型的错误，这样执行起来快
2. 执行 git stash 或 commit ，保存当前的代码状态，让功能开始之前工作空间是干净的
3. 执行`git rev-parse --short HEAD` 把 SHA 写入到日志文件`checkpoints.log`中



🧩 接下来我们来说一下验证指令( /checkpoint verify )

1. 先从 checkpoints.log 中去除最近的 SHA
2. 大模型自己根据**具体情况调用 git diff 和运行代码相关测试的命令**
3. 根据“**关键指标**”的要求输出报告，报告中要有：新增文件、修改文件、测试通过率、覆盖率等

这种方式真的非常好，非常优雅，**因为所有的流程不是强制自动化的，只是提供了最小的必要条件**“SHA”。
至于如何获取新增和修改文件，测试和覆盖率这些指标，都是由模型自己来决定的，最大程度上保证了模型自主性，目前模型能力已经很厉害了，保持模型的自主性，我们未来可以用最小的改动代价换来最大的能力提升



🌴 该模式下使用到的文件 Command 和 Skill 为：

+ commands/checkpoint.md
+ commands/verify.md

### 3.2、持续评估

![持续评估](./image/image%20(67).png)



在持续评估的模式下，具体的流程为：

1. **触发点**：每 N 分钟或重大变更后运行
2. **运行点**：运行完整的测试套件、构建状态、代码检查等，使用 Skill 或 Command
3. **运行结果**：输出完整详细的检测报告
4. **判断结束点**：根据输出的报告判断当前的代码是否合格，如果合格就结束，不合格的话就要进行修复
5. **修复点**：对于报告中不合格的检测点进行修复，成功修复之后结束



🌴 该模式下使用到的文件 Command 和 Skill 为：

+ skills/verification-loop
+ commands/verify.md



两种检测评估方式的区别：

1. 基于检查点评估的方式：适合用于<font style="color:rgb(15, 20, 26);">具有明确里程碑的线性工作流程</font>
2. <font style="color:rgb(15, 20, 26);">持久评估的方式：适合长时间运行的会话</font>

🌟 **所以决定因素是任务的性质，基于检查点评估方式适用于具有明确阶段的特性实现，持续性的评估方式适用于探索性重构或维护，这类工作是没有明确的里程碑和结束点的**

### 3.3、清理冗余代码
清理冗余代码的功能是使用一个子 Agent 和一个 Command，**区别的话就是 Agent 更加详细完整一些，Command 指令轻便一点，直接一点**：

1. Command 指令： commands/refactor-clean.md
2. 子 Agent 的设计： agents/refactor-cleaner.md



目前 Command 指令更加清晰直接一些，我们接下来就分析整理一下这个命令书写的流程吧

```plain
# 重构清理

通过测试验证，安全识别并移除死代码：

1. 运行死代码分析工具：
    - knip：查找未使用的导出与文件
    - depcheck：查找未使用依赖
    - ts-prune：查找未使用的 TypeScript 导出
2. 在 .reports/dead-code-analysis.md 中生成完整报告
3. 按严重程度分类发现结果：
    - SAFE：测试文件、未使用的工具
    - CAUTION：API 路由、组件
    - DANGER：配置文件、主入口
4. 只建议安全删除项
5. 每次删除前：
    - 运行完整测试套件
    - 确认测试通过
    - 应用变更
    - 再次运行测试
    - 如失败则回滚
6. 展示已清理项目的汇总

在运行测试之前，绝不删除代码！
```

1. 先使用工具找出冗余代码：`knip`、`depcheck`、`ts-prune` 这三种工具
2. 把结果写入到文件中，同时对结果进行风险分类
3. 按照“完全流程”进行删除冗余带你：安全流程是在删除代码的前后都要运行测试，也就是(测试 - 删除 - 测试）



### 3.4、代码地图 - 可信的上下文
![codeMap](./image/image%20(68).png)

有代码地图的存在，其就可以作为 AI 或者开发者了解代码库的入口，AI 可以通过代码地图，使用较少的 Token 就可以了解项目的全局面貌。

代码地图里面的文档不要多，尽量保持精简。



🌴 该模式下使用到的文件 Command 和 Skill 为：

+ agents/doc-updater.md
+ commands/update-codemaps.md
+ commands/update-docs.md

### 3.5、一点总结
那我们总结一下吧，关于提高项目可维护性的四种方式：

+ 在适当干预下，两**种验证方法（基于检查点评估和持续评估）足以避免大部分技术债务**。让 Claude 完成任务后通过运行技能和 PostToolUse 钩子进行验证，有助于实现这一点。
+ **持续更新代码地图也有帮助，因为它记录了变更日志以及代码地图随时间的演变过程**，这提供了除代码仓库本身之外的可靠信息来源。
+ **通过严格的规则，Claude 将避免创建杂乱的随机.md 文件，避免为相似代码生成重复文件**，也不会留下大量废弃代码。可以考虑rules的方式，全局的创建文档的规则


## 三、子智能体的使用方式：循环验证调用+编排
使用子智能体的方式会导致整个会话的上下文产生“中断”

<font style="color:rgb(50, 50, 50);">子代理的存在是为了通过返回摘要而非全部信息来节省上下文。然而，编排器拥有子代理所缺乏的语义上下文。子代理只知道字面查询，不了解请求背后的目的或推理过程。摘要常常遗漏关键细节</font>

> <font style="color:rgb(50, 50, 50);">来自@ PerceptualPeak 的类比：“你的老板派你去开会并要求你提供摘要。你回来后向他汇报了情况。十有八九，他会有后续问题。你的摘要不会包含他需要的所有信息，因为你没有他那种隐含的上下文。”</font>
>

<font style="color:rgb(50, 50, 50);"></font>

<font style="color:rgb(50, 50, 50);">所以目前更好使用子代理的方式有两种</font>**<font style="color:rgb(50, 50, 50);">：循环验证调用模式和顺序执行的编排器</font>**

### 3.1、循环验证调用


![循环调用](./image/image%20(69).png)



循环验证调用的流程：

1. 主智能体评估子智能体的结果
2. 当结果不合格的话，主智能体根据评估结果提出新的检索任务
3. 子智能体按照新的检索任务继续检索
4. 循环最多 3 轮

**在这种模式下，主智能体派发给子智能体的任务要“具体的问题+更广泛的目标”，让整体的检索面积更大，能检索到更多的结果**

****

🌴 该模式下使用到的文件 Command 和 Skill 为：

+ **skills/iterative-retrieval**

### 3.2、编排智能体

![编排智能体](./image/image%20(70).png)



编排智能体的原则是：

1. 每个代理接收一个明确的输入、并生成一个明确的输出
2. 输出成为下一阶段的输入
3. 切勿跳过任何阶段 - 每个阶段都蕴含价值
4. 在智能体之间使用/clear命令以保持上下文的新鲜度
5. 将中间输出存储在文件中（而非仅存在内存中）



除了固定的四种功能编排好的子智能体调用流程，还可以自定义子智能体的调用顺序

```shell
/orchestrate custom "architect,tdd-guide,code-reviewer" "Redesign caching layer"
```


🌴 该模式下使用到的文件 Command 和 Skill 为：

+ commands/orchestrate.md
+ agents/architect.md
+ agents/code-reviewer.md
+ agents/planner.md
+ agents/security-reviewer.md
+ agents/tdd-guide.md



## 四、文章配置详解
```plain
everything-claude-code/
|-- .claude-plugin/         # 插件和市场清单
|   |-- plugin.json         # 插件元数据和组件路径
|   |-- marketplace.json    # /plugin marketplace add 的市场目录
|
|-- agents/           # 子智能体文件夹
|   |-- planner.md           		 # 功能实现规划
|   |-- architect.md         		 # 系统设计决策
|   |-- tdd-guide.md         		 # 测试驱动开发
|   |-- code-reviewer.md     		 # 质量和安全审查
|   |-- security-reviewer.md     # 漏洞分析
|   |-- build-error-resolver.md  # 构建错误解决
|   |-- e2e-runner.md        		 # Playwright E2E 测试
|   |-- refactor-cleaner.md  		 # 死代码清理
|   |-- doc-updater.md       	 	 # 文档同步
|   |-- go-reviewer.md       		 # Go 代码审查（新增）
|   |-- go-build-resolver.md 		 # Go 构建错误解决（新增）
|
|-- skills/           # 技能
|   |-- coding-standards/           # 编程语言最佳实践
|   |-- backend-patterns/           # API、数据库、缓存模式
|   |-- frontend-patterns/          # React、Next.js 模式
|   |-- continuous-learning/        # 从会话中自动提取模式（长篇指南）
|   |-- continuous-learning-v2/     # 基于直觉的学习，带置信度评分
|   |-- iterative-retrieval/        # 子智能体的渐进式上下文优化
|   |-- strategic-compact/          # 手动压缩建议（长篇指南）
|   |-- tdd-workflow/               # TDD 方法论
|   |-- security-review/            # 安全检查清单
|   |-- eval-harness/               # 验证循环评估（长篇指南）
|   |-- verification-loop/          # 持续验证（长篇指南）
|   |-- golang-patterns/            # Go 语言习惯用法和最佳实践（新增）
|   |-- golang-testing/             # Go 测试模式、TDD、基准测试（新增）
|
|-- commands/         # 命令
|   |-- tdd.md              # /tdd - 测试驱动开发
|   |-- plan.md             # /plan - 实现规划
|   |-- e2e.md              # /e2e - E2E 测试生成
|   |-- code-review.md      # /code-review - 质量审查
|   |-- build-fix.md        # /build-fix - 修复构建错误
|   |-- refactor-clean.md   # /refactor-clean - 死代码移除
|   |-- learn.md            # /learn - 会话中提取模式（长篇指南）
|   |-- checkpoint.md       # /checkpoint - 保存验证状态（长篇指南）
|   |-- verify.md           # /verify - 运行验证循环（长篇指南）
|   |-- setup-pm.md         # /setup-pm - 配置包管理器
|   |-- go-review.md        # /go-review - Go 代码审查（新增）
|   |-- go-test.md          # /go-test - Go TDD 工作流（新增）
|   |-- go-build.md         # /go-build - 修复 Go 构建错误（新增）
|   |-- skill-create.md     # /skill-create - 从 git 历史生成技能（新增）
|   |-- instinct-status.md  # /instinct-status - 查看学习到的直觉（新增）
|   |-- instinct-import.md  # /instinct-import - 导入直觉（新增）
|   |-- instinct-export.md  # /instinct-export - 导出直觉（新增）
|   |-- evolve.md           # /evolve - 将直觉聚类为技能（新增）
|
|-- rules/            # 始终遵循的指南（复制到 ~/.claude/rules/）
|   |-- security.md         # 强制性安全检查
|   |-- coding-style.md     # 不可变性、文件组织
|   |-- testing.md          # TDD、80% 覆盖率要求
|   |-- git-workflow.md     # 提交格式、PR 流程
|   |-- agents.md           # 何时委托给子智能体
|   |-- performance.md      # 模型选择、上下文管理
|
|-- hooks/            # 基于触发器的自动化
|   |-- hooks.json                # 所有钩子配置（PreToolUse、PostToolUse、Stop 等）
|   |-- memory-persistence/       # 会话生命周期钩子（长篇指南）
|   |-- strategic-compact/        # 压缩建议（长篇指南）
|
|-- scripts/          # 跨平台 Node.js 脚本（新增）
|   |-- lib/                     # 共享工具
|   |   |-- utils.js             # 跨平台文件/路径/系统工具
|   |   |-- package-manager.js   # 包管理器检测和选择
|   |-- hooks/                   # 钩子实现
|   |   |-- session-start.js     # 会话开始时加载上下文
|   |   |-- session-end.js       # 会话结束时保存状态
|   |   |-- pre-compact.js       # 压缩前状态保存
|   |   |-- suggest-compact.js   # 战略性压缩建议
|   |   |-- evaluate-session.js  # 从会话中提取模式
|   |-- setup-package-manager.js # 交互式包管理器设置
|
|-- tests/            # 测试套件（新增）
|   |-- lib/                     # 库测试
|   |-- hooks/                   # 钩子测试
|   |-- run-all.js               # 运行所有测试
|
|-- contexts/         # 动态系统提示注入上下文（长篇指南）
|   |-- dev.md              # 开发模式上下文
|   |-- review.md           # 代码审查模式上下文
|   |-- research.md         # 研究/探索模式上下文
|
|-- examples/         # 示例配置和会话
|   |-- CLAUDE.md           # 项目级配置示例
|   |-- user-CLAUDE.md      # 用户级配置示例
|
|-- mcp-configs/      # MCP 服务器配置
|   |-- mcp-servers.json    # GitHub、Supabase、Vercel、Railway 等
|
|-- marketplace.json  # 自托管市场配置（用于 /plugin marketplace add）
```



🌴按照核心功能拆分使用的话：

1. 跨会话共享内存
    -  scripts/hooks/session-start.js：会话开始钩子	
    -  scripts/hooks/pre-compact.js：会话压缩钩子
    -  scripts/hooks/session-end.js：会话完成钩子
2. 持续学习并更新记忆：
    -  commands/learn.md
    -  skills/continuous-learning
3. 提高项目的可维护性：
    -  commands/checkpoint.md
    -  commands/verify.md
    -  skills/verification-loop
    -  commands/refactor-clean.md
    -  agents/refactor-cleaner.md
    -  agents/doc-updater.md
    -  commands/update-codemaps.md
    -  commands/update-docs.md
4. 子智能体使用方式：
    -  skills/iterative-retrieval
    -  commands/orchestrate.md
    -  agents/architect.md
    -  agents/code-reviewer.md
    -  agents/planner.md
    -  agents/security-reviewer.md
    -  agents/tdd-guide.md