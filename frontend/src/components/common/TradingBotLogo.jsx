// TradingBotLogo.jsx - Unified TradingBot branding component
import React from 'react';
import { cn } from '../../utils/cn';

export function TradingBotIcon({ size = 36, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('flex-shrink-0 transition-transform duration-200 hover:scale-105', className)}
    >
      <defs>
        <linearGradient id="tb-box-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>
        <linearGradient id="tb-accent-grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="60%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
        <filter id="tb-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#06b6d4" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Rounded squircle background */}
      <rect x="2" y="2" width="36" height="36" rx="9" fill="url(#tb-box-grad)" stroke="url(#tb-accent-grad)" strokeWidth="1.5" />

      {/* Candlestick bars */}
      <rect x="10" y="20" width="3" height="10" rx="1" fill="#10b981" opacity="0.85" />
      <line x1="11.5" y1="17" x2="11.5" y2="33" stroke="#10b981" strokeWidth="1" strokeLinecap="round" opacity="0.6" />

      <rect x="17" y="14" width="3.2" height="16" rx="1" fill="#06b6d4" opacity="0.9" />
      <line x1="18.6" y1="11" x2="18.6" y2="33" stroke="#06b6d4" strokeWidth="1" strokeLinecap="round" opacity="0.6" />

      <rect x="24.5" y="8" width="3.2" height="22" rx="1" fill="#38bdf8" />
      <line x1="26.1" y1="5" x2="26.1" y2="33" stroke="#38bdf8" strokeWidth="1" strokeLinecap="round" opacity="0.6" />

      {/* Breakout lightning pulse */}
      <path
        d="M 7 28 L 15 18 L 22 22 L 32 8"
        fill="none"
        stroke="url(#tb-accent-grad)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#tb-glow)"
      />
      {/* Radiant target node */}
      <circle cx="32" cy="8" r="2.2" fill="#38bdf8" filter="url(#tb-glow)" />
    </svg>
  );
}

export default function TradingBotLogo({
  collapsed = false,
  showBadge = true,
  badgeText = "PRO",
  className = "",
  size = "md",
}) {
  const iconSize = size === "sm" ? 28 : size === "lg" ? 44 : 36;
  const textSize = size === "sm" ? "text-base" : size === "lg" ? "text-xl" : "text-lg";

  if (collapsed) {
    return (
      <div className={cn("flex items-center justify-center", className)} title="TradingBot">
        <TradingBotIcon size={iconSize} />
      </div>
    );
  }

  return (
    <div className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <TradingBotIcon size={iconSize} />
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={cn("font-bold tracking-tight text-heading font-display", textSize)}>
          Trading<span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Bot</span>
        </span>
        {showBadge && (
          <span className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {badgeText}
          </span>
        )}
      </div>
    </div>
  );
}
