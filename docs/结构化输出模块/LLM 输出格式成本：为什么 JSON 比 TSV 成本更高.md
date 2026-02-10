
# LLM输出格式成本：为什么JSON比TSV成本更高

🌟🌟**总结（节省时间时可看）**

+ TSV格式：适合作为流式输出，使用制表符作为分隔符，Token：550
+ CSV格式：不适合**数据中包含很多逗号，会导致数据混乱，这个时候可以使用TSV，**Token：568
+ 列JSON格式：不方面阅读，Token：591
+ YAML格式：YAML有很多陷阱，因为其使用空格作为分隔符，所以这个有时候调试难度很大，Token：592
+ TOML格式：没有顶层列表，可以使用general属性值顶层数据解决方案，Token：562
+ JSON格式：有时候会因为双引号，单引号这种符号问题导致解析失败，Token：621

## 一、结果分析

### 1.1、TSV结构

🧐 **TSV是一种以制表符（**`**\t**`**,Tab）作为字段分隔符的文本数据格式，特点：**

+ 每行通常代表一条记录，各字段之间用制表符分隔
+ 行与行之间以换行符分隔

例如：

```plain
name    age    city
Alice   30     New York
Bob     25     Los Angeles
Charlie 35     Chicago
```

代码验证如下：使用LangChain框架来处理的

```javascript
//解析模型输出的TSV转换为对象
function parseTSV(tsvString) {
    // 按行拆分，并去除可能的空行或首尾空白
    const lines = tsvString
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    // 第一行是标题行，使用制表符分割得到各字段名
    const headers = lines[0].split(/\t+/);

    // 用于存放解析结果的数组
    const result = [];

    // 从第二行开始（索引 1）逐行解析
    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(/\t+/);
        const record = {};

        headers.forEach((header, idx) => {
            // 将每列映射到对应的字段名上
            record[header] = row[idx] || '';
        });

        result.push(record);
    }

    return result;
}


export async function mainScriptTSV() {
    let prompt = PromptTemplate.fromTemplate(`
    小明想要选择最适合居住的2个城市。
    以下是小明的喜好与需求：
    - 喜欢温暖的气候
    - 希望靠近海边
    - 热爱多元的美食文化
    - 生活节奏不要太快

    这是城市列表：
    {strList}

    请确保所有输出使用 TSV（Tab-Separated Values） 格式，并且仅包含下列三个字段，每行用制表符（\\t）分隔。
    第一行输出字段名（标题行），接下来两行分别对应所选的 2 个城市。
    字段说明如下：
    - index: 一个整数，表示城市在列表中的索引
    - description: 对城市的简短描述
    - reason: 选择该城市的简要原因，重点说明其在场景或用例中的适用性
  `);

    let model = await getDeepSeekR1DBModel();
    let str = [
        { "index": 0, "text": "三亚：海滨城市，气候温暖，旅游业发达" },
        { "index": 1, "text": "广州：气候温暖，美食丰富，经济发达" },
        { "index": 2, "text": "成都：美食之都，气候湿润，休闲生活" },
        { "index": 3, "text": "上海：国际化大都市，各类文化兼容并蓄" },
        { "index": 4, "text": "大连：海滨城市，气候相对温暖，海鲜丰富" }
    ];
    let chain = prompt.pipe(model).pipe(parseTSV);

    let result = await chain.invoke({ strList: JSON.stringify(str) });

    console.log(result);
}

```

```javascript
[
  {
    index: '0',
    description: '三亚：海滨城市，气候温暖，旅游业发达',
    reason: '符合温暖气候及海滨需求，旅游业发达带来多元文化体验'
  },
  {
    index: '4',
    description: '大连：海滨城市，气候相对温暖，海鲜丰富',
    reason: '海滨位置且气候适宜，海鲜资源丰富契合美食偏好'
  }
]
```

总token：550

+ 输入：419
+ 输出：131

