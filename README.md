# Zest

`Zest` 是从当前项目抽取出的一个通用 Web 启动框架，保留了后续项目最常用的核心能力：

- `Bun + Hono` 后端
- `libsql + Drizzle ORM` 数据库
- 用户初始化、登录、注册、登出、修改密码
- `public / user / admin` 三段式路由设计
- Vue 3 后台管理壳
- Docker 构建与快速启动脚本

它刻意剔除了原项目中的书签、导航、授权、备份、更新等业务逻辑，方便你直接拿来做新的 Web 项目。

## 目录结构

```text
Zest/
├─ src/                  # Bun + Hono 后端
├─ frontend/             # Vue 3 + Vite 前端
├─ public/               # 前端构建产物目录
├─ data/                 # libsql 和运行时数据
├─ build_frontend.sh     # 构建前端并打包后端
├─ run.sh                # 统一启动脚本
├─ Dockerfile            # Docker 镜像构建
├─ compose.yaml          # Docker Compose 启动示例
├─ drizzle.config.ts     # Drizzle 配置
└─ README.md
```

## 保留能力

### 后端

- 路由层保留 `publicRouter`、`userRouter`、`adminRouter`
- 认证方式保留 `Bearer Token + Session + Role`
- 登录态仍基于数据库 `sessions` 表
- 管理员初始化接口保留
- 管理员找回密码接口保留：`/reset_admin_password`

### 数据库

默认只保留 3 张核心表：

- `users`
- `sessions`
- `user_settings`

### 前端

- 极简欢迎页
- 初始化页
- 登录页
- 注册页
- 后台壳页面
- 用户管理页
- 个人中心页
- 2 个空白模板页，给后续业务开发直接扩展

## 环境变量

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

可用变量：

```env
ZEST_APP_NAME=Zest
ZEST_PORT=3080
ZEST_DB_PATH=./data/db/zest.db
ZEST_CORS_ORIGIN=*
ZEST_ALLOW_REGISTER=true
```

说明：

- `ZEST_CORS_ORIGIN`：CORS 允许来源，支持 `*` 或逗号分隔的多个域名
- `ZEST_ALLOW_REGISTER`：是否允许公开注册

## 本地开发

### 1. 安装依赖

```bash
bun install
cd frontend && bun install
bunx drizzle-kit push
```

### 2. 启动后端

```bash
bash run.sh dev
```

默认监听 `3080`。

### 3. 启动前端

先在 `frontend/` 目录下创建开发环境配置文件：

```bash
cp .env.example frontend/.env.development
```

或者手动创建 `frontend/.env.development`，内容至少包含：

```env
VITE_API_URL=http://127.0.0.1:3080
```

然后启动前端：

```bash
cd frontend && bun run dev
```

默认监听 `4000`。

## 生产构建

执行：

```bash
sh build_frontend.sh
```

该脚本会完成：

1. 构建前端
2. 将静态资源复制到 `public/static/assets`
3. 打包 Bun 后端到 `dist/`

## 生产启动

执行：

```bash
sh run.sh
```

`run.sh` 会自动：

1. 读取 `.env`
2. 创建 `data/db` 等运行目录
3. 在缺少构建产物时自动执行构建
4. 执行 `drizzle-kit push`
5. 启动生产服务

## Docker 启动

### 构建并启动

```bash
docker compose -f compose.yaml up -d --build
```

### 停止

```bash
docker compose -f compose.yaml down
```

## 首次使用流程

1. 打开首页 `/`
2. 如果未初始化，进入 `/user/init`
3. 创建管理员账号
4. 跳转到 `/user/login`
5. 登录后进入 `/dashboard/home`

## 管理员找回密码

框架保留了本机文件兜底找回密码方式：

1. 确保 `data/reset.txt` 文件存在
2. 浏览器访问 `/reset_admin_password`
3. 系统会返回新的管理员密码文本

这个能力适合服务器本机受控环境下的应急找回，不建议暴露给公网无额外保护的场景。

## 二次开发入口

常见扩展位置：

- 新增后端接口：`src/api/`
- 新增路由挂载：`src/routers.ts`
- 新增数据表：`src/db/schema.ts`
- 新增后台菜单：`frontend/src/config/menu.ts`
- 新增后台页面：`frontend/src/components/dashboard/`

## 当前抽取时做的调整

- 移除了原项目书签、导航、授权、更新、备份等业务代码
- `logout` 改为只注销当前 session
- CORS 改为由 `ZEST_CORS_ORIGIN` 控制
- 根目录脚本改为更通用的框架启动方式
- 根 `package.json` 的依赖分类做了整理

## 注意事项

- 前端仍采用手工版本号产物命名方式，后端会按 `APP_DATE` 拼接静态资源路径
- 如果你重新构建了前端，建议同步更新 `src/api/info.ts` 中的 `APP_DATE`
- 如果你后续改成正式迁移流，可以使用：

```bash
bun run db:generate
bun run db:migrate
```

## 数据库说明

本项目使用 `libsql`（SQLite 的分支）作为数据库，通过 `Drizzle ORM` 进行操作。

### 为什么选择 libsql？

1. **原生向量支持**：libsql 内置向量数据库功能，支持多种向量类型和距离计算
2. **云数据库支持**：Turso 提供托管的 libsql 云数据库，方便后续扩展
3. **同步功能**：支持本地数据库与云端同步（embedded replicas）
4. **SQLite 兼容**：libsql 是 SQLite 的 fork，大部分功能兼容

### 本地开发

本地开发时，libsql 以文件形式存储数据（与 SQLite 相同），无需额外配置。

### 连接云端

如需连接 Turso 云数据库，修改 `backend/db/index.ts`：

```typescript
import { drizzle } from "drizzle-orm/libsql";

export const db = drizzle({
    connection: {
        url: process.env.TURSO_DATABASE_URL!,
        authToken: process.env.TURSO_AUTH_TOKEN,
    },
    schema,
});
```

并在 `.env` 中添加：

```env
TURSO_DATABASE_URL=libsql://[database-name]-[organization].turso.io
TURSO_AUTH_TOKEN=your-auth-token
```
