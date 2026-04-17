# Bash工具实现和安全权限设计细节

## 一、Bash工具的实现

Bash工具是Agent很关键的基础工具，skill规范中的脚本执行会需要它，随着应用逐渐cli化，未来的Agent调用外部应用也需要它，到时候只需要执行cli命令就可以。

同时有bash工具之后，很多操作都可以实现，一定程度上可以简化Agent工具列表，**但是还是建议保持工具最小权利原则**

> 任务优先使用专用工具完成，例如：读取就使用Read工具、编辑就使用Edit工具等

### 1.1、Bash工具的定义

```javascript
export const BashTool = buildTool({
  name: BASH_TOOL_NAME,
  searchHint: 'execute shell commands',
  description: getSimplePrompt(),
  inputSchema: z.strictObject({
    command: z.string().describe('要执行的命令'),
    timeout: z.number().optional().describe('可选的超时时间，单位为毫秒'),
    description: z.string().optional().describe('用主动语态简明扼要地描述该命令的作用'),
    //全局禁用后台任务时隐藏
    run_in_background: z.boolean().optional().describe('设置为 true 可在后台运行此命令'), 
    // 危险操作
    dangerouslyDisableSandbox: z.boolean().optional().describe('设置为 true 将强制跳过沙箱模式执行命令'), 
    // 始终对模型隐藏
    _simulatedSedEdit: z.object({ filePath: z.string(), newContent: z.string() }).optional().describe('内部字段：预览阶段预计算的 sed 编辑结果'), 
  }),
  // ... 其他方法如 call、checkPermissions 等
})
```

工具的参数：

- command：要执行的bash命令字符串
- timeout：命令执行的超时时间，防止Agent运行被卡死
- description：对命令的简短描述，UI渲染给用户看的
- run_in_background：有一些命令运行需要很久，例如：构建和启动命令，所以将命令执行放入到后台，定时查询任务结果就可以
- dangerouslyDisableSandbox：一种安全防护的策略
- _simulatedSedEdit：预览阶段先计算好sed结果，用户批准之后直接向文件写入该结果，而不是再执行sed命令，将操作从“正则替换”变为“完整内容覆盖”，保证用户所见即所得

工具的描述：

```markdown
**执行给定的 bash 命令并返回其输出**
工作目录在命令之间是持久化的，但 shell 状态不持久化。shell 环境从用户的 profile（bash 或 zsh）初始化。

重要：避免使用此工具运行 find、grep、cat、head、tail、sed、awk 或 echo命令，除非明确指示或已验证专用工具无法完成任务。相反，应使用适当的专用工具，因为这将为用户提供更好的体验。

# Instructions
- 如果命令将创建新目录或文件，首先使用此工具运行 ls 以验证父目录存在且位置正确。
- 始终对包含空格的文件路径使用双引号引用。
- 尽量通过使用绝对路径来保持当前工作目录不变，避免使用 cd。但如果用户明确要求，可以使用 cd。
- 可指定可选超时（毫秒，最多 10 分钟）。默认 2 分钟后超时。
- 可以设置 run_in_background 在后台运行命令。
- 执行多个命令时：
   - 如果命令独立且可并行，在单条消息中发起多个 Bash 调用。
   - 如果命令相互依赖必须顺序执行，用单个 Bash 调用配合 && 链式执行。
   - 仅在需要顺序执行但不在乎前面命令是否失败时使用 ;。
   - 不要用换行符分隔命令（换行在引号字符串内是可以的）。
- git 命令：优先创建新提交而非修改现有提交；破坏性操作前先考虑更安全的替代方案；不要跳过 hook。
- 避免不必要的 sleep：能立即执行的命令不要 sleep；长时间运行的命令用 run_in_background；不要用 sleep循环重试失败的命令；等待后台任务时无需轮询。
- 沙箱说明（如果启用了沙箱）：默认在沙箱中运行，限制可访问的目录和网络；临时文件要用 $TMPDIR 而非 /tmp。
- git 提交与 PR 的详细操作指南（很长的一段，包含具体的 git status / git diff / git log / gh pr create 等步骤和最佳实践）。
```

### 1.2、工具的执行函数

在实现Bash工具的执行函数的时候，主要就是下面的三点核心思路：

1. 采用Generator函数来实现，可以实时输出命令执行情况
2. 生产级别的命令执行函数exec要封装好
3. Bash工具返回结果时，需要进行内容字符长度的判断，如果超出自定义的字符最大限制，就将完整内容写入文件，最终返回**部分结果与文件路径**