🏂：TSV的格式很好解析和处理，并且**TSV很适合作为流式输出，**因为没有大括号之类的

### 1.2、使用CSV格式

代码验证如下：使用LangChain框架来处理的

```javascript
function parseCSV(csvString) {
    // 1. 按行拆分，并去除可能的空行
    const lines = csvString
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    if (lines.length === 0) {
        return [];
    }

    // 2. 第一行是标题行，用逗号分隔得到各字段名
    const headers = lines[0].split(',');

    // 3. 解析后续每一行，将每一列映射到对应字段名上
    const result = [];
    for (let i = 1; i < lines.length; i++) {
        const rowValues = lines[i].split(',');
        const record = {};

        headers.forEach((header, index) => {
            // 如果某行字段数比 header 少，用空字符串填充
            record[header] = rowValues[index] || '';
        });

        result.push(record);
    }

    return result;
}

export async function mainScriptCSV() {
    let prompt = PromptTemplate.fromTemplate(`
      小明想要选择最适合居住的2个城市。
      以下是小明的喜好与需求：
      - 喜欢温暖的气候
      - 希望靠近海边
      - 热爱多元的美食文化
      - 生活节奏不要太快
  
      这是城市列表：
      {strList}
  
      请确保所有输出使用 CSV（Comma-Separated Values）格式，并且仅包含下列三个字段，每行用逗号 (,) 分隔。
      第一行输出字段名（标题行），接下来两行分别对应所选的 2 个城市。
      字段说明如下：
      - index: 一个整数，表示城市在列表中的索引
      - description: 对城市的简短描述
      - reason: 选择该城市的简要原因，重点说明其在场景或用例中的适用性
    `);

    let model = await getDeepSeekR1DBModel();

    let str = [
        { "index": 0, "text": "三亚：海滨城市，气候温暖，旅游业发达" },
        { "index": 1, "text": "广州：气候温暖，美食丰富，经济发达" },
        { "index": 2, "text": "成都：美食之都，气候湿润，休闲生活" },
        { "index": 3, "text": "上海：国际化大都市，各类文化兼容并蓄" },
        { "index": 4, "text": "大连：海滨城市，气候相对温暖，海鲜丰富" }
    ];


    let chain = prompt.pipe(model).pipe(parseCSV);
    console.log(await prompt.pipe(model).invoke({ strList: JSON.stringify(str) }))

    let result = await chain.invoke({ strList: JSON.stringify(str) });

    console.log(result);
}
```

```javascript
index,description,reason
0,三亚：海滨城市，气候温暖，旅游业发达,满足温暖气候与海滨需求，旅游业带动多元美食，生活节奏适中
4,大连：海滨城市，气候相对温暖，海鲜丰富,具备海滨优势且气候较温暖，海鲜美食特色鲜明，生活节奏较舒缓

  
[
  {
    index: '0',
    description: '三亚：海滨城市，气候温暖，旅游业发达',
    reason: '符合温暖气候、海滨需求，旅游业带来多元美食且生活节奏相对休闲'
  },
  {
    index: '4',
    description: '大连：海滨城市，气候相对温暖，海鲜丰富',
    reason: '满足海滨和温暖气候要求，海鲜美食资源丰富，生活节奏较舒缓'
  }
]
```

总Token：568

+ 输入：416
+ 输出：152

🏂 ：CSV的格式“中规中矩”，有一个点要注意：CSV的逗号作为一种分隔符，如果你输出和输入本身就需要逗号，那么LLM在转义的时候，函数载解析的时候，是会达不到效果的，所以**数据中包含很多逗号，就不要使用CSV，因为会导致数据混乱，可以使用TSV**

****

### 1.3、使用列JSON格式

🧐 **列式JSON格式是以“列”来组织的，每个字段对应一个数组，数组依次代表数据记录中该字段的值**

****

代码验证如下，使用LangChain框架来处理

