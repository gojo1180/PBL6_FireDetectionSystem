"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Flame, Wind, AlertTriangle, ShieldCheck, Activity,
  Camera, Gauge, Eye, Bell, Zap, Droplets
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";

/* ─── Types ─── */
interface SensorLog {
  id: string; device_id: string; cng_level: number; co_level: number;
  lpg_level: number; flame_detected: boolean; smoke_detected: boolean; recorded_at: string;
}
interface VisionLog {
  id: string; device_id: string; fire_confidence: number;
  smoke_confidence: number; image_url: string | null; recorded_at: string;
}
interface FusionAlert {
  id: string; device_id: string; risk_level: string; fusion_score: number;
  alert_message: string; is_resolved: boolean; triggered_at: string;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/* ─── DASHBOARD ─── */
export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const [latestSensor, setLatestSensor] = useState<SensorLog | null>(null);
  const [latestVision, setLatestVision] = useState<VisionLog | null>(null);
  const [latestAlert, setLatestAlert] = useState<FusionAlert | null>(null);
  const [sensorHistory, setSensorHistory] = useState<SensorLog[]>([]);
  const [alertsList, setAlertsList] = useState<FusionAlert[]>([]);

  const fetchInitialData = useCallback(async () => {
    const { data: sensors } = await supabase.from("sensor_logs").select("*").order("recorded_at", { ascending: false }).limit(15);
    if (sensors && sensors.length > 0) { setLatestSensor(sensors[0]); setSensorHistory(sensors.reverse()); }

    const { data: visions } = await supabase.from("vision_logs").select("*").order("recorded_at", { ascending: false }).limit(1);
    if (visions && visions.length > 0) setLatestVision(visions[0]);

    const { data: alerts } = await supabase.from("fusion_alerts").select("*").order("triggered_at", { ascending: false }).limit(10);
    if (alerts && alerts.length > 0) { setLatestAlert(alerts[0]); setAlertsList(alerts); }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchInitialData();
    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sensor_logs" }, (payload) => {
        const s = payload.new as SensorLog;
        setLatestSensor(s);
        setSensorHistory((prev) => [...prev, s].slice(-15));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "vision_logs" }, (payload) => {
        setLatestVision(payload.new as VisionLog);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "fusion_alerts" }, (payload) => {
        const a = payload.new as FusionAlert;
        setLatestAlert(a);
        setAlertsList((prev) => [a, ...prev].slice(0, 10));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchInitialData]);

