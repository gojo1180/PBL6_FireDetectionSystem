import React, { useState, useEffect } from 'react';
import { AlertTriangle, Zap, ShieldCheck, MapPin } from 'lucide-react';
import { FusionAlert, Device } from '@/types';
import { fmtTime } from '@/lib/utils';
import { resolveAlert } from '@/lib/api';

interface StatusBannerProps {
 latestAlert: FusionAlert | null;
 devices: Device[];
 onClearAlert?: () => void;
}

export function StatusBanner({ latestAlert, devices, onClearAlert }: StatusBannerProps) {
 const [now, setNow] = useState(new Date().getTime());
 const [confirmingAlertId, setConfirmingAlertId] = useState<string | null>(null);

 useEffect(() => {
 const interval = setInterval(() => setNow(new Date().getTime()), 1000);
 return () => clearInterval(interval);
 }, []);

 const riskLevel = latestAlert?.is_resolved === false ? latestAlert.risk_level : "SAFE";
 
 const handleClear = async () => {
 if (!confirmingAlertId) return;
 try {
 await resolveAlert(confirmingAlertId);
 setConfirmingAlertId(null);
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
 bg: "bg-red-500",
 text: "text-white",
 icon: <AlertTriangle size={22} />,
 label: deviceLabel ? `FIRE DANGER — Anomaly at ${deviceLabel}` : "FIRE DANGER — Immediate Action Required",
 glow: "animate-glow-red",
 blink: "animate-blink",
 },
 CCTV_ALERT: {
 bg: "bg-amber-500",
 text: "text-white",
 icon: <Zap size={22} />,
 label: deviceLabel ? `CCTV ALERT — Threat detected at ${deviceLabel}` : "CCTV ALERT — Threat detected",
 glow: "animate-glow-yellow",
 blink: "",
 },
 SENSOR_ALERT: {
 bg: "bg-yellow-500",
 text: "text-white",
 icon: <AlertTriangle size={22} />,
 label: deviceLabel ? `SENSOR ALERT — Anomaly at ${deviceLabel}` : "SENSOR ALERT — Anomaly Detected",
 glow: "animate-glow-yellow",
 blink: "",
 },
 DANGER: {
 bg: "bg-red-500",
 text: "text-white",
 icon: <AlertTriangle size={22} />,
 label: deviceLabel ? `DANGER — Anomaly at ${deviceLabel}` : "DANGER — Immediate Action Required",
 glow: "animate-glow-red",
 blink: "animate-blink",
 },
 WARNING: {
 bg: "bg-amber-500",
 text: "text-white",
 icon: <Zap size={22} />,
 label: deviceLabel ? `WARNING — Anomaly at ${deviceLabel}` : "WARNING — Anomaly Detected",
 glow: "animate-glow-yellow",
 blink: "",
 },
 SAFE: {
 bg: "bg-emerald-500",
 text: "text-white",
 icon: <ShieldCheck size={22} />,
 label: "ALL SYSTEMS NORMAL",
 glow: "",
 blink: "",
 },
 };

 const banner = bannerMap[riskLevel] ?? bannerMap.SAFE;

 const isAlertActive = latestAlert && !latestAlert.is_resolved;
 const alertAge = latestAlert ? now - new Date(latestAlert.triggered_at).getTime() : 0;
 const isLingering = isAlertActive && alertAge >= 10000;
 const isBlinking = isAlertActive && !isLingering;

 let blinkClass = banner.blink;
 let labelText = banner.label;
 let glowClass = banner.glow;

 if (isAlertActive) {
 if (isLingering) {
 blinkClass = "";
 labelText = "Menunggu Verifikasi Keamanan...";
 glowClass = ""; // Less aggressive glow when lingering
 } else {
 blinkClass = "animate-pulse"; // Override with pulse for ACTIVE phase
 }
 }

 return (
 <>
 <div className={`${banner.bg} ${banner.text} ${glowClass} rounded-2xl px-6 py-4 flex items-center justify-between transition-all duration-300 ${isBlinking ? 'animate-pulse' : ''}`}>
 <div className="flex items-center gap-3">
 <div className={blinkClass}>{banner.icon}</div>
 <div>
 <p className={`text-lg font-bold tracking-wide ${blinkClass}`}>{labelText}</p>
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
 onClick={() => setConfirmingAlertId(latestAlert.id)}
 className="px-3 py-1.5 bg-white/20 hover:bg-surface-card-elevated backdrop-blur-sm rounded-lg border border-white/20 transition-all font-semibold uppercase tracking-wider"
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
 
 {/* CONFIRMATION MODAL */}
 {confirmingAlertId && (
 <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm px-4">
 <div className="bg-surface-card p-6 rounded-2xl border border-hairline shadow-2xl max-w-md w-full animate-in fade-in zoom-in-95 duration-200">
 <div className="flex items-center gap-3 mb-4">
 <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
 <ShieldCheck size={20} className="text-red-500" />
 </div>
 <h3 className="text-lg font-bold text-ink">Konfirmasi Resolusi Alert</h3>
 </div>
 <p className="text-sm text-body mb-6 leading-relaxed">
 Apakah Anda yakin kondisi di lokasi sudah benar-benar aman? Tindakan ini akan menyembunyikan peringatan dari layar utama.
 </p>
 <div className="flex items-center justify-end gap-3">
 <button 
 onClick={() => setConfirmingAlertId(null)} 
 className="px-4 py-2.5 rounded-xl text-sm font-semibold text-body hover:bg-surface-card-elevated transition-colors"
 >
 Batal
 </button>
 <button 
 onClick={handleClear} 
 className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-500 text-white hover:bg-red-600 transition-all shadow-lg shadow-red-500/25 active:scale-95"
 >
 Ya, Tandai Aman
 </button>
 </div>
 </div>
 </div>
 )}
 </>
 );
}