```javascript
export async function mainScriptColJSON() {
    let prompt = PromptTemplate.fromTemplate(`
        小明想要选择最适合居住的2个城市。
        以下是小明的喜好与需求：
        - 喜欢温暖的气候
        - 希望靠近海边
        - 热爱多元的美食文化
        - 生活节奏不要太快
      
        这是城市列表：
        {strList}
      
        请确保所有输出使用列式JSON格式，并且仅包含下列三个字段。
        字段说明如下：
        - index: 一个整数，表示城市在列表中的索引
        - description: 对城市的简短描述
        - reason: 选择该城市的简要原因，重点说明其在场景或用例中的适用性
      
        输出的JSON格式应类似于：
          "index": [0, 1],
          "description": ["城市描述1", "城市描述2"],
          "reason": ["选择理由1", "选择理由2"]
      `);

    let model = await getDeepSeekR1DBModel();

    let str = [
        { "index": 0, "text": "三亚：海滨城市，气候温暖，旅游业发达" },
        { "index": 1, "text": "广州：气候温暖，美食丰富，经济发达" },
        { "index": 2, "text": "成都：美食之都，气候湿润，休闲生活" },
        { "index": 3, "text": "上海：国际化大都市，各类文化兼容并蓄" },
        { "index": 4, "text": "大连：海滨城市，气候相对温暖，海鲜丰富" }
    ];

    let chain = prompt.pipe(model).pipe(JSON.parse);
    // console.log(await prompt.pipe(model).invoke({ strList: JSON.stringify(str) }));

    let result = await chain.invoke({ strList: JSON.stringify(str) });
    console.log(result);


}
```

```javascript
{
  index: [ 0, 4 ],
  description: [ '三亚：海滨城市，气候温暖，旅游业发达', '大连：海滨城市，气候相对温暖，海鲜丰富' ],
  reason: [ '满足温暖气候与海滨需求，旅游业带来多元文化饮食', '兼具海滨属性与海鲜美食，气候在北方城市中相对温和且生活节奏较慢' ]
}
```

总Token：591

+ 输入：421
+ 输出：170

🏂 ：列JSON格式是最不便于人类阅读的，每个键只出现一次，不用每条记录都重复，从而节省了令牌

### 1.4、使用YAML格式

🧐 **YAML是一种基于缩进的数据格式，使用缩进来表示层级结构，映射类似于键值对，用“冒号加空格”分隔键值对**

> YAML 最初由 Clark Evans、Ingy döt Net 和 Oren Ben-Kiki 等人提出，其初衷是创建一种既保留人类可读性又能方便机器处理的格式，作为 XML 的一种更友好的替代方案
>

代码验证如下，使用LangChain框架来处理

YAML格式的解析要借助第三方库，我这里使用的是`js-yaml`

