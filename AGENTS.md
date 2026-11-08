<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 工作流约定（用户要求）

- **收工规则**：每天的最后一次收工总结必须包含关闭本地开发/生产服务器——停掉后台 `npm start` 任务、清理残留 node 进程、确认端口 3000 释放，并在总结中报告服务器状态。
- **改动即测**：每次改动后在浏览器里实测通过才交付，交付时说明验证内容。
- **提交推送**：完成一批修复/优化后提交并推送到 GitHub（master 分支）。