在Bash工具实现中，Generator模式比Promise模式更优秀，Geneator模式可以实时返回命令执行过程的中间态，但Promise模式在执行命令的时候需要持续等待，中间可能会有一大段空白的等待时间，这个过程没有任何输出。

下面这个代码是对于Bash工具的核心实现逻辑（简化版本），同时对比了Generator模式和Promise模式的实现区别

```typescript
import { spawn } from 'child_process';

//使用Promise模式
function runWithPromise(command: string, args: string[]): Promise<{ stdout: string;
 code: number }> {
  return new Promise((resolve) => {
    const proc = spawn(command, args);
    let stdout = '';

    // 只要子进程有输出，就拼接到 stdout 字符串里
    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    // 等子进程完全结束后，一次性 resolve
    proc.on('close', (code) => {
      resolve({ stdout, code: code ?? 0 });
    });
  });
}
const result = await runWithPromise('ping', ['-c', '5', 'google.com']);
console.log("==Promise==")
console.log(result.stdout); // 用户等了 5 秒，然后突然全部刷出来

//使用Generator模式
async function* runWithGenerator(command: string, args: string[]) {
  const proc = spawn(command, args);
  let fullOutput = '';

  // 把"下一行输出"包装成一个 Promise
  let resolveNextLine: ((value: string) => void) | null = null;
  proc.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    fullOutput += text;
    if (resolveNextLine) {
      resolveNextLine(text);   // 唤醒 generator
      resolveNextLine = null;
    }
  });

  // 把"进程结束"包装成一个 Promise
  let resolveExit: ((code: number) => void) | null = null;
  proc.on('close', (code) => {
    if (resolveExit) resolveExit(code ?? 0);
  });
  const exitPromise = new Promise<number>((resolve) => {
    resolveExit = resolve;
  });

  // 核心循环：race 等待"新输出"或"进程结束"
  while (true) {
    const nextLinePromise = new Promise<string>((resolve) => {
      resolveNextLine = resolve;
    });

    // 关键：同时监听两个事件，哪个先到就处理哪个
    const winner = await Promise.race([
      nextLinePromise.then(text => ({ type: 'output' as const, text })),
      exitPromise.then(code => ({ type: 'exit' as const, code })),
    ]);

    if (winner.type === 'exit') {
      // 进程结束了，return 最终值
      return { stdout: fullOutput, code: winner.code };
    }

    // 进程还在跑，有新输出，yield 进度
    yield {
      output: winner.text,      // 这次新增的内容
      fullOutput,                // 截至目前全部内容
    };
  }
}
const gen = runWithGenerator('ping', ['-c', '5', 'google.com']);
while (true) {
    const step = await gen.next();
  
    if (step.done) {
      console.log('Exit code:', step.value.code);
      break;
    }
    console.log("==Generator==")
    console.log(step.value.output);
  
    process.stdout.write(step.value.output);
}
```

在查看ClaudeCode的设计思路中，**如果这个bash工具的实现要更完善一些**，可以将执行命令的exec方法封装

```javascript
// 调用底层 exec（file mode：stdout 直接写文件，不经过 JS data 事件）
const shellCommand = await exec(command, abortController.signal, 'bash', {
    timeout: timeoutMs,
    onProgress(lastLines, allLines, totalLines, totalBytes, isIncomplete) {
        lastProgressOutput = lastLines;
        lastTotalLines = totalLines;
        lastTotalBytes = isIncomplete ? totalBytes : 0;
        // 唤醒 race
        if (resolveProgress) {
        resolveProgress();
        resolveProgress = null;
        }
    },
});
```

exec的主要封装的功能如下：

1. **输出写入磁盘文件**：程序运行内存中只有4KB左右的预览
2. **主动中断**：用户能够主动触发中断执行，使用abortSignal实现
3. **超时处理**：当运行超过120秒时，主动停止运行
4. **stdout和stderr合并写入同一个文件**：让UI层的显示和输出时序一致
5. **CWD自动恢复**：当前命令执行的目录不小心被删除啦，会自动回退到原始目录继续执行

Bash工具的执行函数中，会对于执行命令的结果返回做了一层截断处理

```javascript
const MAX_INLINE_SIZE = 128 * 1024;      // 128KB：直接返回内容
async function resolveOutput(outputFilePath: string, taskId: string) {
    const stat = await fsStat(outputFilePath);
    const totalBytes = stat.size;
  
    // 1. 小文件：直接返回
    if (totalBytes <= MAX_INLINE_SIZE) {
      const content = await readFile(outputFilePath, 'utf-8');
      return {content,persistedPath: undefined};
    }
  
    // 2. 大文件：读取截断内容，复制文件，最终返回截断内容+完整文件路径
    const preview = await readFileRange(outputFilePath, 0, MAX_INLINE_SIZE);
    const dest = getToolResultPath(taskId, false);
    await copyFile(outputFilePath, dest);
    return {
      content:`[Large output (${totalBytes} bytes). ` +`Showing first ${MAX_INLINE_SIZE} bytes. ` +`Use FileRead for full content.]\n${preview}`,
      persistedPath: dest,
    };
  }
```

