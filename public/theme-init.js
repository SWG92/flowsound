// 首屏防闪烁：在页面渲染前根据 localStorage / 系统偏好设置主题 class。
// 由根布局以 next/script 的 beforeInteractive 策略引入。
//
// 注意：主题值由 saveToStorage 以 JSON 形式写入，localStorage 里的原始值是带引号的
// （"dark"），不能直接与 "dark" 比较，否则条件永远不成立、防闪烁失效。
try {
  var raw = localStorage.getItem("flowsound_theme");
  var theme = null;
  if (raw) {
    try {
      theme = JSON.parse(raw);
    } catch {
      theme = raw; // 兼容早期可能写入的裸字符串
    }
  }
  if (theme === "dark" || (!theme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.classList.add("dark");
  }
} catch {
  /* localStorage 不可用时忽略 */
}
