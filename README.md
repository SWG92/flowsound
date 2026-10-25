# 🎵 FlowSound

**让音乐流动起来** · *Where Music Flows*

**全平台聚合音乐播放器** — 网易云 + QQ音乐 + 酷狗，一站式畅听。

> 基于 Next.js 16 构建，纯前端 + API 代理架构，无需后端服务即可使用。
> 
> 📱 支持 **PWA** — 可安装为独立 App，手机/桌面均可使用

---

## ✨ 功能特性

### 🎧 核心播放
- **三平台聚合搜索** — 同时搜索网易云音乐、QQ音乐、酷狗，智能去重合并；VIP 歌曲自动隐藏（匿名无法播放，明示避免困惑）
- **跨平台回退播放** — 源平台无版权时自动在其他平台搜索同名歌曲
- **纯净队列模型** — 队列只放你明确加的歌（点播单曲/「下一首播放」/「播放全部」）；队列播完后退出队列、沿来源列表自动连播（在热歌榜点的歌，播完顺着榜单往下走，自动跳过 VIP）
- **多音质支持** — 播放栏随时切换（96K/128K/320K/无损），当前歌曲立即按新音质重载并保留进度；无损需会员时上游自动降级为 320K 并明确提示
- **倍速播放** — 0.5x ~ 2x 可调
- **定时关闭** — 15/30/45/60 分钟 + 「播完当前歌」，后台标签页同样生效，含音量渐弱
- **播放模式** — 列表循环 / 单曲循环 / 随机播放（真洗牌：一轮不重复）
- **EQ 均衡器** — 10 段图形均衡器，支持流行/摇滚/古典/爵士/舞曲/人声预设（部分跨域音源不支持，会自动回退直连）
- **播放队列管理** — 拖拽排序、单曲移除、一键清空（保留正在播放）
- **滚轮调音量** — 鼠标悬停在播放栏上滚动即可调节
- **键盘快捷键** — 空格播放/暂停、方向键快进退、Ctrl+方向切歌/音量、M 静音

### 🎨 界面体验
- **专辑主色动态取色** — Material You 式封面取色：全屏页背景、播放按钮、歌词高亮、进度条、队列玻璃、波浪可视化、封面光环全部跟随每首歌的专属色调
- **Liquid Glass 液态玻璃 UI** — 参照 iPadOS 26 设计语言：多层折射玻璃、镜面边缘高光、悬浮胶囊面板、底层流动色彩光斑、按压触感反馈与页面过渡动画
- **全屏播放页** — 点播放栏封面/歌名展开：沉浸歌词（3 秒无操作隐藏控制区）、左右滑切歌、下滑关闭、可拖动进度条、评论/收藏浮层不打断沉浸
- **深色/浅色主题** — 一键切换，完整适配所有组件
- **移动端适配** — 响应式布局，侧栏抽屉、播放栏精简、刘海屏安全区
- **桌面悬浮歌词** — 可拖拽的独立歌词窗口（6 色可选、跨窗口同步）
- **歌词弹窗** — 播放栏点击封面/歌名即可打开，附带评论入口
- **音频可视化** — 播放栏实时跳动 EQ 条（专辑主色）
- **品牌标识** — 「流动声波」Logo 与播放中的可视化同构，标志语贯穿应用
- **PWA 支持** — 可安装为独立 App，支持离线缓存

### 📋 音乐管理
- **收藏系统** — 歌曲收藏/取消收藏，持久化存储
- **播放记录 + 听歌排行** — 自动记录最近 100 首，并按播放次数生成「最常播放」榜
- **本地歌单** — 创建/重命名/删除歌单，卡片显示歌单封面；歌曲「更多」菜单添加或移除
- **黑名单** — 拉黑不喜欢的歌曲，列表页自动过滤，独立管理页面
- **歌曲下载** — 「更多」菜单一键下载（需音源可用）

