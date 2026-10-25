import type { LyricLine } from "./types";

// 网易云 LRC 末尾自带的推广/版权元信息行（带时间戳，会被误解析成歌词）。
// 精确匹配这些固定文案，避免误伤含相同词的正常歌词
const META_PATTERNS = [
  /^网易云音乐特别企划/,
  /^本歌曲来自/,
  /^本歌曲出自/,
  /^纯音乐，请欣赏$/,
  /^纯音乐,请欣赏$/,
];

/** 是否为网易云 LRC 中的推广/版权元信息行 */
function isMetaLine(text: string): boolean {
  const t = text.trim();
  return META_PATTERNS.some((p) => p.test(t));
}

/**
 * 解析 LRC 文本为歌词行（含翻译合并、按时间排序）。
 * 过滤网易云 LRC 末尾的"网易云音乐特别企划"/"本歌曲来自【网易音乐人】"等
 * 推广元信息行——它们带时间戳，不滤会在歌曲临近结束时被当作歌词高亮显示。
 */
export function parseLRC(lrc: string, tlyric?: string): LyricLine[] {
  const transMap = new Map<number, string>();
  if (tlyric) {
    for (const line of tlyric.split("\n")) {
      const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
      if (match) {
        const minutes = parseInt(match[1]);
        const seconds = parseInt(match[2]);
        const ms = parseInt(match[3]);
        const time = minutes * 60 + seconds + ms / (match[3].length === 3 ? 1000 : 100);
        const text = match[4].trim();
        if (text) transMap.set(time, text);
      }
    }
  }

  const result: LyricLine[] = [];
  for (const line of lrc.split("\n")) {
    const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
    if (match) {
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      const ms = parseInt(match[3]);
      const time = minutes * 60 + seconds + ms / (match[3].length === 3 ? 1000 : 100);
      const text = match[4].trim();
      if (text && !isMetaLine(text)) {
        let transText: string | undefined;
        for (const [tTime, tText] of transMap) {
          if (Math.abs(tTime - time) < 0.5) {
            transText = tText;
            break;
          }
        }
        result.push({ time, text, transText });
      }
    }
  }

  return result.sort((a, b) => a.time - b.time);
}
