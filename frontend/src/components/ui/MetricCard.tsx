"use client";

import React from 'react';
import { SpotlightCard } from './SpotlightCard';

// Map Catppuccin tailwind classes to raw RGBA for the radial gradient
const getSpotlightColor = (accent: string, warn: boolean) => {
  if (warn) return 'rgba(237, 135, 150, 0.2)'; // ctp-red for danger
  
  switch (accent) {
    case 'ctp-blue': return 'rgba(138, 173, 244, 0.12)';
    case 'ctp-peach': return 'rgba(245, 169, 127, 0.12)';
    case 'ctp-teal': return 'rgba(139, 213, 202, 0.12)';
    case 'ctp-lavender': return 'rgba(183, 189, 248, 0.12)';
    case 'ctp-red': return 'rgba(237, 135, 150, 0.12)';
    default: return 'rgba(255, 255, 255, 0.1)';
  }
};

interface MetricCardProps {
  label: string;
  value?: number;
  unit: string;
  icon: React.ReactNode;
  accent: string;
  warn: boolean;
  className?: string;
}

export function MetricCard({ label, value, unit, icon, accent, warn, className = "" }: MetricCardProps) {
  const spotlightColor = getSpotlightColor(accent, warn);

  return (
    <SpotlightCard
      warn={warn}
      spotlightColor={spotlightColor}
      className={`p-5 flex flex-col justify-between min-h-[140px] ${className}`}
    >
      {/* Content */}
      <div className="flex items-center justify-between mb-3">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider text-ctp-subtext0">{label}</span>
      </div>
      
      <div className="flex items-baseline gap-1.5">
        <span className={`text-3xl font-extrabold tabular-nums text-${warn ? 'ctp-red' : accent} drop-shadow-md transition-colors duration-300`}>
          {value !== undefined ? value.toFixed(1) : "—"}
        </span>
        <span className="text-xs font-medium text-ctp-overlay0">{unit}</span>
      </div>
      
      <div className="mt-3 w-full h-1.5 rounded-full bg-ctp-crust/80 overflow-hidden shadow-inner flex items-center">
        <div 
          className={`h-full rounded-full transition-all duration-700 ease-out bg-${warn ? 'ctp-red' : accent} shadow-[0_0_8px_currentColor]`} 
          style={{ width: `${Math.min((value ?? 0) * 5, 100)}%` }} 
        />
      </div>
    </SpotlightCard>
  );
}
