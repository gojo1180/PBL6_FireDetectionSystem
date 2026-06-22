"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { apiFetch, getDevices, getDashboardSensors, getLatestVision, getAlerts, getCalibrationStatus, CalibrationStatus, setCalibrationConfig, getBuzzerMode, setBuzzerMode, testBuzzer } from "@/lib/api";
import { Activity, Bell, Flame, Gauge, Wind, Droplets, ChevronDown, MapPin, Server, BrainCircuit, Settings2, Thermometer, Zap, PlayCircle, Volume2 } from "lucide-react";
import { TutorialTour, TourStep } from "@/components/ui/TutorialTour";

import { SensorLog, VisionLog, FusionAlert, Device } from "@/types";
import { fmtTime } from "@/lib/utils";
import { getToken } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";

import { StatusBanner } from "@/components/dashboard/StatusBanner";
import { MetricCard } from "@/components/ui/MetricCard";
import { LiveCCTVCard } from "@/components/dashboard/LiveCCTVCard";
import dynamic from "next/dynamic";
import OneSignal from "react-onesignal";

import type { RealtimeChannel, RealtimePostgresInsertPayload } from "@supabase/supabase-js";

const GasTrendChart = dynamic(
  () => import("@/components/dashboard/GasTrendChart").then((mod) => mod.GasTrendChart),
  { ssr: false }
);

