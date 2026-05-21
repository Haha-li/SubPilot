# SubPilot

订阅管理与提醒系统，帮助您集中管理所有订阅服务，到期自动提醒。

## 功能

- **订阅管理** — 卡片网格展示，支持搜索、分类筛选、分页浏览
- **到期提醒** — 支持 Telegram、企业微信、Bark、Webhook、邮件(Resend)、NotifyX 六种通知渠道
- **农历支持** — 日期显示农历，周期可按农历计算
- **深色模式** — 侧边栏一键切换深色/浅色主题
- **复制订阅** — 快速复制已有订阅，预设 14 种订阅类型
- **双环境部署** — 支持 Docker (Express + SQLite) 和 Cloudflare Workers (Hono + D1)
- **一键部署** — Fork 后 GitHub Actions 自动部署到 Cloudflare Workers + Pages

## 技术栈

| 层 | Node.js 版 | Workers 版 |
|---|---|---|
| 前端 | Vue 3、TypeScript、Element Plus、Pinia、Vue Router | 同左 |
| 后端 | Express、Drizzle ORM、SQLite | Hono、Drizzle ORM、Cloudflare D1 |
| 部署 | Docker、Docker Compose | Cloudflare Workers + Pages, GitHub Actions |

## 快速开始

### Docker 部署

```bash
cp .env.example .env
# 编辑 .env 设置 JWT_SECRET
docker compose up -d
```

访问 `http://localhost:3000`

### Cloudflare Workers 部署

#### 一键部署（推荐）

Fork 本仓库后，通过 GitHub Actions 自动部署到 Cloudflare Workers + Pages。

**第一步：创建 Cloudflare 资源**

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 **Workers & Pages** → **D1** → **Create**，数据库名称填 `subpilot`，记下 **Database ID**
3. 进入 **Workers & Pages** → **Overview** → **Create** → 创建一个 Worker（名称随意，后面会被覆盖）
4. 进入 **My Profile** → **API Tokens** → **Create Token**，使用 **Edit Cloudflare Workers** 模板

**第二步：配置 GitHub Secrets**

在你的 GitHub 仓库 → **Settings** → **Secrets and variables** → **Actions** 中添加：

| Secret 名称 | 说明 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | 上一步创建的 API Token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Dashboard 右侧栏的 Account ID |
| `D1_DATABASE_ID` | 第一步创建的 D1 Database ID |
| `JWT_SECRET` | 随机字符串，用于签发登录令牌 |
| `WORKERS_URL` | Workers 部署后的地址，如 `https://subpilot.xxx.workers.dev` |

**第三步：推送到 GitHub**

```bash
git push origin main
```

GitHub Actions 会自动：
- 初始化 D1 数据库表结构
- 部署后端到 Cloudflare Workers
- 构建前端并部署到 Cloudflare Pages

部署完成后访问 `https://你的pages域名.pages.dev`。

<details>
<summary><b>手动部署（不用 GitHub Actions）</b></summary>

**前置条件**

- [Cloudflare 账号](https://dash.cloudflare.com/sign-up)
- 安装 Wrangler CLI：`npm install -g wrangler`
- 登录 Wrangler：`wrangler login`

**1. 创建 D1 数据库**

```bash
cd server
wrangler d1 create subpilot
```

将输出的 `database_id` 填入 `server/wrangler.toml`。

**2. 设置 JWT_SECRET**

在 Cloudflare Dashboard → Workers → Settings → Variables and Secrets 中添加 `JWT_SECRET`（Secret 类型）。

**3. 初始化数据库 + 部署后端**

```bash
cd server
npm install
npx wrangler d1 execute subpilot --file=migrations/0001_init.sql
npx wrangler deploy
```

**4. 部署前端**

```bash
cd client
npm install
VITE_API_URL=https://subpilot.xxx.workers.dev npm run build
npx wrangler pages deploy dist --project-name=subpilot-frontend
```

</details>

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
