/**
 * API 路由参数验证：所有拼进上游 URL 的参数必须先过这里。
 * 未验证的参数可被注入额外 query（如 br=320000&evil=x）或改写请求路径。
 */

/** 纯数字参数（网易云歌曲/专辑/歌手 id、bitrate、limit、offset），非法回落默认值 */
export function numParam(v: string | null | undefined, fallback: string): string {
  return v && /^\d+$/.test(v) ? v : fallback;
}

/** 字母数字 id（跨平台通用：网易云数字 id、QQ songmid、酷狗 hash 均为字母数字），非法返回空串 */
export function alnumParam(v: string | null | undefined): string {
  return v && /^[a-zA-Z0-9]+$/.test(v) ? v : "";
}
