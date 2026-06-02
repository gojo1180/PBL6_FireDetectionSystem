"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { getDevices, getSensorLogsPaginated } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { Device, SensorLog } from "@/types";
import { TutorialTour, TourStep } from "@/components/ui/TutorialTour";
import {
  Download,
  Database,
  Loader2,
  AlertCircle,
  Server,
  ChevronDown,
  TrendingUp,
} from "lucide-react";

// ─── Lazy-load Recharts (SSR-off) ───────────────────────────────────
const RechartsChart = dynamic(() => import("./TelemetryChart"), {
  ssr: false,
  loading: () => (
    <div className="h-[480px] flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-muted" />
    </div>
  ),
});

// ─── Time range helpers ──────────────────────────────────────────────
type RangePreset = "1D" | "1W" | "1M";

function getDateRange(preset: RangePreset): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  const from = new Date(now);
  switch (preset) {
    case "1D":
      from.setDate(from.getDate() - 1);
      break;
    case "1W":
      from.setDate(from.getDate() - 7);
      break;
    case "1M":
      from.setMonth(from.getMonth() - 1);
      break;
  }
  return { from: from.toISOString(), to };
}

function toInputDate(iso: string): string {
  return iso.slice(0, 10);
}

function fromInputDate(dateStr: string, endOfDay = false): string {
  if (!dateStr) return "";
  return endOfDay ? `${dateStr}T23:59:59.999Z` : `${dateStr}T00:00:00.000Z`;
}

