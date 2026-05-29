"use client";

import React from 'react';
import { SpotlightCard } from './SpotlightCard';
import { Info, X } from 'lucide-react';

// ─── Sensor Information Mapping (K3/OSHA) ──────────────────────────────────
const infoMap: Record<string, { desc: string }> = {
  "Smoke": { desc: "Konsentrasi partikel asap di udara akibat adanya pembakaran." },
  "CO": { desc: "Karbon Monoksida (CO), gas beracun hasil pembakaran yang tidak sempurna." },
  "LPG": { desc: "Liquid Petroleum Gas (Propana/Butana), campuran gas mudah terbakar." },
  "CNG (Metana)": { desc: "Compressed Natural Gas (Metana murni), gas alam yang mudah meledak." },
  "Flame": { desc: "Sensor pendeteksi radiasi inframerah dari keberadaan nyala api." },
  "Temperature": { desc: "Suhu ruangan lingkungan terpantau di sekitar area pemantauan." },
  "Humidity": { desc: "Tingkat kelembapan relatif udara di sekitar sensor." }
};

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
  const [isInfoHovered, setIsInfoHovered] = React.useState(false);

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
        flex flex-col min-h-[148px]
        rounded-xl
        hover:-translate-y-1 hover:shadow-lg
        transition-all duration-300 ease-out
        ${className}
      `}
    >
      {/* Main card content wrapped in padding container */}
      <div className="p-5 flex flex-col justify-between flex-1 w-full h-full">
        {/* Header: Icon + Label */}
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2.5 rounded-xl ${iconBgClass} transition-colors duration-300`}>
            {icon}
          </div>
          <div className="flex items-center gap-1.5 group relative">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {label}
            </span>
            {infoMap[label] && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsInfoHovered(true);
                }}
                className="relative flex items-center justify-center p-0.5 -m-0.5 cursor-pointer outline-none animate-pulse hover:animate-none"
                aria-label="Info Keterangan"
              >
                <Info 
                  size={12} 
                  className="text-slate-400 hover:text-indigo-500 transition-colors" 
                />
              </button>
            )}
          </div>
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
      </div>

      {/* Dynamic Info Overlay (Light Glassmorphism, absolute overlay matching outer borders) */}
      {infoMap[label] && (
        <div 
          onClick={() => setIsInfoHovered(false)}
          className={`absolute inset-0 z-20 bg-white/90 backdrop-blur-md p-6 rounded-xl flex flex-col justify-center items-center transition-all duration-300 border border-white/60 shadow-[0_8px_32px_0_rgba(99,102,241,0.05)] text-center cursor-pointer ${
            isInfoHovered ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"
          }`}
        >
          {/* Close Button */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsInfoHovered(false);
            }}
            className="absolute top-3 right-3 p-1 rounded-full text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-all duration-200"
            aria-label="Tutup"
          >
            <X size={14} />
          </button>

          <div className="flex flex-col items-center justify-center gap-3 w-full">
            <div className="p-2 rounded-xl bg-indigo-50/80 border border-indigo-100/50 text-indigo-500 shadow-sm flex items-center justify-center">
              <Info size={16} className="animate-pulse" />
            </div>
            <p className="text-[11px] font-black text-indigo-600/90 uppercase tracking-[0.25em]">
              {label}
            </p>
            <p className="text-xs text-slate-600 leading-relaxed font-bold px-1 max-w-[90%]">
              {infoMap[label].desc}
            </p>
          </div>
        </div>
      )}
    </SpotlightCard>
  );
}
