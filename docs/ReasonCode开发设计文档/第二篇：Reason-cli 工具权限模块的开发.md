# 第二篇：Reason-cli 工具权限模块的开发
工具权限模式的开发重点就是通过设计几种 Agent 模式以此来判断执行工具的时候，这个工具是否需要用户审核批准执行，但是以此会延伸出来**工具调度的实现和 allowList 的机制**

所以工具权限模块的完整的开发方式是：

1. 工具的权限验证方法和终端的权限验证面板
2. 工具执行的调度
3. allowList 机制



参考的分析资料：

+ Gemini-cli：[https://github.com/google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli)
+ OpenCode：[https://github.com/anomalyco/opencode](https://github.com/anomalyco/opencode)
+ Kode：[https://github.com/shareAI-lab/Kode-cli](https://github.com/shareAI-lab/Kode-cli)

## 一、工具权限验证方法的设计
Excalidraw 文件链接：[https://ai.feishu.cn/file/Q7WJb4ACaoTFfpxWH72cDlHLnzg](https://ai.feishu.cn/file/Q7WJb4ACaoTFfpxWH72cDlHLnzg)

![工具权限验证方法的设计](./image/image%20(76).png)

1. 计划模式：是完全不能使用编辑和执行命令的工具
2. 默认模式：是所有的工具都可以使用，但是需要批准
3. 编辑模式：所有的工具都可以使用，编辑类工具自动批准，执行命令工具依旧要批准
4. 自动模式：所有的工具都可以使用，所有的工具都自动批准



前端可以进行模式的切换，当 Agent 需要执行一个工具的时候，在工具执行调度模块的地方，会执行工具的验证函数，**每一个工具几乎都有一个验证函数**，验证函数的实现核心是：

1. 获取前端传递过来的模式
2. 根据模式进行判断该工具是否需要审核批准
3. 对于命令执行工具的执行，在命令执行工具的验证函数中会进行 allowList 机制判断



当验证函数返回需要审核批准的时候，就开始进入第二阶段，在第二阶段中就是获取用户的选择，目前有三种模式：

+ 执行一次：同意本次工具的执行
+ 本次会话允许：在这个会话中，该工具的执行全部都自动批准后续
+ 取消：不允许执行该工具

那么本次会话允许的话，对于两类工具的表现是不同的：**命令执行工具和编辑类工具**

1. 命令执行工具：使用 `allowList` 机制保留命令执行的“前缀”，下一次判断就进行前缀的验证
2. 编辑类工具：编辑类工具会切换模式，将模式切换为“编辑模式”

## 二、工具调度流程的设计
Excalidraw 文件链接：[https://ai.feishu.cn/file/NwcJbEG0soQqr5xGImucKCz6n7B](https://ai.feishu.cn/file/NwcJbEG0soQqr5xGImucKCz6n7B)


![工具调度流程的设计](./image/image%20(77).png)

工具的调度流程设计中，工具的执行状态有以下几种：

1. validating（验证中）： 验证工具的参数等前置状态是否正确
2. awaiting_approval（等待确认）：需要用户批准，正在等待用户批准
3. scheduled（已调度）：工具准备开始执行的，等待批量执行
4. executing（已执行）： 正在执行工具
5. success（执行成功）：工具执行成功
6. error（执行失败）：工具执行失败
7. cancelled（取消执行）：用户取消执行工具或者进程中断



### 2.1、 终端显示执行的效果和方式
工具的执行状态有利于 cli 终端进行状态的显示，Agent 端进行事件通知采用“发布-订阅”的方式，让 cli 终端可以得到工具的执行状态的推送，那么 cli 终端就可以进行自定义的状态显示

+ validating 的时候就显示工具等待中
+ awaiting_approval 的时候就显示审核面板，让用户选择执行的方式
+ executing 的时候就显示工具执行中的状态
+ success、error、cancelled 的时候就当作工具的执行结果显示在 cli 终端


![工具执行结果的显示](./image/image%20(78).png)

![工具执行中](./image/image%20(79).png)

![工具执行前的显示](./image/image%20(80).png)




