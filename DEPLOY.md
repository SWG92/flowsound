# FlowSound 部署指南（EdgeOne Pages）

> 目标：让 FlowSound 在公网可访问（国内直连），作为 Android APK 的后端地址。

## 前置确认（已完成 ✅）

- EdgeOne Pages **原生支持 Next.js SSR / API 路由**（零配置自动识别）
- 本项目是 Next.js 服务端应用（`/api/music` 代理上游三平台），必须部署在支持 SSR/Node 的平台
- `package.json` 已有部署脚本：`npm run edgeone`（即 `edgeone makers deploy ./ -n flowsound`）
- 构建脚本已带 `NODE_TLS_REJECT_UNAUTHORIZED=0`（上游音乐接口 TLS 特殊性），会随脚本带入云端构建
- 注意：仓库**不能有** `.env` 类敏感文件被提交（本项目无需环境变量，无此风险）

## 路线 A：Git 仓库导入（推荐，push 即部署）

**你来做（约 10 分钟）：**
1. 注册/登录 [EdgeOne Pages 控制台](https://console.cloud.tencent.com/edgeone/pages)
2. 「创建项目」→「导入 Git 仓库」→ 授权 GitHub → 选 `SWG92/flowsound`
3. 构建配置一般自动识别；确认：
   - 构建命令：`npm run build`
   - 输出/启动：Next.js 由平台托管（无需手动指定）
4. 点部署，等构建完成拿到 `*.edgeone.app` 域名

**我来做：**
- 部署后全功能验证（搜索/播放/歌词/收藏在公网域名下逐项过一遍）
- 有问题修完 push，平台自动重新部署

## 路线 B：CLI 直传（备选）

```bash
# 一次性：登录（会拉起浏览器授权）
npx edgeone login
npx edgeone whoami   # 确认登录成功

# 部署（当前 package.json 的 edgeone 脚本即是）
npm run edgeone
# 或手动：npx edgeone makers deploy ./ -n flowsound -e production
# CI/无人值守可用 -t <API Token> 替代登录
```

> CLI 直传是「本地构建+直传」，适合不想连 GitHub 的场景；Git 导入更适合长期迭代。

## 部署后验证清单（我来执行）

- [ ] 首页加载 / 每日推荐出列表
- [ ] 搜索（聚合三平台）→ 双击播放 → 声音正常
- [ ] 歌词显示（含酷狗源）+ 翻译开关
- [ ] 收藏/歌单/历史/黑名单本地数据读写正常
- [ ] 手机浏览器实测（后续 Android APK 的 WebView 同源验证）
- [ ] 移动端视口布局（PWA 安装可用性）

## 上线后解锁的工程

| 工程 | 依赖 |
|------|------|
| **Android APK**（Capacitor，2~3h） | 需要上面的公网地址作为 WebView 入口；JDK 21 + SDK 已就绪 |
| **Electron 桌面端**（1.5~2.5h） | 不依赖部署，可并行开工 |
