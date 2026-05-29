# SubPilot Design System (MASTER)

> 全局设计规范。任何 UI 改动先读这个文件；如果某个页面有 `design-system/pages/<page>.md`，则页面文件覆盖本规范。

## 1. 风格基调

- **核心组合**：Bento Grid + Glassmorphism
- **关键词**：modular cards, frosted glass, layered depth, soft shadow, content-first
- **不要做**：dark mode by default、过度动画（>300ms）、emoji 图标、ElCard 默认灰边

## 2. Color Tokens

| Role | Light | Dark | 用途 |
|---|---|---|---|
| Brand | `#6366F1` Indigo-500 | `#A5B4FC` Indigo-300 | 主操作、主链接、激活态 |
| Brand Soft | `#EEF2FF` | `rgba(99,102,241,0.12)` | 选中/hover 背景 |
| Success | `#10B981` Emerald-500 | 同 | 活跃订阅、收益、正常 |
| Warning | `#F59E0B` Amber-500 | 同 | 即将到期、置顶星 |
| Danger | `#EF4444` Red-500 | 同 | 已过期、删除 |
| BG Page | `#F5F3FF` 紫调灰 + 双向 radial 渐变 | `#020617` slate-950 + 双向渐变 | 全局背景 |
| Card | `#FFFFFF` | `rgba(30,41,59,0.55)` (毛玻璃) | 卡片表面 |
| Border | `#E2E8F0` slate-200 | `rgba(148,163,184,0.18)` | 微边框 |
| Text Primary | `#0F172A` slate-900 | `#F8FAFC` slate-50 | 标题、关键数字 |
| Text Secondary | `#475569` slate-600 | `#CBD5E1` slate-300 | 正文 |
| Text Muted | `#64748B` slate-500 | `#94A3B8` slate-400 | 提示、时间戳 |

## 3. Typography

| 用途 | 字体 | 备注 |
|---|---|---|
| Heading | **Poppins** 500/600/700 | 几何无衬线，标题专用 |
| Body | **Inter** 400/500/600 | 西文/英文正文 |
| 中文正文 | **Noto Sans SC** 400/500/600 | 自动 fallback |
| 数字 / 金额 | **Fira Code** + `tabular-nums` | 等宽对齐，使用 `.font-mono-nums` |

字号阶梯：`text-xs(12) / text-sm(14) / text-base(16) / text-lg(18) / text-xl(20) / text-2xl(24) / text-3xl(30) / text-4xl(36)` —— 移动端正文最小 16px。

## 4. 圆角 / 阴影 / 间距

- 圆角：bento `rounded-[20px]` / `rounded-bento`(24px) / 输入框 `rounded-[10px]` / 标签 `rounded-lg`(8px)
- 阴影：默认 `shadow-bento`，hover `shadow-bento-hover`，玻璃面 `shadow-glass`
- 间距：4 / 8 / 12 / 16 / 20 / 24 / 32（严格 4 倍数）
- 卡片间距：grid gap 16-20px

## 5. 关键效果

- **毛玻璃**：`backdrop-blur-xl saturate-150` + `bg-white/70` (light) / `bg-slate-900/55` (dark)
- **卡片 hover**：`hover:-translate-y-0.5 hover:shadow-bento-hover` 200ms
- **数字进入**：count-up 600ms（重要 KPI）
- **transition**：`transition-all duration-200 ease-soft`
- **focus ring**：`focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2`

## 6. Iconography

- 使用 **Lucide** (`@lucide/vue`) 替代 `@element-plus/icons-vue`
- 默认尺寸 `w-5 h-5`（20px），导航 `w-[18px] h-[18px]`，按钮内联 `w-4 h-4`
- 不使用 emoji 作为 UI 图标

## 7. 组件守则

### Card / Bento
- 所有"内容载体"用 `.bento-card`：圆角 20px、白底、淡边、hover 抬升
- Dashboard 订阅卡：左上图标 + 标题，右上状态徽标，中部进度条+到期日，底部价格+操作

### Button
- 主操作 `el-button type="primary"`（已被 token 覆盖为 indigo）
- 次操作 `plain`（白底 + 边框）
- 文字按钮 `text`（仅在工具区/侧栏）
- 高度：`size="default"` ≈ 36px；移动端最小 44×44 触控

### Form
- 标签置上（`label-position="top"`）
- `el-input` 已被覆盖为 10px 圆角 + 透明背景
- 错误提示靠近输入框，使用 `el-form-item` 内置

### Sidebar
- 桌面端 220px，折叠 64px
- `glass-panel` 风格，半透明、blur 20px
- 选中态：brand-soft 背景 + brand 文字 + 600 字重

### Status Tag (订阅状态)
- 正常：success-soft 底 + success 字
- 即将到期：warning-soft 底 + warning 字
- 已过期：danger-soft 底 + danger 字
- 已停用：ink-200 底 + ink-600 字

## 8. 反模式（不要这样做）

- ❌ 用 emoji 当图标（🚀 ⚙️）
- ❌ hover 用 `scale()` 引发布局抖动
- ❌ 浅色模式下 `bg-white/10` 之类的过透明
- ❌ 浅色文本颜色 < `slate-600`
- ❌ 无 cursor-pointer 的可点击卡
- ❌ 默认 dark mode（应该跟随系统 + 手动开关）
- ❌ 使用 `border-white/10` 在浅色模式（不可见）
- ❌ 暗色模式下 backdrop-blur 不加足够 opacity（看不见）

## 9. 落地策略（与 Element Plus 共存）

不"一刀切"删 Element Plus，分三层：

1. **保留**：`ElTable / ElDatePicker / ElMessageBox / ElDrawer / ElPagination / ElForm` —— 复杂组件，token 覆盖即可
2. **覆盖 token**：`src/style.css` 中已写入 `--el-color-primary` 等变量映射到品牌色
3. **替换**：`AppLayout / Login / Dashboard 的卡片` 用纯 Tailwind 重写，拿回完全控制权

## 10. Pre-Delivery Checklist

- [ ] 所有 emoji 已换成 Lucide SVG
- [ ] 所有可点击元素 `cursor-pointer`
- [ ] hover 是 color/opacity/shadow，不是 scale
- [ ] light mode 文字对比度 ≥ 4.5:1
- [ ] focus-visible ring 可见
- [ ] 375 / 768 / 1024 / 1440 四档响应式
- [ ] 数字使用 `font-mono-nums` 对齐
- [ ] 无横向滚动
- [ ] `prefers-reduced-motion` 关闭非必要动画
