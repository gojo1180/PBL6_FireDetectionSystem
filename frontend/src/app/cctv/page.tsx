"use client";

import { useEffect, useState } from "react";
import { Activity, Camera, ShieldAlert, Cpu, Network, Frame, VideoOff } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function CCTVPage() {
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [isOffline, setIsOffline] = useState(false);

  // Real DB data state
  const [deviceInfo, setDeviceInfo] = useState({
    name: "Loading Device...",
    location: "Loading Location..."
  });

  const CCTV_DEVICE_ID = "c00c732b-ef0b-4eac-b06c-663417b87ad2";

  useEffect(() => {
    setMounted(true);

    // Anti-cache trick to prevent stream freezing when switching pages!
    setStreamUrl(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/v1/vision/stream?t=${Date.now()}`);

    // Fetch device info from DB
    const fetchDevice = async () => {
      const { data, error } = await supabase
        .from("devices")
        .select("name, location")
        .eq("id", CCTV_DEVICE_ID)
        .single();

      if (data && !error) {
        setDeviceInfo({
          name: data.name,
          location: data.location || "Unknown Location"
        });
      } else {
        setDeviceInfo({
          name: "CAM-01 (DB Sync Failed)",
          location: "Main Facility (Fallback)"
        });
      }
    };
    fetchDevice();

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

  if (!mounted) return <div className="flex-1 min-h-screen bg-ctp-base" />;

  return (
    <div className="flex flex-col min-h-screen bg-ctp-base">
      {/* Top Bar for SOC Layout */}
      <header className="h-14 border-b border-ctp-crust bg-ctp-mantle flex items-center justify-between pl-16 lg:pl-6 pr-6 shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-2 text-sm">
          <Activity size={16} className="text-ctp-blue" />
          <span className="font-semibold text-ctp-text">Security Operations Center</span>
          <span className="text-ctp-overlay0">/</span>
          <span className="text-ctp-subtext0">Live Feed</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full border animate-pulse ${isOffline ? 'bg-ctp-red border-ctp-red' : 'bg-ctp-green border-ctp-green'}`} />
            <span className={`text-xs font-bold tracking-widest uppercase ${isOffline ? 'text-ctp-red' : 'text-ctp-green'}`}>
              {isOffline ? 'System Offline' : 'System Online'}
            </span>
          </div>
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
                {deviceInfo.name} : {deviceInfo.location}
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
                {streamUrl && !isOffline && (
                  <img
                    src={streamUrl}
                    alt="Live CCTV Stream"
                    className="w-full max-h-[70vh] object-contain bg-black rounded-lg border border-ctp-crust shadow-2xl"
                    onError={(e) => {
                      setIsOffline(true);
                    }}
                  />
                )}

                {/* Offline State Canvas */}
                {isOffline && (
                  <div className="w-full min-h-[50vh] md:min-h-[70vh] flex flex-col items-center justify-center bg-black rounded-lg border border-ctp-red/30 shadow-[0_0_15px_rgba(243,139,168,0.1)] relative overflow-hidden">
                    <div className="absolute inset-0 opacity-[0.05] bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,#fff_2px,#fff_4px)] mix-blend-overlay"></div>
                    <div className="relative z-10 flex flex-col items-center">
                      <VideoOff size={56} className="text-ctp-red mb-4 opacity-80" />
                      <span className="text-2xl font-bold text-ctp-red tracking-widest uppercase flex items-center gap-3">
                        <span className="w-3 h-3 bg-ctp-red rounded-full animate-ping" />
                        SIGNAL LOST
                        <span className="w-3 h-3 bg-ctp-red rounded-full animate-ping" />
                      </span>
                      <span className="text-sm text-ctp-overlay0 mt-3 font-mono">CONNECTION TO CAMERA FAILED</span>
                      <button
                        onClick={() => {
                          setIsOffline(false);
                          setStreamUrl(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/v1/vision/stream?t=${Date.now()}`);
                        }}
                        className="mt-6 px-4 py-2 bg-ctp-red/10 border border-ctp-red/50 text-ctp-red font-mono text-xs uppercase tracking-widest rounded hover:bg-ctp-red/20 transition-colors"
                      >
                        Retry Connection
                      </button>
                    </div>
                  </div>
                )}

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
