# SubPilot

订阅管理与提醒系统，帮助您集中管理所有订阅服务，到期自动提醒。

## 功能

- **订阅管理** — 卡片网格展示，支持搜索、分类筛选、分页浏览
- **到期提醒** — 支持 Telegram、企业微信、Bark、Webhook、邮件(Resend)、NotifyX 六种通知渠道
- **农历支持** — 日期显示农历，周期可按农历计算
- **深色模式** — 侧边栏一键切换深色/浅色主题
- **复制订阅** — 快速复制已有订阅，预设 14 种订阅类型
- **Docker 部署** — 一键启动，数据持久化

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3、TypeScript、Element Plus、Pinia、Vue Router |
| 后端 | Express、Drizzle ORM、SQLite |
| 部署 | Docker、Docker Compose |

## 快速开始

### Docker 部署

```bash
cp .env.example .env
# 编辑 .env 设置 JWT_SECRET
docker compose up -d
```

访问 `http://localhost:3000`

### 本地开发

```bash
# 后端
cd server
npm install
cp .env.example .env
npm run dev

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
