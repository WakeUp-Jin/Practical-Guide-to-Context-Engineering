# Agent的评估

## 前言：
+ 《Claude-Cookbooks》：[https://github.com/anthropics/claude-cookbooks](https://github.com/anthropics/claude-cookbooks)
+ LangFuse 的文档：[https://langfuse.com/docs/evaluation/overview](https://langfuse.com/docs/evaluation/overview)
+ promptfoo 框架：[https://github.com/promptfoo/promptfoo](https://github.com/promptfoo/promptfoo)

## 一、Agent 评估为什么这么重要
LLM 的输出是存在不可控因素的，而对于一个线上生产级别的大模型应用来说，稳定性是最重要的，成熟的评估方案不仅可以让大模型应用更加稳定，同时也可以发现模型的潜力和边界，以此更好的迭代大模型应用

有几句真实引述可以参考。以此来解释为什么评估很重要

> 1. <font style="color:rgba(0, 0, 0, 0.87);">团队难以有效的评估模型性能是 LLMs 生产应用案例的最大障碍，同时也使提示词的设计变成艺术而非科学</font>
> 2. <font style="color:rgba(0, 0, 0, 0.87);">尽管评估需要大量时间，但提前进行评估将长期节省开发人员的时间，并使更好的产品能更快地推出</font>
>

<br/>

评估对于大模型应用开发是有好处的，可以量化一些模型的边界能力：

1. ✏️ **迭代式提示词优化**：我们的 V2 版本的提示词是否比 V1 版本更好呢？
2. ✏️ **部署上线前后提示词变更质量的保证**：我们的最新提示词更新是否导致了性能下降？
3. ✏️ **客观模型的对比**：我们更换为更高级的模型时，是否可以维持或提升当前的评估性能？
4. ✏️ **潜在的成本节约**：当我们更换为更快、成本更低的模型时是否可以维持当前的评估性能？

<br/>

设计完整的评估方案并且准确的执行，不仅有益于大模型应用开发的效率，同时也可以帮助团队探索出模型的边界能力，为极大释放模型的潜力提供方向

接下来就一起来看看评估方案的主要元素有哪些，同时评估的流程是什么，还有评估的方法

## 二、评估的组成
一个设计良好的评估方案由四个主要组成部分构成：

1. **示例输**入：这里是给模型的指令或问题，**关键是要设计出能够准确代表你的应用在实际使用中会遇到的各类场景的输入**
2. **标准答案**：正确的或理想的回答，作为模型输出的基准，创建高质量的标准答案通常需要领域专家的参与，以确保准确性和相关性
3. **模型输出**：这个是 LLM 基于示例输入实际生成的回答，这个就是你要拿来与黄金答案对比的评估内容
4. **分数**：一个定量或定性的值，代表模型在该特定输入上的表现，评分方法可以根据你的任务性质和选择的评分方法而有所不同

<br/>

关于准备的**示例输入和标准答案至少需要超过 100 组**才会有评估的意义和参考价值

# 三、评估的流程
Excalidraw 文件：[https://gcntfv628ebr.feishu.cn/file/BE4hbfHfgoovDPxTdeYcGu7knDd](https://gcntfv628ebr.feishu.cn/file/BE4hbfHfgoovDPxTdeYcGu7knDd)

![评估流程](./image/image%20(46).png)

上图就是评估的完整流程的示意图，下面我详细解释一下各步骤中的关键

1. 首先我们要准备好测试用例，这个是由示例输入和标准答案组成
2. 然后将测试用例分为两批，80%作为开发集测试用例，20%作为留存集测试用例
3. 根据你自己的感觉设计第一版本的提示词
4. 在开发集上面进行测试
5. 当效果很差的时候，就根据测试结果优化提示词，循环往复，直到提示词合格
6. 这个时候你再使用之前准备好的留存集测试，这一步是验证提示词的泛化
7. 当**留存集的测试结果和开发集的测试结果差距**小于 10%（具体的你可以自己定，我这里只是举一个例子）左右，就可以通过
8. 如果差距大于 10%，就说明提示词和开发集的测试用例严重过拟合，重新再回到优化提示词的那一步，循环往复，直到留存集测试结果合格

<br/>

在评估流程中，两步测试用例的结果是主要的，**开发集准确率和留存集的准确率**，但是还有两个评估因素可以考虑使用

+ **边缘案例覆盖**：评估在极端输入中，模型的表现如何
+ **性能测试**：评估模型的响应时间

<br/>


当然在整个评估流程的准备和执行中，最重要的两点：

1. 编写评估问题和标准答案：也就是标准答案的准备，如果让人工来编写问题和标准答案会非常耗时，成本也非常高，但这个成本是一次性的，编写好的问题和标准答案可以重复利用
2. 评分运行产生的持续成本：我们会持续高频繁的运行评估，如果采用大模型来评分，那么这一步的模型成本是存在的，所以我们要尽量构建快速且经济地评估体系核心

## 四、评估的方法
常见的三种评估方法是：

+ 基于代码评分：使用标准代码来匹配和判断模型的输出
+ 人工评分：人工手动的查看模型生成的答案进行打分
+ 基于模型的评分：由一个更高级的模型来对于输出进行评价

<br/>

三种评分方法中可以首先考虑使用模型评分和代码评分，最后才考虑人工评分，因为人工评分相比前面两种方式其成本大，周期长

### 4.1、基于代码评分
1. 📝 **特点**：基于<font style="color:rgb(50, 50, 50);">代码的评分使用程序化方法来评估模型的输出。这种方法适用于具有明确、客观标准的任务。例如，如果你使用 LLM 从文本中提取特定数据点，你可以使用代码来检查提取的信息是否与预期值匹配。</font>
2. **<font style="color:rgb(50, 50, 50);">优势</font>**<font style="color:rgb(50, 50, 50);">：基于代码的评分的主要优势在于其速度和可扩展性。一旦设置完成，它能够快速且一致地处理数千次评估。然而，它在处理细微差别或主观性回答方面的能力有限。</font>**<font style="color:rgb(50, 50, 50);">常见的基于代码的评分技术包括精确字符串匹配、关键词存在性检查以及使用正则表达式进行模式匹配</font>**
3. **<font style="color:rgb(50, 50, 50);">形式</font>**<font style="color:rgb(50, 50, 50);">：</font>
    1. <font style="color:rgb(50, 50, 50);">精确字符串匹配评分：模型的输出必须与标准答案完全一致</font>
    2. <font style="color:rgb(50, 50, 50);">关键词存在性检查：这种方法用于判断模型的输出是否包含某些关键单词和短语</font>
    3. <font style="color:rgb(50, 50, 50);">正则表达式：我们可以定义正则表达式来检查复杂的文本模式</font>
    4. <font style="color:rgb(50, 50, 50);">还有很多.......</font>
<br/>

#### 4.1.1、代码评分的例子
因为案例比较简单，为了方便展示整个评估流程，选择了模型能力相对弱的`Qwen2-7B-Instruct`

第一步：我们先准备好一个评估用例数据集**（示例输入和标准输出）**，这里我们取测试主干，暂时不进行留存集的测试步骤

```typescript
let testCases = [
  // 明显积极（2个）
  {
    id: 1,
    text: '太棒了！非常满意，五星好评！',
    expected: '积极',
    reason: '明确的正面词汇',
  },
  {
    id: 2,
    text: '物流很快，质量超出预期，强烈推荐',
    expected: '积极',
    reason: '多个正面描述',
  },
  // 明显消极（2个）
  {
    id: 3,
    text: '垃圾产品，完全不能用，退款了',
    expected: '消极',
    reason: '明确的负面词汇',
  },
  {
    id: 4,
    text: '质量太差，客服态度恶劣，不推荐',
    expected: '消极',
    reason: '多个负面描述',
  },
  // 明显中性（2个）
  {
    id: 5,
    text: '今天收到货了，包装还可以',
    expected: '中性',
    reason: '陈述事实，无明显情感倾向',
  },
  {
    id: 6,
    text: '产品是蓝色的，重量500克左右',
    expected: '中性',
    reason: '纯客观描述',
  },
  // 陷阱：讽刺反话（2个）
  {
    id: 7,
    text: '呵呵，真是"完美"的体验呢',
    expected: '消极',
    reason: '引号表示讽刺，简单提示词看到"完美"会判断为积极',
  },
  {
    id: 8,
    text: '好得不得了，好到我想扔掉',
    expected: '消极',
    reason: '前半句是假好评，后半句才是真实情感',
  },
  // 陷阱：转折结构（2个）
  {
    id: 9,
    text: '虽然价格有点贵，但是质量真的很好，值得购买',
    expected: '积极',
    reason: '先提缺点后肯定，整体是积极，简单提示词可能被"贵"误导',
  },
  {
    id: 10,
    text: '外观设计不错，但是用了一天就坏了',
    expected: '消极',
    reason: '先肯定后否定，整体是消极，简单提示词可能被"不错"误导',
  },
  // 陷阱：隐性情感（2个）
  {
    id: 11,
    text: '买了三次了，每次都回购',
    expected: '积极',
    reason: '没有明显褒义词，但多次回购说明满意',
  },
  {
    id: 12,
    text: '用了两天就不想再用了',
    expected: '消极',
    reason: '没有明显贬义词，但表达了放弃使用的意图',
  },
];
```

<br/>

第二步：我们再准备一个初版的提示词

```typescript
// V1 - 提示词
let promptV1 = (text: string) => `
判断以下文本的情感倾向，回答"积极"、"消极"或"中性"。

文本：${text}

只回答一个词：积极、消极或中性。
`;
```

<br/>

第三步：我们使用评估数据集来运行初版提示词得出评估分数

```typescript
// 评估函数
async function evaluatePrompt(
  service: any,
  promptFn: (text: string) => string,
  version: string
) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`开始评估: ${version}`);
  console.log('='.repeat(60));

  let successCount = 0;
  let failCount = 0;
  let totalCount = testCases.length;
  let failedCases: any[] = [];

  for (let test of testCases) {
    const prompt = promptFn(test.text);
    const response = await service.generate(prompt);
    const isSuccess = response.trim() === test.expected;

    if (isSuccess) {
      successCount++;
    } else {
      failCount++;
      failedCases.push({
        id: test.id,
        expected: test.expected,
        actual: response.trim(),
        reason: test.reason,
      });
    }

    console.log(
      `测试用例${test.id}: ${isSuccess ? '✓ 成功' : '✗ 失败'} (期望: ${test.expected}, 实际: ${response.trim()})`
    );
  }

  console.log(`\n${'-'.repeat(60)}`);
  console.log(`${version} 评估结果汇总:`);
  console.log(`总测试用例数: ${totalCount}`);
  console.log(`成功用例数: ${successCount}`);
  console.log(`失败用例数: ${failCount}`);
  console.log(`准确率: ${((successCount / totalCount) * 100).toFixed(2)}%`);

  if (failedCases.length > 0) {
    console.log(`\n失败用例详情:`);
    failedCases.forEach(fc => {
      console.log(`  用例${fc.id}: 期望${fc.expected}，实际${fc.actual}`);
      console.log(`    原因: ${fc.reason}`);
    });
  }

  return { successCount, failCount, totalCount, failedCases };
}
```

```typescript
export async function main() {
  const service = await createLLMService({
    provider: 'siliconflow',
    model: 'Qwen/Qwen2-7B-Instruct',
    apiKey: config.siliconflowApiKey,
    maxIterations: 30,
  });

  // 评估三个版本的提示词
  const v1Result = await evaluatePrompt(
    service,
    promptV1,
    '提示词 V1 (简单版)'
  );
  // 对比结果
  console.log(`\n${'='.repeat(60)}`);
  console.log('对比结果:');
  console.log('='.repeat(60));
  console.log(
    `V1 准确率: ${((v1Result.successCount / v1Result.totalCount) * 100).toFixed(2)}%`
  );
}


/** 
输出结果：
提示词 V1 (简单版) 评估结果汇总:
总测试用例数: 12
成功用例数: 10
失败用例数: 2
准确率: 83.33%

失败用例详情:
  用例5: 期望中性，实际积极
    原因: 陈述事实，无明显情感倾向
  用例7: 期望消极，实际积极
    原因: 引号表示讽刺，简单提示词看到"完美"会判断为积极

============================================================
对比结果:
============================================================
V1 准确率: 83.33%
**/
```

<br/>

第四步：我们根据评估结果，发现用例 5 和用例 7 出现歧义错误，对提示词的调整

1. 引号表示讽刺的含义的可能要再提示词中表明出来
2. 说明中性、积极、消极的具体含义，给模型清晰的评估标准，而不是一个词语

```typescript
// V2 - 提示词-添加具体的描述和引号含义
let promptV2 = (text: string) => `
你是一个情感分析专家，判断以下文本的情感倾向。

分类标准：
- 积极：表达满意、赞赏、推荐等正面情感
- 消极：表达不满、失望、批评等负面情感
- 中性：客观陈述事实，无明显情感倾向

注意事项：
- 注意"虽然...但是..."这类转折句，以后半句为准
- 注意带引号的词可能是反讽

文本：${text}

只回答一个词：积极、消极或中性。
`;
```

<br/>

第五步：执行优化后的提示词，查看结果

```typescript
export async function main() {
  const service = await createLLMService({
    provider: 'siliconflow',
    model: 'Qwen/Qwen2-7B-Instruct',
    apiKey: config.siliconflowApiKey,
    maxIterations: 30,
  });

  const v2Result = await evaluatePrompt(
    service,
    promptV2,
    '提示词 V2 (规则版)'
  );

  // 对比结果
  console.log(`\n${'='.repeat(60)}`);
  console.log('对比结果:');
  console.log('='.repeat(60));
  console.log(
    `V2 准确率: ${((v2Result.successCount / v2Result.totalCount) * 100).toFixed(2)}%`
  );
}

/**
======输出结果：======
提示词 V2 (规则版) 评估结果汇总:
总测试用例数: 12
成功用例数: 12
失败用例数: 0
准确率: 100.00%

============================================================
对比结果:
============================================================
V1 准确率: 83.33%
V2 准确率: 100.00%
**/
```

<br/>

第六步：当准确率得到提升合格之后，就可以进入到留存率的测试集中或者评估通过

### 4.2、基于人工评分
1. 📝**特点**：<font style="color:rgb(50, 50, 50);">对于需要细致理解或主观判断的任务，基于人类的评分仍然是标准答案。这种方法涉及让个人 - 通常是领域专家 - 审查模型的输出，评估其质量，并为每个输出分配分数</font>
2. **<font style="color:rgb(50, 50, 50);">优势</font>**<font style="color:rgb(50, 50, 50);">：人工评分在评估诸如语气、创造力、复杂推理或事实性等方面的能力上表现优异，尤其是在处理开放式任务或答案的正确性依赖于微妙语境因素时。</font>**<font style="color:rgb(50, 50, 50);">其缺点是耗时且可能成本高昂，尤其是在大规模评估中。此外，它还可能受到不同评分者之间不一致性的影响。</font>**
3. **<font style="color:rgb(50, 50, 50);">形式</font>**<font style="color:rgb(50, 50, 50);">：</font>
    1. <font style="color:rgb(50, 50, 50);">专家评审：领域内的专家评估回答的准确性和深度，例如：律师手动审查公平贷款并准确反映条款，皮肤科医生可能会评估模型关于皮肤癌筛查的建议</font>
    2. <font style="color:rgb(50, 50, 50);">用户体验小组：一个小组评估输出内容的清晰度、帮助性、参与度以及其他基于人类判断的方面</font>

### 4.3、基于模型评分
Excalidraw 文件：[https://gcntfv628ebr.feishu.cn/file/YtPAbgpd0otvaRxyLMbctcbwnrc](https://gcntfv628ebr.feishu.cn/file/YtPAbgpd0otvaRxyLMbctcbwnrc)

![基于模型评分](./image/image%20(47).png)



1. 📝**特点**：基于 LLM 的评分方法介于基于代码和基于人工的方法之间。这种方法使用另一个 LLM（有时是同一个）来评估输出。通过精心设计评分提示，你可以利用 LLM 的语言理解能力来评估多种标准。
2. **优势**：与基于代码的评分相比，这种方法可以处理更复杂和主观的评估，同时比人工评分更快、更具可扩展性。然而，它需要高超的提示工程技巧来确保可靠的结果，并且评分 LLM 引入自身偏见的风险始终存在。
3. **形式**：
    1. 摘要质量：这个摘要有多简洁和准确
    2. 语气评估：该回复是否符合我们品牌指南或语气
    3. 其他.....

<br/>

#### 4.3.1、 评估模型的提示词书写
<font style="color:rgb(50, 50, 50);">在基于模型评分的方法下，最核心的是</font>**<font style="color:rgb(50, 50, 50);">评估模型，其对应的也是需要为评估模型编写一份提示词，关于这个提示词的书写思路可以参考：</font>**

+ 原始提示或问题
+ 我们想要评估的模型输出
+ 一套用于评估的标准或指南
+ 关于如何评估和给响应结果打分的说明

<br/>

常见的模型评估的标准或指南：

1. 这个回应带有多少歉意？
2. 根据所提供的上下文，该回应在事实上是否准确？
3. 这个回复是否过度提及自身上下文的信息
4. 这个回复是否真正恰当回答了问题？
5. 这个输出与我们的语气｜品牌｜风格指南的契合度如何？

#### 4.3.2、评估模型的定位
一个合格的评估模型想要保持客观中立的态度，目前的很多模型默认情况下都是友好的，有偏向道歉的倾向

所以在书写评估模型的提示词中，需要加一段观点和角度的限制

**“不道歉和不使用道歉的语言，要客观中立”**

<br/>

#### 4.3.3、评估案例
步骤 1：用户提问

> 输入：   输入："为儿童玩具店写一句宣传语"
>

步骤 2：被测试模型输出

> "本店提供高品质玩具，欢迎选购。"
>

步骤 3：评估LLM打分

> 评估提示：
> + 评估是否符合儿童友好、活泼的语气。
> + 总分10分


步骤 4：评估结果

> + 得分：4/10
> + 理由：语气过于正式严肃，不符合儿童玩具店的活泼定位
>

