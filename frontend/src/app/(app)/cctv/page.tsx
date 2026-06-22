"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Activity, Camera, ShieldAlert, Cpu, Network, Frame, WifiOff, ChevronDown, MapPin, Server, RefreshCw, ShieldCheck, Radio, Settings2 } from "lucide-react";
import { getDevices, updateDevice } from "@/lib/api";
import { Device } from "@/types";
import { TutorialTour, TourStep } from "@/components/ui/TutorialTour";

// How long to wait for stream to load before considering it dead (ms)
const STREAM_TIMEOUT = 12000;
// Auto-retry interval when offline (ms)
const RECONNECT_INTERVAL = 8000;

export default function CCTVPage() {
 const [mounted, setMounted] = useState(false);
 const [currentTime, setCurrentTime] = useState("");
 const [connectionState, setConnectionState] = useState<"connecting" | "live" | "error">("connecting");
 const [errorMessage, setErrorMessage] = useState("");
 const videoRef = useRef<HTMLVideoElement>(null);
 const pcRef = useRef<RTCPeerConnection | null>(null);
 const [isOffline, setIsOffline] = useState(false);
 const [isReconnecting, setIsReconnecting] = useState(false);
 const [reconnectCount, setReconnectCount] = useState(0);

 // Device selector state
 const [devices, setDevices] = useState<Device[]>([]);
 const [isDevicesLoading, setIsDevicesLoading] = useState(true);
 const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
 const [isDropdownOpen, setIsDropdownOpen] = useState(false);
 const dropdownRef = useRef<HTMLDivElement>(null);

 // Calibration state
 const [mediumThreshold, setMediumThreshold] = useState<number>(5.0);
 const [largeThreshold, setLargeThreshold] = useState<number>(20.0);
 const [isSavingCalibration, setIsSavingCalibration] = useState(false);

 const [isTourActive, setIsTourActive] = useState(false);

 useEffect(() => {
 const isTourActiveStr = localStorage.getItem("bomba_tutorial_active");
 const tourPage = localStorage.getItem("bomba_tutorial_page");
 if (isTourActiveStr === "true" && tourPage === "cctv") {
 setIsTourActive(true);
 localStorage.removeItem("bomba_tutorial_active");
 localStorage.removeItem("bomba_tutorial_page");
 }
 }, []);

 const handleTourComplete = () => {
 setIsTourActive(false);
 localStorage.setItem("bomba_tutorial_active", "true");
 localStorage.setItem("bomba_tutorial_page", "sensor-logs");
 window.location.href = "/sensor-logs";
 };

 const handleTourClose = () => {
 setIsTourActive(false);
 localStorage.removeItem("bomba_tutorial_active");
 localStorage.removeItem("bomba_tutorial_page");
 };

 const tourSteps: TourStep[] = [
 {
 targetId: "device-selector-cctv",
 title: "Pilih Kamera CCTV",
 description: "Pilih kamera CCTV pemantau ruangan yang ingin dilihat visualisasinya.",
 type: "button",
 },
 {
 targetId: "tour-cctv-feed",
 title: "Feed Kamera Real-time dan Deteksi AI",
 description: "Feed video dari ruangan yang dipilih. Sistem AI (YOLOv8) secara otomatis menganalisis citra visual untuk mendeteksi api dan asap.",
 type: "section",
 },
 {
 targetId: "tour-cctv-specs",
 title: "Spesifikasi dan Informasi Kamera",
 description: "Lihat informasi detail seperti protokol koneksi, resolusi, model AI yang aktif, serta alamat stream RTSP kamera.",
 type: "section",
 },
 {
 targetId: "sidebar-link-sensor-logs",
 title: "Halaman Telemetri Sensor",
 description: "Mari kita lanjut ke halaman Sensor Logs untuk melihat tren telemetri lingkungan secara berkala.",
 type: "button",
 }
 ];

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
  setDevices(data || []);
  if (data && data.length > 0) {
  // Auto-select the first CCTV device, or first device overall
  const cctvDevice = data.find(d => d.device_type === "CCTV") || data[0];
  setSelectedDeviceId(cctvDevice.id);
  setMediumThreshold(cctvDevice.medium_fire_threshold ?? 5.0);
  setLargeThreshold(cctvDevice.large_fire_threshold ?? 20.0);
  console.log("[CCTV] Devices loaded, selected:", cctvDevice.device_name);
  }
  } catch (err) {
  console.error("Failed to fetch device info", err);
  } finally {
  setIsDevicesLoading(false);
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

  // ─── Connect to stream using WebRTC ─────────────────────────
  const connectWebRTC = useCallback(async () => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);

    setIsOffline(false);
    setIsReconnecting(true);
    setConnectionState("connecting");
    setErrorMessage("");

    // Cleanup previous connection
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
      });
      pcRef.current = pc;

      pc.addTransceiver("video", { direction: "recvonly" });

      pc.ontrack = (event) => {
        if (event.track.kind === "video" && videoRef.current) {
          videoRef.current.srcObject = event.streams[0];
        }
      };

      pc.onconnectionstatechange = () => {
        console.log("📡 WebRTC State (CCTV Page):", pc.connectionState);
        if (pc.connectionState === "connected") {
          setConnectionState("live");
          setIsOffline(false);
          setIsReconnecting(false);
          setReconnectCount(0);
        } else if (
          pc.connectionState === "failed" ||
          pc.connectionState === "disconnected" ||
          pc.connectionState === "closed"
        ) {
          setConnectionState("error");
          setIsOffline(true);
          setIsReconnecting(false);
          setErrorMessage("Koneksi WebRTC terputus.");
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const response = await fetch(`${API_BASE}/api/v1/vision/webrtc/offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sdp: pc.localDescription?.sdp,
          type: pc.localDescription?.type,
          device_id: selectedDeviceId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to connect: ${response.statusText}`);
      }

      const answer = await response.json();
      if (pc.signalingState !== "closed") {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } else {
        console.warn("WebRTC connection closed before setting remote description");
      }

    } catch (err: any) {
      console.error("❌ WebRTC Setup Error:", err);
      setConnectionState("error");
      setIsOffline(true);
      setIsReconnecting(false);
      setErrorMessage(err.message || "Gagal membangun koneksi WebRTC");
    }
  }, [API_BASE, selectedDeviceId]);

  useEffect(() => {
    if (selectedDeviceId && mounted) {
      setReconnectCount(0);
      connectWebRTC();
    }
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  }, [selectedDeviceId, mounted, connectWebRTC]);

  // ─── Poll status to detect if stream drops during live playback ───
  useEffect(() => {
    if (connectionState !== "live") return;
    
    let lastFramesDecoded = 0;
    
    const interval = setInterval(async () => {
      if (!pcRef.current) return;
      try {
        const stats = await pcRef.current.getStats();
        let currentFramesDecoded = 0;
        
        stats.forEach((report) => {
          if (report.type === "inbound-rtp" && report.kind === "video") {
            currentFramesDecoded = report.framesDecoded || 0;
          }
        });
        
        // If frames decoded hasn't increased, the stream is frozen/dropped
        if (currentFramesDecoded === lastFramesDecoded && currentFramesDecoded > 0) {
          console.log("📡 Stream dropped during playback (No new frames decoded)");
          setConnectionState("error");
          setIsOffline(true);
          setErrorMessage("Kamera terputus (Video Freeze)");
        }
        
        lastFramesDecoded = currentFramesDecoded;
      } catch (e) {
        // ignore stats error
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [connectionState]);

  // ─── Auto-reconnect when offline ──────────────────────────────────
  useEffect(() => {
    if (!isOffline) {
      setIsReconnecting(false);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      return;
    }

    console.log(`[CCTV] Stream offline, scheduling reconnect in ${RECONNECT_INTERVAL}ms...`);
    setIsReconnecting(true);
    reconnectTimerRef.current = setTimeout(() => {
      setReconnectCount(prev => prev + 1);
      console.log("[CCTV] Auto-reconnecting now...");
      connectWebRTC();
    }, RECONNECT_INTERVAL);

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [isOffline, connectWebRTC]);

  const handleRetry = async () => {
    setReconnectCount(0);
    try {
      await fetch(`${API_BASE}/api/v1/vision/rtsp/retry`, { 
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: selectedDeviceId }),
      });
    } catch (e) {
      console.error("Failed to trigger RTSP retry", e);
    }
    setTimeout(() => {
      connectWebRTC();
    }, 1000);
  };

  const saveCalibration = async () => {
    if (!selectedDeviceId) return;
    setIsSavingCalibration(true);
    try {
      await updateDevice(selectedDeviceId, {
        medium_fire_threshold: mediumThreshold,
        large_fire_threshold: largeThreshold
      });
      setDevices(prev => prev.map(d => d.id === selectedDeviceId ? {
        ...d,
        medium_fire_threshold: mediumThreshold,
        large_fire_threshold: largeThreshold
      } : d));
    } catch (e) {
      console.error("Failed to save calibration", e);
    } finally {
      setIsSavingCalibration(false);
    }
  };

  const selectedDevice = devices.find(d => d.id === selectedDeviceId);

  if (!mounted) return <div className="flex-1 min-h-screen bg-canvas" />;

  if (!isDevicesLoading && devices.length === 0) {
    return (
      <div className="flex flex-col min-h-screen bg-canvas">
        <header className="h-16 border-b border-hairline bg-surface-card backdrop-blur-md flex items-center pl-6 pr-6 shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-3 text-sm">
            <div className="p-2 rounded-lg bg-violet-50">
              <Camera size={18} className="text-violet-500" />
            </div>
            <span className="font-bold text-base text-ink">Security Operations Center</span>
          </div>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 bg-surface-card border border-hairline rounded-2xl shadow-xl flex items-center justify-center mb-6">
            <Camera size={32} className="text-muted" />
          </div>
          <h2 className="text-2xl font-bold text-ink mb-2">No Cameras Connected</h2>
          <p className="text-body max-w-md mx-auto mb-8">
            You haven't added any CCTV cameras to your account yet. Please add a camera device to start monitoring visual feeds.
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
 {/* Top Bar */}
 <header className="h-16 border-b border-hairline bg-surface-card backdrop-blur-md flex items-center justify-between pl-16 lg:pl-6 pr-6 shrink-0 sticky top-0 z-20 shadow-[0_2px_8px_rgba(99,102,241,0.02)]">
 <div className="flex items-center gap-3 text-sm">
 <div className="p-2 rounded-lg bg-violet-50">
 <Camera size={18} className="text-violet-500" />
 </div>
 <span className="font-bold text-base text-ink">Security Operations Center</span>
 <span className="text-muted text-lg">/</span>

 {/* ─── Device Selector Dropdown ─────────────────────────── */}
 <div className="relative" ref={dropdownRef}>
 <button
 id="device-selector-cctv"
 onClick={() => setIsDropdownOpen(!isDropdownOpen)}
 className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-card-elevated backdrop-blur-sm border border-hairline hover:border-primary/40 transition-all duration-200 cursor-pointer group"
 >
 <Server size={13} className="text-primary" />
 <span className="text-ink font-medium truncate max-w-[180px]">
 {selectedDevice?.device_name || "Select Camera"}
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
 <div className="absolute top-full left-0 mt-1.5 w-72 bg-surface-card backdrop-blur-xl border border-hairline rounded-xl shadow-2xl shadow-slate-200/50 overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150">
 <div className="px-3 py-2 border-b border-hairline">
 <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Select Camera</p>
 </div>
 <div className="max-h-64 overflow-y-auto py-1">
 {devices.filter(d => d.device_type === "CCTV").map((device) => (
 <button
 key={device.id}
 onClick={() => {
 setSelectedDeviceId(device.id);
 setMediumThreshold(device.medium_fire_threshold ?? 5.0);
 setLargeThreshold(device.large_fire_threshold ?? 20.0);
 setIsDropdownOpen(false);
 console.log("[CCTV] Switched to device:", device.device_name);
 }}
 className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-all duration-150 hover:bg-primary/10 group/item ${device.id === selectedDeviceId ? "bg-primary/10 border-l-2 border-indigo-500" : "border-l-2 border-transparent"
 }`}
 >
 <div className={`w-2 h-2 rounded-full shrink-0 ${device.status === "active" ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" : "bg-slate-300"}`} />
 <div className="flex-1 min-w-0">
 <p className={`text-sm font-medium truncate ${device.id === selectedDeviceId ? "text-primary" : "text-ink"}`}>
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
 <span className="text-xs font-mono text-body bg-surface-card-elevated px-3 py-1.5 rounded-lg border border-hairline tabular-nums">{currentTime}</span>
 </div>
 </header>

 {/* Main Content grid */}
 <main className="flex-1 p-6 lg:p-8 space-y-6">

 <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">

 {/* Main Video Stream Container (takes up 3 cols on large screens) */}
 <div className="lg:col-span-3 flex flex-col overflow-hidden relative bg-surface-card backdrop-blur-md border border-hairline rounded-2xl shadow-sm">
 {/* Header for Panel */}
 <div className="px-5 py-3 border-b border-hairline flex justify-between items-center">
 <div className="flex items-center gap-2.5">
 <div className="p-1.5 rounded-lg bg-violet-50">
 <Camera size={14} className="text-violet-500" />
 </div>
 <span className="text-sm font-semibold text-ink">
 {selectedDevice?.device_name || "Camera"} : {selectedDevice?.location || "Unknown"}
 </span>
 </div>
 <div className="flex items-center gap-2">
 <span className="text-[10px] text-muted font-mono tracking-widest">
 FPS: {isOffline ? '0' : '20'}
 </span>
 </div>
 </div>

 {/* The Video Container */}
 <div id="tour-cctv-feed" className="relative w-full aspect-video max-h-[60vh] bg-black overflow-hidden group border-t border-hairline">
 {/* Video Element for WebRTC */}
 <video
 ref={videoRef}
 autoPlay
 playsInline
 muted
 className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${connectionState === "live" ? "opacity-100" : "opacity-0"
 }`}
 />

 {/* Skeleton Loading - Connecting */}
 <div
 className={`absolute inset-0 flex items-center justify-center bg-slate-800/40 backdrop-blur-md transition-opacity duration-500 z-20 ${connectionState === "connecting" ? "opacity-100" : "opacity-0 pointer-events-none"
 }`}
 >
 <div className="flex flex-col items-center gap-3">
 <RefreshCw size={32} className="text-indigo-400 animate-spin" />
 <p className="text-base font-medium text-body animate-pulse">Menyiapkan stream latensi rendah...</p>
 </div>
 </div>

 {/* Error / Offline fallback */}
 <div
 className={`absolute inset-0 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-md transition-opacity duration-500 z-20 ${connectionState === "error" ? "opacity-100" : "opacity-0 pointer-events-none"
 }`}
 >
 <div className="flex flex-col items-center gap-4 p-6">
 <div className="relative">
 <div className="absolute inset-0 w-16 h-16 bg-rose-100 rounded-full blur-2xl animate-pulse" />
 <div className="relative w-16 h-16 rounded-2xl bg-surface-strong border border-hairline flex items-center justify-center shadow-sm">
 <WifiOff size={28} className="text-muted" />
 </div>
 </div>

 <p className="text-base font-semibold text-body">
 Kamera Offline
 </p>
 <p className="text-sm text-muted text-center max-w-[250px]">
 {errorMessage || "Tidak dapat terhubung ke stream WebRTC."}
 </p>

 <button
 onClick={handleRetry}
 className="mt-2 px-5 py-2.5 text-xs font-bold text-primary bg-primary/10 border border-primary/40 rounded-lg hover:bg-primary/20 hover:border-primary/40 transition-all duration-200 active:scale-95"
 >
 Coba Hubungkan Kembali
 </button>
 </div>
 </div>

 {/* Overlay badges */}
 <span className="absolute top-4 left-4 bg-black/60 text-white text-xs font-mono px-2.5 py-1 rounded-md z-10 backdrop-blur-sm border border-white/10 shadow-lg">
 {selectedDevice?.device_name || "CAM-01"}
 </span>

 {connectionState === "live" && (
 <span className="absolute top-4 right-4 flex items-center gap-1.5 bg-emerald-500/80 text-white text-xs font-bold px-2.5 py-1 rounded-md z-10 backdrop-blur-sm shadow-lg">
 <ShieldCheck size={14} />
 AMAN
 </span>
 )}

 {connectionState === "error" && (
 <span className="absolute top-4 right-4 flex items-center gap-1.5 bg-rose-500/90 text-white text-xs font-bold px-2.5 py-1 rounded-md z-10 backdrop-blur-sm shadow-lg">
 <ShieldAlert size={14} />
 OFFLINE
 </span>
 )}

 {/* Bottom Left Timestamp */}
 <div className="absolute bottom-4 left-4 z-10 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-md border border-white/10 shadow-lg">
 <span className={`text-xs font-mono shadow-sm ${connectionState === "error" ? "text-red-300/80" : "text-white/90"}`}>
 {currentTime}
 </span>
 </div>

 {/* Crosshair / Center decoration just for SOC aesthetic */}
 <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-30 transition-opacity duration-700">
 <div className={`absolute top-1/2 left-0 w-full h-[1px] ${connectionState === "error" ? 'bg-red-500/50' : 'bg-primary/50'}`} />
 <div className={`absolute left-1/2 top-0 w-[1px] h-full ${connectionState === "error" ? 'bg-red-500/50' : 'bg-primary/50'}`} />
 <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 border rounded-full ${connectionState === "error" ? 'border-red-500' : 'border-indigo-500'}`} />
 </div>
 </div>
 </div>

 {/* Camera Info Panel (Aside) */}
 <div id="tour-cctv-specs" className="lg:col-span-1 space-y-6">

 {/* Tech Specs Card */}
 <div className="bg-surface-card backdrop-blur-md p-5 border border-hairline rounded-2xl shadow-sm">
 <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-4 flex items-center gap-2">
 <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
 Tech Specs
 </h3>

 <div className="space-y-3">

 <div className="p-3 rounded-xl bg-surface-card-elevated border border-hairline">
 <div className="flex items-center gap-2 mb-1">
 <Network size={14} className={isOffline ? "text-red-400" : "text-primary"} />
 <span className="text-[11px] font-semibold text-body">Status</span>
 </div>
 <p className={`text-sm font-semibold ${isOffline ? 'text-red-500' : 'text-emerald-600'}`}>
 {isOffline ? 'Disconnected' : 'Connected'}
 </p>
 </div>

 <div className="p-3 rounded-xl bg-surface-card-elevated border border-hairline">
 <div className="flex items-center gap-2 mb-1">
 <Radio size={14} className="text-teal-500" />
 <span className="text-[11px] font-semibold text-body">Protocol</span>
 </div>
 <p className="text-sm font-mono font-semibold text-ink">WebRTC / UDP</p>
 </div>

 <div className="p-3 rounded-xl bg-surface-card-elevated border border-hairline">
 <div className="flex items-center gap-2 mb-1">
 <Frame size={14} className="text-primary" />
 <span className="text-[11px] font-semibold text-body">Resolution</span>
 </div>
 <p className="text-sm font-mono font-semibold text-ink">Sub-stream</p>
 </div>

 <div className="p-3 rounded-xl bg-surface-card-elevated border border-hairline">
 <div className="flex items-center gap-2 mb-1">
 <Cpu size={14} className={isOffline ? "text-muted" : "text-violet-500"} />
 <span className="text-[11px] font-semibold text-body">AI Model</span>
 </div>
 <p className={`text-sm font-semibold ${isOffline ? 'text-muted' : 'text-violet-600'}`}>
 {isOffline ? 'Offline' : 'YOLOv8 Active'}
 </p>
 </div>
 </div>
 </div>

 {/* Camera Info Card */}
 <div className="bg-surface-card backdrop-blur-md p-5 border border-hairline rounded-2xl shadow-sm">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted flex items-center gap-2">
 <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
 Camera
 </h3>
 <button 
 onClick={handleRetry}
 className="px-3 py-1.5 text-[11px] font-bold text-white bg-primary hover:bg-primary/90 border border-transparent rounded-lg flex items-center gap-2 transition-all shadow-sm active:scale-95"
 >
 <RefreshCw size={12} /> RETRY RTSP
 </button>
 </div>

 <div className="space-y-3">
 <div className="flex items-center gap-2 text-sm text-ink">
 <Camera size={14} className="text-muted" />
 <span className="font-medium">{selectedDevice?.device_name || "—"}</span>
 </div>
 <div className="flex items-center gap-2 text-sm text-body">
 <MapPin size={14} className="text-muted" />
 <span>{selectedDevice?.location || "No location set"}</span>
 </div>
 {selectedDevice?.rtsp_url && (
 <div className="px-3 py-2 rounded-lg bg-surface-card-elevated border border-hairline">
 <p className="text-[10px] text-muted font-mono truncate">{selectedDevice.rtsp_url}</p>
 </div>
 )}
 </div>
 </div>

  {/* Calibration Card */}
  <div className="bg-surface-card backdrop-blur-md p-5 border border-hairline rounded-2xl shadow-sm">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
        Visual Calibration
      </h3>
      {isSavingCalibration ? <RefreshCw size={12} className="animate-spin text-primary" /> : <Settings2 size={12} className="text-muted" />}
    </div>
    
    <div className="space-y-5">
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs font-semibold text-body">Medium Fire</label>
          <span className="text-xs font-mono bg-orange-50 text-orange-600 px-2 py-0.5 rounded-md border border-orange-100">{mediumThreshold}% area</span>
        </div>
        <input 
          type="range" min="1" max="50" step="0.5" 
          value={mediumThreshold} 
          onChange={(e) => setMediumThreshold(parseFloat(e.target.value))}
          onMouseUp={saveCalibration}
          onTouchEnd={saveCalibration}
          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
        />
        <p className="text-[10px] text-muted mt-1.5 leading-tight">If fire area &gt; {mediumThreshold}%, it will trigger medium severity.</p>
      </div>
      
      <div className="pt-2 border-t border-hairline">
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs font-semibold text-body">Large Fire</label>
          <span className="text-xs font-mono bg-red-50 text-red-600 px-2 py-0.5 rounded-md border border-red-100">{largeThreshold}% area</span>
        </div>
        <input 
          type="range" min="1" max="100" step="0.5" 
          value={largeThreshold} 
          onChange={(e) => setLargeThreshold(parseFloat(e.target.value))}
          onMouseUp={saveCalibration}
          onTouchEnd={saveCalibration}
          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-500"
        />
        <p className="text-[10px] text-muted mt-1.5 leading-tight">If fire area &gt; {largeThreshold}%, it will trigger large/danger severity.</p>
      </div>
    </div>
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