// Maximum number of data points in the sliding window for the chart
const MAX_HISTORY = 15;

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [isDevicesLoading, setIsDevicesLoading] = useState(true);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [selectedCctvId, setSelectedCctvId] = useState<string>("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [latestSensor, setLatestSensor] = useState<SensorLog | null>(null);
  const [latestVision, setLatestVision] = useState<VisionLog | null>(null);
  const [latestAlert, setLatestAlert] = useState<FusionAlert | null>(null);
  const [sensorHistory, setSensorHistory] = useState<SensorLog[]>([]);
  const [alertsList, setAlertsList] = useState<FusionAlert[]>([]);
  const [calibration, setCalibration] = useState<CalibrationStatus | null>(null);
  const [isUpdatingToleransi, setIsUpdatingToleransi] = useState(false);
  const [buzzerMode, setBuzzerModeState] = useState<string>("FUSION_ONLY");
  const [isUpdatingBuzzer, setIsUpdatingBuzzer] = useState(false);
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
      targetId: "tour-charts-cctv",
      title: "Live Monitor & Informasi",
      description: "Pantau area secara visual melalui stream CCTV. Di bagian kanan, Anda dapat melihat status detail perangkat beserta metrik Suhu dan Kelembapan secara real-time.",
      type: "section",
    },
    {
      targetId: "tour-gas-sensors",
      title: "Monitoring Gas Berbahaya",
      description: "Area ini menampilkan tingkat konsentrasi gas secara live. Angka akan otomatis memperingatkan Anda jika mendekati atau melampaui ambang batas bahaya.",
      type: "section",
    },
    {
      targetId: "tour-gas-trend",
      title: "Grafik Tren Emisi Gas",
      description: "Di sini Anda dapat melihat pergerakan visualisasi data emisi gas secara historis. Sangat berguna untuk menganalisis tren kenaikan atau penurunan sebelum bahaya terjadi.",
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

  const updateBuzzerMode = async (newMode: string) => {
    setIsUpdatingBuzzer(true);
    try {
      await setBuzzerMode(newMode);
      setBuzzerModeState(newMode);
    } catch (err) {
      console.error("Failed to update buzzer", err);
    } finally {
      setIsUpdatingBuzzer(false);
    }
  };

  const toggleCctv = () => {
    if (buzzerMode === "CCTV_ONLY") updateBuzzerMode("MUTE");
    else if (buzzerMode === "SENSOR_ONLY") updateBuzzerMode("ANY");
    else if (buzzerMode === "ANY") updateBuzzerMode("SENSOR_ONLY");
    else updateBuzzerMode("CCTV_ONLY");
  };

  const toggleSensor = () => {
    if (buzzerMode === "SENSOR_ONLY") updateBuzzerMode("MUTE");
    else if (buzzerMode === "CCTV_ONLY") updateBuzzerMode("ANY");
    else if (buzzerMode === "ANY") updateBuzzerMode("CCTV_ONLY");
    else updateBuzzerMode("SENSOR_ONLY");
  };

  const toggleMute = () => {
    if (buzzerMode !== "MUTE") updateBuzzerMode("MUTE");
  };

  const toggleFusion = () => {
    if (buzzerMode === "FUSION_ONLY") updateBuzzerMode("MUTE");
    else updateBuzzerMode("FUSION_ONLY");
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

  // ─── Fetch devices on mount ─────────────────────────────────────────
  useEffect(() => {
    setMounted(true);

    const fetchDevices = async () => {
      try {
        const data = await getDevices();
        setDevices(data || []);
        if (data && data.length > 0) {
          // Auto-select first IoT/Sensor device, or first device overall
          const sensorDevice = data.find(d => d.device_type === "SENSOR") || data[0];
          setSelectedDeviceId(sensorDevice.id);
          console.log("[Dashboard] Devices loaded, selected:", sensorDevice.device_name);

          // Auto-select first CCTV device
          const cctvDevice = data.find(d => d.device_type === "CCTV");
          if (cctvDevice) {
            setSelectedCctvId(cctvDevice.id);
          }
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

      // Fetch buzzer mode
      try {
        const buzzerData = await getBuzzerMode();
        if (buzzerData?.current_mode) setBuzzerModeState(buzzerData.current_mode);
      } catch (err) {
        console.error("[Dashboard] Error fetching buzzer mode:", err);
      }
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
  const selectedCctvDevice = useMemo(() => devices.find(d => d.id === selectedCctvId), [devices, selectedCctvId]);

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
        {/* ── Group 1: CCTV (left) + Environment cards (right) ── */}
        <div id="tour-charts-cctv" className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-5">
          {/* CCTV — spans 1 column on desktop (50% width) */}
          <div className="lg:col-span-1">
            <LiveCCTVCard
              latestVision={latestVision}
              isDanger={isSystemInDanger}
              deviceId={selectedCctvId}
            />
          </div>
          {/* Right column: Informasi CCTV + Environment Cards */}
          <div className="lg:col-span-1 flex flex-col gap-3 md:gap-5 h-full">
            {/* Informasi CCTV Card */}
            <div className="bg-surface-card backdrop-blur-md border border-hairline rounded-2xl shadow-sm p-4 md:p-5 flex-1 flex flex-col justify-center">
              <div className="mb-3 border-b border-hairline pb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-ink">Informasi CCTV</span>
                  {selectedCctvDevice?.status === "active" ? (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 text-emerald-600 text-[10px] font-bold rounded-lg border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Aktif
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 bg-rose-500/10 text-rose-600 text-[10px] font-bold rounded-lg border border-rose-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      Offline
                    </span>
                  )}
                </div>
                <select
                  value={selectedCctvId}
                  onChange={(e) => setSelectedCctvId(e.target.value)}
                  className="w-full bg-surface-card-elevated border border-hairline text-body text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 cursor-pointer appearance-none"
                >
                  {devices.filter(d => d.device_type === "CCTV").map(cctv => (
                    <option key={cctv.id} value={cctv.id}>{cctv.device_name} - {cctv.location}</option>
                  ))}
                  {devices.filter(d => d.device_type === "CCTV").length === 0 && (
                    <option value="">Tidak ada CCTV</option>
                  )}
                </select>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted">Nama Perangkat:</span>
                  <span className="font-semibold text-ink">{selectedCctvDevice?.device_name || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Lokasi:</span>
                  <span className="font-semibold text-ink">{selectedCctvDevice?.location || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">IP Address / RTSP:</span>
                  <span className="font-mono text-[10px] text-ink truncate max-w-[120px]" title={selectedCctvDevice?.rtsp_url || "-"}>
                    {selectedCctvDevice?.rtsp_url ? "Terhubung" : "Tidak ada"}
                  </span>
                </div>
              </div>
            </div>

            {/* Environment Cards (Side-by-side) */}
            <div className="grid grid-cols-2 gap-3 md:gap-5 flex-1">
              <MetricCard
                label="Temperature"
                value={latestSensor?.temperature}
                unit="°C"
                icon={<Thermometer size={20} className="text-sky-500" />}
                accent="ctp-sky"
                warn={false}
                variant="environment"
                className="h-full"
              />
              <MetricCard
                label="Humidity"
                value={latestSensor?.humidity}
                unit="%"
                icon={<Droplets size={20} className="text-blue-500" />}
                accent="ctp-blue"
                warn={false}
                variant="environment"
                className="h-full"
              />
            </div>
          </div>
        </div>

        {/* ── Group 2: Gas & Fire Sensors — CO, CNG, LPG, Smoke, Flame (5 columns) ── */}
        <div id="tour-gas-sensors">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
            Gas & Fire Sensors
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-5">
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
              label="CNG (Metana)"
              value={latestSensor?.cng_level}
              unit="ppm"
              icon={<Gauge size={20} className="text-primary" />}
              accent="ctp-yellow"
              warn={checkFeatureWarn("cng")}
              progress={getFeatureProgress("cng")}
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
              label="Flame"
              value={latestSensor?.flame_detected}
              unit=""
              icon={<Flame size={20} className="text-rose-500" />}
              accent="ctp-red"
              warn={checkFeatureWarn("flame")}
              progress={getFeatureProgress("flame")}
              variant="gas"
            />
          </div>
        </div>
      </div>
    </div>
  ), [latestSensor, latestVision, isSystemInDanger, isBuffering, isTourActive, checkFeatureWarn, getFeatureProgress, selectedCctvId, selectedCctvDevice, devices]);

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
              <div className="fixed top-[72px] left-4 right-4 sm:absolute sm:top-full sm:left-0 sm:right-auto sm:mt-1.5 sm:w-72 bg-white dark:bg-gray-900 border border-hairline rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in sm:slide-in-from-top-1 duration-150">
                <div className="px-3 py-2 border-b border-hairline">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Select Device</p>
                </div>
                <div className="max-h-64 overflow-y-auto py-1">
                  {devices.filter(d => d.device_type === "SENSOR").map((device) => (
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
          {/* Start Tutorial Button */}
          <button
            onClick={() => setIsTourActive(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary to-indigo-500 hover:from-primary/90 hover:to-indigo-500/90 text-white text-sm font-bold transition-all duration-300 shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 group"
            title="Mulai Tutorial"
          >
            <PlayCircle size={16} className="group-hover:scale-110 transition-transform" />
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
              <div className="fixed top-[72px] left-4 right-4 sm:absolute sm:top-full sm:left-auto sm:right-0 sm:mt-2 sm:w-80 bg-white dark:bg-gray-900 border border-hairline rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in sm:slide-in-from-top-2 duration-200">
                <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-hairline flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50">
                  <div className="p-2 rounded-xl bg-primary/10">
                    <Settings2 size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-ink">System Settings</p>
                    <p className="text-xs text-muted">Configure AI & Hardware options</p>
                  </div>
                </div>

                <div className="p-4 sm:p-5 space-y-5 sm:space-y-6">
                  {/* AI Sensitivity */}
                  <div className="space-y-2.5 sm:space-y-3">
                    <div className="flex items-center gap-2">
                      <BrainCircuit size={16} className="text-indigo-500" />
                      <h4 className="text-sm font-bold text-ink">AI Sensitivity</h4>
                    </div>
                    {calibration ? (
                      <select
                        value={calibration.toleransi_threshold}
                        onChange={handleToleransiChange}
                        disabled={isUpdatingToleransi}
                        className="w-full bg-surface-card-elevated border border-hairline text-body text-sm font-semibold rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20 cursor-pointer disabled:opacity-50 transition-all appearance-none"
                      >
                        <option value={1.1}>High (Strict)</option>
                        <option value={1.3}>Balanced (Recommended)</option>
                        <option value={1.5}>Low (Relaxed)</option>
                        <option value={1.7}>Very Low</option>
                        <option value={2.0}>Minimum Alerts</option>
                      </select>
                    ) : (
                      <div className="text-center py-2">
                        <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-1"></div>
                        <p className="text-[10px] text-muted">Loading...</p>
                      </div>
                    )}
                  </div>

                  {/* Buzzer Mode */}
                  <div className="space-y-2.5 sm:space-y-3">
                    <div className="flex items-center gap-2">
                      <Volume2 size={16} className="text-rose-500" />
                      <h4 className="text-sm font-bold text-ink">Physical Alarm</h4>
                    </div>
                    <p className="text-[11px] text-muted leading-tight mb-2">Select the detection source that triggers the Sensor physical alarm.</p>

                    <div className={`space-y-2 ${isUpdatingBuzzer ? 'opacity-50 pointer-events-none' : ''}`}>
                      <label className="flex items-center gap-3 p-2.5 rounded-xl border border-hairline bg-surface-card-elevated hover:bg-primary/5 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={buzzerMode === "CCTV_ONLY" || buzzerMode === "ANY"}
                          onChange={toggleCctv}
                          className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                        />
                        <span className="text-sm font-medium text-ink">CCTV Camera Detection</span>
                      </label>

                      <label className="flex items-center gap-3 p-2.5 rounded-xl border border-hairline bg-surface-card-elevated hover:bg-primary/5 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={buzzerMode === "SENSOR_ONLY" || buzzerMode === "ANY"}
                          onChange={toggleSensor}
                          className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                        />
                        <span className="text-sm font-medium text-ink">Gas & Smoke Sensor Detection</span>
                      </label>

                      {/* Standalone Fusion Checkbox */}
                      <label className="flex items-center gap-3 p-2.5 rounded-xl border border-indigo-200 bg-indigo-50/50 dark:bg-indigo-900/10 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={buzzerMode === "FUSION_ONLY"}
                          onChange={toggleFusion}
                          className="w-4 h-4 rounded border-indigo-300 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-indigo-700 dark:text-indigo-400">Both Detections Required (Fusion)</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-2.5 rounded-xl border border-hairline bg-surface-card-elevated hover:bg-rose-50 dark:hover:bg-rose-900/10 cursor-pointer transition-colors mt-2">
                        <input
                          type="checkbox"
                          checked={buzzerMode === "MUTE"}
                          onChange={toggleMute}
                          className="w-4 h-4 rounded border-gray-300 text-rose-500 focus:ring-rose-500 cursor-pointer accent-rose-500"
                        />
                        <span className={`text-sm font-medium ${buzzerMode === "MUTE" ? "text-rose-600 dark:text-rose-400" : "text-ink"}`}>Mute Alarm</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              try {
                OneSignal.Slidedown.promptPush();
              } catch (err) {
                console.error("OneSignal prompt error:", err);
              }
            }}
            title="Aktifkan Notifikasi Push"
            className="relative p-1.5 rounded-full hover:bg-surface-card-elevated hover:text-primary transition-all group cursor-pointer"
          >
            <Bell size={20} className="text-muted group-hover:text-primary transition-colors" />
            {alertsList.filter(a => !a.is_resolved).length > 0 && (
              <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-semantic-error rounded-full border-2 border-canvas animate-pulse" />
            )}
          </button>
          <span className="text-xs text-muted font-mono tabular-nums hidden lg:inline">
            {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </span>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6 overflow-x-hidden">
        <StatusBanner latestAlert={latestAlert} devices={devices} onClearAlert={fetchDashboardData} />

        {/* ── Sensor Metric Cards (Environment + Gas Groups) ── */}
        {memoizedSensorCards}

        {/* ── Gas Trend Chart (full width) ── */}
        <div id="tour-gas-trend">
          <GasTrendChart chartData={chartData} />
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