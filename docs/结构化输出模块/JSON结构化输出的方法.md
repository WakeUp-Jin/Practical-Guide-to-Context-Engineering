
# JSON结构化输出的方法

让大模型 JSON 结构化的输出方法目前有三种

1. 工具调用辅助
2. 提示词控制+结果解析
3. JSON 参数

## 一、工具调用输出
在 Function Call 的模式下，输出的结果自然就是 JSON，工具调用的名称和参数的 JSON 格式

🚀 **那么是不是可以思考一下，我设置了一个函数，这个函数的执行结果为空，执行代码无，因为这个函数就是用来输出 JSON 格式的参数列表的，**

**这个参数列表就是我需要的结果，而不是工具调用之后返回的结果**

****

例如现在有一个使用 LLM 进行总结摘要的功能

```typescript
//方式A：提示词控制结构化输出
const prompt = `
请总结以下内容，输出必须是 JSON：
{
  "title": "...",
  "key_points": ["...", "..."],
  "sentiment": "positive | neutral | negative"
}
内容：${inputText}
`;

// 模型大概率会返回 JSON 字符串
const raw = await llm.chat(prompt);
const result = JSON.parse(raw);
console.log(result);


//方式B：工具调用辅助结构化输出
// 定义一个“假的工具”，只要参数，不关心执行
const tools = [{
  name: "summarize_text",
  description: "把文本总结为 JSON",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string" },
      key_points: { type: "array", items: { type: "string" } },
      sentiment: { type: "string" }
    },
    required: ["title", "key_points", "sentiment"]
  }
}];

// 让模型调用工具
const res = await llm.chatWithTools({
  user: `请总结：${inputText}`,
  tools,
  tool_choice: "summarize_text" // 强制用工具
});

// 拿到工具的参数 = 我们要的 JSON
const args = JSON.parse(res.tool_calls[0].arguments);
console.log(args);

```



## 二、提示词控制
我们需要大模型输出 JSON 格式的时候，会在提示词里面控制大模型输出结果，例如：

> “输出结果一定要是JSON格式，字段要求：xxx、xxxx、xxxx”
>

这个时候大模型大部分情况下输出的效果还是可以的，如果要让效果更加稳定，我们需要花一点心思在提示词的优化上面。



当大模型输出 JSON 格式的字符串之后，要成为真正的对象格式，还需要进行字符串解析的

1、自己编写解析函数

```typescript
 function parseModelOutput(output) {
    try {
      // 提取JSON部分（去除可能的前后文本）
      const jsonMatch = output.match(/\{.*\}/s);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(output);
    } catch (error) {
      console.error('JSON解析失败:', error);
      return null;
    }
  }
```



2、使用 LangChain 中的`JsonOutputParser`

```typescript
import { JsonOutputParser } from '@langchain/core/output_parsers';

  let parseJSON = new JsonOutputParser<BackMusic>();

  let chain = prompt.pipe(model).pipe(parseJSON);
```

## 三、JSON 参数
  API原生JSON支持

 1、OpenAI API

```typescript
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [...],
    response_format: { type: "json_object" }
  });
```



2、Anthropic Claude API

```typescript
  const response = await anthropic.messages.create({
    model: "claude-3-sonnet-20240229",
    messages: [...],
    response_format: { type: "json" }
  });
```



API 参数的控制会比提示词控制在输出 JSON 格式方面更稳定，输出必定为有效的 JSON

