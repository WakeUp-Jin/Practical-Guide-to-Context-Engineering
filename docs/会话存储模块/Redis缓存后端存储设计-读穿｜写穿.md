
# Redis缓存后端存储设计-读穿｜写穿
Redis 缓存后端的设计，比多后端设计更加简单直观，使用便捷，开发难度小，同时也保持了**高性能和数据一致性的优势。**

唯一的不足就是**没有多后端设计的高可用**，因为其使用 Redis 作为缓存，唯一的持久化后端只有一个，所以并没有“备用”数据的存在，在高可用方面是薄弱的，但是同时换来了开发难度的降低和架构的清晰

****

## 一、为什么需要 Redis 缓存后端
+ 高性能：Redis 作为缓存层，是和系统直连的数据层，查询和写入都会非常的快速
+ 架构简约：架构非常清晰，使用 Redis 作为缓存，后面一层持久化数据库，开发难度小
+ 持久化：Redis 提供高速访问的同时，也有一层持久化数据库来保障数据的安全，增加容错机制

## 二、架构设计
Excalidraw 文件：[https://gcntfv628ebr.feishu.cn/file/L9N9bNDUIocNUNxh25KcM7FRn2e](https://gcntfv628ebr.feishu.cn/file/L9N9bNDUIocNUNxh25KcM7FRn2e)

![](./image/image%20(25).png)



1. Redis 缓存：主要负责聊天记录的的高效读取，并且当 Redis 获取失败之后会从持久化数据库中获取之后写回缓存
2. 持久化数据库：负责存储数据，作为缓存层的兜底数据库



## 三、工作原理
**1、写入操作**

+ 首先将消息写入到持久化数据库
+ 当持久化数据库写入成功之后在将数据写入到 Redis 缓存中



**持久化数据库作为唯一的真相源，要保证该数据库中写入成功之后，才写入到 Redis 中，保证数据的一致性，以持久化数据库为准**

****

**2、读取操作**

+ 首先从 Redis 中读取消息
+ 如果 Redis 中读取失败或者为空，那在读取持久化数据库
+ 读取成功之后，将数据返回的同时也需要将数据写回缓存 Redis 中



这样可以保证下次的读取 Redis 缓存中就有数据了

## 四、代码实现
### 4.1、 目录结构设计
```plain
  src/core/storage/
  ├── index.ts                    # 统一导出
  ├── unified-storage.ts          # 统一存储服务(核心)
  ├── config.ts                   # 配置schema
  ├── types.ts                    # 类型定义
  ├── backends/                   # 后端实现
  │   ├── cache/                  # 缓存后端
  │   │   ├── redis-cache.ts      # Redis缓存实现
  │   │   └── memory-cache.ts     # 内存缓存实现
  │   └── persistent/             # 持久化后端
  │       ├── mysql-store.ts      # MySQL实现
  │       ├── mongodb-store.ts    # MongoDB实现
  │       └── memory-store.ts     # 内存存储实现
  └── factory.ts                  # 工厂创建器
```



### 4.2、 核心接口设计
```typescript
// types.ts
export interface CacheBackend {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

export interface PersistentBackend {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

export interface UnifiedStorageOptions {
  cache: CacheBackend;
  persistent: PersistentBackend;
  defaultTtl?: number;
  enableWriteThrough?: boolean;
  enableReadThrough?: boolean;
}
```

### 4.3、统一存储服务实现
```typescript
/ unified-storage.ts
  export class UnifiedStorage {
    private cache: CacheBackend;
    private persistent: PersistentBackend;
    private defaultTtl: number;
    private writeThrough: boolean;
    private readThrough: boolean;

    constructor(options: UnifiedStorageOptions) {
      this.cache = options.cache;
      this.persistent = options.persistent;
      this.defaultTtl = options.defaultTtl || 3600; // 1小时
      this.writeThrough = options.enableWriteThrough ?? true;
      this.readThrough = options.enableReadThrough ?? true;
    }

    // 写穿模式：同时写入缓存和持久层
    async set<T>(key: string, value: T, ttl?: number):Promise<void> {
      const actualTtl = ttl || this.defaultTtl;

      if (this.writeThrough) {
        // 并发写入两个存储
        await Promise.all([
          this.cache.set(key, value, actualTtl),
          this.persistent.set(key, value)
        ]);
      } else {
        // 仅写入持久层
        await this.persistent.set(key, value);
      }
    }

    // 读穿模式：优先缓存，缓存未命中时从持久层读取并回写
    async get<T>(key: string): Promise<T | null> {
      // 1. 优先从缓存读取
      try {
        const cached = await this.cache.get<T>(key);
        if (cached !== null) {
          return cached;
        }
      } catch (error) {
        // 缓存读取失败，继续从持久层读取
        console.warn(`Cache read failed for key ${key}:`,error);
      }

      // 2. 缓存未命中，从持久层读取
      const persistent = await this.persistent.get<T>(key);

      if (persistent !== null && this.readThrough) {
        // 3. 回写缓存（异步，不阻塞返回）
        this.cache.set(key, persistent,
  this.defaultTtl).catch(error => {
          console.warn(`Cache write-back failed for key 
  ${key}:`, error);
        });
      }

      return persistent;
    }

    // 删除操作：同时删除缓存和持久层
    async delete(key: string): Promise<void> {
      await Promise.allSettled([
        this.cache.delete(key),
        this.persistent.delete(key)
      ]);
    }

    // 检查存在性：优先检查缓存
    async exists(key: string): Promise<boolean> {
      const cacheExists = await this.cache.exists(key);
      if (cacheExists) return true;

      return await this.persistent.exists(key);
    }
  }
```

该管理器主要的方法有：

+ set 方法：用于写入缓存和持久层
+ get 方法：读取数据，优先从缓存，之后在从持久层
+ delete 方法：删除数据
+ exists 方法：检查键是否存在



### 4.4、工厂模式创建器
```typescript
// factory.ts
  export class StorageFactory {
    static async createUnifiedStorage(config: StorageConfig):
  Promise<UnifiedStorage> {
      // 创建缓存后端
      const cache = await this.createCacheBackend(config.cache);

      // 创建持久化后端  
      const persistent = await this.createPersistentBackend(config.persistent);

      // 连接后端
      await Promise.all([
        cache.connect(),
        persistent.connect()
      ]);

      return new UnifiedStorage({
        cache,
        persistent,
        defaultTtl: config.defaultTtl,
        enableWriteThrough: config.enableWriteThrough,
        enableReadThrough: config.enableReadThrough
      });
    }

    private static async createCacheBackend(config:CacheConfig): Promise<CacheBackend> {
      switch (config.type) {
        case 'redis':
          const { RedisCache } = await import('./backends/cache/redis-cache.js');
          return new RedisCache(config.options);
        case 'memory':
        default:
          const { MemoryCache } = await import('./backends/cache/memory-cache.js');
          return new MemoryCache();
      }
    }

    private static async createPersistentBackend(config:PersistentConfig): Promise<PersistentBackend> {
      switch (config.type) {
        case 'mysql':
          const { MySQLStore } = await import('./backends/persistent/mysql-store.js');
          return new MySQLStore(config.options);
        case 'mongodb':
          const { MongoDBStore } = await import('./backends/persistent/mongodb-store.js');
          return new MongoDBStore(config.options);
        case 'memory':
        default:
          const { MemoryStore } = await import('./backends/persistent/memory-store.js');
          return new MemoryStore();
      }
    }
  }
```

工厂模式是一种创建型设计模式，它提供了一种创建东西的接口，让子类决定实例化哪一个类，**工厂模式就是把实例化操作推迟到子类**

****

**核心思路：不直接使用 new 创建对象，而是通过工厂方法来创建对象**

### 4.5、配置 Schema 设计
```typescript
  // config.ts
  export const StorageConfigSchema = z.object({
    cache: z.object({
      type: z.enum(['redis', 'memory']),
      options: z.record(z.any()).optional()
    }),
    persistent: z.object({
      type: z.enum(['mysql', 'mongodb', 'memory']),
      options: z.record(z.any()).optional()
    }),
    defaultTtl: z.number().default(3600),
    enableWriteThrough: z.boolean().default(true),
    enableReadThrough: z.boolean().default(true)
  }).strict();

  export type StorageConfig = z.infer<typeofStorageConfigSchema>;
```

+ defaultTtl：默认过期时间
+ enableWriteThrough：写穿模式，启用是同时写入缓存和数据库，禁用时只写数据库，不写缓存
+ enableReadThrough：读穿模式，启用是从 DB 加载之后自动更新缓存，禁用时只读缓存

### 4.6、使用示例
```typescript
// 使用示例
  const config: StorageConfig = {
    cache: {
      type: 'redis',
      options: { url: 'redis://localhost:6379' }
    },
    persistent: {
      type: 'mysql',
      options: {
        host: 'localhost',
        database: 'cipher',
        user: 'root',
        password: 'password'
      }
    },
    defaultTtl: 1800, // 30分钟
    enableWriteThrough: true,
    enableReadThrough: true
  };

  const storage = await
  StorageFactory.createUnifiedStorage(config);

  // 写入数据 - 同时写入Redis和MySQL
  await storage.set('user:123', { name: 'John', age: 30 });

  // 读取数据 - 优先从Redis读取，未命中时从MySQL读取并回写Redis
  const user = await storage.get<User>('user:123');
```

## 五、一些优化
### 5.1、读操作-旁路缓存模式（Cache-Aside Pattern）
使用双写模式有时候在高性能的和大量数据的情况下，会导致两个问题

1. **并发写入数据不一致的问题**
2. **部分失败，只成功写入缓存，或者 DB 中**

****

问题 1：并发写入数据不一致

```typescript
时间线：
T1: 线程A写入 user:1 = {name: "Alice", age: 20}
T2: 线程B写入 user:1 = {name: "Alice", age: 21}

可能的执行顺序：
T1: A写入DB {age: 20}
T2: B写入DB {age: 21}      // DB最终值：21
T3: B写入Cache {age: 21}
T4: A写入Cache {age: 20}   // Cache最终值：20 不一致！
```

问题 2:部分失败

```typescript
await cache.set(key, value);  // 成功
await db.set(key, value);      // 失败
```



🌟 **在旁路缓存模式下，会先写入 DB（单一真是数据源重），之后删除缓存（而不是更新）**

```typescript
//之前的双写模式
async unsafeSet(key: string, value: any) {
  // 两个写操作可能因为网络延迟、并发等原因导致顺序错乱
  await Promise.all([
    this.cache.set(key, value, 3600),
    this.db.set(key, value)
  ]);
}

//保证最终一致性的模式
async safeSet(key: string, value: any) {
  // 1. DB是唯一真实数据源
  await this.db.set(key, value);

  // 2. 缓存失效（删除）而不是更新
  try {
    await this.cache.delete(key);
  } catch (error) {
    // 即使删除失败也没关系，最多是暂时读到旧数据
    // TTL会让它最终过期
    console.warn(`Cache invalidation failed for ${key}`);
  }
}
```



### 5.2、写操作-同进程去重（single-flight）
同进程去重可以避免缓存击穿，那么什么是缓存击穿？

**缓存击穿：是指某个热点key在缓存过期的瞬间，大量并发请求同时访问这个key，导致这些请求全部打到数据库上，造成数据库瞬间压力过大。**

```typescript
  时间线：
  T0: 热点数据 "hot:product:123" 在缓存中，QPS 10000
  T1: 缓存过期，key被删除
  T2: 1000个请求同时到达
  T3: 1000个请求都发现缓存没有
  T4: 1000个请求同时查询DB ❌ DB瞬间压力暴增！
```



**同进程去重：同一个时间对同一个 key 只允许一个 DB 查询**

```typescript
class SingleFlightGroup {
    private inFlight: Map<string, Promise<any>> = new Map();

    async do<T>(key: string, fn: () => Promise<T>): Promise<T> {
      // 检查是否已有相同key的请求在执行
      const existing = this.inFlight.get(key);
      if (existing) {
        // 复用已有的请求，等待其结果
        return existing;
      }

      // 创建新请求并记录
      const promise = fn().finally(() => {
        // 请求完成后清理
        this.inFlight.delete(key);
      });

      this.inFlight.set(key, promise);
      return promise;
    }
  }

  // 使用示例
  const sfg = new SingleFlightGroup();

  async function getWithProtection(key: string) {
    // 即使1000个请求同时到达，也只会有1个真正查询DB
    return sfg.do(key, async () => {
      // 只有第一个请求会执行这里的代码
      const value = await db.get(key);
      await cache.set(key, value, 3600);
      return value;
    });
  }
```

第一步：先检查是否有相同的请求正在执行

第二步：首个请求，创建新的 Promise

第三步：请求完成之后，清理资源，允许下次请求

第四步：记录这个 Promise，用于第一步进行检查正在运行的



**处理进程去重还有其他两种方法：**

1. **互斥锁：只允许一个请求去加载数据，其他请求等待**
2. **提取刷新：当 TTL 小于阈值的时候，提前刷新**

