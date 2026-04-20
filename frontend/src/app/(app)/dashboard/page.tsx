"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { Activity, Bell, Flame, Gauge, Wind, Droplets, ChevronDown, MapPin, Server } from "lucide-react";

import { SensorLog, VisionLog, FusionAlert, Device } from "@/types";
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
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [latestSensor, setLatestSensor] = useState<SensorLog | null>(null);
  const [latestVision, setLatestVision] = useState<VisionLog | null>(null);
  const [latestAlert, setLatestAlert] = useState<FusionAlert | null>(null);
  const [sensorHistory, setSensorHistory] = useState<SensorLog[]>([]);
  const [alertsList, setAlertsList] = useState<FusionAlert[]>([]);

  // Keep a ref to track last known sensor timestamp to detect new entries
  const lastSensorTs = useRef<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ─── Fetch devices on mount ─────────────────────────────────────────
  useEffect(() => {
    setMounted(true);

    const fetchDevices = async () => {
      try {
        const data = await apiFetch<Device[]>("/api/v1/devices");
        if (data && data.length > 0) {
          setDevices(data);
          // Auto-select first IoT/Sensor device, or first device overall
          const sensorDevice = data.find(d => d.device_type === "IOT") || data[0];
          setSelectedDeviceId(sensorDevice.id);
          console.log("[Dashboard] Devices loaded, selected:", sensorDevice.device_name);
        }
      } catch (err) {
        console.log("[Dashboard] Error fetching devices:", err);
      }
    };
    fetchDevices();
  }, []);

  // ─── Fetch all dashboard data from Backend API ─────────────────────
  const fetchDashboardData = useCallback(async () => {
    if (!selectedDeviceId) return;
    try {
      // Fetch last 15 sensor readings for the SELECTED device
      const sensors = await apiFetch<SensorLog[]>(`/api/v1/sensors?limit=15&device_id=${selectedDeviceId}`);
      if (sensors && sensors.length > 0) {
        // API returns desc order, reverse for chronological chart
        const chronological = [...sensors].reverse();
        setLatestSensor(sensors[0]);
        setSensorHistory(chronological);
        lastSensorTs.current = sensors[0].recorded_at;
      } else {
        setLatestSensor(null);
        setSensorHistory([]);
        lastSensorTs.current = null;
      }

      // Fetch latest vision log
      const vision = await apiFetch<VisionLog | null>("/api/v1/vision/latest");
      if (vision) setLatestVision(vision);

      // Fetch recent alerts GLOBALLY (last 10) — DO NOT filter by device
      const alerts = await apiFetch<FusionAlert[]>("/api/v1/alerts?limit=10");
      if (alerts && alerts.length > 0) {
        setLatestAlert(alerts[0]);
        setAlertsList(alerts);
      }
    } catch (err) {
      console.log("[Dashboard] Error fetching data:", err);
    }
  }, [selectedDeviceId]);

  // ─── Lightweight poll for realtime-like updates ────────────────────
  const pollForUpdates = useCallback(async () => {
    if (!selectedDeviceId) return;
    try {
      // Poll latest sensor for the SELECTED device
      const sensor = await apiFetch<SensorLog | null>(`/api/v1/sensors/latest/${selectedDeviceId}`);
      if (sensor && sensor.recorded_at !== lastSensorTs.current) {
        setLatestSensor(sensor);
        setSensorHistory((prev) => [...prev, sensor].slice(-15));
        lastSensorTs.current = sensor.recorded_at;
      }

      // Poll latest vision
      const vision = await apiFetch<VisionLog | null>("/api/v1/vision/latest");
      if (vision) setLatestVision(vision);

      // Poll alerts GLOBALLY — DO NOT filter by device
      const alerts = await apiFetch<FusionAlert[]>("/api/v1/alerts?limit=10");
      if (alerts && alerts.length > 0) {
        setLatestAlert(alerts[0]);
        setAlertsList(alerts);
      }
    } catch (err) {
      console.log("[Dashboard] Polling error:", err);
    }
  }, [selectedDeviceId]);

  // Trigger full refetch when selectedDeviceId changes
  useEffect(() => {
    if (selectedDeviceId) {
      fetchDashboardData();
    }
  }, [selectedDeviceId, fetchDashboardData]);

  // Start polling interval for near-realtime updates
  useEffect(() => {
    if (!selectedDeviceId) return;
    const intervalId = setInterval(pollForUpdates, POLL_INTERVAL);
    return () => clearInterval(intervalId);
  }, [selectedDeviceId, pollForUpdates]);

  const chartData = useMemo(() => sensorHistory.map((s) => ({
    time: mounted ? fmtTime(s.recorded_at) : "",
    CNG: Number(s.cng_level.toFixed(2)),
    CO: Number(s.co_level.toFixed(2)),
    LPG: Number(s.lpg_level.toFixed(2)),
  })), [sensorHistory, mounted]);

  const selectedDevice = useMemo(() => devices.find(d => d.id === selectedDeviceId), [devices, selectedDeviceId]);

  const isSystemInDanger = latestAlert ? !latestAlert.is_resolved : false;

  const memoizedSensorCards = useMemo(() => (
    <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-6 gap-4">
      <MetricCard className="col-span-1 md:col-span-2" label="CNG" value={latestSensor?.cng_level} unit="ppm" icon={<Gauge size={20} className="text-ctp-blue" />} accent="ctp-blue" warn={isSystemInDanger} />
      <MetricCard className="col-span-1 md:col-span-2" label="CO" value={latestSensor?.co_level} unit="ppm" icon={<Wind size={20} className="text-ctp-peach" />} accent="ctp-peach" warn={isSystemInDanger} />
      <MetricCard className="col-span-1 md:col-span-2" label="LPG" value={latestSensor?.lpg_level} unit="ppm" icon={<Droplets size={20} className="text-ctp-teal" />} accent="ctp-teal" warn={isSystemInDanger} />
      <MetricCard className="col-span-1 md:col-span-3" label="SMOKE" value={latestSensor?.smoke_detected} unit="ppm" icon={<Wind size={20} className="text-ctp-lavender" />} accent="ctp-lavender" warn={isSystemInDanger} />
      <MetricCard className="col-span-2 md:col-span-3" label="FLAME" value={latestSensor?.flame_detected} unit="lvl" icon={<Flame size={20} className="text-ctp-red" />} accent="ctp-red" warn={isSystemInDanger} />
    </div>
  ), [latestSensor, isSystemInDanger]);

  if (!mounted) return <div className="flex-1 min-h-screen bg-ctp-base" />;

  return (
    <div className="flex flex-col min-h-screen">
      <header className="h-14 border-b border-ctp-crust bg-ctp-mantle flex items-center justify-between pl-16 lg:pl-6 pr-6 shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-2 text-sm">
          <Activity size={16} className="text-ctp-blue" />
          <span className="font-semibold text-ctp-text">Control Center</span>
          <span className="text-ctp-overlay0">/</span>

          {/* ─── Device Selector Dropdown ─────────────────────────── */}
          <div className="relative" ref={dropdownRef}>
            <button
              id="device-selector-dashboard"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-ctp-base border border-ctp-crust hover:border-ctp-blue/50 transition-all duration-200 cursor-pointer group"
            >
              <Server size={13} className="text-ctp-blue" />
              <span className="text-ctp-text font-medium truncate max-w-[180px]">
                {selectedDevice?.device_name || "Select Device"}
              </span>
              {selectedDevice?.location && (
                <span className="text-ctp-overlay0 text-xs hidden md:inline truncate max-w-[120px]">
                  — {selectedDevice.location}
                </span>
              )}
              <ChevronDown size={14} className={`text-ctp-overlay0 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-72 bg-ctp-mantle/95 backdrop-blur-xl border border-ctp-crust rounded-xl shadow-2xl shadow-black/20 overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="px-3 py-2 border-b border-ctp-crust">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-ctp-overlay0">Select Device</p>
                </div>
                <div className="max-h-64 overflow-y-auto py-1">
                  {devices.map((device) => (
                    <button
                      key={device.id}
                      onClick={() => {
                        setSelectedDeviceId(device.id);
                        setIsDropdownOpen(false);
                        console.log("[Dashboard] Switched to device:", device.device_name);
                      }}
                      className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-all duration-150 hover:bg-ctp-blue/10 group/item ${device.id === selectedDeviceId ? "bg-ctp-blue/10 border-l-2 border-ctp-blue" : "border-l-2 border-transparent"
                        }`}
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${device.status === "active" ? "bg-ctp-green shadow-[0_0_6px_rgba(64,160,43,0.5)]" : "bg-ctp-surface1"}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${device.id === selectedDeviceId ? "text-ctp-blue" : "text-ctp-text"}`}>
                          {device.device_name}
                        </p>
                        <p className="text-[11px] text-ctp-overlay0 flex items-center gap-1 truncate">
                          <MapPin size={10} /> {device.location || "No location"}
                        </p>
                      </div>
                      <span className="text-[10px] font-mono text-ctp-overlay0 uppercase tracking-wider shrink-0">
                        {device.device_type}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
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
        <StatusBanner latestAlert={latestAlert} devices={devices} />

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
