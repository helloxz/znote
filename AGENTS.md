# Zest 框架结构说明

## 技术栈

| 组件 | 技术 |
|------|------|
| 运行时 | Bun |
| 后端框架 | Hono v4 |
| 前端框架 | Vue 3 + Vite 7 |
| UI 组件库 | Naive UI |
| 数据库 | libsql (SQLite fork) |
| ORM | Drizzle ORM |
| 国际化 | vue-i18n (中/英) |
| 状态管理 | Pinia |
| 图标组件 | DynamicIcon.vue，引入为ZIcon |

---

## 目录结构

### 后端目录 (`backend/`)

```
backend/
├── index.ts              # 后端入口（创建 Hono app，挂载路由）
├── routers.ts            # 路由定义（publicRouter / userRouter / adminRouter）
├── types.ts              # 类型定义
├── api/                  # API 处理器
│   ├── html.ts           # 返回前端 SPA HTML
│   ├── info.ts           # 应用信息接口
│   ├── setting.ts        # 用户设置 CRUD
│   ├── system.ts         # 系统状态接口
│   └── user.ts           # 用户相关（注册/登录/登出/改密码）
├── db/                   # 数据库层
│   ├── index.ts          # Drizzle ORM 初始化
│   └── schema.ts         # 数据库表定义（users, sessions, user_settings）
├── middleware/
│   └── auth.ts           # Bearer Token 认证中间件
└── utils/
    ├── check.ts          # 输入校验
    └── helper.ts         # 工具函数（密码加密/Token解析）
```

> 注意：使用Mastra框架的时候你应该遵循skills的约定，而不是自我猜测它的用法。

### 前端目录 (`frontend/`)

```
frontend/
├── index.html            # Vite 入口 HTML
├── package.json          # 前端依赖配置
├── vite.config.ts        # Vite 配置
├── src/
│   ├── main.ts           # 前端入口（创建 Vue App）
│   ├── App.vue           # 根组件
│   ├── i18n/             # 国际化
│   │   ├── index.ts      # i18n 初始化
│   │   └── locales/
│   │       ├── zh.ts     # 中文翻译
│   │       └── en.ts     # 英文翻译
│   ├── router/
│   │   └── index.ts      # Vue Router 配置
│   ├── stores/           # Pinia 状态管理
│   │   ├── user.ts       # 用户状态
│   │   ├── site.ts       # 站点信息
│   │   └── system.ts     # 系统状态
│   ├── config/
│   │   └── menu.ts       # 后台菜单配置
│   ├── utils/
│   │   └── req.ts        # Axios 封装
│   ├── components/
│   │   └── dashboard/    # 后台面板组件
│   └── views/            # 页面视图
```

---

## 核心入口文件

| 用途 | 文件路径 |
|------|----------|
| 后端入口 | `backend/index.ts` |
| 路由定义 | `backend/routers.ts` |
| 数据库 Schema | `backend/db/schema.ts` |
| 数据库连接 | `backend/db/index.ts` |
| 认证中间件 | `backend/middleware/auth.ts` |
| 前端入口 | `frontend/src/main.ts` |
| 前端路由 | `frontend/src/router/index.ts` |
| 国际化入口 | `frontend/src/i18n/index.ts` |
| 中文语言包 | `frontend/src/i18n/locales/zh.ts` |
| 英文语言包 | `frontend/src/i18n/locales/en.ts` |
| 后台菜单 | `frontend/src/config/menu.ts` |
| API 请求封装 | `frontend/src/utils/req.ts` |

---

## 配置文件

| 文件 | 用途 |
|------|------|
| `package.json` | 根配置（后端依赖 + 脚本） |
| `tsconfig.json` | TypeScript 配置 |
| `drizzle.config.ts` | Drizzle ORM 配置 |
| `frontend/vite.config.ts` | Vite 构建配置 |
| `.env.example` | 环境变量模板 |
| `Dockerfile` | Docker 构建配置 |
| `compose.yaml` | Docker Compose 配置 |

---

## 构建和运行脚本

| 脚本 | 用途 |
|------|------|
| `build_frontend.sh` | 前端构建 + 后端打包 |
| `run.sh` | 统一启动脚本（dev/生产） |
| `bun run dev` | 后端开发模式（热重载） |
| `bun run build` | 构建前端 + 打包后端 |

> 无论什么情况下你都不应该自作主张去执行bunx drizzle-kit generate命令。

---

## 数据库表

| 表名 | 说明 |
|------|------|
| `users` | 用户表（id, username, email, password, role, status） |
| `sessions` | 会话表（Token 认证） |
| `user_settings` | 用户设置表（JSON 存储） |

---

## 路由架构

| 路由层 | 基路径 | 认证要求 |
|--------|--------|----------|
| publicRouter | `/` | 无 |
| userRouter | `/api/user` | Bearer Token (user/admin) |
| adminRouter | `/api/admin` | Bearer Token (admin only) |

---

## 多语言开发说明

- **库**: vue-i18n v12，支持中文 (`zh`)、英文 (`en`)
- **语言检测**: 自动检测浏览器语言，`zh` 开头使用中文，否则英文
- **初始化文件**: `frontend/src/i18n/index.ts`

| 语言 | 文件路径 |
|------|----------|
| 中文 | `frontend/src/i18n/locales/zh.ts` |
| 英文 | `frontend/src/i18n/locales/en.ts` |

**组件中使用**:

```vue
<script setup lang="ts">
import { useI18n } from "vue-i18n";
const { t } = useI18n();
</script>

<template>
  <p>{{ t("login.welcome") }}</p>
  <NInput :placeholder="t('login.email_or_username.placeholder')" />
</template>
```

**添加翻译**: 在 `zh.ts` 和 `en.ts` 中添加相同 key，命名格式 `模块.功能.描述`（如 `login.welcome`、`panel.users.title`）。

---

## API 返回规范

后端所有接口必须统一返回以下 JSON 格式：

```json
{
    "code": 200,
    "msg": "module.action.result",
    "data": {}
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | number | 状态码。`200` 表示成功，其他一律使用 `-1000` 表示失败 |
| `msg` | string | 消息标识符，英文缩写，点分段式命名，用于前端 i18n 翻译 |
| `data` | any | 返回数据，任意格式，可为空对象 `{}` 或 `null` |

### msg 命名规则

- **必须是英文缩写**，不能是中文
- 使用**点分段式**命名：`模块.功能.结果`
- 保持简短，搭配前端翻译文件使用

### 示例

```typescript
// 成功
return c.json({ code: 200, msg: "login.success", data: { token, user } });
return c.json({ code: 200, msg: "user.info.success", data: user });
return c.json({ code: 200, msg: "success", data: null });

// 失败
return c.json({ code: -1000, msg: "invalid.password", data: null });
return c.json({ code: -1000, msg: "user.not.found", data: null });
return c.json({ code: -1000, msg: "register.not.allowed", data: null });
```

---

## 代码注释规范

在关键代码处必须添加清晰的中文注释，方便后续维护和理解。

### 需要添加注释的位置

| 位置 | 说明 |
|------|------|
| 函数/方法 | 说明功能、参数含义、返回值 |
| 复杂逻辑 | 解释算法思路、业务规则 |
| 关键变量 | 说明变量用途、取值范围 |
| 条件判断 | 解释判断条件的业务含义 |
| API 接口 | 说明接口功能、请求参数、返回数据 |