### 💬 社交互动
- **评论系统** — 查看热门评论（数据来自网易云），支持加载更多分页
- **本地评论** — 可发表本地评论，支持删除
- **点赞** — 评论点赞，本地持久化

### 🔍 发现音乐
- **热歌榜 / 飙升榜 / 新歌榜** — 首页三大榜单
- **每日推荐** — 随机歌单推荐，Fisher-Yates 洗牌，按日缓存（跨天自动刷新）
- **全平台搜索** — 搜索页面无限滚动加载，自动去重、搜索联想
- **大家都在搜** — 搜索页空状态热门歌手推荐，一键直达

### 🧭 导航
- **前进/后退** — QQ音乐风格的历史导航，独立 Zustand 栈
- **歌手页 / 专辑页** — 点击歌手/专辑查看详情和歌曲列表
- **相似歌曲推荐** — 歌曲信息弹窗中按歌手推荐同风格歌曲，可直接播放

### ⚡ 性能
- **服务端 TTL 缓存 + HTTP 缓存头** — 重复请求 0.3s → 0.004s，显著缓解上游限流
- **接口响应瘦身** — 歌曲列表出口只保留所需字段，榜单响应 1.2MB → 40KB（-97%）
- **React Compiler** — 编译期自动 memo 化全部组件
- **Zustand 字段级订阅** — 播放时页面组件零重渲染，进度条自订阅组件化
- **虚拟滚动** — 大列表（1000+ 首）只渲染可视区域，流畅不卡顿
- **系统媒体控制** — Media Session API，锁屏/通知中心显示歌曲和控制
- **歌词同步 O(1)** — rAF 歌词索引均摊查找，队列洗牌序列 O(n) 同步

### 🔒 安全
- **API 输入验证** — 全路由参数白名单（防 query 注入/路径改写），关键词限长
- **XSS 零风险渲染** — 全部用户内容走 React 转义，无 innerHTML

---

## 🛠 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| UI 库 | React 19 |
| 语言 | TypeScript |
| 样式 | Tailwind CSS 4 + shadcn/ui |
| 状态管理 | Zustand（字段级订阅） |
| 编译优化 | React Compiler |
| 虚拟滚动 | @tanstack/react-virtual |
| 音频引擎 | Howler.js (HTML5 Audio) |
| EQ/可视化 | Web Audio API (BiquadFilterNode) |
| 系统媒体 | Media Session API |
| 基础组件 | Base UI (headless) |
| 图标 | Lucide React |

---

## 📁 项目结构

