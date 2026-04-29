"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Activity, Camera, ShieldAlert, Cpu, Network, Frame, VideoOff, WifiOff, ChevronDown, MapPin, Server, RefreshCw } from "lucide-react";
import { getDevices } from "@/lib/api";
import { Device } from "@/types";

// How long to wait for stream to load before considering it dead (ms)
const STREAM_TIMEOUT = 12000;
// Auto-retry interval when offline (ms)
const RECONNECT_INTERVAL = 8000;

export default function CCTVPage() {
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [isOffline, setIsOffline] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);

  // Device selector state
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Stream health timers
  const streamTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

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
        const data = await getDevices();
        if (data && data.length > 0) {
          setDevices(data);
          // Auto-select the first CCTV device, or first device overall
          const cctvDevice = data.find(d => d.device_type === "CCTV") || data[0];
          setSelectedDeviceId(cctvDevice.id);
          console.log("[CCTV] Devices loaded, selected:", cctvDevice.device_name);
        }
      } catch (err) {
        console.error("Failed to fetch device info", err);
      }
    };
    fetchDevices();

    // Update local time every second for the overlay
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleString("id-ID", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // ─── Connect to stream when device changes ─────────────────────────
  const connectStream = useCallback(() => {
    // Clear any pending reconnect
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current);

    setIsOffline(false);
    setIsReconnecting(false);
    const url = `${API_BASE}/api/v1/vision/stream?t=${Date.now()}`;
    setStreamUrl(url);
    console.log("[CCTV] Connecting to stream...");

    // Start a timeout — if we don't get onLoad within STREAM_TIMEOUT, mark dead
    streamTimeoutRef.current = setTimeout(() => {
      console.log("[CCTV] Stream timeout — marking offline");
      setIsOffline(true);
    }, STREAM_TIMEOUT);
  }, [API_BASE]);

  useEffect(() => {
    if (selectedDeviceId && mounted) {
      setReconnectCount(0);
      connectStream();
    }
    return () => {
      if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [selectedDeviceId, mounted, connectStream]);

  // ─── Auto-reconnect when offline ──────────────────────────────────
  useEffect(() => {
    if (isOffline && !isReconnecting) {
      setIsReconnecting(true);
      reconnectTimerRef.current = setTimeout(() => {
        setReconnectCount(prev => prev + 1);
        console.log("[CCTV] Auto-reconnecting...");
        connectStream();
      }, RECONNECT_INTERVAL);
    }
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [isOffline, isReconnecting, connectStream]);

  const handleStreamLoad = () => {
    // Stream loaded successfully — cancel timeout
    if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current);
    setIsOffline(false);
    setIsReconnecting(false);
    setReconnectCount(0);
    console.log("[CCTV] Stream connected successfully");
  };

  const handleStreamError = () => {
    if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current);
    console.log("[CCTV] Stream error — marking offline");
    setIsOffline(true);
  };

  const handleRetry = () => {
    setReconnectCount(0);
    connectStream();
  };

  const selectedDevice = devices.find(d => d.id === selectedDeviceId);

  if (!mounted) return <div className="flex-1 min-h-screen bg-ctp-base" />;

  return (
    <div className="flex flex-col min-h-screen bg-ctp-base">
      {/* Top Bar for SOC Layout */}
      <header className="h-14 border-b border-ctp-crust bg-ctp-mantle flex items-center justify-between pl-16 lg:pl-6 pr-6 shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-2 text-sm">
          <Activity size={16} className="text-ctp-blue" />
          <span className="font-semibold text-ctp-text">Security Operations Center</span>
          <span className="text-ctp-overlay0">/</span>

          {/* ─── Device Selector Dropdown ─────────────────────────── */}
          <div className="relative" ref={dropdownRef}>
            <button
              id="device-selector-cctv"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-ctp-base border border-ctp-crust hover:border-ctp-blue/50 transition-all duration-200 cursor-pointer group"
            >
              <Server size={13} className="text-ctp-blue" />
              <span className="text-ctp-text font-medium truncate max-w-[180px]">
                {selectedDevice?.device_name || "Select Camera"}
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
                  <p className="text-[10px] font-bold uppercase tracking-widest text-ctp-overlay0">Select Camera</p>
                </div>
                <div className="max-h-64 overflow-y-auto py-1">
                  {devices.map((device) => (
                    <button
                      key={device.id}
                      onClick={() => {
                        setSelectedDeviceId(device.id);
                        setIsDropdownOpen(false);
                        console.log("[CCTV] Switched to device:", device.device_name);
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
          <span className="text-xs font-mono text-ctp-text bg-ctp-crust px-3 py-1.5 rounded-lg border border-ctp-crust">{currentTime}</span>
        </div>
      </header>

      {/* Main Content grid */}
      <main className="flex-1 p-6 lg:p-8 space-y-6">

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* Main Video Stream Container (takes up 3 cols on large screens) */}
          <div className="lg:col-span-3 card flex flex-col overflow-hidden relative border border-ctp-crust bg-ctp-mantle rounded-2xl shadow-lg">
            {/* Header for Panel */}
            <div className="px-5 py-3 border-b border-ctp-crust flex justify-between items-center bg-ctp-base">
              <div className="flex items-center gap-2 text-ctp-text font-semibold">
                <Camera size={16} className="text-ctp-blue" />
                {selectedDevice?.device_name || "Camera"} : {selectedDevice?.location || "Unknown"}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-ctp-overlay0 font-mono tracking-widest">
                  FPS: {isOffline ? '0' : '20'}
                </span>
              </div>
            </div>

            {/* The Video Container */}
            <div className="relative p-4 flex-1 flex flex-col justify-center items-center bg-ctp-crust">
              <div className="relative w-full max-w-5xl group">
                {/* The actual stream */}
                <div className={`transition-opacity duration-500 ${isOffline ? 'opacity-0 absolute inset-0 pointer-events-none' : 'opacity-100'}`}>
                  {streamUrl && (
                    <img
                      src={streamUrl}
                      alt="Live CCTV Stream"
                      className="w-full max-h-[70vh] object-contain bg-black rounded-lg border border-ctp-crust shadow-2xl"
                      onLoad={handleStreamLoad}
                      onError={handleStreamError}
                    />
                  )}
                </div>

                {/* ─── Lost Connection / Offline State ──────────────── */}
                <div className={`transition-all duration-500 ${isOffline ? 'opacity-100' : 'opacity-0 absolute inset-0 pointer-events-none'}`}>
                  <div className="w-full min-h-[50vh] md:min-h-[70vh] flex flex-col items-center justify-center rounded-lg relative overflow-hidden bg-gradient-to-br from-black via-[#0d0d15] to-[#110d1a] border border-ctp-red/20">
                    {/* Glassmorphism overlay */}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-ctp-red/[0.03] to-ctp-red/[0.06]" />

                    {/* CRT scanline effect */}
                    <div className="absolute inset-0 opacity-[0.04] bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,#fff_2px,#fff_4px)] mix-blend-overlay" />

                    {/* Subtle pulsing glow behind icon */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-ctp-red/10 rounded-full blur-[80px] animate-pulse" />

                    <div className="relative z-10 flex flex-col items-center p-8">
                      {/* Icon cluster */}
                      <div className="relative mb-6">
                        <div className="absolute inset-0 w-20 h-20 bg-ctp-red/10 rounded-full blur-xl animate-pulse" />
                        <div className="relative w-20 h-20 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-2xl">
                          <WifiOff size={36} className="text-ctp-red drop-shadow-[0_0_12px_rgba(210,15,57,0.5)]" />
                        </div>
                      </div>

                      {/* Signal Lost Title */}
                      <div className="flex items-center gap-3 mb-2">
                        <span className="w-2.5 h-2.5 bg-ctp-red rounded-full animate-ping" />
                        <h2 className="text-2xl font-bold text-white tracking-widest uppercase">
                          SIGNAL LOST
                        </h2>
                        <span className="w-2.5 h-2.5 bg-ctp-red rounded-full animate-ping" />
                      </div>

                      <p className="text-sm text-white/50 font-mono mb-1">CONNECTION TO CAMERA FAILED</p>

                      {/* Reconnecting status */}
                      <div className="flex items-center gap-2 mt-4 mb-6 px-4 py-2 rounded-full bg-white/[0.05] border border-white/10 backdrop-blur-sm">
                        <RefreshCw size={14} className={`text-ctp-peach ${isReconnecting ? 'animate-spin' : ''}`} />
                        <span className="text-xs text-white/60 font-mono">
                          {isReconnecting ? `Reconnecting... (attempt ${reconnectCount + 1})` : 'Waiting...'}
                        </span>
                      </div>

                      {/* Retry button */}
                      <button
                        onClick={handleRetry}
                        className="px-5 py-2.5 bg-ctp-red/10 border border-ctp-red/40 text-ctp-red font-mono text-xs uppercase tracking-widest rounded-lg hover:bg-ctp-red/20 hover:border-ctp-red/60 hover:shadow-[0_0_20px_rgba(210,15,57,0.15)] transition-all duration-300 active:scale-95"
                      >
                        Manual Retry
                      </button>
                    </div>
                  </div>
                </div>

                {/* Overlays on the video */}
                <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded border border-white/10 shadow-lg">
                  <div className={`w-2.5 h-2.5 rounded-full ${isOffline ? 'bg-ctp-red' : 'bg-ctp-green animate-pulse shadow-[0_0_8px_rgba(166,227,161,0.8)]'}`} />
                  <span className={`text-[10px] font-bold tracking-widest uppercase ${isOffline ? 'text-ctp-red' : 'text-white'}`}>
                    {isOffline ? 'OFFLINE' : 'LIVE'}
                  </span>
                </div>

                <div className="absolute bottom-4 left-4 z-10 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded border border-white/10 shadow-lg">
                  <span className={`text-xs font-mono shadow-sm ${isOffline ? 'text-ctp-red/80' : 'text-white/90'}`}>{currentTime}</span>
                </div>

                <div className="absolute top-4 right-4 z-10 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded border border-white/10 shadow-lg">
                  <div className="flex items-center gap-1.5">
                    <ShieldAlert size={12} className={isOffline ? 'text-ctp-surface1' : 'text-ctp-yellow'} />
                    <span className={`text-[10px] font-bold tracking-widest uppercase ${isOffline ? 'text-ctp-surface1' : 'text-white'}`}>
                      {isOffline ? 'AI DISABLED' : 'AI ACTIVE'}
                    </span>
                  </div>
                </div>

                {/* Crosshair / Center decoration just for SOC aesthetic */}
                <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-30 transition-opacity duration-700">
                  <div className={`absolute top-1/2 left-0 w-full h-[1px] ${isOffline ? 'bg-ctp-red/50' : 'bg-ctp-blue/50'}`} />
                  <div className={`absolute left-1/2 top-0 w-[1px] h-full ${isOffline ? 'bg-ctp-red/50' : 'bg-ctp-blue/50'}`} />
                  <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 border rounded-full ${isOffline ? 'border-ctp-red' : 'border-ctp-blue'}`} />
                </div>
              </div>
            </div>
          </div>

          {/* Camera Info Panel (Aside) */}
          <div className="lg:col-span-1 space-y-6">

            <div className="card p-5 border border-ctp-crust bg-ctp-mantle rounded-2xl shadow-lg">
              <h3 className="text-xs font-bold uppercase tracking-widest text-ctp-subtext0 mb-4 flex items-center gap-2">
                <Activity size={14} className="text-ctp-mauve" />
                Tech Specs
              </h3>

              <div className="space-y-4">

                <div className="flex justify-between items-center p-3 rounded-xl bg-ctp-crust/50 border border-ctp-crust">
                  <div className="flex items-center gap-2">
                    <Network size={14} className={isOffline ? "text-ctp-red" : "text-ctp-blue"} />
                    <span className="text-xs font-semibold text-ctp-text">Status</span>
                  </div>
                  <span className={`text-xs font-mono ${isOffline ? 'text-ctp-red' : 'text-ctp-green'}`}>
                    {isOffline ? 'Disconnected' : 'Connected'}
                  </span>
                </div>

                <div className="flex justify-between items-center p-3 rounded-xl bg-ctp-crust/50 border border-ctp-crust">
                  <div className="flex items-center gap-2">
                    <Activity size={14} className="text-ctp-teal" />
                    <span className="text-xs font-semibold text-ctp-text">Protocol</span>
                  </div>
                  <span className="text-xs font-mono text-ctp-subtext1">MJPEG over TCP</span>
                </div>

                <div className="flex justify-between items-center p-3 rounded-xl bg-ctp-crust/50 border border-ctp-crust">
                  <div className="flex items-center gap-2">
                    <Frame size={14} className="text-ctp-lavender" />
                    <span className="text-xs font-semibold text-ctp-text">Resolution</span>
                  </div>
                  <span className="text-xs font-mono text-ctp-subtext1">Sub-stream</span>
                </div>

                <div className="flex justify-between items-center p-3 rounded-xl bg-ctp-crust/50 border border-ctp-crust">
                  <div className="flex items-center gap-2">
                    <Cpu size={14} className={isOffline ? "text-ctp-surface1" : "text-ctp-peach"} />
                    <span className="text-xs font-semibold text-ctp-text">AI Model</span>
                  </div>
                  <span className={`text-xs font-mono font-bold ${isOffline ? 'text-ctp-surface1' : 'text-ctp-peach drop-shadow-[0_0_8px_rgba(250,179,135,0.4)]'}`}>
                    {isOffline ? 'Offline' : 'YOLOv8 Active'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
