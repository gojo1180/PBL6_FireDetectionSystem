"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { Activity, Bell, Flame, Gauge, Wind, Droplets } from "lucide-react";

import { SensorLog, VisionLog, FusionAlert } from "@/types";
import { fmtTime } from "@/lib/utils";

import { StatusBanner } from "@/components/dashboard/StatusBanner";
import { MetricCard } from "@/components/ui/MetricCard";
import { VisionCard } from "@/components/dashboard/VisionCard";
import { IncidentLog } from "@/components/dashboard/IncidentLog";
import dynamic from "next/dynamic";

const GasTrendChart = dynamic(
  () => import("@/components/dashboard/GasTrendChart").then((mod) => mod.GasTrendChart),
  { ssr: false }
);

// Polling interval in ms (3 seconds provides near-realtime feel)
const POLL_INTERVAL = 3000;

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [latestSensor, setLatestSensor] = useState<SensorLog | null>(null);
  const [latestVision, setLatestVision] = useState<VisionLog | null>(null);
  const [latestAlert, setLatestAlert] = useState<FusionAlert | null>(null);
  const [sensorHistory, setSensorHistory] = useState<SensorLog[]>([]);
  const [alertsList, setAlertsList] = useState<FusionAlert[]>([]);

  // Keep a ref to track last known sensor timestamp to detect new entries
  const lastSensorTs = useRef<string | null>(null);

  // ─── Fetch all dashboard data from Backend API ─────────────────────
  const fetchDashboardData = useCallback(async () => {
    try {
      // Fetch last 15 sensor readings for history chart
      const sensors = await apiFetch<SensorLog[]>("/api/v1/sensors?limit=15");
      if (sensors && sensors.length > 0) {
        // API returns desc order, reverse for chronological chart
        const chronological = [...sensors].reverse();
        setLatestSensor(sensors[0]);
        setSensorHistory(chronological);
        lastSensorTs.current = sensors[0].recorded_at;
      }

      // Fetch latest vision log
      const vision = await apiFetch<VisionLog | null>("/api/v1/vision/latest");
      if (vision) setLatestVision(vision);

      // Fetch recent alerts (last 10)
      const alerts = await apiFetch<FusionAlert[]>("/api/v1/alerts?limit=10");
      if (alerts && alerts.length > 0) {
        setLatestAlert(alerts[0]);
        setAlertsList(alerts);
      }
    } catch (err) {
      console.log("[Dashboard] Error fetching data:", err);
    }
  }, []);

  // ─── Lightweight poll for realtime-like updates ────────────────────
  const pollForUpdates = useCallback(async () => {
    try {
      // Poll latest sensor
      const sensor = await apiFetch<SensorLog | null>("/api/v1/sensors/latest");
      if (sensor && sensor.recorded_at !== lastSensorTs.current) {
        setLatestSensor(sensor);
        setSensorHistory((prev) => [...prev, sensor].slice(-15));
        lastSensorTs.current = sensor.recorded_at;
      }

      // Poll latest vision
      const vision = await apiFetch<VisionLog | null>("/api/v1/vision/latest");
      if (vision) setLatestVision(vision);

      // Poll alerts
      const alerts = await apiFetch<FusionAlert[]>("/api/v1/alerts?limit=10");
      if (alerts && alerts.length > 0) {
        setLatestAlert(alerts[0]);
        setAlertsList(alerts);
      }
    } catch (err) {
      console.log("[Dashboard] Polling error:", err);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchDashboardData();

    // Start polling interval for near-realtime updates
    const intervalId = setInterval(pollForUpdates, POLL_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, [fetchDashboardData, pollForUpdates]);

  const chartData = useMemo(() => sensorHistory.map((s) => ({
    time: mounted ? fmtTime(s.recorded_at) : "",
    CNG: Number(s.cng_level.toFixed(2)),
    CO: Number(s.co_level.toFixed(2)),
    LPG: Number(s.lpg_level.toFixed(2)),
  })), [sensorHistory, mounted]);

  const memoizedSensorCards = useMemo(() => (
    <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-6 gap-4">
      <MetricCard className="col-span-1 md:col-span-2" label="CNG" value={latestSensor?.cng_level} unit="ppm" icon={<Gauge size={20} className="text-ctp-blue" />} accent="ctp-blue" warn={latestSensor ? latestSensor.cng_level > 8 : false} />
      <MetricCard className="col-span-1 md:col-span-2" label="CO" value={latestSensor?.co_level} unit="ppm" icon={<Wind size={20} className="text-ctp-peach" />} accent="ctp-peach" warn={latestSensor ? latestSensor.co_level > 15 : false} />
      <MetricCard className="col-span-1 md:col-span-2" label="LPG" value={latestSensor?.lpg_level} unit="ppm" icon={<Droplets size={20} className="text-ctp-teal" />} accent="ctp-teal" warn={latestSensor ? latestSensor.lpg_level > 10 : false} />
      <MetricCard className="col-span-1 md:col-span-3" label="SMOKE" value={latestSensor?.smoke_detected} unit="ppm" icon={<Wind size={20} className="text-ctp-lavender" />} accent="ctp-lavender" warn={latestSensor ? latestSensor.smoke_detected > 35 : false} />
      <MetricCard className="col-span-2 md:col-span-3" label="FLAME" value={latestSensor?.flame_detected} unit="lvl" icon={<Flame size={20} className="text-ctp-red" />} accent="ctp-red" warn={latestSensor ? latestSensor.flame_detected > 0.5 : false} />
    </div>
  ), [latestSensor]);

  if (!mounted) return <div className="flex-1 min-h-screen bg-ctp-base" />;

  return (
    <div className="flex flex-col min-h-screen">
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

      <main className="flex-1 p-6 lg:p-8 space-y-6">
        <StatusBanner latestAlert={latestAlert} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {memoizedSensorCards}
          <VisionCard latestVision={latestVision} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <GasTrendChart chartData={chartData} />
          <IncidentLog alertsList={alertsList} />
        </div>
      </main>
    </div>
  );
}
