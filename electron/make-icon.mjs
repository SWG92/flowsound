// 生成应用图标：品牌 logo（三条声波+流线）渲染到深色圆角底上 → build/icon.png
// electron-builder 会以该 PNG 自动生成 Windows .ico / 其余平台图标
// 用法：node electron/make-icon.mjs
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const svg = `<svg width="512" height="512" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#231d3d"/>
      <stop offset="1" stop-color="#141a30"/>
    </linearGradient>
    <linearGradient id="brand" x1="4" y1="22" x2="20" y2="3" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#8b5cf6"/>
      <stop offset="1" stop-color="#38bdf8"/>
    </linearGradient>
  </defs>
  <rect width="24" height="24" rx="5.6" fill="url(#bg)"/>
  <g transform="translate(-1.2 -1.4) scale(1.1)">
    <rect x="4" y="10.5" width="3.2" height="7.5" rx="1.6" fill="url(#brand)" opacity="0.65"/>
    <rect x="10.4" y="4" width="3.2" height="14" rx="1.6" fill="url(#brand)"/>
    <rect x="16.8" y="8" width="3.2" height="10" rx="1.6" fill="url(#brand)" opacity="0.8"/>
    <path d="M2.5 21.2c3.6-2.8 7.2 1.4 10.8-1.6 2.5-2.1 5-4.6 8.2-10.4"
      stroke="url(#brand)" stroke-width="1.7" stroke-linecap="round" opacity="0.9"/>
  </g>
</svg>`;

const out = path.resolve("desktop/build/icon.png");
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(path.resolve("build/icon.svg"), svg);
await sharp(Buffer.from(svg), { density: 512 }).resize(512, 512).png().toFile(out);
console.log("icon ->", out);
