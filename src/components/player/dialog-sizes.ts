/**
 * 播放器相关弹窗的统一尺寸。
 *
 * 歌词窗与评论窗共用同一个尺寸：从歌词切换到评论时不会发生窗口跳变，
 * 用户视角里就是"同一个窗口换了内容"。
 *
 * 注意：基础 DialogContent 自带 `sm:max-w-sm`，桌面端会覆盖不带前缀的
 * `max-w-*`（媒体查询优先级更高）。因此这里必须用 `sm:` 前缀的写法才能生效。
 */
export const PLAYER_DIALOG_SIZE =
  "w-full max-w-[calc(100%-2rem)] sm:max-w-2xl h-[78vh]";
