export default {
  // site-level options
  base: "/Practical-Guide-to-Context-Engineering/",
  rewrites: {
    "guide/index.md": "index.md",
  },
  markdown: {
    config: (md) => {
      // 自定义插件：让单独的代码块也能通过 [filename] 语法显示文件名标签
      const defaultFence = md.renderer.rules.fence;
      md.renderer.rules.fence = (tokens, idx, options, env, self) => {
        const token = tokens[idx];
        const info = token.info ? token.info.trim() : "";
        // 匹配 typescript [filename.ts] 或 js [config.js] 等格式
        const match = info.match(/^(\w+)\s*\[([^\]]+)\](.*)$/);

        if (match) {
          const filename = match[2];
          // 把 info 还原成不带 [filename] 的格式，保留其他修饰符（如行号高亮）
          token.info = match[1] + (match[3] || "");
          const rendered = defaultFence(tokens, idx, options, env, self);
          // 在代码块外面包一层带文件名标签的容器
          return `<div class="code-block-with-filename"><div class="code-block-filename">${md.utils.escapeHtml(filename)}</div>${rendered}</div>`;
        }

        return defaultFence(tokens, idx, options, env, self);
      };
    },
  },
  title: "上下文工程实践指南",
  description: "从理论到实践，从基础到进阶，构建你的上下文工程体系",
  lastUpdated: true,
  head: [
    [
      "link",
      {
        rel: "icon",
        href: "/Practical-Guide-to-Context-Engineering/favicon.ico",
        type: "image/x-icon",
      },
    ],
  ],
  ignoreDeadLinks: [
    /\.log$/, // 忽略所有.log文件的dead link检查
  ],

  themeConfig: {
    // theme-level options
    // nav: [{ text: "指南", link: "/" }],
    sidebar: [
      {
        text: "全局认知",
        items: [
          { text: "首页", link: "/" },
          { text: "上下文工程", link: "/概述/上下文工程" },
          { text: "Harness Engineering", link: "/概述/Harness%20Engineering" },
          {
            text: "基于上下文工程的 Agent 后端设计",
            link: "/前言/从零到一：基于上下文工程的%20Agent%20后端设计",
          },
        ],
      },
      {
        text: "大模型应用开发基础技术",
        items: [
          { text: "RAG 策略", link: "/RAG技术/RAG策略-index" },
          { text: "搜索代理", link: "/搜索代理/搜索代理" },
          {text: "为你的Agent集成Skill系统",link: "/工具管理模块/为你的Agent集成Skill系统"},
        ],
      },
      {
        text: "上下文核心模块",
        items: [
          {
            text: "系统提示词 [待补充]",
          },
          {
            text: "工具管理",
            collapsed: false,
            items: [
              { text: "工具管理概述", link: "/工具管理模块/工具管理" },
              {
                text: "工具调度与权限模块的开发",
                link: "/工具管理模块/工具调度与权限模块的开发",
              },
              {text: "Bash工具实现和安全权限设计",link: "/工具管理模块/Bash工具实现和安全权限设计细节"},
              {
                text: "Kode 工具定义",
                link: "/工具管理模块/ClaudeCode逆向工程（Kode）的工具定义和管理 -TS版本",
              },
            ],
          },
          {
            text: "用户记忆 [待补充]",
          },
          {
            text: "会话存储",
            collapsed: false,
            items: [
              {
                text: "Redis 读写穿透",
                link: "/会话存储模块/Redis缓存后端存储设计-读穿｜写穿",
              },
              {
                text: "多后端备份降级",
                link: "/会话存储模块/多后端存储设计-备份降级策略",
              },
            ],
          },
          {
            text: "结构化输出",
            collapsed: false,
            items: [
              {
                text: "JSON 结构化输出",
                link: "/结构化输出模块/JSON结构化输出的方法",
              },
              {
                text: "输出格式成本",
                link: "/结构化输出模块/LLM 输出格式成本：为什么 JSON 比 TSV 成本更高",
              },
            ],
          },
          {
            text: "LLM 模块",
            collapsed: false,
            items: [
              {
                text: "LLM 服务层设计",
                link: "/LLM模块/LLM服务层的实现设计",
              },
              {
                text: "Cipher 服务架构",
                link: "/LLM模块/Cipher的LLM 服务架构分析文档 -TS版本",
              },
            ],
          },
        ],
      },
      {
        text: "上下文管理：跨模块的全局策略",
        items: [
          { text: "上下文管理策略", link: "/上下文管理/上下文管理" },
          { text: "Token 压缩策略", link: "/上下文管理/Token压缩策略" },
          {
            text: "ClaudeCode 与 Gemini 压缩",
            link: "/上下文管理/上下文压缩：ClaudeCode、Gemini与工具消息裁剪",
          },
        ],
      },
      {
        text: "Agent 运行空间",
        items: [
          {
            text: "Agent 形态",
            collapsed: false,
            items: [
              {
                text: "协同与自主 Agent",
                link: "/Agent形态/两种世界的交互形态：协同Agent与自主Agent",
              },
              {
                text: "单智能体与多智能体",
                link: "/Agent形态/智能体系统构建策略-单智能体和多智能体",
              },
            ],
          },
          {
            text: "Agent 评估",
            collapsed: false,
            items: [
              { text: "Agent 的评估", link: "/Agent评估/Agent的评估" },
              {
                text: "评估器实现 (TS)",
                link: "/Agent评估/实现Agent的评估器-TS版本",
              },
              {
                text: "多种 Agent 评估方法",
                link: "/Agent评估/评估多种类型Agent的方法",
              },
            ],
          },
          {
            text: "定时任务与KAIROS模式",
            link: "/Agent运行空间/让Agent从被动变为主动：定时任务和KAIROS模式",
          },
        ],
      },
      {
        text: "实践与案例",
        items: [
          {
            text: "ReasonCode 项目介绍",
            link: "/ReasonCode开发设计文档/首页：ReasonCode项目介绍",
          },
          {
            text: "Claude Code 配置全解",
            link: "/AI协作编码与上下文工程/Anthropic 黑客马拉松冠军- ClaudeCode配置整理和补充",
          },
        ],
      },
      {
        text: "附录",
        items: [
          { text: "更新日记", link: "/更新日记/更新日记" },
        ],
      },
    ],

    editLink: {
      pattern:
        "https://github.com/WakeUp-Jin/Practical-Guide-to-Context-Engineering/edit/main/docs/:path",
      text: "在 GitHub 上编辑此页面",
    },

    //右侧的大纲
    outline: { level: [1, 2, 3,], label: "本章目录" },
    // 搜索（v1 内置本地搜索足够好；若要 Algolia，配置 algolia 字段）
    search: { provider: "local" },

    // 社交链接
    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/WakeUp-Jin/Practical-Guide-to-Context-Engineering",
      },
    ],
    lastUpdated: {
      text: "最后更新时间",
      formatOptions: {
        dateStyle: "long",
        timeStyle: "short",
      },
    },
  },
};
