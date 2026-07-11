# 给Agent接入Browser use的设计思路

让Agent控制浏览器，其实有很多的实现方式，你可以在应用中内嵌一个浏览器，像cursor、codex那样，在应用中就可以打开网页，内部就可以使用tool工具定义实现，然后进行控制读取，但是这种方式是无法继承用户完整的浏览器权限的，无法完整模拟用户去操作浏览器

所以我更偏向使用浏览器插件作为中转，来控制用户的原本的浏览器，插件可以实现原始的Chroma API接口读取和操作Tab页面等方式，可以使用CDP提供的API来模拟人类使用浏览器，点击，下载，查看，输入等方式



Agent操作浏览器是一个很复杂的事情，有很多细节是值得慢慢学习的，我这次梳理只是让自己对于实现Agent控制浏览器有一个整体大概的理解，但是对于CDP、CUA、还有Playwright的具体使用和细节，我需要更多的时间在实践中慢慢理解，所以本篇文章就作为一个“引子”吧，让大家可以更好的去探索学习Agent操作浏览器这件事



调研资料：

- 《open-browser-use项目》：https://github.com/iFurySt/open-browser-use

- 《Actspace的项目》：https://github.com/WakeUp-Jin/actspace-agent

- 《Notch Agent》：https://github.com/Puggo1145/Notch-Agent

- 《ExcaliDraw图片的文件》：https://my.feishu.cn/file/FdJXbWkWDoebP7xkpnWcPCthn0e

## 一、Browser use核心实现思路

我们想要实现让Agent可以操作浏览器功能之前，首先要了解模拟人类使用浏览器的一些原语。

> 原语：观看确认位置、鼠标点击、鼠标双击、鼠标移动、键盘输入，键盘按键，下载，拖拽、网页滚动



借助这些原语，Chrome DeveTools Protocal提供相应原语操作浏览器的API，只有理解这第一层，那么Agent操作浏览器的功能实现起来就不再没有方向啦。

> 对于CDP提供的具体、完整的API的朋友，可以自行搜索或者让AI给你解释，我们这里主要专注整体的设计思路
> 
> 

![Image](./image/browser-1.PNG)

采用CUA的方式来实现让Agent操作浏览器，操作方式我们可以借助CDP提供的API来封装自己的函数。

例如：我需要点击网页的按钮，那么就可以封装一个点击函数，里面执行CDP中相应的API就可以



但是这里最关键的是一切操作的源头“看”，Agent怎么知道点击什么按钮？，这个按钮的位置在哪里？

**所以CUA中最核心的是：截图来确定坐标，通过确定下来的坐标就可以执行相应的操作事件，所以对于这一步，我们需要模型有多模态的能力，拥有识图的能力**



那么如果模型没有识图能力的话，或者说识图能力比较弱，那么我们可以使用DOM CUA的方式来实现让Agent操作浏览器，DOM CUA的方式和CUA不同的是，**DOM CUA不借助截图分析来确定起始操作的位置，而是通过DOM来确定操作的位置，并且通过node\_id执行相应的操作**

DOM CUA中关键的方法是：get\_visible\_dom方法，这个会获取网页上一切可见的DOM元素，并且以JSON的格式将结果返回给Agent，这样Agent就可以获取到元素的node\_id用来执行相应的操作啦

**🎃一个小提示：DOM CUA获取全部DOM元素的方法，内部调用的是CDP的原生的API，而其他的操作内部调用的是已经封装好的CUA的函数**



除了DOM CUA的方式，我们还可以使用成熟的浏览器操作框架Playwright，它里面有很多封装好的完整安全的执行流程，同时它也可以获取到CSS元素来作为操作条件，会比DOM CUA细很多

例如：它可以实现等待的操作、也可以使用元素过滤查询，可控性很强

```Plain Text
-----执行等待操作-------
CDP（你自己来）：
  发 Runtime.evaluate("document.querySelector('.result')")
  → 如果元素还没加载出来 → 返回 null → 失败
  → 你得自己写 while 循环 + sleep + 重试 + 超时处理
  
Playwright（自动帮你等）：
  wait_for(selector=".result", state="visible")
  → 内部自动轮询、检查状态、处理超时
  → 只在元素真正可见后才返回
  

-----查询元素状态｜过滤查询------
*// CDP 方式（每次手写 JS）：*
Runtime.evaluate({
  expression: `
    const el = document.querySelector('.submit-btn');
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden'
      && style.opacity !== '0' && rect.width > 0 && rect.height > 0
      && !el.disabled && el.getAttribute('aria-disabled') !== 'true';
  `
})
*// Playwright 方式：*
is_visible(selector=".submit-btn")  *// → true/false*
is_enabled(selector=".submit-btn")  *// → true/false*
```



## 二、如何将核心接入Agent

![Image](./image/browser-2.png)

目前可以考虑三种比较不错的方式：

1. 内嵌Tool工具：将这些函数以工具列表的方式提供给Agent调用

2. MCP服务器：以MCP的方式提供给Agent，设计好暴露出去的资源函数

3. Skill\+Cli方式：将这些函数封装称为一个cli工具，借助skill作为工具“使用指南”提供给Agent调用



## 三、Browser use 完整架构

我们一共分析三种应用的架构设计，每一种的侧重点都不同，应用场景也是不同的，值得多思考

1. Codex的Browser use

2. Open Browser use

3. ActSpace的Browser use



**1、首先我们梳理的是Codex的实现设计**Codex的实现会将大部分的逻辑实现在Browser\-client\.js中，该文件近2700行代码，非常的复杂，而使用rust实现的extension\-host只是简单的做消息的转发的中继器的角色，下图就是数据链路的传递。

![Image](./image/browser-3.png)

Codex的实现中，有一些交互上面的小细节非常值得参考借鉴，第一个是：鼠标的移动是有起始位置的，会丝滑的过渡点击，第二个是：Agent创建的Tab页面和用户创建的页面是分开的，有清晰的样式可以区分



**2、其次是Open\-Browser\-Use的架构分析实现**该插件的实现，重点在“open”上面，所以对于调用方会做的非常全面，可以skill的cli方式调用，也可以MCP直接连接，甚至你开发的Agent的话也可以直接SDK接入，open\-browser\-use的实现大部分业务逻辑是放在go实现的客户端上，里面同时存在和浏览器插件通信的文件进程

> 对于这个项目的分析，我是从大角度去梳理的，可能在细节上不一定完全对得齐，如果有感谢兴趣的朋友可以去仓库看源码
> 
> 

![Image](./image/browser-4.png)



**3、对于ActSpace的架构设计分析**我借鉴了上面两个优秀的设计思路，为了更好的和actspace项目内部的逻辑结合在一起，使用文件的方式直接嵌入到项目源码中去，由这个browser\-tool文件来定义提供什么浏览器操作给Agent，由它来做第一道安全的把关，整体的文件没有codex那么重，很轻量，文件只是简单的将消息转发和工具提供的职责，没有大量的业务。

为了保证提供Skill\+Cli的插件访问形式，我将大量的业务放在Go实现的cli上面啦，里面是核心的浏览器操作实现指令，同时连接插件的进程也是在cli中实现的。

![Image](./image/browser-5.png)

ActSpace的实现中，有一个小细节，因为担心tool工具定义的实现，将浏览器操作的工具提供给Agent，我担心参数太复杂，工具描述不能清晰完整的介绍，导致Agent调用的时候出现大量的错误，所以我提供啦一个browser\_help的命令，执行这个命令之后会返回完整的指令介绍还有参数描述，极大的提高Agent调用浏览器控制的正确性



