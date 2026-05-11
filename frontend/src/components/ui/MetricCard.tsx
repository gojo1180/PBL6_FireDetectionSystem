"use client";

import React from 'react';
import { SpotlightCard } from './SpotlightCard';

// ─── Semantic Status Colors ─────────────────────────────────────────────────
// Determines the status color based on value thresholds or warn flag.
// Returns: 'safe' (emerald), 'warning' (amber), 'danger' (rose/red)
type StatusLevel = 'safe' | 'warning' | 'danger' | 'neutral';

const getStatusLevel = (warn: boolean, progress?: number): StatusLevel => {
  if (warn) return 'danger';
  if (progress !== undefined) {
    if (progress >= 75) return 'warning';
    if (progress >= 90) return 'danger';
  }
  return 'safe';
};

// Map status level to Tailwind color classes
const statusColorMap: Record<StatusLevel, {
  text: string;
  bar: string;
  glow: string;
  iconBg: string;
  spotlight: string;
}> = {
  safe: {
    text: 'text-emerald-600',
    bar: 'bg-emerald-500',
    glow: 'shadow-[0_0_8px_rgba(16,185,129,0.3)]',
    iconBg: 'bg-emerald-50',
    spotlight: 'rgba(16, 185, 129, 0.06)',
  },
  warning: {
    text: 'text-amber-500',
    bar: 'bg-amber-500',
    glow: 'shadow-[0_0_8px_rgba(245,158,11,0.3)]',
    iconBg: 'bg-amber-50',
    spotlight: 'rgba(245, 158, 11, 0.08)',
  },
  danger: {
    text: 'text-rose-500',
    bar: 'bg-rose-500',
    glow: 'shadow-[0_0_8px_rgba(244,63,94,0.4)]',
    iconBg: 'bg-rose-50',
    spotlight: 'rgba(244, 63, 94, 0.08)',
  },
  neutral: {
    text: 'text-indigo-500',
    bar: 'bg-indigo-500',
    glow: 'shadow-[0_0_8px_rgba(99,102,241,0.25)]',
    iconBg: 'bg-indigo-50',
    spotlight: 'rgba(99, 102, 241, 0.06)',
  },
};

// Map accent key to spotlight fallback for env cards (temp/humidity)
const getEnvSpotlightColor = (accent: string) => {
  switch (accent) {
    case 'ctp-blue': return 'rgba(99, 102, 241, 0.06)';
    case 'ctp-sky': return 'rgba(14, 165, 233, 0.06)';
    case 'ctp-sapphire': return 'rgba(32, 159, 181, 0.06)';
    case 'ctp-teal': return 'rgba(20, 184, 166, 0.06)';
    default: return 'rgba(99, 102, 241, 0.05)';
  }
};

// Full class-name lookup so Tailwind JIT can detect them at build time.
const accentClassMap: Record<string, { text: string; bar: string; iconBg: string }> = {
  'ctp-blue':     { text: 'text-indigo-500',   bar: 'bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.3)]',   iconBg: 'bg-indigo-50' },
  'ctp-sky':      { text: 'text-sky-500',      bar: 'bg-sky-500 shadow-[0_0_6px_rgba(14,165,233,0.3)]',      iconBg: 'bg-sky-50' },
  'ctp-sapphire': { text: 'text-cyan-500',     bar: 'bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.3)]',      iconBg: 'bg-cyan-50' },
  'ctp-teal':     { text: 'text-teal-500',     bar: 'bg-teal-500 shadow-[0_0_6px_rgba(20,184,166,0.3)]',     iconBg: 'bg-teal-50' },
  'ctp-peach':    { text: 'text-amber-500',    bar: 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.3)]',    iconBg: 'bg-amber-50' },
  'ctp-lavender': { text: 'text-violet-500',   bar: 'bg-violet-500 shadow-[0_0_6px_rgba(139,92,246,0.3)]',   iconBg: 'bg-violet-50' },
  'ctp-red':      { text: 'text-rose-500',     bar: 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.3)]',      iconBg: 'bg-rose-50' },
  'ctp-yellow':   { text: 'text-indigo-500',   bar: 'bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.3)]',   iconBg: 'bg-indigo-50' },
};

// ─── Types ──────────────────────────────────────────────────────────────────
export type MetricCardVariant = 'gas' | 'environment';

interface MetricCardProps {
  label: string;
  value?: number;
  unit: string;
  icon: React.ReactNode;
  accent: string;
  warn: boolean;
  className?: string;
  progress?: number;
  /** 'gas' enables dynamic semantic colors; 'environment' keeps accent-based styling */
  variant?: MetricCardVariant;
}

// ─── Component ──────────────────────────────────────────────────────────────
export function MetricCard({
  label,
  value,
  unit,
  icon,
  accent,
  warn,
  className = "",
  progress,
  variant = 'gas',
}: MetricCardProps) {
  // Determine status-based color scheme for gas cards; env cards use accent
  const isGas = variant === 'gas';
  const status = isGas ? getStatusLevel(warn, progress) : 'neutral';
  const colors = statusColorMap[status];
  const accentColors = accentClassMap[accent] || accentClassMap['ctp-blue'];

  // Spotlight color
  const spotlightColor = isGas
    ? (warn ? 'rgba(244, 63, 94, 0.1)' : colors.spotlight)
    : getEnvSpotlightColor(accent);

  // Value color class
  const valueColorClass = isGas ? colors.text : accentColors.text;

  // Progress bar color class
  const barColorClass = isGas ? `${colors.bar} ${colors.glow}` : accentColors.bar;

  // Icon background color
  const iconBgClass = isGas ? colors.iconBg : accentColors.iconBg;

  return (
    <SpotlightCard
      warn={warn}
      spotlightColor={spotlightColor}
      className={`
        p-5 flex flex-col justify-between min-h-[148px]
        rounded-xl
        hover:-translate-y-1 hover:shadow-lg
        transition-all duration-300 ease-out
        ${className}
      `}
    >
      {/* Header: Icon + Label */}
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${iconBgClass} transition-colors duration-300`}>
          {icon}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </span>
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-1.5">
        <span className={`text-3xl font-extrabold tabular-nums ${valueColorClass} transition-colors duration-300`}>
          {value !== undefined ? value.toFixed(1) : "—"}
        </span>
        <span className="text-xs font-medium text-slate-400">{unit}</span>
      </div>

      {/* Progress bar */}
      <div className="mt-3 w-full h-1.5 rounded-full bg-slate-100 overflow-hidden flex items-center">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barColorClass}`}
          style={{ width: `${progress !== undefined ? progress : Math.min((value ?? 0) * 5, 100)}%` }}
        />
      </div>
    </SpotlightCard>
  );
}
