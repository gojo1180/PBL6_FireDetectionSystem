import React from 'react';
import { AlertTriangle, Zap, ShieldCheck } from 'lucide-react';
import { FusionAlert } from '@/types';
import { fmtTime } from '@/lib/utils';

export function StatusBanner({ latestAlert }: { latestAlert: FusionAlert | null }) {
  const riskLevel = latestAlert?.is_resolved === false ? latestAlert.risk_level : "SAFE";
  
  const bannerMap: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string; glow: string; blink: string }> = {
    DANGER: { bg: "bg-ctp-red", text: "text-white", icon: <AlertTriangle size={22} />, label: "DANGER — Immediate Action Required", glow: "animate-glow-red", blink: "animate-blink" },
    WARNING: { bg: "bg-ctp-yellow", text: "text-ctp-text", icon: <Zap size={22} />, label: "WARNING — Anomaly Detected", glow: "animate-glow-yellow", blink: "" },
    SAFE: { bg: "bg-ctp-green", text: "text-white", icon: <ShieldCheck size={22} />, label: "ALL SYSTEMS NORMAL", glow: "", blink: "" },
  };
  
  const banner = bannerMap[riskLevel] ?? bannerMap.SAFE;

  return (
    <div className={`${banner.bg} ${banner.text} ${banner.glow} rounded-2xl px-6 py-4 flex items-center justify-between transition-all duration-300`}>
      <div className="flex items-center gap-3">
        <div className={banner.blink}>{banner.icon}</div>
        <div>
          <p className={`text-lg font-bold tracking-wide ${banner.blink}`}>{banner.label}</p>
          {latestAlert && !latestAlert.is_resolved && (
            <p className="text-sm opacity-80 mt-0.5">{latestAlert.alert_message}</p>
          )}
        </div>
      </div>
      <div className="text-right text-xs opacity-70 hidden sm:block">
        <p>Last check</p>
        <p className="font-mono">{latestAlert ? fmtTime(latestAlert.triggered_at) : "—"}</p>
      </div>
    </div>
  );
}
