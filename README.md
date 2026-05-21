# SubPilot

订阅管理与提醒系统，帮助您集中管理所有订阅服务，到期自动提醒。

## 功能

- **订阅管理** — 卡片网格展示，支持搜索、分类筛选、分页浏览
- **到期提醒** — 支持 Telegram、企业微信、Bark、Webhook、邮件(Resend)、NotifyX 六种通知渠道
- **农历支持** — 日期显示农历，周期可按农历计算
- **深色模式** — 侧边栏一键切换深色/浅色主题
- **复制订阅** — 快速复制已有订阅，预设 14 种订阅类型
- **双环境部署** — 支持 Docker (Express + SQLite) 和 Cloudflare Workers (Hono + D1)

## 技术栈

| 层 | Node.js 版 | Workers 版 |
|---|---|---|
| 前端 | Vue 3、TypeScript、Element Plus、Pinia、Vue Router | 同左 |
| 后端 | Express、Drizzle ORM、SQLite | Hono、Drizzle ORM、Cloudflare D1 |
| 部署 | Docker、Docker Compose | Cloudflare Workers |

## 快速开始

### Docker 部署

```bash
cp .env.example .env
# 编辑 .env 设置 JWT_SECRET
docker compose up -d
```

访问 `http://localhost:3000`

### Cloudflare Workers 部署

#### 前置条件

- [Cloudflare 账号](https://dash.cloudflare.com/sign-up)（免费即可）
- 安装 Wrangler CLI：`npm install -g wrangler`
- 登录 Wrangler：`wrangler login`

#### 第一步：创建 D1 数据库

```bash
cd server
wrangler d1 create subpilot
```

输出类似：
```
[[d1_databases]]
binding = "DB"
database_name = "subpilot"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**复制 `database_id`**，下一步要用。

#### 第二步：配置 wrangler.toml

编辑 `server/wrangler.toml`：

```toml
name = "subpilot"
main = "src/hono/index.ts"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "subpilot"
database_id = "你刚才复制的 database_id"

[vars]
JWT_SECRET = "改成一个随机字符串"

[[triggers.crons]]
cron = "0 0 * * *"
```

#### 第三步：初始化数据库

```bash
npm run db:migrate:d1
```

如果本地开发需要 D1，可以创建本地数据库副本：
```bash
wrangler d1 create subpilot --local
```

#### 第四步：部署后端

```bash
npm install
npm run deploy
```

部署成功后会显示 Workers 地址，如 `https://subpilot.xxx.workers.dev`

#### 第五步：部署前端（Cloudflare Pages）

```bash
cd client
npm install
npm run build
```

两种方式部署前端：

**方式 A：通过 Wrangler**
```bash
wrangler pages project create subpilot-frontend
wrangler pages deploy dist --project-name=subpilot-frontend
```

**方式 B：通过 Cloudflare Dashboard**
1. 进入 Cloudflare Dashboard → Pages → Create a project
2. 连接 GitHub 仓库
3. 构建设置：Framework preset 选 `None`，Build command 填 `cd client && npm install && npm run build`，Build output directory 填 `client/dist`

#### 第六步：配置前端 API 地址

构建时通过环境变量 `VITE_API_URL` 指向 Workers 地址，**无需修改代码**：

**方式 A：本地构建**
```bash
cd client
VITE_API_URL=https://subpilot.xxx.workers.dev npm run build
```

**方式 B：Cloudflare Dashboard**
在 Pages 项目设置 → Environment variables 中添加：
- Variable name: `VITE_API_URL`
- Value: `https://subpilot.xxx.workers.dev`（你的 Workers 地址）

**方式 C：Wrangler**
```bash
wrangler pages deploy dist --project-name=subpilot-frontend --branch main -- VITE_API_URL=https://subpilot.xxx.workers.dev
```

不设置此变量时，默认使用 `/api`（适用于 Docker 同源部署）。

#### 第七步：配置 CORS

编辑 `server/src/hono/index.ts`，将前端 Pages 域名加入 CORS 白名单：

```ts
app.use('*', cors({ origin: 'https://你的pages域名.pages.dev', credentials: true }));
```

### 本地开发

```bash
# Node.js 版
cd server
npm install
cp .env.example .env
npm run dev

# Workers 版（需要先配置 wrangler.toml）
cd server
npm run dev:workers

# 前端（新终端）
cd client
npm install
npm run dev
```

前端 `http://localhost:5173`，后端 `http://localhost:3000`

## 通知渠道

| 渠道 | 说明 |
|------|------|
| Telegram | 通过 Bot Token + Chat ID 推送 |
| 企业微信 | 通过群机器人 Webhook 推送 |
| Bark | 推送到 iOS 设备 |
| Webhook | 自定义 HTTP 回调 |
| 邮件 | 通过 Resend API 发送 |
| NotifyX | 通过 NotifyX 服务推送 |

## License

MIT