### 1.3、工具的返回值

```javascript
const data = {
    stdout: compressedStdout,                    // 核心输出（可能含 stderr混合内容）
    stderr: stderrForShellReset,                 // 仅用于 cwd 重置提示
    interrupted: wasInterrupted,                 // 是否被中断
    isImage,                                      // 是否是图片输出
    returnCodeInterpretation: interpretationResult?.message,  // 退出码语义解释
    noOutputExpected: isSilentBashCommand(input.command),     // 成功时是否应无输出
    dangerouslyDisableSandbox: input.dangerouslyDisableSandbox,  // 是否绕过沙箱
    persistedOutputPath,                          // 大输出持久化路径
    persistedOutputSize                           // 大输出字节数
};
```

有几个核心的字段要留意：

- returnCodeInterpretation：对非零退出码的语义化的解释，可以让模型根据输出结果更好的推断如何进行下一步
- perisstedOutputPath：大输出的文件路径，这个很重要，返回给模型之后，模型可以根据上下文的情况来判断是否有必要读取完整的输出，而不是一股脑的把一堆输出放入到上下文中，这样做会导致上下文使用效率非常低
- stdout：这个就是bash工具执行的核心输出

### 1.4、**工具权限验证流程**

Bash工具的执行范围非常大，所以它的危险性也是最高的，对于Agent和宿主机来说，权限验证是最复杂的

1. 命令解析
2. 静态规则检查
3. 权限验证
4. 模型验证
5. 容器验证

其中关于**静态规则检查和权限验证**两点是最核心的，静态规则检查一共有24条规则检查，权限验证有三层结果，其中大部分无法确定的情况，都会在权限验证中输出ask模式，交给用户确认

> 静态规则实在是太多了，我就重点梳理了其中的8条我觉得比较核心的，静态规则部分的具体实现，可以借助Agent CLI工具，将24条规则作为上下文输入，由模型生产对应的验证代码
> 权限验证是非常有必要实现的，但是这么严格的静态规则检查是否有必要，开发者可以根据场景具体判断吧

🌴多说一点，静态规则的检查开发者可以根据场景自己判断，参考目前的一些优秀项目的做法是：

- ClaudeCode的Bash工具实现中，静态规则检查时非常严格的
- OpenCode的实现并没有这么严格的静态规则检查，只有权限验证
- Gemini-cli的实现了部分静态规则检查，解析分段检查、危险命令验证、wrapper去壳，同时也实现了权限验证

## 一、执行命令解析

要解析bash工具传入的command命令，可以直接使用**tree-sitter库**，其会将Bash脚本解析成为结构化的AST

> 可以考虑使用web-tree-sitter库，这个是WASM版本的，不依赖平台预编译包，跨平台一致性，
> 比原生的tree-sitter要好用一些，原生的是C++扩展的

解析例子：

```typescript
// web-tree-sitter (WASM) 版本
import { Language, Parser } from 'web-tree-sitter';

async function main() {
  await Parser.init();

  const lang = await Language.load('./tree-sitter-bash.wasm');
  const parser = new Parser();
  parser.setLanguage(lang);

  const command = 'grep -r "foo" . && cat file.txt | wc -l';
  const tree = parser.parse(command);

  // 收集所有 command 节点
  const commands: string[] = [];
  function walk(node: any) {
    if (node.type === 'command') commands.push(node);
    for (const child of node.children) walk(child);
  }
  walk(tree?.rootNode);

  // 提取 argv
  function argv(node: any) {
    return node.children
      .filter((c: any) => ['word', 'string', 'raw_string'].includes(c?.type))
      .map((c: any) => c.text);
  }

  console.log(`Found ${commands.length} command(s):\n`);
  commands.forEach((cmd: any, i: number) => {
    console.log(`[${i + 1}] ${cmd.text.trim()}`);
    console.log(`    argv: ${JSON.stringify(argv(cmd))}\n`);
  });
}

main();
```

运行输出结果：

```text
Found 3 command(s):

[1] grep -r "foo" .
    argv: ["-r","\"foo\"","."]

[2] cat file.txt
    argv: ["file.txt"]

[3] wc -l
    argv: ["-l"]
```

