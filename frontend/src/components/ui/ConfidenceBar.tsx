import React from "react";

export function ConfidenceBar({ label, value, color, threshold }: { label: string; value: number; color: string; threshold: number }) {
  const pct = (value * 100).toFixed(1);
  const isHigh = value > threshold;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="font-semibold text-ctp-subtext0 uppercase tracking-wide">{label}</span>
        <span className="font-bold tabular-nums" style={{ color: isHigh ? color : "#9ca0b0" }}>{pct}%</span>
      </div>
      <div className="w-full h-2 rounded-full bg-ctp-surface0 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value * 100}%`, backgroundColor: isHigh ? color : "#acb0be" }} />
      </div>
    </div>
  );
}