```
flowsound/
├── src/
│   ├── app/                      # Next.js App Router 页面
│   │   ├── page.tsx              # 首页（三大榜单）
│   │   ├── layout.tsx            # 根布局
│   │   ├── globals.css           # 全局样式 + 深色主题
│   │   ├── search/page.tsx       # 全平台搜索页
│   │   ├── daily/page.tsx        # 每日推荐
│   │   ├── favorites/page.tsx    # 我的收藏
│   │   ├── history/page.tsx      # 播放历史
│   │   ├── playlist/page.tsx     # 歌单管理
│   │   ├── blacklist/page.tsx    # 黑名单管理
│   │   ├── settings/page.tsx     # 设置页
│   │   ├── album/[id]/page.tsx   # 专辑详情
│   │   ├── artist/[id]/page.tsx  # 歌手详情
│   │   ├── lyrics-desktop/page.tsx # 桌面歌词独立窗口
│   │   └── api/music/            # API 代理路由
│   │       ├── route.ts          # 主路由（搜索/播放/歌词/歌单）
│   │       ├── album/route.ts    # 专辑 API
│   │       ├── artist/route.ts   # 歌手 API
│   │       └── comments/route.ts # 评论 API
│   │
│   ├── components/
│   │   ├── layout/               # 布局组件
│   │   │   ├── sidebar.tsx       # 侧边栏导航
│   │   │   ├── top-nav.tsx       # 顶部导航（前进/后退）
│   │   │   ├── theme-provider.tsx # 主题 Provider
│   │   │   ├── client-wrapper.tsx # 客户端包裹器
│   │   │   └── conditional-layout.tsx # 条件布局
│   │   │
│   │   ├── player/               # 播放器核心组件
│   │   │   ├── player-bar.tsx    # 底部播放栏（主界面）
│   │   │   ├── lyrics.tsx        # 歌词展示
│   │   │   ├── floating-lyrics.tsx # 桌面悬浮歌词窗
│   │   │   ├── queue.tsx         # 播放队列面板
│   │   │   ├── comments-dialog.tsx # 评论弹窗
│   │   │   ├── song-info.tsx     # 歌曲信息弹窗
│   │   │   ├── share-dialog.tsx  # 分享弹窗
│   │   │   ├── equalizer-panel.tsx # EQ 均衡器面板
│   │   │   ├── visualizer-bars.tsx # 音频可视化条
│   │   │   └── daily-recommend.tsx # 每日推荐组件
│   │   │
│   │   ├── playlist/
│   │   │   └── song-list.tsx     # 通用歌曲列表组件
│   │   │
│   │   ├── search/
│   │   │   └── search-bar.tsx    # 搜索栏组件
│   │   │
│   │   └── ui/                   # 基础 UI 组件（shadcn/ui）
│   │       ├── button.tsx, dialog.tsx, slider.tsx,
│   │       ├── tabs.tsx, badge.tsx, skeleton.tsx,
│   │       ├── toast.tsx, tooltip.tsx, scroll-area.tsx,
│   │       ├── input.tsx, card.tsx, avatar.tsx, separator.tsx
│   │
│   ├── hooks/                    # 自定义 Hooks
│   │   ├── use-player.ts         # 音频播放器 Hook
│   │   ├── use-visualizer.ts     # 音频可视化 Hook
│   │   ├── use-media-session.ts  # 系统媒体控制 Hook
│   │   ├── use-lyrics-broadcast.ts # 跨窗口歌词同步
│   │   ├── use-keyboard.ts       # 键盘快捷键
│   │   └── use-nav-tracker.ts    # 导航历史追踪
│   │
│   └── lib/                      # 核心库
│       ├── store.ts              # Zustand 全局状态管理
│       ├── api.ts                # 客户端 API 封装
│       ├── audio-player.ts       # 音频引擎（Howler.js 封装）
│       ├── constants.ts          # 常量定义
│       ├── types.ts              # TypeScript 类型定义
│       ├── utils.ts              # 工具函数
│       ├── logger.ts             # 结构化日志
│       ├── toast-store.ts        # Toast 通知 Store
│       ├── eq-store.ts           # EQ 均衡器 Store
│       ├── equalizer.ts          # Web Audio EQ 引擎
│       ├── search-store.ts       # 搜索历史 Store
│       ├── nav-history.ts        # 导航历史 Store
│       ├── download.ts           # 歌曲下载工具
│       ├── lyrics-broadcast.ts   # 跨窗口歌词广播
│       └── platforms/            # 平台适配器（Adapter 模式）
│           ├── types.ts          # 适配器接口定义
│           ├── index.ts          # 统一导出 + getAdapter()
│           ├── netease.ts        # 网易云音乐适配器
│           ├── qq.ts             # QQ音乐适配器
│           └── kugou.ts          # 酷狗音乐适配器
```

---

## 🚀 快速开始

### 环境要求

- Node.js 18+
- npm / yarn / pnpm / bun

### 安装

```bash
git clone https://github.com/SWG92/flowsound.git
cd flowsound
npm install
```

### 开发

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 即可使用。

### 生产构建

```bash
npm run build
npm start
```

### 部署到 EdgeOne（国内直连）

```bash
npm run edgeone
```

3 分钟后即获得国内可访问的在线链接。

---

## 🏗 架构设计