解析拿到最终command命令和argv参数，就可以进行下一步的静态检查啦

## 二、核心8条静态检查

### 2.1、控制字符与Unicode空白拒绝

这个可以放在解析之前执行，因为是为了清理执行命令，防止有人注入“恶意的字符”，所以先使用正则表达式进行匹配清理：

```javascript
// 匹配控制字符
  const CONTROL_CHAR_RE = /[\x00-\x08\x0B-\x1F\x7F]/
  
  //匹配Unicode空白
  const UNICODE_WHITESPACE_RE =/[\u00A0\u1680\u2000-\u200B\u2028\u2029\u202F\u205F\u3000\uFEFF]/
  
  //匹配反斜杠转义空白
  const BACKSLASH_WHITESPACE_RE = /\\[ \t]|[^ \t\n\\]\\\n/
```

具体的关于这三个规则详细解析，可以问问模型，向模型提问的模版可以这样，模型的回复会更详细

```text
const CONTROL_CHAR_RE = /[\x00-\x08\x0B-\x1F\x7F]/
const UNICODE_WHITESPACE_RE =/[\u00A0\u1680\u2000-\u200B\u2028\u2029\u202F\u205F\u3000\uFEFF]/
const BACKSLASH_WHITESPACE_RE = /\\[ \t]|[^\t\n\\]\\\n/，
这三条正则分别拦截了 tree-sitter 和 bash的哪几种分词分歧？为什么放在 AST 遍历之前而不是之后？并且举一个实际例子
```

🌴 我这里简单的总结一下：上面三条规则，每一条都对应一个已验证的 tree-sitter-bash 分歧

<img src="./image/PQdIb1fZeo9wapxu3sycSN2UnDh.png" src-width="820" src-height="303" align="center" />

🎃 一个完整的例子：

假设有人诱导模型构建这样的命令：`rm\u00A0-rf /`

> 其中 `\u00A0` 是一个看起来像空格但实际上不是 ASCII 空格的字符

- tree-sitter 的视角：`\u00A0 `不是普通空格，所以 `rm\u00A0-rf`可能被解析成一个完整的命令名或参数，后续路径`/ `只是单独的一个参数。从 AST上看，这甚至不像是 `rm` 命令
- bash 的视角：`\u00A0` 属于空白字符，会被当作参数分隔符。于是实际执行的是：`rm -rf /`

结果：我们的静态规则（比如“检查 rm 命令的目标路径是否危险”）可能因为 AST上根本看不出这是 rm 命令而漏检，但 bash 却实实在在地执行了危险删除

### 2.2、危险结构类型触发ask模式

AST解析执行命令的时候，返回的结果中会有一个字段表示命令的节点类型，那么我们可以使用这个**节点类型**来判断命令是否是危险的

核心的节点类型验证规则如下：

```javascript
const DANGEROUS_TYPES = new Set([
    'command_substitution',   // $(cmd) 或 `cmd`
    'process_substitution',   // <(cmd) 或 >(cmd)
    'expansion',              // ${VAR}
    'simple_expansion',       // $VAR
    'brace_expression',       // {a,b,c}
    'subshell',               // (cmd)
    'compound_statement',     // { cmd; cmd; }
    'for_statement',          // for i in ...; do ...; done
    'while_statement',        // while ...; do ...; done
    'until_statement',        // until ...; do ...; done
    'if_statement',           // if ...; then ...; fi
    'case_statement',         // case ... in ... esac
    'function_definition',    // foo() { ... }
    'test_command',           // [[ ... ]]
    'ansi_c_string',          // $'...'
    'translated_string',      // $"..."
    'herestring_redirect',    // <<< ...
    'heredoc_redirect',       // << ...
  ])
```

**判断之后的结果，有两种情况**

- 如果命中啦，表示当前命令有点危险，不能直接执行，那么走ask模式询问用户，或者也可以直接拒绝（具体拒绝那些命令，这个是由用户自己配置的）
- 如果没有命中，表示当前阶段是安全的，那么进入到下一个解析阶段

核心的判断代码如下：

```typescript
export function parseForSecurityFromAst(
    cmd: string,
    root: Node | typeof PARSE_ABORTED,
  ): ParseForSecurityResult {
    // ── AST 遍历：核心安全检查 ──
    // 直接 too-complex，不再进入后续的精细分析。
    if (root.type === 'ERROR' || DANGEROUS_TYPES.has(root.type)) {
      return tooComplex(root)
    }
    
    //.....
    
    // ── 没有命中：结构化提取成功 ──
    return { kind: 'simple', commands }
  }
```

