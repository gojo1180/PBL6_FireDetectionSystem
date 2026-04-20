import React from 'react';
import { AlertTriangle, Zap, ShieldCheck, MapPin } from 'lucide-react';
import { FusionAlert, Device } from '@/types';
import { fmtTime } from '@/lib/utils';

interface StatusBannerProps {
  latestAlert: FusionAlert | null;
  devices: Device[];
}

export function StatusBanner({ latestAlert, devices }: StatusBannerProps) {
  const riskLevel = latestAlert?.is_resolved === false ? latestAlert.risk_level : "SAFE";

  // Resolve the device name for the alerting device
  const alertDevice = latestAlert && !latestAlert.is_resolved
    ? devices.find(d => d.id === latestAlert.device_id)
    : null;

  const deviceLabel = alertDevice
    ? `${alertDevice.device_name} — ${alertDevice.location || "Unknown Location"}`
    : null;

  const bannerMap: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string; glow: string; blink: string }> = {
    DANGER: {
      bg: "bg-ctp-red",
      text: "text-white",
      icon: <AlertTriangle size={22} />,
      label: deviceLabel ? `DANGER — Anomaly at ${deviceLabel}` : "DANGER — Immediate Action Required",
      glow: "animate-glow-red",
      blink: "animate-blink",
    },
    WARNING: {
      bg: "bg-ctp-yellow",
      text: "text-ctp-text",
      icon: <Zap size={22} />,
      label: deviceLabel ? `WARNING — Anomaly at ${deviceLabel}` : "WARNING — Anomaly Detected",
      glow: "animate-glow-yellow",
      blink: "",
    },
    SAFE: {
      bg: "bg-ctp-green",
      text: "text-white",
      icon: <ShieldCheck size={22} />,
      label: "ALL SYSTEMS NORMAL",
      glow: "",
      blink: "",
    },
  };

  const banner = bannerMap[riskLevel] ?? bannerMap.SAFE;

  return (
    <div className={`${banner.bg} ${banner.text} ${banner.glow} rounded-2xl px-6 py-4 flex items-center justify-between transition-all duration-300`}>
      <div className="flex items-center gap-3">
        <div className={banner.blink}>{banner.icon}</div>
        <div>
          <p className={`text-lg font-bold tracking-wide ${banner.blink}`}>{banner.label}</p>
          {latestAlert && !latestAlert.is_resolved && (
            <div className="flex items-center gap-2 mt-0.5">
              {alertDevice && (
                <span className="flex items-center gap-1 text-xs opacity-70">
                  <MapPin size={12} />
                  {alertDevice.location || "Unknown"}
                </span>
              )}
              <p className="text-sm opacity-80">{latestAlert.alert_message}</p>
            </div>
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
