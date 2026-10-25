/**
 * FlowSound 品牌标识：三条流动声波 + 底部流线。
 * 声波与播放中的 eq-bar 可视化同构——logo 即"正在播放"的样子；
 * 流线呼应 Flow。品牌渐变（紫→蓝）与 gradient-text 同源。
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="fs-brand" x1="4" y1="22" x2="20" y2="3" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      {/* 三条声波：低-高-中，错落的节奏感 */}
      <rect x="4" y="10.5" width="3.2" height="7.5" rx="1.6" fill="url(#fs-brand)" opacity="0.65" />
      <rect x="10.4" y="4" width="3.2" height="14" rx="1.6" fill="url(#fs-brand)" />
      <rect x="16.8" y="8" width="3.2" height="10" rx="1.6" fill="url(#fs-brand)" opacity="0.8" />
      {/* 底部流线：从左下流向右上的韵律曲线 */}
      <path
        d="M2.5 21.2c3.6-2.8 7.2 1.4 10.8-1.6 2.5-2.1 5-4.6 8.2-10.4"
        stroke="url(#fs-brand)"
        strokeWidth="1.7"
        strokeLinecap="round"
        opacity="0.9"
      />
    </svg>
  );
}

/** 完整品牌区（图标 + 名称 + 标志语） */
export function LogoBlock({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark className="h-8 w-8 shrink-0" />
      <span className="flex flex-col leading-none">
        <span className="text-lg font-bold gradient-text">FlowSound</span>
        {!compact && (
          <span className="text-[10px] text-muted-foreground tracking-wide mt-1">让音乐流动起来</span>
        )}
      </span>
    </span>
  );
}