```javascript
import * as yaml from 'js-yaml'

// 修复模型输出，确保YAML格式正确
export function sanitizeModelOutputByYAML(output: string): string {
    // 去掉模型输出中的 "```yaml" 和 "```" 标记
    output = output.replace(/```yaml|```/g, '').trim();  // 清除开头和结尾的 ` ```yaml` 和 ` ``` `

    return output;
}

export async function mainScriptYAML() {
    let prompt = PromptTemplate.fromTemplate(`
        小明想要选择最适合居住的2个城市。
        以下是小明的喜好与需求：
        - 喜欢温暖的气候
        - 希望靠近海边
        - 热爱多元的美食文化
        - 生活节奏不要太快
      
        这是城市列表：
        {strList}
      
        请确保所有输出使用 YAML 格式。
        输出结果中应包含下列三个字段：
        - index: 一个整数，表示城市在列表中的索引
        - description: 对城市的简短描述
        - reason: 选择该城市的简要原因，重点说明其在场景或用例中的适用性
      
        请输出 2 个城市的信息，每个城市作为 YAML 中的一个条目。
      `);

    let model = await getDeepSeekR1DBModel();

    let str = [
        { "index": 0, "text": "三亚：海滨城市，气候温暖，旅游业发达" },
        { "index": 1, "text": "广州：气候温暖，美食丰富，经济发达" },
        { "index": 2, "text": "成都：美食之都，气候湿润，休闲生活" },
        { "index": 3, "text": "上海：国际化大都市，各类文化兼容并蓄" },
        { "index": 4, "text": "大连：海滨城市，气候相对温暖，海鲜丰富" }
    ];

    let chain = prompt.pipe(model);
    // console.log(await prompt.pipe(model).invoke({ strList: JSON.stringify(str) }));

    let result = await chain.invoke({ strList: JSON.stringify(str) });

    console.log(result);

    //去掉字符串中的yaml标志
    let sanitizedResult = sanitizeModelOutputByYAML(result);
    console.log(sanitizedResult)

    try {
        // let yamlLoadStr = `
        // ${sanitizedResult}
        // `
        const parseData = yaml.load(sanitizedResult)
        console.log(parseData)
    } catch (error) {
        console.error('YAML 解析错误:', error);
    }

}
```

```yaml
- index: 0
  description: "三亚：海滨城市，气候温暖，旅游业发达"
  reason: "满足温暖气候和近海需求，旅游业发达带来多元饮食文化，生活节奏较非旅游区更悠闲"
- index: 4
  description: "大连：海滨城市，气候相对温暖，海鲜丰富"
  reason: "海滨属性突出，气候在北方城市中较温和，海鲜美食特色鲜明且生活节奏较一线城市缓慢"
```

```javascript
[
  {
    index: 0,
    description: '三亚：海滨城市，气候温暖，旅游业发达',
    reason: '满足温暖气候和近海需求，旅游业发达带来多元饮食文化，生活节奏较非旅游区更悠闲'
  },
  {
    index: 4,
    description: '大连：海滨城市，气候相对温暖，海鲜丰富',
    reason: '海滨属性突出，气候在北方城市中较温和，海鲜美食特色鲜明且生活节奏较一线城市缓慢'
  }
]
```

总Token：592

+ 输入：388
+ 输出：204

🏂：YAML要慎用，其比JSON有更多的陷阱，尤其是其空格来进行分隔，还有一点就是如果你的数据中包含转义序列（例如希望有制表符、换行符或者特殊 Unicode 字符），只有双引号方式能正确解析这些转义字符。其他方式可能会将它们当作普通文本处理，不进行解析。

> **在 YAML 中表示字符串的五种方式中，只有一种支持解析转义序列（ **`**\t**`** 、 **`**\u03B1**`** 等）。因此，如果你的数据包含转义序列，最好明确请求字符串使用双引号。**
>

### 1.5、使用TOML格式

🧐 **TMOL的格式与YAML非常的相似，使用**`**[]**`**来定义对象，采用键值对的形式**

代码验证如下，使用LangChain框架来处理

 我使用了`@iarna/toml`框架包来解析

```javascript
import * as toml from '@iarna/toml'

export function sanitizeModelOutputByTOML(output: string): string {
    // 去掉模型输出中的 "```toml" 和 "```" 标记
    output = output.replace(/```toml|```/g, '').trim();  // 清除开头和结尾的 ` ```toml` 和 ` ``` `

    return output;
}

