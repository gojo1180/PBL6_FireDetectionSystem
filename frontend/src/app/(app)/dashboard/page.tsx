"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { apiFetch, getDevices, getDashboardSensors, getLatestVision, getAlerts, getCalibrationStatus, CalibrationStatus, setCalibrationConfig } from "@/lib/api";
import { Activity, Bell, Flame, Gauge, Wind, Droplets, ChevronDown, MapPin, Server, BrainCircuit, Settings2, Thermometer, Zap, Sparkles } from "lucide-react";
import { TutorialTour, TourStep } from "@/components/ui/TutorialTour";

import { SensorLog, VisionLog, FusionAlert, Device } from "@/types";
import { fmtTime } from "@/lib/utils";
import { getToken } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";

import { StatusBanner } from "@/components/dashboard/StatusBanner";
import { MetricCard } from "@/components/ui/MetricCard";
import { LiveCCTVCard } from "@/components/dashboard/LiveCCTVCard";
import { IncidentLog } from "@/components/dashboard/IncidentLog";
import { ThemeToggle } from "@/components/ThemeToggle";
import dynamic from "next/dynamic";

import type { RealtimeChannel, RealtimePostgresInsertPayload } from "@supabase/supabase-js";

const GasTrendChart = dynamic(
 () => import("@/components/dashboard/GasTrendChart").then((mod) => mod.GasTrendChart),
 { ssr: false }
);

// Maximum number of data points in the sliding window for the chart
const MAX_HISTORY = 15;

// ─── VAPID Public Key (loaded from environment variable) ────────────────────
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

/**
 * Convert a Base64-URL-encoded string (used by VAPID keys) to a Uint8Array
 * that the PushManager.subscribe() API expects for applicationServerKey.
 */