  /* Derived */
  const riskLevel = latestAlert?.is_resolved === false ? latestAlert.risk_level : "SAFE";
  const bannerMap: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string; glow: string; blink: string }> = {
    DANGER: { bg: "bg-ctp-red", text: "text-white", icon: <AlertTriangle size={22} />, label: "DANGER — Immediate Action Required", glow: "animate-glow-red", blink: "animate-blink" },
    WARNING: { bg: "bg-ctp-yellow", text: "text-ctp-text", icon: <Zap size={22} />, label: "WARNING — Anomaly Detected", glow: "animate-glow-yellow", blink: "" },
    SAFE: { bg: "bg-ctp-green", text: "text-white", icon: <ShieldCheck size={22} />, label: "ALL SYSTEMS NORMAL", glow: "", blink: "" },
  };
  const banner = bannerMap[riskLevel] ?? bannerMap.SAFE;

  const chartData = sensorHistory.map((s) => ({
    time: mounted ? fmtTime(s.recorded_at) : "",
    CNG: Number(s.cng_level.toFixed(2)),
    CO: Number(s.co_level.toFixed(2)),
    LPG: Number(s.lpg_level.toFixed(2)),
  }));

  if (!mounted) return <div className="flex-1 min-h-screen bg-ctp-base" />;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Bar */}
      <header className="h-14 border-b border-ctp-crust bg-ctp-mantle flex items-center justify-between px-6 shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-2 text-sm">
          <Activity size={16} className="text-ctp-blue" />
          <span className="font-semibold text-ctp-text">Control Center</span>
          <span className="text-ctp-overlay0">/</span>
          <span className="text-ctp-subtext0">Main Facility</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Bell size={18} className="text-ctp-subtext0" />
            {alertsList.filter(a => !a.is_resolved).length > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-ctp-red rounded-full border-2 border-ctp-mantle animate-pulse" />
            )}
          </div>
          <span className="text-xs text-ctp-overlay0 font-mono tabular-nums">
            {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-6 lg:p-8 space-y-6">

        {/* 1. STATUS BANNER */}
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

        {/* 2. SENSOR CARDS + VISION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sensor Cards - 2x2 grid */}
          <div className="lg:col-span-2 grid grid-cols-2 gap-4">
            <MetricCard label="CNG" value={latestSensor?.cng_level} unit="ppm" icon={<Gauge size={20} className="text-ctp-blue" />} accent="ctp-blue" warn={latestSensor ? latestSensor.cng_level > 8 : false} />
            <MetricCard label="CO" value={latestSensor?.co_level} unit="ppm" icon={<Wind size={20} className="text-ctp-peach" />} accent="ctp-peach" warn={latestSensor ? latestSensor.co_level > 15 : false} />
            <MetricCard label="LPG" value={latestSensor?.lpg_level} unit="ppm" icon={<Droplets size={20} className="text-ctp-teal" />} accent="ctp-teal" warn={latestSensor ? latestSensor.lpg_level > 10 : false} />
            {/* Binary */}
            <div className="card p-5 flex flex-col justify-between min-h-[140px]">
              <div className="flex items-center gap-2 mb-3">
                <Flame size={18} className="text-ctp-red" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-ctp-subtext0">Binary Sensors</span>
              </div>
              <div className="space-y-3 flex-1 flex flex-col justify-center">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ctp-subtext0">Flame</span>
                  <StatusPill active={latestSensor?.flame_detected ?? false} activeLabel="FIRE" inactiveLabel="CLEAR" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ctp-subtext0">Smoke</span>
                  <StatusPill active={latestSensor?.smoke_detected ?? false} activeLabel="SMOKE" inactiveLabel="CLEAR" />
                </div>
              </div>
              <p className="text-[10px] text-ctp-overlay0 mt-2 font-mono tabular-nums">{latestSensor ? fmtTime(latestSensor.recorded_at) : "—"}</p>
            </div>
          </div>

          {/* Vision Card */}
          <div className="card overflow-hidden flex flex-col">
            <div className="px-5 py-3 border-b border-ctp-crust flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera size={16} className="text-ctp-lavender" />
                <span className="text-sm font-semibold text-ctp-text">Vision Feed</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-ctp-green font-semibold">
                <span className="w-2 h-2 rounded-full bg-ctp-green animate-pulse" />
                LIVE
              </div>
            </div>
            <div className={`relative aspect-video flex items-center justify-center transition-colors duration-300 ${latestVision && latestVision.fire_confidence > 0 ? "bg-red-50" : "bg-ctp-crust"
              }`}>
              {latestVision && latestVision.fire_confidence > 0 ? (
                <>
                  <div className="absolute inset-0 border-4 border-ctp-red animate-pulse pointer-events-none z-10" />
                  <Flame size={48} strokeWidth={1.5} className="text-ctp-red" />
                </>
              ) : (
                <Eye size={48} strokeWidth={1} className="text-ctp-surface1" />
              )}
              <span className="absolute top-2 left-2 bg-black/50 text-white text-[10px] font-mono px-2 py-0.5 rounded">CAM-01</span>
            </div>
            <div className="p-5 space-y-4 flex-1">
              <ConfidenceBar label="Fire" value={latestVision?.fire_confidence ?? 0} color="#d20f39" threshold={0.6} />
              <ConfidenceBar label="Smoke" value={latestVision?.smoke_confidence ?? 0} color="#fe640b" threshold={0.4} />
              <p className="text-[10px] text-ctp-overlay0 font-mono tabular-nums pt-1">
                Last detection: {latestVision ? fmtTime(latestVision.recorded_at) : "No events"}
              </p>
            </div>
          </div>
        </div>

        {/* 3. CHART + ALERTS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart */}
          <div className="lg:col-span-2 card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-bold text-ctp-text">Gas Concentration Trend</h3>
                <p className="text-xs text-ctp-subtext0 mt-0.5">Last 15 readings · realtime</p>
              </div>
              <Activity size={16} className="text-ctp-overlay0" />
            </div>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ccd0da" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#9ca0b0" }} tickLine={false} axisLine={{ stroke: "#ccd0da" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca0b0" }} tickLine={false} axisLine={{ stroke: "#ccd0da" }} width={40} />
                  <Tooltip contentStyle={{ background: "#e6e9ef", border: "1px solid #dce0e8", borderRadius: "12px", fontSize: "12px", color: "#4c4f69" }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px", color: "#6c6f85" }} />
                  <Line type="monotone" dataKey="CNG" stroke="#1e66f5" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="CO" stroke="#fe640b" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="LPG" stroke="#179299" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-sm text-ctp-overlay0">Waiting for sensor data…</div>
            )}
          </div>

          {/* Alerts */}
          <div className="card flex flex-col max-h-[380px]">
            <div className="px-5 py-3 border-b border-ctp-crust flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-ctp-yellow" />
                <span className="text-sm font-semibold">Incident Log</span>
              </div>
              <span className="bg-ctp-surface0 text-ctp-subtext0 text-[10px] font-bold px-2 py-0.5 rounded-md">
                {alertsList.filter(a => !a.is_resolved).length} active
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {alertsList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-10">
                  <ShieldCheck size={28} className="text-ctp-surface1 mb-2" />
                  <p className="text-sm text-ctp-overlay0">No incidents recorded.</p>
                </div>
              ) : (
                alertsList.map((a) => (
                  <div key={a.id} className={`p-3 rounded-xl border transition-colors ${a.risk_level === "DANGER" ? "border-ctp-red/30 bg-ctp-red/5"
                    : a.risk_level === "WARNING" ? "border-ctp-yellow/30 bg-ctp-yellow/5"
                      : "border-ctp-crust bg-ctp-base"
                    }`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${a.risk_level === "DANGER" ? "bg-ctp-red text-white" : "bg-ctp-yellow/20 text-ctp-yellow"
                        }`}>{a.risk_level}</span>
                      <span className="text-[10px] font-mono text-ctp-overlay0">{fmtTime(a.triggered_at)}</span>
                    </div>
                    <p className="text-xs text-ctp-subtext1 leading-relaxed line-clamp-2">{a.alert_message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ─── SUB-COMPONENTS ─── */
function MetricCard({ label, value, unit, icon, accent, warn }: {
  label: string; value?: number; unit: string; icon: React.ReactNode; accent: string; warn: boolean;
}) {
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

function StatusPill({ active, activeLabel, inactiveLabel }: { active: boolean; activeLabel: string; inactiveLabel: string }) {
  return (
    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${active ? "bg-ctp-red/15 text-ctp-red" : "bg-ctp-surface0 text-ctp-overlay0"}`}>
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

function ConfidenceBar({ label, value, color, threshold }: { label: string; value: number; color: string; threshold: number }) {
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