### 2.3、wrapper去壳后一致性检查

原始命令：`timeout 5 eval "rm -rf /"`

解析结果：

```typescript
{
    argv: ['timeout', '5', 'eval', 'rm -rf /'],
    envVars: [],
    redirects: [],
    text: 'timeout 5 eval "rm -rf /"'
  }
```

**这个阶段是去除argv中多余无关的参数值，将真正的执行命令暴露出来给下一个节点验证**

如果没有这个阶段的话，我们可能会对无关的参数值进行验证，随意就通过啦

例如：timeout这个命令本身就不是危险操作，只是一种简单的时间限制，如果我们只检查argv[0]==='timeout'就觉得安全了，那么后面的危险操作就会逃过下面静态规则的判断

> 攻击者完全可以把任意的危险命令“藏”在timeout后面，这样就会被执行，导致无法挽回的结果

所以wrapper就是去壳操作，暴露出真正的命令，去掉的外壳命令有下面几种：

**time、nohup、timeout、nice、env、stdbuf**

timeout和stdbuf可能有点特殊要多留意一下，主要是以下几种：-、--、.5

1. `timeout -k 5 10 eval ...`：旧代码只处理 --long flag，没处理 -k，导致 eval没被识别到
2. `timeout .5 eval "id"`：.5 不匹配旧的 duration 正则，导致 eval 被漏掉
3. `stdbuf --output 0 eval`：旧代码只剥了一层，结果把 0 当成命令名，eval 被隐藏

🌴对于命令执行这个危险操作，要记住一个设计原则：**未知的情况就直接拒绝**

该静态节点完整的核心代码如下：

```javascript
let a = cmd.argv
  for (;;) {
    if (a[0] === 'time' || a[0] === 'nohup') {
      a = a.slice(1)
    } else if (a[0] === 'timeout') {
      // 遍历 GNU timeout 的 flag（--foreground, -k, -s...）
      // 跳过 duration（5, 10s, 0.5...）
      // 未知 flag 或无法识别的 duration → 直接拒绝
      a = a.slice(i + 1)  // 从 duration 之后开始
    } else if (a[0] === 'nice') {
      // 跳过 -n N 或 -N，然后 slice
      // 如果参数包含 $((...)) 等 expansion → 直接拒绝
      a = a.slice(...)
    } else if (a[0] === 'env') {
      // 跳过 VAR=val 赋值和已知 flag（-i, -0, -v, -u NAME）
      // 遇到 -S / -C / -P 或任何未知 flag → 直接拒绝
      a = a.slice(i)
    } else if (a[0] === 'stdbuf') {
      // 跳过 -o MODE / --output=MODE 等已知形式
      // 未知 flag → 直接拒绝
      a = a.slice(i)
    } else {
      break  // 不是 wrapper 了，停止剥壳
    }
  }
  const name = a[0]  // 这才是真正要执行的命令名
```

🎃 一个简单的wrapper的案例如下，原始命令：`timeout 10 eval "rm -rf /"`

如果不执行wrapper，后面节点得到的就是：argv[0] = 'timeout'，timeout 是安全的，放行

但是Bash实际执行的是：`eval "rm -rf /"`这种高危操作

### 2.4、命令名健壮性检查

在wrapper去壳之后，name就被确定下来了，那么要对于这个name进行基础的准确性检查

1. name是否为空
2. name是否是一个占位符
3. name是否是一个完整的命令

核心的判断代码如下：

```javascript
const name = a[0]

  // 1. 空命令名
  if (name === '') {
    return { ok: false, reason: 'Empty command name — argv[0] may not reflect what
  bash runs' }
  }

  // 2. 占位符命令名
  if (name.includes("__CMDSUB_OUTPUT__") || name.includes("__TRACKED_VAR__")) {
    return { ok: false, reason: 'Command name is runtime-determined (placeholder
  argv[0])' }
  }

  // 3. 片段化命令（以操作符开头）
  if (name.startsWith('-') || name.startsWith('|') || name.startsWith('&')) {
    return { ok: false, reason: 'Command appears to be an incomplete fragment' }
  }
```

在前面解析步骤中，我们主动将两种动态命令替换为字符常量：

1. $(...)：替换成为"__CMDSUB__"
2. $VAR：替换成为"__VAR__"

所以在这一步判断的时候，我们只需要检查name是否包含这些占位符，如果包含的话就说明name是运行时动态决定的

### 2.5、eval-like builtin拦截

> eval-like builtin 指的是一类 shell 内建命令：它们会把参数当“代码”再执行，或绕过普通argv 安全假设

