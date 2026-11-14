# FlowSound 桌面版（Electron）

双击即用的 Windows 桌面应用：内嵌 Next.js 服务器，无需部署、无需浏览器。

## 结构

```
desktop/               electron-builder 的 app 目录（独立 package.json）
  main.cjs             主进程：内嵌服务器 + 窗口 + 托盘 + 媒体键 + 自动更新
  preload.cjs          渲染层桥（媒体键命令、更新检查）
  build/icon.png       应用图标（由 electron/make-icon.mjs 生成）
electron-builder.yml   打包配置（NSIS 安装包 + GitHub Releases 更新源）
release/               打包输出（已 gitignore）
```

- 内嵌服务器：Next.js `output: "standalone"`（.next/standalone），打包时经
  extraResources 放到 `resources/server`，主进程用
  `ELECTRON_RUN_AS_NODE=1` 拉起 electron 自带 Node 运行 server.js——
  **用户机器不需要安装 Node**
- 端口：37120 起，占用自动 +1（最多试 20 个）
- 渲染层媒体键桥：`src/components/electron/desktop-media-bridge.tsx`（挂载于 ClientWrapper）

## 常用命令

```bash
npm run electron:setup   # 安装 desktop/ 依赖（electron-updater）
npm run build            # Next.js 构建（standalone 输出）
npm run electron:build   # 上面 + 打 Windows 安装包（release/FlowSound Setup x.y.z.exe）
npm run electron:dev     # 开发模式跑壳（需先 npm run build 或 npm start）
node electron/make-icon.mjs  # 重新生成图标
```

## 发新版（软件内自动更新）

1. 改完代码后 bump 两处版本号：根 `package.json` 和 `desktop/package.json`
2. `npm run electron:build`
3. 推到 GitHub Releases（需 GH_TOKEN，可用 `gh auth token`）：
   ```bash
   GH_TOKEN=$(gh auth token) npx electron-builder --win --publish always
   ```
4. 已安装的用户：启动 15 秒后自动检查 → 后台下载 → 弹窗重启即完成更新

注意：未做代码签名，Windows「智能应用控制」（Smart App Control）开着的机器
会拦截未签名新程序——需在 设置 → Windows 安全中心 → 应用和浏览器控制 中关闭
（关闭后无法重新开启，装各种独立软件的机器一般都关）。
