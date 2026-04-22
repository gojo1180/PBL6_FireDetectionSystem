import React from 'react';
import { AlertTriangle, Zap, ShieldCheck, MapPin } from 'lucide-react';
import { FusionAlert, Device } from '@/types';
import { fmtTime } from '@/lib/utils';
import { apiFetch } from '@/lib/api';

interface StatusBannerProps {
  latestAlert: FusionAlert | null;
  devices: Device[];
  onClearAlert?: () => void;
}

export function StatusBanner({ latestAlert, devices, onClearAlert }: StatusBannerProps) {
  const riskLevel = latestAlert?.is_resolved === false ? latestAlert.risk_level : "SAFE";
  
  const handleClear = async () => {
    if (!latestAlert) return;
    try {
      await apiFetch(`/api/v1/alerts/${latestAlert.id}/resolve`, { method: "PATCH" });
      if (onClearAlert) onClearAlert();
    } catch (e) {
      console.error("Failed to clear alert", e);
    }
  };

  // Resolve the device name for the alerting device
  const alertDevice = latestAlert && !latestAlert.is_resolved
    ? devices.find(d => d.id === latestAlert.device_id)
    : null;

  const deviceLabel = alertDevice
    ? `${alertDevice.device_name} — ${alertDevice.location || "Unknown Location"}`
    : null;

  const bannerMap: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string; glow: string; blink: string }> = {
    FIRE_DANGER: {
      bg: "bg-ctp-red",
      text: "text-white",
      icon: <AlertTriangle size={22} />,
      label: deviceLabel ? `FIRE DANGER — Anomaly at ${deviceLabel}` : "FIRE DANGER — Immediate Action Required",
      glow: "animate-glow-red",
      blink: "animate-blink",
    },
    CCTV_ALERT: {
      bg: "bg-ctp-peach",
      text: "text-white",
      icon: <Zap size={22} />,
      label: deviceLabel ? `CCTV ALERT — Threat detected at ${deviceLabel}` : "CCTV ALERT — Threat detected",
      glow: "animate-glow-yellow",
      blink: "",
    },
    SENSOR_ALERT: {
      bg: "bg-ctp-yellow",
      text: "text-ctp-crust",
      icon: <AlertTriangle size={22} />,
      label: deviceLabel ? `SENSOR ALERT — Anomaly at ${deviceLabel}` : "SENSOR ALERT — Anomaly Detected",
      glow: "animate-glow-yellow",
      blink: "",
    },
    DANGER: {
      bg: "bg-ctp-red",
      text: "text-white",
      icon: <AlertTriangle size={22} />,
      label: deviceLabel ? `DANGER — Anomaly at ${deviceLabel}` : "DANGER — Immediate Action Required",
      glow: "animate-glow-red",
      blink: "animate-blink",
    },
    WARNING: {
      bg: "bg-ctp-peach",
      text: "text-white",
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
      <div className="flex items-center gap-4 text-xs opacity-90 hidden sm:flex">
        {latestAlert && !latestAlert.is_resolved && (
          <button 
            onClick={handleClear}
            className="px-3 py-1.5 bg-black/20 hover:bg-black/30 backdrop-blur-sm rounded-lg border border-white/20 transition-all font-semibold uppercase tracking-wider"
          >
            Clear Alert
          </button>
        )}
        <div className="text-right opacity-70">
          <p>Last check</p>
          <p className="font-mono">{latestAlert ? fmtTime(latestAlert.triggered_at) : "—"}</p>
        </div>
      </div>
    </div>
  );
}
