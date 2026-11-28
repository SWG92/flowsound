import { useId } from "react";

/**
 * FlowSound 品牌标识：品牌渐变磁贴 + 白色三条声波 + 底部流线。
 * 磁贴造型即"应用图标"质感；声波与播放中的 eq-bar 可视化同构；
 * 流线呼应 Flow。品牌渐变（紫→蓝）与 gradient-text 同源。
 */
export function LogoMark({ className }: { className?: string }) {
  // 渐变 id 必须实例唯一：侧栏的移动/桌面两个 Logo 同时在 DOM（其一 display:none），
  // 共用 id 时可见实例会引用到隐藏实例的渐变定义而失效（图标整体透明）
  const gid = `fs-brand-${useId()}`;
  const fill = `url(#${gid})`;

  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="3" y1="29" x2="29" y2="3" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      {/* 品牌渐变磁贴（应用图标质感） */}
      <rect x="1" y="1" width="30" height="30" rx="9" fill={fill} />
      {/* 白色三条声波：低-高-中，错落的节奏感 */}
      <rect x="8" y="14" width="2.6" height="6.5" rx="1.3" fill="white" opacity="0.85" />
      <rect x="14.7" y="7.5" width="2.6" height="13" rx="1.3" fill="white" />
      <rect x="21.4" y="11" width="2.6" height="9.5" rx="1.3" fill="white" opacity="0.9" />
      {/* 白色底部流线：从左下流向右上的韵律曲线 */}
      <path
        d="M6.5 25.6c3.2-2.4 6.3 1.2 9.5-1.4 2.2-1.8 4.3-4 7-8.6"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.95"
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