// ─── Main Page ───────────────────────────────────────────────────────
export default function SensorLogsPage() {
  const [mounted, setMounted] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [isDevicesLoading, setIsDevicesLoading] = useState(true);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [isDeviceDropdownOpen, setIsDeviceDropdownOpen] = useState(false);

  // Time range state
  const [activePreset, setActivePreset] = useState<RangePreset | "custom">("1W");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Data state
  const [chartRows, setChartRows] = useState<(SensorLog & { is_anomaly?: boolean })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalRecords, setTotalRecords] = useState(0);

  const [isTourActive, setIsTourActive] = useState(false);

  useEffect(() => {
    const isTourActiveStr = localStorage.getItem("bomba_tutorial_active");
    const tourPage = localStorage.getItem("bomba_tutorial_page");
    if (isTourActiveStr === "true" && tourPage === "sensor-logs") {
      setIsTourActive(true);
      localStorage.removeItem("bomba_tutorial_active");
      localStorage.removeItem("bomba_tutorial_page");
    }
  }, []);

  const handleTourComplete = () => {
    setIsTourActive(false);
    localStorage.setItem("bomba_tutorial_active", "true");
    localStorage.setItem("bomba_tutorial_page", "settings");
    window.location.href = "/settings";
  };

  const handleTourClose = () => {
    setIsTourActive(false);
    localStorage.removeItem("bomba_tutorial_active");
    localStorage.removeItem("bomba_tutorial_page");
  };

  const tourSteps: TourStep[] = [
    {
      targetId: "device-selector-logs",
      title: "Pilih Perangkat Sensor",
      description: "Pilih node sensor IoT yang ingin dianalisis riwayat datanya.",
      type: "button",
    },
    {
      targetId: "tour-sensor-logs-filters",
      title: "Filter Waktu dan Rentang Data",
      description: "Anda bisa memilih rentang waktu preset (1 Hari, 1 Minggu, 1 Bulan) atau mengatur tanggal kustom (From / To) untuk membatasi data yang ditarik.",
      type: "section",
    },
    {
      targetId: "tour-sensor-logs-section",
      title: "Grafik Telemetri Interaktif",
      description: "Grafik ini memvisualisasikan data runtun waktu (time-series) untuk suhu, gas MQ-4, MQ-9, dan sensor Flame secara bersamaan.",
      type: "section",
    },
    {
      targetId: "export-csv-btn",
      title: "Ekspor Data ke CSV",
      description: "Unduh seluruh riwayat telemetri perangkat dalam format CSV untuk analisis offline atau pelaporan.",
      type: "button",
    },
    {
      targetId: "sidebar-link-settings",
      title: "Halaman Manajemen Perangkat",
      description: "Mari kita beralih ke halaman Devices untuk mengelola dan menambahkan sensor atau kamera baru.",
      type: "button",
    }
  ];

  useEffect(() => setMounted(true), []);

  // Initialize date range from preset
  useEffect(() => {
    if (activePreset !== "custom") {
      const range = getDateRange(activePreset);
      setDateFrom(toInputDate(range.from));
      setDateTo(toInputDate(range.to));
    }
  }, [activePreset]);

  // ─── Load devices ──────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const devs = await getDevices();
        setDevices(devs || []);
        if (devs && devs.length > 0) {
          const sensorDev = devs.find((d) => d.device_type === "IOT") || devs[0];
          setSelectedDeviceId(sensorDev.id);
        }
      } catch (err) {
        console.error("[SensorLogs] Devices error:", err);
      } finally {
        setIsDevicesLoading(false);
      }
    })();
  }, []);

  // ─── Fetch sensor data for chart ──────────────────────────────────
  const fetchChartData = useCallback(async () => {
    if (!selectedDeviceId || !dateFrom || !dateTo) return;
    setLoading(true);
    setError(null);
    try {
      // Fetch up to 2000 rows for chart rendering
      const result = await getSensorLogsPaginated(
        1,
        2000,
        selectedDeviceId,
        fromInputDate(dateFrom),
        fromInputDate(dateTo, true)
      );
      // Reverse so chronological order (oldest first) for charting
      setChartRows([...result.data].reverse());
      setTotalRecords(result.total);
    } catch (err) {
      console.error("[SensorLogs] Fetch error:", err);
      setError(err instanceof Error ? err.message : "Gagal memuat data sensor");
    } finally {
      setLoading(false);
    }
  }, [selectedDeviceId, dateFrom, dateTo]);

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

  // ─── CSV Download ──────────────────────────────────────────────────
  const downloadCSV = async () => {
    if (!selectedDeviceId) return;
    try {
      const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";
      const token = getToken();
      const res = await fetch(
        `${BASE_URL}/api/v1/sensors/export/csv?device_id=${selectedDeviceId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sensor_logs_${selectedDeviceId}_${dateFrom}_${dateTo}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Download failed", err);
    }
  };

  const selectedDevice = useMemo(
    () => devices.find((d) => d.id === selectedDeviceId),
    [devices, selectedDeviceId]
  );

  const presets: RangePreset[] = ["1D", "1W", "1M"];

  if (!mounted) return <div className="flex-1 min-h-screen bg-canvas" />;

  if (!isDevicesLoading && devices.length === 0) {
    return (
      <div className="flex flex-col min-h-screen bg-canvas">
        <header className="px-4 md:px-6 lg:px-12 pt-6 md:pt-10 pb-5 md:pb-8 border-b border-hairline/60">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <TrendingUp size={20} className="text-primary" />
            </div>
            <span className="text-[10px] font-bold text-muted uppercase tracking-[0.2em]">
              Sensor Logs &amp; Archive
            </span>
          </div>
          <h1 className="display-sm md:display-lg text-ink">Telemetry Analytics</h1>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 bg-surface-card border border-hairline rounded-2xl shadow-xl flex items-center justify-center mb-6">
            <Database size={32} className="text-muted" />
          </div>
          <h2 className="text-2xl font-bold text-ink mb-2">No Devices Connected</h2>
          <p className="text-body max-w-md mx-auto mb-8">
            You haven't added any sensors to your account yet. Please add an IoT device to view telemetry logs.
          </p>
          <a href="/settings" className="px-6 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all flex items-center gap-2">
            Go to Device Settings
          </a>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-canvas">
      {/* ═══════════════════════════════════════════════════════════════
          HEADER
      ═══════════════════════════════════════════════════════════════ */}
      <header className="px-4 md:px-6 lg:px-12 pt-6 md:pt-10 pb-5 md:pb-8 border-b border-hairline/60 overflow-x-hidden">
        <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          {/* Left: Title + Description */}
          <div className="space-y-2">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <TrendingUp size={20} className="text-primary" />
              </div>
              <span className="text-[10px] font-bold text-muted uppercase tracking-[0.2em]">
                Sensor Logs &amp; Archive
              </span>
            </div>
            <h1 className="display-sm md:display-lg text-ink">Telemetry Analytics</h1>
            <p className="body-md text-muted max-w-2xl">
              Visualisasi tren dan riwayat data sensor lingkungan (MQ series, DHT22)
              untuk analisis lanjutan.
            </p>
          </div>

          {/* Right: Device selector + Export */}
          <div className="flex items-center gap-2 md:gap-3 shrink-0 flex-wrap">
            {/* Device Dropdown */}
            <div className="relative">
              <button
                id="device-selector-logs"
                onClick={() => setIsDeviceDropdownOpen(!isDeviceDropdownOpen)}
                className="flex items-center gap-2 px-4 h-10 rounded-lg bg-surface-card border border-hairline text-body text-sm font-medium hover:border-primary/40 transition-all cursor-pointer"
              >
                <Server size={14} className="text-primary" />
                <span className="truncate max-w-[160px]">
                  {selectedDevice?.device_name || "Select Device"}
                </span>
                <ChevronDown
                  size={14}
                  className={`text-muted transition-transform duration-200 ${isDeviceDropdownOpen ? "rotate-180" : ""
                    }`}
                />
              </button>

              {isDeviceDropdownOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-[calc(100vw-2rem)] sm:w-64 bg-surface-card border border-hairline rounded-lg overflow-hidden z-50">
                  <div className="px-3 py-2 border-b border-hairline">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                      Pilih Perangkat
                    </p>
                  </div>
                  <div className="max-h-48 overflow-y-auto py-1">
                    {devices.map((device) => (
                      <button
                        key={device.id}
                        onClick={() => {
                          setSelectedDeviceId(device.id);
                          setIsDeviceDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-surface-card-elevated cursor-pointer ${device.id === selectedDeviceId
                          ? "text-primary bg-primary/5"
                          : "text-body"
                          }`}
                      >
                        <p className="font-medium truncate">{device.device_name}</p>
                        <p className="text-[11px] text-muted truncate">
                          {device.location || "No location"}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Export CSV Button */}
            <button
              id="export-csv-btn"
              onClick={downloadCSV}
              className="button-primary btn-text gap-2 cursor-pointer"
            >
              <Download size={16} />
              <span className="hidden sm:inline">Export to CSV</span>
            </button>
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════
          MAIN CONTENT
      ═══════════════════════════════════════════════════════════════ */}
      <main className="flex-1 px-4 md:px-6 lg:px-12 py-4 md:py-8 overflow-x-hidden">
        <div className="max-w-[1400px] mx-auto space-y-4 md:space-y-6">
          {/* ── Time-Range Toolbar ──────────────────────────────────── */}
          <div id="tour-sensor-logs-filters" className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 md:gap-4 px-3 md:px-5 py-3 md:py-4 rounded-xl bg-surface-card-elevated border border-hairline">
            {/* Left: Preset Toggles */}
            <div className="flex items-center gap-1 bg-canvas rounded-lg p-1">
              {presets.map((preset) => (
                <button
                  key={preset}
                  id={`preset-${preset}`}
                  onClick={() => setActivePreset(preset)}
                  className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200 cursor-pointer ${activePreset === preset
                    ? "bg-surface-card-elevated text-ink"
                    : "text-muted-soft hover:text-body"
                    }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Right: Custom Date Range */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                  From
                </label>
                <input
                  id="date-from-input"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setActivePreset("custom");
                  }}
                  className="h-10 px-3 rounded-lg bg-canvas border border-hairline text-body text-sm font-mono outline-none focus:border-primary/40 transition-colors"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                  To
                </label>
                <input
                  id="date-to-input"
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setActivePreset("custom");
                  }}
                  className="h-10 px-3 rounded-lg bg-canvas border border-hairline text-body text-sm font-mono outline-none focus:border-primary/40 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* ── Stats Bar ──────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-2">
            <p className="text-[13px] font-mono text-muted">
              <span className="text-body-strong font-semibold">
                {totalRecords.toLocaleString("id-ID")}
              </span>{" "}
              total logs dalam rentang waktu ini
              {chartRows.length < totalRecords && (
                <span className="text-muted-soft">
                  {" "}· menampilkan {chartRows.length.toLocaleString("id-ID")} titik data
                </span>
              )}
            </p>
            {loading && (
              <Loader2 size={16} className="animate-spin text-primary" />
            )}
          </div>

          {/* ── Chart Area ─────────────────────────────────────────── */}
          <div id="tour-sensor-logs-section" className="feature-card !p-0 overflow-hidden !rounded-2xl">
            {/* Chart Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between px-4 md:px-6 pt-4 md:pt-6 pb-2 gap-2">
              <div>
                <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  Time-Series Sensor Trend
                </h2>
                <p className="text-[11px] text-muted mt-0.5 font-mono">
                  {dateFrom} → {dateTo}
                </p>
              </div>
              <div className="hidden md:flex items-center gap-4 text-[11px] font-mono text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-[2px] rounded-full bg-[#5e6ad2]" /> Temperature
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-[2px] rounded-full bg-[#22c55e]" /> MQ-4 (CNG)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-[2px] rounded-full bg-[#f59e0b]" /> MQ-9 (CO)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-[2px] rounded-full bg-[#ef4444]" /> Flame
                </span>
              </div>
            </div>

            {/* Chart Body */}
            <div className="px-2 md:px-4 pb-4 md:pb-6">
              {error ? (
                <div className="h-[300px] md:h-[480px] flex flex-col items-center justify-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-semantic-error/10 flex items-center justify-center">
                    <AlertCircle size={28} className="text-semantic-error" />
                  </div>
                  <p className="text-sm text-body font-medium">{error}</p>
                  <button
                    onClick={fetchChartData}
                    className="button-primary btn-text cursor-pointer px-6"
                  >
                    Coba Lagi
                  </button>
                </div>
              ) : chartRows.length === 0 && !loading ? (
                <div className="h-[300px] md:h-[480px] flex flex-col items-center justify-center gap-3">
                  <Database size={40} className="text-muted-soft" />
                  <p className="text-sm text-muted">
                    Tidak ada data sensor dalam rentang waktu ini.
                  </p>
                </div>
              ) : (
                <RechartsChart data={chartRows} loading={loading} />
              )}
            </div>
          </div>
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
