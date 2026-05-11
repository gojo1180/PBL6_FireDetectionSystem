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
    glow: 'shadow-[0_0_10px_rgba(16,185,129,0.4)]',
    iconBg: 'bg-emerald-500/10',
    spotlight: 'rgba(16, 185, 129, 0.10)',
  },
  warning: {
    text: 'text-amber-500',
    bar: 'bg-amber-500',
    glow: 'shadow-[0_0_10px_rgba(245,158,11,0.4)]',
    iconBg: 'bg-amber-500/10',
    spotlight: 'rgba(245, 158, 11, 0.12)',
  },
  danger: {
    text: 'text-rose-500',
    bar: 'bg-rose-500',
    glow: 'shadow-[0_0_10px_rgba(244,63,94,0.5)]',
    iconBg: 'bg-rose-500/10',
    spotlight: 'rgba(244, 63, 94, 0.15)',
  },
  neutral: {
    text: 'text-ctp-blue',
    bar: 'bg-ctp-blue',
    glow: 'shadow-[0_0_10px_rgba(30,102,245,0.3)]',
    iconBg: 'bg-ctp-blue/10',
    spotlight: 'rgba(30, 102, 245, 0.10)',
  },
};

// Map Catppuccin accent to spotlight fallback for env cards (temp/humidity)
const getEnvSpotlightColor = (accent: string) => {
  switch (accent) {
    case 'ctp-blue': return 'rgba(138, 173, 244, 0.12)';
    case 'ctp-sky': return 'rgba(4, 165, 229, 0.12)';
    case 'ctp-sapphire': return 'rgba(32, 159, 181, 0.12)';
    case 'ctp-teal': return 'rgba(23, 146, 153, 0.12)';
    default: return 'rgba(138, 173, 244, 0.10)';
  }
};

// Full class-name lookup so Tailwind JIT can detect them at build time.
// Dynamic interpolation like `text-${accent}` is NOT supported.
const accentClassMap: Record<string, { text: string; bar: string; iconBg: string }> = {
  'ctp-blue':     { text: 'text-ctp-blue',     bar: 'bg-ctp-blue shadow-[0_0_8px_currentColor]',     iconBg: 'bg-ctp-blue/10' },
  'ctp-sky':      { text: 'text-ctp-sky',      bar: 'bg-ctp-sky shadow-[0_0_8px_currentColor]',      iconBg: 'bg-ctp-sky/10' },
  'ctp-sapphire': { text: 'text-ctp-sapphire', bar: 'bg-ctp-sapphire shadow-[0_0_8px_currentColor]', iconBg: 'bg-ctp-sapphire/10' },
  'ctp-teal':     { text: 'text-ctp-teal',     bar: 'bg-ctp-teal shadow-[0_0_8px_currentColor]',     iconBg: 'bg-ctp-teal/10' },
  'ctp-peach':    { text: 'text-ctp-peach',     bar: 'bg-ctp-peach shadow-[0_0_8px_currentColor]',    iconBg: 'bg-ctp-peach/10' },
  'ctp-lavender': { text: 'text-ctp-lavender',  bar: 'bg-ctp-lavender shadow-[0_0_8px_currentColor]', iconBg: 'bg-ctp-lavender/10' },
  'ctp-red':      { text: 'text-ctp-red',       bar: 'bg-ctp-red shadow-[0_0_8px_currentColor]',      iconBg: 'bg-ctp-red/10' },
  'ctp-yellow':   { text: 'text-ctp-yellow',    bar: 'bg-ctp-yellow shadow-[0_0_8px_currentColor]',   iconBg: 'bg-ctp-yellow/10' },
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
    ? (warn ? 'rgba(244, 63, 94, 0.2)' : colors.spotlight)
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
        hover:-translate-y-1 hover:shadow-xl
        transition-all duration-300 ease-out
        ${className}
      `}
    >
      {/* Header: Icon + Label */}
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${iconBgClass} transition-colors duration-300`}>
          {icon}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-ctp-subtext0">
          {label}
        </span>
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-1.5">
        <span className={`text-3xl font-extrabold tabular-nums ${valueColorClass} drop-shadow-md transition-colors duration-300`}>
          {value !== undefined ? value.toFixed(1) : "—"}
        </span>
        <span className="text-xs font-medium text-ctp-overlay0">{unit}</span>
      </div>

      {/* Progress bar */}
      <div className="mt-3 w-full h-1.5 rounded-full bg-ctp-crust/80 overflow-hidden shadow-inner flex items-center">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barColorClass}`}
          style={{ width: `${progress !== undefined ? progress : Math.min((value ?? 0) * 5, 100)}%` }}
        />
      </div>
    </SpotlightCard>
  );
}

