"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Activity, Bell, Flame, Gauge, Wind, Droplets } from "lucide-react";

import { SensorLog, VisionLog, FusionAlert } from "@/types";
import { fmtTime } from "@/lib/utils";

import { StatusBanner } from "@/components/dashboard/StatusBanner";
import { MetricCard } from "@/components/ui/MetricCard";
import { VisionCard } from "@/components/dashboard/VisionCard";
import { GasTrendChart } from "@/components/dashboard/GasTrendChart";
import { IncidentLog } from "@/components/dashboard/IncidentLog";

export default function DashboardPage() {
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
      <header className="h-14 border-b border-ctp-crust bg-ctp-mantle flex items-center justify-between pl-16 lg:pl-6 pr-6 shrink-0 sticky top-0 z-20">
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
        <StatusBanner latestAlert={latestAlert} />

        {/* SENSOR CARDS + VISION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-4">
            <MetricCard label="CNG" value={latestSensor?.cng_level} unit="ppm" icon={<Gauge size={20} className="text-ctp-blue" />} accent="ctp-blue" warn={latestSensor ? latestSensor.cng_level > 8 : false} />
            <MetricCard label="CO" value={latestSensor?.co_level} unit="ppm" icon={<Wind size={20} className="text-ctp-peach" />} accent="ctp-peach" warn={latestSensor ? latestSensor.co_level > 15 : false} />
            <MetricCard label="LPG" value={latestSensor?.lpg_level} unit="ppm" icon={<Droplets size={20} className="text-ctp-teal" />} accent="ctp-teal" warn={latestSensor ? latestSensor.lpg_level > 10 : false} />
            
            {/* Flame & Smoke numeric sensors */}
            <MetricCard label="SMOKE" value={latestSensor?.smoke_detected} unit="ppm" icon={<Wind size={20} className="text-ctp-lavender" />} accent="ctp-lavender" warn={latestSensor ? latestSensor.smoke_detected > 35 : false} />
            <MetricCard label="FLAME" value={latestSensor?.flame_detected} unit="lvl" icon={<Flame size={20} className="text-ctp-red" />} accent="ctp-red" warn={latestSensor ? latestSensor.flame_detected > 0.5 : false} />
          </div>

          <VisionCard latestVision={latestVision} />
        </div>

        {/* CHART + ALERTS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <GasTrendChart chartData={chartData} />
          <IncidentLog alertsList={alertsList} />
        </div>
      </main>
    </div>
  );
}