```javascript
const EVAL_LIKE_BUILTINS = new Set([
    'eval',       // 直接求值字符串
    'source',     // 执行脚本文件
    '.',          // source 的别名
    'exec',       // 替换当前进程执行新程序
    'command',    // 绕过 alias/function 查找
    'builtin',    // 强制调用 builtin
    'fc',         // 编辑/重新执行历史命令
    'coproc',     // 协进程
    'noglob',     // zsh 前缀修饰符
    'nocorrect',  // zsh 前缀修饰符
    'trap',       // 设置信号处理程序
    'enable',     // 加载 .so 作为 builtin
    'mapfile',    // 带回调的数组读取
    'readarray',  // mapfile 的别名
    'hash',       // 污染命令查找缓存
    'bind',       // 绑定键盘回调
    'complete',   // 补全回调
    'compgen',    // 补全生成（可执行 -C 参数）
    'alias',      // 定义别名
    'let',        // 算术求值
  ])
  
  //拦截逻辑：
  if (EVAL_LIKE_BUILTINS.has(name)) {
    // 几个特例放行：
    // - command -v / command -V：只打印路径，不执行
    // - fc -l / fc -ln：列出历史，安全
    // - compgen -c/-f/-v：只列出补全，安全
    // 其余全部拒绝
    return { ok: false, reason: `'${name}' evaluates arguments as shell code` }
  }
```

验证这类shell内建命令，可以防止攻击者将危险命令藏在一个正常的字符串参数里面，利用运行时解析把它变成实际执行的命令

🎃例如：`eval "rm -rf /"`

AST解析之后的argv参数是`[ 'eval' , 'rm -rf / ' ]`，如果没有这一次拦截，那么eval就会被放行

那么bash执行的就是 `"rm -rf /"`，也就是说eval会把后面的指令重新解析然后被执行

### 2.6、管道分段递归

如果检测到命令中包含管道符 | ，会分段处理，每一段都执行完整的权限验证

> 管道｜ 会将多个命令串在一起，如果静态检查只检查一次验证，那么可能就只会验证第一段命令，如果第一段命令符合就通过执行啦，后面的危险命令就可能会被漏掉被执行啦

所以要分段递归验证，只有所有的分段检查都是通过的，整体命令才会通过，否则只要有一段有问题就拒绝执行或者询问用户

🎃 例子：

原始命令：`echo hello | rm -rf /`

不分段验证：只看到了echo命令，就验证通过啦，bash就会执行后面一段命令 `rm -rf /`

分段验证：

- `echo hello`：这段命令是没有问题的，通过
- `rm -rf /`：这一段是危险的删除命令，拒绝执行或者询问用户

那么最后整段命令被拒绝执行，因为其中的第二段命令没有通过

### 2.7、cd + git 组合的危险判断

git 不是一个纯"只读"命令——它会读取当前目录下的 .git/config 并执行 hooks。**如果 cd把当前目录切换到了一个不可信的目录，那么任何 git 命令都可能成为代码执行的入口。**

所以我们需要组合判断cd+git的情况

```javascript
//核心代码
  if (hasCd && hasGit) {
    return { behavior: 'ask', reason: '...bare repository attacks' }
  }
```

### 2.8、危险删除路径拦截

对于rm和rmdir命令，要谨慎对待，这是删除命令，是有可能出现删除系统核心文件的

核心防护思路：**对于rm和rmdir命令执行之前，先提取目标路径出来，然后进行匹配，如果匹配到系统核心文件，命令就直接拒绝执行**

系统核心文件列表：

- **通配符删除**：如 `*`、`/*`、`/tmp/*`，通配符范围不可控，存在批量误删风险
- **根目录**：如 `/`，禁止对系统根目录执行删除操作
- **Windows 驱动器根目录**：如 `C:\`、`D:\`，禁止对磁盘根目录执行删除操作
- **用户主目录**：如 `~`、`/home/user`，禁止删除用户主目录，避免丢失全部个人数据
- **根目录的直接子目录**：如 `/usr`、`/etc`、`/tmp`，均为系统关键目录，删除将导致系统崩溃
- **Windows 驱动器的直接子目录**：如 `C:\Windows`、`C:\Program Files`，均为系统核心目录，删除将导致系统不可用

判断的核心代码：

```typescript
export function isDangerousRemovalPath(resolvedPath: string): boolean
   {
    const forwardSlashed = resolvedPath.replace(/[\\/]+/g, '/')

    // 1. 通配符删除当前目录全部内容
    if (forwardSlashed === '*' || forwardSlashed.endsWith('/*')) return
   true

    const normalizedPath =forwardSlashed === '/' ? forwardSlashed :forwardSlashed.replace(/\/$/, '')

    // 2. 根目录
    if (normalizedPath === '/') return true

    // 3. Windows 驱动器根目录
    if (WINDOWS_DRIVE_ROOT_REGEX.test(normalizedPath)) return true

    // 4. 用户主目录
    const normalizedHome = homedir().replace(/[\\/]+/g, '/')
    if (normalizedPath === normalizedHome) return true

    // 5. 根目录的直接子目录（如 /usr, /tmp, /etc）
    const parentDir = dirname(normalizedPath)
    if (parentDir === '/') return true

    // 6. Windows 驱动器的直接子目录（如 C:\Windows）
    if (WINDOWS_DRIVE_CHILD_REGEX.test(normalizedPath)) return true

    return false
  }
