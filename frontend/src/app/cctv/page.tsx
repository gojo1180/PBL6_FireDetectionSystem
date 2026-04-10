"use client";

import { useEffect, useState } from "react";
import { Activity, Camera, ShieldAlert, Cpu, Network, Frame } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function CCTVPage() {
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  
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
      <header className="h-14 border-b border-ctp-crust bg-ctp-mantle flex items-center justify-between px-6 shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-2 text-sm">
          <Activity size={16} className="text-ctp-blue" />
          <span className="font-semibold text-ctp-text">Security Operations Center</span>
          <span className="text-ctp-overlay0">/</span>
          <span className="text-ctp-subtext0">Live Feed</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-ctp-green rounded-full border border-ctp-green animate-pulse" />
            <span className="text-xs font-bold text-ctp-green tracking-widest uppercase">System Online</span>
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
                  FPS: 20
                </span>
              </div>
            </div>

            {/* The Video Container */}
            <div className="relative p-4 flex-1 flex flex-col justify-center items-center bg-ctp-crust">
              <div className="relative w-full max-w-5xl group">
                {/* The actual stream */}
                {streamUrl && (
                  <img
                    src={streamUrl}
                    alt="Live CCTV Stream"
                    className="w-full max-h-[70vh] object-contain bg-black rounded-lg border border-ctp-crust shadow-2xl"
                    onError={(e) => {
                      // Fallback visual if stream is down
                      (e.target as HTMLImageElement).src = "/stream-fallback.png"; // Doesn't exist, but won't loop if unhandled
                    }}
                  />
                )}

                {/* Overlays on the video */}
                <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded border border-white/10 shadow-lg">
                  <div className="w-2.5 h-2.5 bg-ctp-green rounded-full animate-pulse shadow-[0_0_8px_rgba(166,227,161,0.8)]" />
                  <span className="text-[10px] font-bold text-white tracking-widest uppercase">LIVE</span>
                </div>

                <div className="absolute bottom-4 left-4 z-10 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded border border-white/10 shadow-lg">
                  <span className="text-xs font-mono text-white/90 shadow-sm">{currentTime}</span>
                </div>

                <div className="absolute top-4 right-4 z-10 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded border border-white/10 shadow-lg">
                   <div className="flex items-center gap-1.5">
                     <ShieldAlert size={12} className="text-ctp-yellow" />
                     <span className="text-[10px] font-bold text-white tracking-widest uppercase">AI ACTIVE</span>
                   </div>
                </div>
                
                {/* Crosshair / Center decoration just for SOC aesthetic */}
                <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-30 transition-opacity duration-700">
                  <div className="absolute top-1/2 left-0 w-full h-[1px] bg-ctp-blue/50" />
                  <div className="absolute left-1/2 top-0 w-[1px] h-full bg-ctp-blue/50" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 border border-ctp-blue rounded-full" />
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
                    <Network size={14} className="text-ctp-blue" />
                    <span className="text-xs font-semibold text-ctp-text">Status</span>
                  </div>
                  <span className="text-xs font-mono text-ctp-green">Connected</span>
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
                    <Cpu size={14} className="text-ctp-peach" />
                    <span className="text-xs font-semibold text-ctp-text">AI Model</span>
                  </div>
                  <span className="text-xs font-mono text-ctp-peach font-bold drop-shadow-[0_0_8px_rgba(250,179,135,0.4)]">YOLOv8 Active</span>
                </div>
              </div>
            </div>

            <div className="card p-5 border border-ctp-crust bg-ctp-mantle rounded-2xl shadow-lg relative overflow-hidden">
               {/* Background pattern */}
               <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#cdd6f4_1px,transparent_1px)] [background-size:16px_16px]" />
               
               <h3 className="text-xs font-bold uppercase tracking-widest text-ctp-subtext0 mb-4 relative flex items-center gap-2">
                 <ShieldAlert size={14} className="text-ctp-red" />
                 Active Protections
               </h3>

               <div className="space-y-3 relative">
                 <div className="flex items-center justify-between text-sm">
                   <span className="text-ctp-text font-medium">Late Fusion Inference</span>
                   <span className="text-xs font-mono text-ctp-green bg-ctp-green/10 px-2 py-0.5 rounded">OK</span>
                 </div>
                 <div className="flex items-center justify-between text-sm">
                   <span className="text-ctp-text font-medium">Fire Profile Match</span>
                   <span className="text-xs font-mono text-ctp-green bg-ctp-green/10 px-2 py-0.5 rounded">OK</span>
                 </div>
                 <div className="flex items-center justify-between text-sm">
                   <span className="text-ctp-text font-medium">Smoke Dispersion</span>
                   <span className="text-xs font-mono text-ctp-green bg-ctp-green/10 px-2 py-0.5 rounded">OK</span>
                 </div>
               </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
