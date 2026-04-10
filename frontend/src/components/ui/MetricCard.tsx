import React from 'react';

interface MetricCardProps {
  label: string; 
  value?: number; 
  unit: string; 
  icon: React.ReactNode; 
  accent: string; 
  warn: boolean;
}

export function MetricCard({ label, value, unit, icon, accent, warn }: MetricCardProps) {
  return (
    <div className={`card p-5 flex flex-col justify-between min-h-[140px] transition-shadow ${warn ? "ring-2 ring-ctp-red/30" : ""}`}>
      <div className="flex items-center justify-between mb-3">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider text-ctp-subtext0">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-3xl font-extrabold tabular-nums text-${accent}`}>
          {value !== undefined ? value.toFixed(1) : "—"}
        </span>
        <span className="text-xs font-medium text-ctp-overlay0">{unit}</span>
      </div>
      <div className="mt-3 w-full h-1.5 rounded-full bg-ctp-surface0 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 bg-${accent}`} style={{ width: `${Math.min((value ?? 0) * 5, 100)}%` }} />
      </div>
    </div>
  );
}