function urlBase64ToUint8Array(base64String: string): BufferSource {
 const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
 const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
 const rawData = window.atob(base64);
 const outputArray = new Uint8Array(rawData.length);
 for (let i = 0; i < rawData.length; ++i) {
 outputArray[i] = rawData.charCodeAt(i);
 }
 return outputArray.buffer as ArrayBuffer;
}

 export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [isDevicesLoading, setIsDevicesLoading] = useState(true);
 const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
 const [isDropdownOpen, setIsDropdownOpen] = useState(false);
 const [isSettingsOpen, setIsSettingsOpen] = useState(false);
 const [latestSensor, setLatestSensor] = useState<SensorLog | null>(null);
 const [latestVision, setLatestVision] = useState<VisionLog | null>(null);
 const [latestAlert, setLatestAlert] = useState<FusionAlert | null>(null);
 const [sensorHistory, setSensorHistory] = useState<SensorLog[]>([]);
 const [alertsList, setAlertsList] = useState<FusionAlert[]>([]);
 const [calibration, setCalibration] = useState<CalibrationStatus | null>(null);
 const [isUpdatingToleransi, setIsUpdatingToleransi] = useState(false);
 const [isTourActive, setIsTourActive] = useState(false);

 // Track buffering state efficiently without global intervals
 const [isBuffering, setIsBuffering] = useState(true);

 const handleTourComplete = () => {
 setIsTourActive(false);
 localStorage.setItem("bomba_tutorial_active", "true");
 localStorage.setItem("bomba_tutorial_page", "cctv");
 window.location.href = "/cctv";
 };

 const handleTourClose = () => {
 setIsTourActive(false);
 localStorage.removeItem("bomba_tutorial_active");
 localStorage.removeItem("bomba_tutorial_page");
 };

 const tourSteps: TourStep[] = [
 {
 targetId: "device-selector-dashboard",
 title: "Pilih Node Perangkat",
 description: "Pilih node sensor ESP32 IoT aktif yang ingin dipantau. Setiap node mewakili area ruangan yang berbeda.",
 type: "button",
 },
 {
 targetId: "tour-sensor-metrics",
 title: "Metrik Sensor Real-time",
 description: "Panel ini menampilkan data lingkungan (suhu, kelembapan) serta kadar gas (Smoke, CO, LPG, Flame, CNG) lengkap dengan status toleransi AI.",
 type: "section",
 },
 {
 targetId: "settings-popover-btn",
 title: "Sensitivitas AI (LSTM Autoencoder)",
 description: "Sesuaikan sensitivitas pendeteksian anomali secara dinamis. Anda dapat mengatur tingkat High, Balanced, atau Low sesuai kebutuhan lingkungan.",
 type: "button",
 },
 {
 targetId: "tour-charts-cctv",
 title: "Grafik Tren dan Video CCTV",
 description: "Di sini Anda bisa memantau grafik kenaikan gas secara berkala, bersanding dengan siaran langsung CCTV yang mendeteksi api/asap menggunakan YOLOv8.",
 type: "section",
 },
 {
 targetId: "tour-incident-log",
 title: "Log Insiden Kebakaran",
 description: "Semua riwayat peringatan bahaya yang terpicu secara otomatis oleh gabungan sensor & visi akan tersimpan di tabel log ini.",
 type: "section",
 },
 {
 targetId: "sidebar-link-cctv",
 title: "Halaman CCTV Live",
 description: "Mari kita pindah ke halaman CCTV Live untuk memantau visualisasi feed kamera AI secara penuh.",
 type: "button",
 }
 ];

 useEffect(() => {
 if (!latestSensor) {
 setIsBuffering(true);
 return;
 }

 // We just received a new sensor reading! Remove buffering state.
 setIsBuffering(false);

 // If we don't get another reading in 10 seconds, show buffering again.
 // This avoids clock-sync issues between frontend and backend.
 const timeout = setTimeout(() => setIsBuffering(true), 10000);
 return () => clearTimeout(timeout);
 }, [latestSensor]);

 const handleToleransiChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
 const val = parseFloat(e.target.value);
 setIsUpdatingToleransi(true);
 try {
 await setCalibrationConfig(val);
 // fetch immediately to reflect UI change
 const calib = await getCalibrationStatus();
 if (calib) setCalibration(calib);
 } catch (err) {
 console.error("Failed to update toleransi", err);
 } finally {
 setIsUpdatingToleransi(false);
 }
 };

 const dropdownRef = useRef<HTMLDivElement>(null);
 const settingsRef = useRef<HTMLDivElement>(null);

 // Keep refs to channels for cleanup
 const sensorChannelRef = useRef<RealtimeChannel | null>(null);
 const alertChannelRef = useRef<RealtimeChannel | null>(null);

 // Close dropdown when clicking outside
 useEffect(() => {
 function handleClickOutside(event: MouseEvent) {
 if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
 setIsDropdownOpen(false);
 }
 if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
 setIsSettingsOpen(false);
 }
 }
 document.addEventListener("mousedown", handleClickOutside);
 return () => document.removeEventListener("mousedown", handleClickOutside);
 }, []);

 // ─── Register Service Worker & Subscribe to Web Push ────────────────
 useEffect(() => {
 async function registerServiceWorkerAndSubscribe() {
 if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
 console.log("[Push] Service Worker or Push API not supported in this browser.");
 return;
 }

 try {
 // 1. Register the Service Worker
 await navigator.serviceWorker.register("/sw.js");
 const registration = await navigator.serviceWorker.ready;
 console.log("[Push] Service Worker registered and ready:", registration);

 // 2. Request notification permission
 const permission = await Notification.requestPermission();
 console.log("[Push] Notification permission:", permission);

 if (permission === "granted") {
 // 3. Subscribe to PushManager
 const subscription = await registration.pushManager.subscribe({
 userVisibleOnly: true,
 applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
 });
 console.log("[Push] PushSubscription object:", JSON.stringify(subscription));

 // 4. Send subscription to backend to save it
 try {
 const result = await apiFetch<{ message: string; success: boolean }>(
 "/api/v1/test-push",
 {
 method: "POST",
 body: subscription.toJSON(),
 }
 );
 console.log("[Push] Subscription saved to backend:", result.message);
 } catch (pushErr) {
 console.error("[Push] Failed to send subscription to backend:", pushErr);
 }
 } else {
 console.log("[Push] Notification permission was denied or dismissed.");
 }
 } catch (err) {
 console.error("[Push] Failed to register SW or subscribe:", err);
 }
 }

 registerServiceWorkerAndSubscribe();
 }, []);

 // ─── Fetch devices on mount ─────────────────────────────────────────
 useEffect(() => {
 setMounted(true);

 const fetchDevices = async () => {
 try {
 const data = await getDevices();
 setDevices(data || []);
 if (data && data.length > 0) {
 // Auto-select first IoT/Sensor device, or first device overall
 const sensorDevice = data.find(d => d.device_type === "IOT") || data[0];
 setSelectedDeviceId(sensorDevice.id);
 console.log("[Dashboard] Devices loaded, selected:", sensorDevice.device_name);
 }
 } catch (err) {
 console.log("[Dashboard] Error fetching devices:", err);
 } finally {
 setIsDevicesLoading(false);
 }
 };
 fetchDevices();
 }, []);

 // ─── Fetch all dashboard data from Backend API (ONE-TIME) ──────────
 const fetchDashboardData = useCallback(async () => {
 if (!selectedDeviceId) return;
 try {
 // Fetch last 15 sensor readings for the SELECTED device
 const sensors = await getDashboardSensors(selectedDeviceId, MAX_HISTORY);
 if (sensors && sensors.length > 0) {
 // API returns desc order, reverse for chronological chart
 const chronological = [...sensors].reverse();
 setLatestSensor(sensors[0]);
 setSensorHistory(chronological);
 } else {
 setLatestSensor(null);
 setSensorHistory([]);
 }

 // Fetch latest vision log
 const vision = await getLatestVision();
 if (vision) setLatestVision(vision);

 // Fetch recent alerts GLOBALLY (last 10) — DO NOT filter by device
 const alerts = await getAlerts(10);
 if (alerts && alerts.length > 0) {
 setLatestAlert(alerts[0]);
 setAlertsList(alerts);
 }

 // Fetch calibration
 const calib = await getCalibrationStatus();
 if (calib) setCalibration(calib);
 } catch (err) {
 console.log("[Dashboard] Error fetching initial data:", err);
 }
 }, [selectedDeviceId]);

 // ─── Initial fetch + Supabase Realtime Subscriptions ───────────────
 useEffect(() => {
 if (!selectedDeviceId) return;

 // 1) One-time initial data load via REST API
 fetchDashboardData();

 // 2) Subscribe to Supabase Realtime: sensor_logs (INSERT)
 // Only react to inserts for the currently selected device
 const sensorChannel = supabase
 .channel(`realtime-sensor-${selectedDeviceId}`)
 .on(
 "postgres_changes",
 {
 event: "INSERT",
 schema: "public",
 table: "sensor_logs",
 filter: `device_id=eq.${selectedDeviceId}`,
 },
 (payload: RealtimePostgresInsertPayload<Record<string, unknown>>) => {
 const newRow = payload.new as unknown as SensorLog;
 console.log("[Realtime] New sensor_log:", newRow.recorded_at);

 // Update latest sensor reading
 setLatestSensor(newRow);

 // Sliding window: append new data, keep max MAX_HISTORY points
 setSensorHistory((prev) => [...prev, newRow].slice(-MAX_HISTORY));
 }
 )
 .subscribe((status) => {
 console.log("[Realtime] sensor_logs channel status:", status);
 });

 sensorChannelRef.current = sensorChannel;

 // 3) Subscribe to Supabase Realtime: fusion_alerts (INSERT + UPDATE)
 // Listen globally — alerts can come from any device
 const alertChannel = supabase
 .channel("realtime-alerts")
 .on(
 "postgres_changes",
 {
 event: "INSERT",
 schema: "public",
 table: "fusion_alerts",
 },
 (payload: RealtimePostgresInsertPayload<Record<string, unknown>>) => {
 const newAlert = payload.new as unknown as FusionAlert;
 console.log("[Realtime] New alert:", newAlert.risk_level, newAlert.alert_message);

 // New alert becomes the latest
 setLatestAlert(newAlert);

 // Prepend to the alerts list, keep max 10
 setAlertsList((prev) => [newAlert, ...prev].slice(0, 10));
 }
 )
 .on(
 "postgres_changes",
 {
 event: "UPDATE",
 schema: "public",
 table: "fusion_alerts",
 },
 (payload) => {
 const updated = payload.new as unknown as FusionAlert;
 console.log("[Realtime] Alert updated:", updated.id, "resolved:", updated.is_resolved);

 // Update in-place within the alerts list
 setAlertsList((prev) =>
 prev.map((a) => (a.id === updated.id ? updated : a))
 );

 // If the latest alert was resolved, recalculate latestAlert
 setLatestAlert((prev) => {
 if (prev && prev.id === updated.id) return updated;
 return prev;
 });
 }
 )
 .subscribe((status) => {
 console.log("[Realtime] fusion_alerts channel status:", status);
 });

 alertChannelRef.current = alertChannel;

 // 4) Cleanup: unsubscribe channels on unmount or device change
 return () => {
 console.log("[Realtime] Cleaning up channels for device:", selectedDeviceId);
 if (sensorChannelRef.current) {
 supabase.removeChannel(sensorChannelRef.current);
 sensorChannelRef.current = null;
 }
 if (alertChannelRef.current) {
 supabase.removeChannel(alertChannelRef.current);
 alertChannelRef.current = null;
 }
 };
 }, [selectedDeviceId, fetchDashboardData]);

 const chartData = useMemo(() => sensorHistory.map((s) => ({
 time: mounted ? fmtTime(s.recorded_at) : "",
 CO: Number(s.co_level.toFixed(2)),
 LPG: Number(s.lpg_level.toFixed(2)),
 Smoke: Number(s.smoke_detected.toFixed(2)),
 CNG: Number(s.cng_level.toFixed(2)),
 })), [sensorHistory, mounted]);



 const selectedDevice = useMemo(() => devices.find(d => d.id === selectedDeviceId), [devices, selectedDeviceId]);

 const isSystemInDanger = latestAlert ? !latestAlert.is_resolved : false;

 const checkFeatureWarn = useCallback((feature: string) => {
 // If there's an active unresolved alert, ALL cards turn red
 if (isSystemInDanger) return true;
 if (!calibration?.error_per_fitur || !calibration?.threshold_per_fitur) return false;
 const err = calibration.error_per_fitur[feature];
 const thr = calibration.threshold_per_fitur[feature];
 if (err !== undefined && thr !== undefined) {
 return err > thr;
 }
 return false;
 }, [calibration, isSystemInDanger]);

 const getFeatureProgress = useCallback((feature: string) => {
 if (!calibration?.error_per_fitur || !calibration?.threshold_per_fitur) return 0;
 const err = calibration.error_per_fitur[feature] || 0;
 const thr = calibration.threshold_per_fitur[feature] || 1; // avoid div by zero
 return Math.min((err / thr) * 100, 100);
 }, [calibration]);

 // (isBuffering is now managed via state)

 const memoizedSensorCards = useMemo(() => (
 <div id="tour-sensor-metrics" className="relative">
 {isBuffering && !isTourActive && (
 <div className="absolute inset-0 z-10 bg-surface-card-elevated backdrop-blur-sm rounded-xl flex items-center justify-center border border-amber-200/30 shadow-sm animate-in fade-in duration-300">
 <div className="flex flex-col items-center gap-3 bg-surface-card backdrop-blur-md px-6 py-5 rounded-2xl border border-hairline shadow-lg">
 <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
 <div className="text-center">
 <p className="text-sm font-bold text-primary tracking-widest uppercase mb-1">Connection Interrupted</p>
 <p className="text-[11px] text-muted max-w-[200px]">Waiting for new sensor data to rebuild temporal sequence buffer...</p>
 </div>
 </div>
 </div>
 )}

 <div className={`space-y-6 ${(isBuffering && !isTourActive) ? 'opacity-40 grayscale-[0.5] pointer-events-none' : 'transition-all duration-500'}`}>
 {/* ── Group 1: Environment — Temperature & Humidity (2 columns) ── */}
 <div>
 <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-3 flex items-center gap-2">
 <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
 Environment
 </h3>
 <div className="grid grid-cols-2 gap-3 md:gap-5">
 <MetricCard
 label="Temperature"
 value={latestSensor?.temperature}
 unit="°C"
 icon={<Thermometer size={20} className="text-sky-500" />}
 accent="ctp-sky"
 warn={false}
 variant="environment"
 />
 <MetricCard
 label="Humidity"
 value={latestSensor?.humidity}
 unit="%"
 icon={<Droplets size={20} className="text-blue-500" />}
 accent="ctp-blue"
 warn={false}
 variant="environment"
 />
 </div>
 </div>

 {/* ── Group 2: Gas & Fire Sensors — Smoke, CO, LPG, Flame, CNG (5 columns on desktop) ── */}
 <div>
 <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-3 flex items-center gap-2">
 <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
 Gas & Fire Sensors
 </h3>
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-5">
 <MetricCard
 label="Smoke"
 value={latestSensor?.smoke_detected}
 unit="ppm"
 icon={<Wind size={20} className="text-violet-500" />}
 accent="ctp-lavender"
 warn={checkFeatureWarn("smoke")}
 progress={getFeatureProgress("smoke")}
 variant="gas"
 />
 <MetricCard
 label="CO"
 value={latestSensor?.co_level}
 unit="ppm"
 icon={<Wind size={20} className="text-amber-500" />}
 accent="ctp-peach"
 warn={checkFeatureWarn("co")}
 progress={getFeatureProgress("co")}
 variant="gas"
 />
 <MetricCard
 label="LPG"
 value={latestSensor?.lpg_level}
 unit="ppm"
 icon={<Droplets size={20} className="text-teal-500" />}
 accent="ctp-teal"
 warn={checkFeatureWarn("lpg")}
 progress={getFeatureProgress("lpg")}
 variant="gas"
 />
 <MetricCard
 label="Flame"
 value={latestSensor?.flame_detected}
 unit=""
 icon={<Flame size={20} className="text-rose-500" />}
 accent="ctp-red"
 warn={checkFeatureWarn("flame")}
 progress={getFeatureProgress("flame")}
 variant="gas"
 />
 <MetricCard
 label="CNG (Metana)"
 value={latestSensor?.cng_level}
 unit="ppm"
 icon={<Gauge size={20} className="text-primary" />}
 accent="ctp-yellow"
 warn={checkFeatureWarn("cng")}
 progress={getFeatureProgress("cng")}
 variant="gas"
 />
 </div>
 </div>
 </div>
 </div>
 ), [latestSensor, isBuffering, isTourActive, checkFeatureWarn, getFeatureProgress]);

  if (!mounted) return <div className="flex-1 min-h-screen bg-canvas" />;

  if (!isDevicesLoading && devices.length === 0) {
    return (
      <div className="flex flex-col min-h-screen bg-canvas transition-colors duration-500">
        <header className="h-16 border-b border-hairline bg-surface-card/80 backdrop-blur-md flex items-center pl-6 pr-6 shrink-0 sticky top-0 z-20 justify-between">
          <div className="flex items-center gap-3 text-sm">
            <div className="p-2 rounded-lg bg-primary/10">
              <Activity size={18} className="text-primary" />
            </div>
            <span className="font-bold text-base text-ink">Control Center</span>
          </div>
          <ThemeToggle />
        </header>
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 bg-surface-card border border-hairline rounded-2xl shadow-xl flex items-center justify-center mb-6">
            <Server size={32} className="text-muted" />
          </div>
          <h2 className="text-2xl font-bold text-ink mb-2">No Devices Connected</h2>
          <p className="text-body max-w-md mx-auto mb-8">
            You haven't added any sensors or CCTV cameras to your account yet. Please add a device to start monitoring.
          </p>
          <a href="/settings" className="px-6 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all flex items-center gap-2">
            <Settings2 size={18} /> Go to Device Settings
          </a>
        </main>
      </div>
    );
  }

  return (
 <div className="flex flex-col min-h-screen bg-canvas transition-colors duration-500">
 <header className="h-16 border-b border-hairline bg-surface-card/80 backdrop-blur-md flex items-center justify-between pl-16 lg:pl-6 px-4 lg:px-6 shrink-0 sticky top-0 z-20 shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-colors duration-500">
 <div className="flex items-center gap-3 text-sm">
 <div className="p-2 rounded-lg bg-primary/10 transition-colors duration-500">
 <Activity size={18} className="text-primary" />
 </div>
 <span className="font-bold text-base text-ink hidden sm:inline transition-colors duration-500">Control Center</span>
 <span className="text-muted-soft text-lg transition-colors duration-500">/</span>

 {/* ─── Device Selector Dropdown ─────────────────────────── */}
 <div className="relative" ref={dropdownRef}>
 <button
 id="device-selector-dashboard"
 onClick={() => setIsDropdownOpen(!isDropdownOpen)}
 className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-card-elevated backdrop-blur-sm border border-hairline hover:border-primary/40 transition-all duration-200 cursor-pointer group"
 >
 <Server size={13} className="text-primary" />
 <span className="text-body font-medium truncate max-w-[180px]">
 {selectedDevice?.device_name || "Select Device"}
 </span>
 {selectedDevice?.location && (
 <span className="text-muted text-xs hidden md:inline truncate max-w-[120px]">
 — {selectedDevice.location}
 </span>
 )}
 <ChevronDown size={14} className={`text-muted transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
 </button>

 {/* Dropdown Menu */}
 {isDropdownOpen && (
 <div className="absolute top-full left-0 md:left-auto mt-1.5 w-[calc(100vw-2rem)] sm:w-72 bg-surface-card border border-hairline rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150">
 <div className="px-3 py-2 border-b border-hairline">
 <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Select Device</p>
 </div>
 <div className="max-h-64 overflow-y-auto py-1">
 {devices.map((device) => (
 <button
 key={device.id}
 onClick={() => {
 setSelectedDeviceId(device.id);
 setIsDropdownOpen(false);
 }}
 className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-all duration-150 hover:bg-surface-card-elevated group/item ${device.id === selectedDeviceId ? "bg-surface-strong border-l-2 border-primary" : "border-l-2 border-transparent"
 }`}
 >
 <div className={`w-2 h-2 rounded-full shrink-0 ${device.status === "active" ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" : "bg-muted-soft"}`} />
 <div className="flex-1 min-w-0">
 <p className={`text-sm font-medium truncate ${device.id === selectedDeviceId ? "text-primary" : "text-body"}`}>
 {device.device_name}
 </p>
 <p className="text-[11px] text-muted flex items-center gap-1 truncate">
 <MapPin size={10} /> {device.location || "No location"}
 </p>
 </div>
 <span className="text-[10px] font-mono text-muted uppercase tracking-wider shrink-0">
 {device.device_type}
 </span>
 </button>
 ))}
 </div>
 </div>
 )}
 </div>
 </div>

 <div className="flex items-center gap-3">
 <ThemeToggle />
 
          {/* Start Tutorial Button */}
          <button
            onClick={() => setIsTourActive(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary to-indigo-500 hover:from-primary/90 hover:to-indigo-500/90 text-white text-sm font-bold transition-all duration-300 shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 group"
            title="Mulai Tutorial"
          >
            <Sparkles size={16} className="text-yellow-300 group-hover:animate-spin" />
            <span className="hidden sm:inline tracking-wide">Mulai Tutorial</span>
          </button>

 {/* ─── Settings Popover (AI Sensitivity) — Prominent ─── */}
 <div className="relative" ref={settingsRef}>
 <button
 id="settings-popover-btn"
 onClick={() => setIsSettingsOpen(!isSettingsOpen)}
 className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border transition-all duration-200 text-sm font-semibold ${isSettingsOpen
 ? "bg-primary/10 border-primary/30 text-primary"
 : "bg-surface-card-elevated backdrop-blur-sm border-hairline hover:border-primary/40 text-body"
 }`}
 title="AI Sensitivity Settings"
 >
 <Settings2 size={16} />
 <span className="hidden md:inline">Settings</span>
 </button>

 {isSettingsOpen && (
 <div className="absolute top-full right-0 origin-top-right mt-2 w-[calc(100vw-2rem)] sm:w-80 bg-surface-card border border-hairline rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
 <div className="px-5 py-4 border-b border-hairline flex items-center gap-3 bg-surface-strong">
 <div className="p-2 rounded-xl bg-primary/10">
 <BrainCircuit size={18} className="text-primary" />
 </div>
 <div>
 <p className="text-sm font-bold text-ink">AI Anomaly Detection</p>
 <p className="text-xs text-muted">Configure sensitivity level</p>
 </div>
 </div>
 <div className="p-5 space-y-4">
 {calibration ? (
 <>
 <div>
 <label htmlFor="sensitivity-select" className="text-xs text-muted uppercase tracking-wider font-bold block mb-2">
 Sensitivity Level
 </label>
 <select
 id="sensitivity-select"
 value={calibration.toleransi_threshold}
 onChange={handleToleransiChange}
 disabled={isUpdatingToleransi}
 className="w-full bg-surface-card-elevated border border-hairline text-body text-sm font-semibold rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20 cursor-pointer disabled:opacity-50 transition-all"
 >
 <option value={1.1}>High (Strict)</option>
 <option value={1.15}>Balanced (Recommended)</option>
 <option value={1.2}>Low (Relaxed)</option>
 <option value={1.3}>Very Low</option>
 <option value={1.4}>Minimum Alerts</option>
 </select>
 </div>
 <div className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-3 py-2 rounded-lg text-xs font-medium">
 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
 <span>System actively analyzing sensor variances</span>
 </div>
 </>
 ) : (
 <div className="text-center py-4">
 <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
 <p className="text-sm text-muted">Loading calibration...</p>
 </div>
 )}
 </div>
 </div>
 )}
 </div>

 <div className="relative p-1.5">
 <Bell size={20} className="text-muted" />
 {alertsList.filter(a => !a.is_resolved).length > 0 && (
 <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-semantic-error rounded-full border-2 border-canvas animate-pulse" />
 )}
 </div>
 <span className="text-xs text-muted font-mono tabular-nums hidden lg:inline">
 {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
 </span>
 </div>
 </header>

 <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6 overflow-x-hidden">
 <StatusBanner latestAlert={latestAlert} devices={devices} onClearAlert={fetchDashboardData} />

 {/* ── Sensor Metric Cards (Environment + Gas Groups) ── */}
 {memoizedSensorCards}

 {/* ── Gas Trend + Vision Feed (side by side) ── */}
 <div id="tour-charts-cctv" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 <GasTrendChart chartData={chartData} />
 <LiveCCTVCard latestVision={latestVision} isDanger={isSystemInDanger} />
 </div>

 {/* ── Incident Log (full width) ── */}
 <div id="tour-incident-log">
 <IncidentLog alertsList={alertsList} onClearAlert={fetchDashboardData} />
 </div>
 </main>

 <TutorialTour
 active={isTourActive}
 steps={tourSteps}
 onClose={handleTourClose}
 onComplete={handleTourComplete}
 />
 </div>
 );
}