```

## 三、完整的24条静态验证规则：

<table>
  <colgroup>
    <col width="75" />
    <col width="280" />
    <col width="429" />
    <col width="84" />
  </colgroup>
  <tbody>
    <tr><td><p>序号</p></td><td><p>规则名称</p></td><td><p>核心作用</p></td><td><p>重点</p></td></tr>
    <tr><td><p>1</p></td><td><p>控制字符与 Unicode 空白拒绝</p></td><td><p>原始字符串含控制字符或 Unicode 空白时，解析器与 bash 分词不一致，直接标记 <code>too-complex</code></p></td><td><p>⭐</p></td></tr>
    <tr><td><p>2</p></td><td><p>危险结构类型（DANGEROUS_TYPES）触发 too-complex</p></td><td><p>AST 中出现 process substitution、subshell、控制流等无法静态证明安全的结构，直接拒绝</p></td><td><p>⭐</p></td></tr>
    <tr><td><p>3</p></td><td><p>wrapper 去壳后一致性检查</p></td><td><p><code>timeout</code>、<code>nice</code>、<code>env</code>、<code>stdbuf</code>、<code>nohup</code>、<code>time</code> 等 wrapper 会被层层剥掉，确保安全检查针对真正被执行的内层命令</p></td><td><p>⭐</p></td></tr>
    <tr><td><p>4</p></td><td><p>命令名健壮性检查</p></td><td><p>拦截空命令名、占位符命令名（<code>__CMDSUB__</code> / <code>__VAR__</code>）、以 <code>-</code> / <code>|</code> / <code>&amp;</code> 开头的片段化命令名</p></td><td><p>⭐</p></td></tr>
    <tr><td><p>5</p></td><td><p>eval-like builtin 拦截</p></td><td><p><code>eval</code>、<code>source</code>、<code>exec</code>、<code>command</code>、<code>trap</code>、<code>alias</code>、<code>let</code> 等会二次解释参数为代码的 builtin 被统一拦截</p></td><td><p>⭐</p></td></tr>
    <tr><td><p>6</p></td><td><p>zsh 危险 builtin 拦截</p></td><td><p><code>zmodload</code>、<code>zpty</code>、<code>ztcp</code> 等可扩展 zsh 能力的 builtin 被拦截，防止 shell 能力绕过</p></td><td></td></tr>
    <tr><td><p>7</p></td><td><p>数组下标执行面（flag 触发）</p></td><td><p>某些 builtin（如 <code>printf -v</code>）在 NAME 位置会算术求值数组下标，可能触发 <code>$(...)</code> 执行</p></td><td></td></tr>
    <tr><td><p>8</p></td><td><p>read/unset 裸位置 NAME 下标执行面</p></td><td><p><code>read</code>、<code>unset</code> 等命令的裸 NAME 参数即使无危险 flag，也会把下标当作可执行表达式解析</p></td><td></td></tr>
    <tr><td><p>9</p></td><td><p><code>[[ ... ]]</code> 算术比较两侧操作数检查</p></td><td><p><code>-eq</code>、<code>-gt</code> 等算术比较操作符会对两侧操作数做算术求值，属于隐式执行入口</p></td><td></td></tr>
    <tr><td><p>10</p></td><td><p>Shell 关键字误解析防御</p></td><td><p><code>if</code>、<code>while</code>、<code>for</code> 等关键字出现在 <code>argv[0]</code> 时，代表 AST 可能误解析，必须 fail-closed</p></td><td></td></tr>
    <tr><td><p>11</p></td><td><p>newline + <code>#</code> 注释错位防御</p></td><td><p>参数中若出现换行后紧跟 <code>#</code>，下游按行分词时会把 <code>#</code> 后内容当注释丢弃，造成参数隐藏</p></td><td></td></tr>
    <tr><td><p>12</p></td><td><p><code>jq system()</code> 与危险 flag 拦截</p></td><td><p><code>jq</code> 的 <code>system()</code> 函数及 <code>--run-tests</code> 等 flag 可成为代码执行与文件读取的桥接点</p></td><td></td></tr>
    <tr><td><p>13</p></td><td><p><code>/proc/*/environ</code> 敏感访问拦截</p></td><td><p>访问 <code>/proc/self/environ</code> 等路径可能泄露进程环境变量中的密钥与凭据</p></td><td></td></tr>
    <tr><td><p>14</p></td><td><p>复杂结构操作符检查（subshell/command group）</p></td><td><p><code>(cmd)</code>、<code>{ cmd; }</code> 等组合结构可隐藏执行边界，必须先拦</p></td><td></td></tr>
    <tr><td><p>15</p></td><td><p>管道分段递归检查与跨段 cd+git 防护</p></td><td><p>管道 <code>|</code> 将命令分段后每段独立过权限检查，同时扫描所有段防止 cd+git 组合风险被拆开遗漏</p></td><td><p>⭐</p></td></tr>
    <tr><td><p>16</p></td><td><p>process substitution 路径层拦截（Legacy 路径）</p></td><td><p>在 AST 不可用的 Legacy 路径下，对 <code>&lt;(cmd)</code> / <code>&gt;(cmd)</code> 做兜底拦截</p></td><td></td></tr>
    <tr><td><p>17</p></td><td><p>重定向目标安全检查（含危险 expansion）</p></td><td><p>重定向目标若含变量展开或命令替换，可能写入任意文件</p></td><td></td></tr>
    <tr><td><p>18</p></td><td><p>危险删除路径拦截（rm/rmdir）</p></td><td><p><code>rm -rf /</code>、<code>rm -rf ~</code>、<code>rm -rf /*</code> 等针对关键系统目录的删除强制人工确认</p></td><td><p>⭐</p></td></tr>
    <tr><td><p>19</p></td><td><p><code>cd + write</code> 组合路径不确定性拦截</p></td><td><p>复合命令中 cwd 变化后，后续写操作的路径解析不确定，自动判定不可靠</p></td><td></td></tr>
    <tr><td><p>20</p></td><td><p><code>--</code> 终止符与 flag 解析健壮性</p></td><td><p>正确处理 <code>--</code> 后的参数，防止把 <code>--</code> 后的路径误当 flag 丢弃导致漏检</p></td><td></td></tr>
    <tr><td><p>21</p></td><td><p>路径命令 wrapper 去壳后再校验</p></td><td><p>路径校验层对 <code>timeout</code>/<code>env</code>/<code>nice</code> 等再次去壳，防止外层绕过路径检查</p></td><td></td></tr>
    <tr><td><p>22</p></td><td><p>Legacy 注入安全网（仅 AST 不可用）</p></td><td><p>AST 不可用时，用正则兜底已知注入/误解析模式</p></td><td></td></tr>
    <tr><td><p>23</p></td><td><p>安全 heredoc 例外重检</p></td><td><p>对无引号但内容纯字面量的 heredoc 做例外处理，减少误报同时不放松对注入的拦截</p></td><td></td></tr>
    <tr><td><p>24</p></td><td><p>子命令 fanout 上限防护</p></td><td><p>限制 <code>$()</code> 拆分或 heredoc 分段的数量上限，防止超大拆分触发 CPU 饥饿/DoS</p></td><td></td></tr>
  </tbody>
</table>

### 
## 四、权限验证

权限策略状态一共有三种：allow（允许执行）、deny（拒绝执行）、ask（询问用户）

那么匹配这个权限策略状态的规则主要是这几种：

1. 配置文件规则命中将执行相应的权限策略状态
2. 静态规则检查命中的大部分结果都会是ask状态
3. 一般只读命令是直接allow状态

<img src="./image/LoqZbCLQBoL21qxxxBScLT80nCc.png" src-width="887" src-height="469" align="center" />

配置文件的定义格式一般如下：

```json
{
    "permissions": {
      "allow": ["Bash(git status:*)", "Bash(npm install:*)"],
      "deny": ["Bash(rm:*)", "Bash(rm -rf:*)"],
      "ask": ["Bash(docker:*)"]
    }
}
```

只读指令的判断标准一般如下：

1. 命令是 `ls、cat、head、tail、wc、find、grep、git status、git diff、git log` 等纯读取命令
2. 不包含cd
3. 不包含输出重定向和管道中的写入操作符
