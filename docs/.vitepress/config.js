export default {
    // site-level options
    base:'/Practical-Guide-to-Context-Engineering/',
    title: '上下文工程实践指南',
    description: '从理论到实践，从基础到进阶，构建你的上下文工程体系',
  
    themeConfig: {
      // theme-level options
      nav: [
        { text: '指南', link: '/guide/' }
      ],
      sidebar: [
        {
          text: '前言',
          items: [
            { text: '上下文组成' }
          ]
        },
        {
          text: '第一部分：上下文工程基础技术',
          items: [
            { text: '第一章 数据持久化',  },
            { text: '第二章 向量存储和嵌入模型',  },
            { text: '第三章 知识图谱',  },
            { text: '第四章 RAG技术', 
              items: [
                { text: 'RAG策略', link: '/RAG技术/RAG策略-index' },
                { text: '编码器和LLM微调'}
              ]
            }
          ]
        },
        {
          text: '第二部分：上下文组成工程实践',
          items: [
            { text: '第五章 系统提示词模块',  },
            { text: '第六章 工具管理模块',
              items: [
                { text: '工具管理', link: '/工具管理模块/工具管理' },
                { text: '模型调用工具能力评估',  },
                { text: 'MCP与MCP的安全',  }
              ]
            },
            { text: '第七章 用户记忆模块',  },
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
            { text: '第十章 相关上下文模块' },
            { text: '第十一章 LLM模块',
              items: [
                { text: 'LLM服务层的实现设计', link: '/LLM模块/LLM服务层的实现设计' },
                { text: '三大LLM提供商实现策略细节' }
              ]
            }
          ]
        },
        {
          text: '第三部分：上下文管理',
          items: [
            { text: '第十二章 上下文管理', link: '/上下文管理/上下文管理' },
            { text: '第十三章 Token压缩策略', link: '/上下文管理/Token压缩策略' }
          ]
        },
        {
          text: '第四部分：Agent架构设计',
          items: [
            { text: '两种世界的交互形态：协同Agent与自主Agent', link: '/Agent形态/两种世界的交互形态：协同Agent与自主Agent' }
          ]
        },
        {
          text: '第五部分：Agent评估',
          items: [
            { text: '敬请期待' }
          ]
        },
        {
          text: '第六部分：上下文工程实践项目',
          items: [
            { text: '敬请期待' }
          ]
        }
      ]
    },
  }