export async function mainScriptTOML() {
    let prompt = PromptTemplate.fromTemplate(
        `小明想要选择最适合居住的2个城市。
        以下是小明的喜好与需求：
        - 喜欢温暖的气候
        - 希望靠近海边
        - 热爱多元的美食文化
        - 生活节奏不要太快

        这是城市列表：
        {strList}

        请确保所有输出使用 TOML 格式。
        输出结果中应包含下列三个字段：
        - index: 一个整数，表示城市在列表中的索引
        - description: 对城市的简短描述
        - reason: 选择该城市的简要原因，重点说明其在场景或用例中的适用性

        请输出 2 个城市的信息，每个城市作为 TOML 中的一个条目。
        `
    );

    let model = await getDeepSeekR1DBModel();

    let str = [
        { "index": 0, "text": "三亚：海滨城市，气候温暖，旅游业发达" },
        { "index": 1, "text": "广州：气候温暖，美食丰富，经济发达" },
        { "index": 2, "text": "成都：美食之都，气候湿润，休闲生活" },
        { "index": 3, "text": "上海：国际化大都市，各类文化兼容并蓄" },
        { "index": 4, "text": "大连：海滨城市，气候相对温暖，海鲜丰富" }
    ];

    let chain = prompt.pipe(model);
    // console.log(await prompt.pipe(model).invoke({ strList: JSON.stringify(str) }));

    let result = await chain.invoke({ strList: JSON.stringify(str) });

    console.log(result);

    let sanitizedResult = sanitizeModelOutputByTOML(result);
    console.log(sanitizedResult);

    try {
        const parseData = toml.parse(sanitizedResult);
        console.log(parseData);
    } catch (error) {
        console.error('TOML 解析错误:', error);
    }
}

```

```toml
[[city]]
index = 0
description = "三亚：海滨城市，气候温暖，旅游业发达"
reason = "符合温暖气候+海滨需求，旅游业带来丰富餐饮体验且生活节奏适中"

[[city]]
index = 4
description = "大连：海滨城市，气候相对温暖，海鲜丰富"
reason = "兼具海滨属性和温和气候，海鲜美食与较慢生活节奏契合需求"
```

```javascript
{
  city: [
    {
      index: 0,
      description: '三亚：海滨城市，气候温暖，旅游业发达',
      reason: '符合温暖气候+海滨需求，旅游业带来丰富餐饮体验且生活节奏适中'
    },
    {
      index: 4,
      description: '大连：海滨城市，气候相对温暖，海鲜丰富',
      reason: '兼具海滨属性和温和气候，海鲜美食与较慢生活节奏契合需求'
    }
  ]
}

```

总Token：562

+ 输入：386
+ 输出：176

🏂 ：**TOML的数据格式与YAML非常的相似，但是TOML没有顶层的列表设计，所以可以看到在最后的输出的时候有一个键 **`**city**`**，因此如果您想用 TOML 表示记录列表，您需要将它们放在顶层对象中，并告诉 LLM 您想在这个对象中称这个键为什么。**

****

****

### 1.6、使用JSON格式

代码验证如下，使用LangChain框架来处理

::: details 点击展开完整代码
```javascript
import { JsonOutputParser } from '@langchain/core/output_parsers';

export async function mainScriptTOML() {
    let prompt = PromptTemplate.fromTemplate(
        `小明想要选择最适合居住的2个城市。
        以下是小明的喜好与需求：
        - 喜欢温暖的气候
        - 希望靠近海边
        - 热爱多元的美食文化
        - 生活节奏不要太快

        这是城市列表：
        {strList}

        请确保所有输出使用 TOML 格式。
        输出结果中应包含下列三个字段：
        - index: 一个整数，表示城市在列表中的索引
        - description: 对城市的简短描述
        - reason: 选择该城市的简要原因，重点说明其在场景或用例中的适用性

        请输出 2 个城市的信息，每个城市作为 TOML 中的一个条目。
        `
    );

    let model = await getDeepSeekR1DBModel();

    let str = [
        { "index": 0, "text": "三亚：海滨城市，气候温暖，旅游业发达" },
        { "index": 1, "text": "广州：气候温暖，美食丰富，经济发达" },
        { "index": 2, "text": "成都：美食之都，气候湿润，休闲生活" },
        { "index": 3, "text": "上海：国际化大都市，各类文化兼容并蓄" },
        { "index": 4, "text": "大连：海滨城市，气候相对温暖，海鲜丰富" }
    ];

    let chain = prompt.pipe(model);
    // console.log(await prompt.pipe(model).invoke({ strList: JSON.stringify(str) }));

    let result = await chain.invoke({ strList: JSON.stringify(str) });

    console.log(result);

    let sanitizedResult = sanitizeModelOutputByTOML(result);
    console.log(sanitizedResult);

    try {
        const parseData = toml.parse(sanitizedResult);
        console.log(parseData);
    } catch (error) {
        console.error('TOML 解析错误:', error);
    }
}


