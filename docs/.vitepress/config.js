export default {
    // site-level options
    base:'/Practical-Guide-to-Context-Engineering/',
    markdown: {
      config: (md) => {
        // 自定义插件：让单独的代码块也能通过 [filename] 语法显示文件名标签
        const defaultFence = md.renderer.rules.fence
        md.renderer.rules.fence = (tokens, idx, options, env, self) => {
          const token = tokens[idx]
          const info = token.info ? token.info.trim() : ''
          // 匹配 typescript [filename.ts] 或 js [config.js] 等格式
          const match = info.match(/^(\w+)\s*\[([^\]]+)\](.*)$/)
          
          if (match) {
            const filename = match[2]
            // 把 info 还原成不带 [filename] 的格式，保留其他修饰符（如行号高亮）
            token.info = match[1] + (match[3] || '')
            const rendered = defaultFence(tokens, idx, options, env, self)
            // 在代码块外面包一层带文件名标签的容器
            return `<div class="code-block-with-filename"><div class="code-block-filename">${md.utils.escapeHtml(filename)}</div>${rendered}</div>`
          }
          
          return defaultFence(tokens, idx, options, env, self)
        }
      }
    },
    title: '上下文工程实践指南',
    description: '从理论到实践，从基础到进阶，构建你的上下文工程体系',
    lastUpdated: true,
    head:[
      ['link', { rel: 'icon', href: '/Practical-Guide-to-Context-Engineering/favicon.ico',type: 'image/x-icon' }]
    ],
    ignoreDeadLinks: [
      /\.log$/,  // 忽略所有.log文件的dead link检查
    ],
  
    themeConfig: {
      // theme-level options
      nav: [
        { text: '指南', link: '/guide/' }
      ],
      sidebar: [
        {
          text: '前言',
          items: [
            // { text: '上下文组成' },
            { text: '更新日记', link: '/更新日记/更新日记' },
            { text: '从零到一：基于上下文工程的 Agent 后端设计', link: '/前言/从零到一：基于上下文工程的%20Agent%20后端设计' }
          ]
        },
        {
          text: '第一部分：上下文工程基础技术',
          items: [
            // { text: '第一章 数据持久化(待整理)',  },
            { text: '第一章 向量存储和嵌入模型(待整理)',  },
            { text: '第二章 知识图谱(待整理)',  },
            { text: '第三章 RAG技术', 
              items: [
                { text: 'RAG策略', link: '/RAG技术/RAG策略-index' },
                // { text: '编码器和LLM微调'}
              ]
            },
            { text: '第四章 搜索代理', link: '/搜索代理/搜索代理' }
          ]
        },
        {
          text: '第二部分：上下文组成工程实践',
          items: [
            { text: '第五章 系统提示词模块(待整理)',  },
            { text: '第六章 工具管理模块',
              items: [
                { text: '工具管理', link: '/工具管理模块/工具管理' },
                { text: 'ClaudeCode逆向工程（Kode）的工具定义和管理', link: '/工具管理模块/ClaudeCode逆向工程（Kode）的工具定义和管理 -TS版本' },
                // { text: '模型调用工具能力评估',  },
                // { text: 'MCP与MCP的安全',  }
              ]
            },
            { text: '第七章 用户记忆模块(待整理)',  },
            { text: '第八章 会话存储模块',
              items: [
                { text: 'Redis缓存后端存储设计-读穿｜写穿', link: '/会话存储模块/Redis缓存后端存储设计-读穿｜写穿' },
                { text: '多后端存储设计-备份降级策略', link: '/会话存储模块/多后端存储设计-备份降级策略' }
              ]
            },
            { text: '第九章 结构化输出模块',
              items: [
                { text: 'JSON结构化输出的方法', link: '/结构化输出模块/JSON结构化输出的方法' },
                { text: 'LLM输出格式成本：为什么JSON比TSV成本更高', link: '/结构化输出模块/LLM 输出格式成本：为什么 JSON 比 TSV 成本更高' }
              ]
            },
            { text: '第十章 相关上下文模块(待整理)',  },
            { text: '第十一章 LLM模块',
              items: [
                { text: 'LLM服务层的实现设计', link: '/LLM模块/LLM服务层的实现设计' },
                { text: 'Cipher的LLM 服务架构分析文档', link: '/LLM模块/Cipher的LLM 服务架构分析文档 -TS版本' },
                // { text: '三大LLM提供商实现策略细节' }
              ]
            }
          ]
        },
        {
          text: '第三部分：上下文管理',
          items: [
            { text: '第十二章 上下文管理', link: '/上下文管理/上下文管理' },
            { text: '第十三章 Token压缩策略', link: '/上下文管理/Token压缩策略' },
            { text: '第十四章 上下文压缩：ClaudeCode、Gemini 与工具消息裁剪', link: '/上下文管理/上下文压缩：ClaudeCode、Gemini与工具消息裁剪' }
          ]
        },
        {
          text: '第四部分：Agent架构设计',
          items: [
            { text: '第十五章 两种世界的交互形态：协同Agent与自主Agent', link: '/Agent形态/两种世界的交互形态：协同Agent与自主Agent' },
            { text: '第十六章 智能体系统构建策略：单智能体和多智能体', link: '/Agent形态/智能体系统构建策略-单智能体和多智能体' }
          ]
        },
        {
          text: '第五部分：Agent评估',
          items: [
            { text: '第十七章 Agent的评估', link: '/Agent评估/Agent的评估' },
            { text: '第十八章 实现Agent的评估器-TS版本', link: '/Agent评估/实现Agent的评估器-TS版本' },
            { text: '第十九章 揭秘 AI 代理的评估 - 多种Agent的评估方法', link: '/Agent评估/评估多种类型Agent的方法' }
          ]
        },
        {
          text: '第六部分：AI协作编码与上下文工程',
          items: [
            { text: '第二十章 Anthropic 黑客马拉松冠军- ClaudeCode配置整理和补充', link: '/AI协作编码与上下文工程/Anthropic 黑客马拉松冠军- ClaudeCode配置整理和补充' }
          ]
        },
        {
          text: '第七部分：上下文工程实践项目',
          items: [
            { text: '敬请期待' }
          ]
        }
      ],

      editLink: {
        pattern: 'https://github.com/WakeUp-Jin/Practical-Guide-to-Context-Engineering/edit/main/docs/:path',
        text: '在 GitHub 上编辑此页面'
      },

      //右侧的大纲
      outline:{level:[1,2,3],label:"本章目录"},
      // 搜索（v1 内置本地搜索足够好；若要 Algolia，配置 algolia 字段）
      search: { provider: 'local' },

      // 社交链接
      socialLinks: [{ icon: 'github', link: 'https://github.com/WakeUp-Jin/Practical-Guide-to-Context-Engineering' }],
      lastUpdated:{
        text:"最后更新时间",
        formatOptions:{
          dateStyle:"long",
          timeStyle:"short"
        }
      }
    },
  }