### 平台适配器模式

```
┌─────────────────────────────────────┐
│            UI Layer                  │
│  (PlayerBar, SongList, Search...)    │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│         API Layer (lib/api.ts)       │
│  searchAllPlatforms / getSongUrl...  │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│      API Route (/api/music)          │
│  统一代理，分发到各平台适配器         │
└──────┬───────┬───────┬──────────────┘
       │       │       │
   ┌───▼──┐ ┌──▼──┐ ┌──▼────┐
   │网易云 │ │ QQ  │ │ 酷狗  │
   │适配器 │ │适配器│ │适配器  │
   └───┬──┘ └──┬──┘ └───┬───┘
       │       │        │
   ┌───▼──┐ ┌──▼──┐ ┌───▼───┐
   │163 API│ │Q音API│ │酷狗API│
   └──────┘ └─────┘ └───────┘
```

每个平台适配器实现统一的 `PlatformAdapter` 接口：

```typescript
interface PlatformAdapter {
  search(keywords: string, page: number, limit: number): Promise<SearchResult>;
  getSongUrl(id: string): Promise<string>;
  getLyrics(id: string): Promise<LyricLine[]>;
  getPlaylistDetail(listId: string): Promise<Song[]>;
}
```

### 跨平台回退策略

播放歌曲时，如果源平台无可用 URL，自动在其他平台搜索同名歌曲：

```
源平台 (如酷狗) 无URL
  → 网易云搜索同名歌曲 → 有URL ✓ 播放
  → QQ音乐搜索同名歌曲 → ...
```

### 状态管理

使用 Zustand 管理全局状态，关键数据 localStorage 持久化：

| Store | 文件 | 职责 |
|-------|------|------|
| `usePlayerStore` | `store.ts` | 播放状态、队列、收藏、历史、歌词、主题 |
| `useToastStore` | `toast-store.ts` | Toast 通知队列 |
| `useEQStore` | `eq-store.ts` | EQ 均衡器配置 |
| `useSearchStore` | `search-store.ts` | 搜索历史记录 |
| `useNavHistory` | `nav-history.ts` | 导航前进/后退栈 |

---

## 🎹 快捷键

| 按键 | 功能 |
|------|------|
| `Space` | 播放 / 暂停 |
| `←` / `→` | 快退 / 快进 5 秒 |
| `Ctrl+←` / `Ctrl+→` | 上一首 / 下一首 |
| `Ctrl+↑` / `Ctrl+↓` | 音量加 / 减 |
| `M` | 静音 / 取消静音 |
| `Escape` | 关闭悬浮歌词 |

---

## 📦 API 端点

所有 API 通过 `/api/music` 代理，避免跨域问题。

| 端点 | 参数 | 说明 |
|------|------|------|
| `GET /api/music?fn=search&keywords=xx` | `keywords`, `offset`, `limit`, `platform` | 搜索歌曲 |
| `GET /api/music?fn=song/url&id=xx` | `id`, `br`, `platform` | 获取播放 URL |
| `GET /api/music?fn=lyric&id=xx` | `id`, `platform` | 获取歌词 |
| `GET /api/music?fn=playlist/detail&id=xx` | `id` | 获取歌单详情 |
| `GET /api/music/comments?id=xx` | `id`, `limit`, `offset` | 获取歌曲评论 |
| `GET /api/music/album?id=xx` | `id` | 获取专辑信息 |
| `GET /api/music/artist?id=xx` | `id` | 获取歌手信息 |

---

## 📝 许可

MIT License

---

## 🙏 鸣谢

- [网易云音乐](https://music.163.com/) · [QQ音乐](https://y.qq.com/) · [酷狗音乐](https://kugou.com/)
- [Next.js](https://nextjs.org/) · [Howler.js](https://howlerjs.com/) · [Zustand](https://zustand.docs.pmnd.rs/) · [Lucide](https://lucide.dev/)