export async function mainScriptJSON1() {
    let prompt = PromptTemplate.fromTemplate(`
        小明想要选择最适合居住的2个城市。
        以下是小明的喜好与需求：
        - 喜欢温暖的气候
        - 希望靠近海边
        - 热爱多元的美食文化
        - 生活节奏不要太快
      
        这是城市列表：
        {strList}
      
        请确保所有输出使用 JSON 格式。
        输出结果中应包含下列三个字段：
        - index: 一个整数，表示城市在列表中的索引
        - description: 对城市的简短描述
        - reason: 选择该城市的简要原因，重点说明其在场景或用例中的适用性
      
        请输出 2 个城市的信息，每个城市作为 JSON 中的一个对象。
      `);

    let model = await getDeepSeekR1DBModel();

    let str = [
        { "index": 0, "text": "三亚：海滨城市，气候温暖，旅游业发达" },
        { "index": 1, "text": "广州：气候温暖，美食丰富，经济发达" },
        { "index": 2, "text": "成都：美食之都，气候湿润，休闲生活" },
        { "index": 3, "text": "上海：国际化大都市，各类文化兼容并蓄" },
        { "index": 4, "text": "大连：海滨城市，气候相对温暖，海鲜丰富" }
    ];

    let chain = prompt.pipe(model).pipe(new JsonOutputParser());
    let result = await chain.invoke({ strList: JSON.stringify(str) });

    console.log(result);

}

```
:::

```javascript
[
  {
    index: 0,
    description: '三亚：海滨城市，气候温暖，旅游业发达',
    reason: '气候温暖且靠近海边，旅游业发达带来休闲氛围，符合温暖气候、海滨及较慢生活节奏的需求。'
  },
  {
    index: 1,
    description: '广州：气候温暖，美食丰富，经济发达',
    reason: '气候温暖且以多元美食文化著称，虽经济发达但部分区域仍保留较慢生活节奏，兼顾美食与气候需求。'
  }
]
```

总Token：621

+ 输入：387
+ 输出：243

🏂：JSON结构之前的处理都是使用提示词来硬性控制，但是GPT-4等模型默认支持JSON结构，这个时候的输出是更加稳定的，同时也是更加便宜一些和更快一些

JSON结构中的带有很多字符，例如：逗号，引号，冒号等，所以JSON的符号制是最复杂的，会有一种情况出现，当输出的时候要求其“划重点”词语的时候，会出现字符串中还有双引号的出现，例如：

```javascript
{
  "index": 34,
  "description": "描述",
  "reason": '高频清脆特质精准匹配清点场景中金属物品的物理特性，"金光闪烁"的声效层次可增强物品珍贵感暗示'
}

```

这个时候进行JSON解析的时候会报出错误，导致解析失败，因为双引号和单引号的问题，有时候还会有无效字符的问题导致

解决方案就是，我们可以使用正则表达式进行清理，与大模型“斗智斗勇”

修复函数（仅供参考）

```javascript
export function sanitizeModelOutput(output: string): string {
  // 确保所有的双引号正确转义
  output = output.replace(/([^\\])"/g, '$1\\"'); // 转义字符串中的双引号

  // 修复可能存在的字段格式问题（例如键名没有使用双引号）
  output = output.replace(/(\w+):\s*'([^']+)'/g, '"$1": "$2"'); // 确保键名使用双引号

  return output;
}
```
