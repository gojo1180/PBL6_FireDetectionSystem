"use client";

import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import { Camera, WifiOff, RefreshCw, ShieldCheck, ShieldAlert } from "lucide-react";
import { VisionLog } from "@/types";
import { ConfidenceBar } from "@/components/ui/ConfidenceBar";
import { fmtTime } from "@/lib/utils";

// ─── Props ──────────────────────────────────────────────────────────────
interface LiveCCTVCardProps {
  /** Latest vision log data for confidence bars */
  latestVision: VisionLog | null;
  /** If true, the card enters "danger" mode (red ring + red LIVE dot) */
  isDanger?: boolean;
}

type ConnectionState = "connecting" | "live" | "error";

// ─── Component ──────────────────────────────────────────────────────────
export const LiveCCTVCard = memo(function LiveCCTVCard({
  latestVision,
  isDanger = false,
}: LiveCCTVCardProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [errorMessage, setErrorMessage] = useState("");
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

  // ── WebRTC Setup ──────────────────────────────────────────────────────
  const connectWebRTC = useCallback(async () => {
    setConnectionState("connecting");
    setErrorMessage("");

    try {
      // 1. Buat instance RTCPeerConnection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" } // Fallback STUN public
        ]
      });
      pcRef.current = pc;

      // 2. Transceiver untuk receive-only video
      pc.addTransceiver("video", { direction: "recvonly" });

      // 3. Tangkap event ontrack
      pc.ontrack = (event) => {
        if (event.track.kind === "video" && videoRef.current) {
          videoRef.current.srcObject = event.streams[0];
        }
      };

      // 4. Pantau perubahan state koneksi
      pc.onconnectionstatechange = () => {
        console.log("📡 WebRTC State:", pc.connectionState);
        if (pc.connectionState === "connected") {
          setConnectionState("live");
        } else if (
          pc.connectionState === "failed" ||
          pc.connectionState === "disconnected" ||
          pc.connectionState === "closed"
        ) {
          setConnectionState("error");
          setErrorMessage("Koneksi WebRTC terputus.");
        }
      };

      // 5. Buat Offer dan set Local Description
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 6. Kirim offer SDP ke backend menggunakan fetch
      const response = await fetch(`${API_BASE}/api/v1/vision/webrtc/offer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sdp: pc.localDescription?.sdp,
          type: pc.localDescription?.type,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to connect: ${response.statusText}`);
      }

      // 7. Terima Answer dari backend dan set Remote Description
      const answer = await response.json();
      await pc.setRemoteDescription(new RTCSessionDescription(answer));

    } catch (err: any) {
      console.error("❌ WebRTC Setup Error:", err);
      setConnectionState("error");
      setErrorMessage(err.message || "Gagal membangun koneksi WebRTC");
    }
  }, [API_BASE]);

  // Initial connection & Cleanup
  useEffect(() => {
    connectWebRTC();

    return () => {
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  }, [connectWebRTC]);

  const handleRetry = async () => {
    // 1. Beri tahu backend untuk melakukan reconnect RTSP (jika mati)
    try {
      await fetch(`${API_BASE}/api/v1/vision/rtsp/retry`, { method: "POST" });
    } catch (err) {
      console.warn("RTSP retry notification failed", err);
    }

    // 2. Cleanup old connection before retrying
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    connectWebRTC();
  };

  // ── Derived styles based on danger state ───────────────────────────
  const liveDotColor = isDanger ? "bg-rose-500" : "bg-emerald-500";
  const liveLabelColor = isDanger ? "text-rose-500" : "text-emerald-500";
  const dangerRing = isDanger
    ? "ring-2 ring-rose-500/60 animate-pulse"
    : "";

  return (
    <div className="bg-white/60 backdrop-blur-md border border-slate-200/40 rounded-2xl shadow-sm overflow-hidden flex flex-col">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="px-5 py-3 border-b border-slate-200/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-violet-50">
            <Camera size={14} className="text-violet-500" />
          </div>
          <span className="text-sm font-semibold text-slate-700">
            Live Area Monitor
          </span>
        </div>

        {/* LIVE / OFFLINE / CONNECTING indicator */}
        {connectionState === "error" && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-slate-300" />
            OFFLINE
          </div>
        )}
        {connectionState === "connecting" && (
          <div className="flex items-center gap-1.5 text-xs text-indigo-500 font-semibold">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            CONNECTING
          </div>
        )}
        {connectionState === "live" && (
          <div className={`flex items-center gap-1.5 text-xs font-semibold ${liveLabelColor}`}>
            <span className={`w-2 h-2 rounded-full ${liveDotColor} animate-pulse`} />
            LIVE
          </div>
        )}
      </div>

      {/* ── Stream / Fallback ────────────────────────────────────── */}
      <div
        className={`relative aspect-video bg-slate-50/20 overflow-hidden transition-all duration-300 ${dangerRing}`}
      >
        {/* Video Element for WebRTC */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
            connectionState === "live" ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* Skeleton Loading - Connecting */}
        <div
          className={`absolute inset-0 flex items-center justify-center bg-slate-50/10 backdrop-blur-sm transition-opacity duration-500 ${
            connectionState === "connecting" ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <div className="flex flex-col items-center gap-3">
            <RefreshCw size={24} className="text-indigo-400 animate-spin" />
            <p className="text-sm font-medium text-slate-500 animate-pulse">Menyiapkan stream latensi rendah...</p>
          </div>
        </div>

        {/* Error / Offline fallback */}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center bg-slate-50/10 backdrop-blur-sm transition-opacity duration-500 ${
            connectionState === "error" ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <div className="flex flex-col items-center gap-3 p-6">
            <div className="relative">
              <div className="absolute inset-0 w-14 h-14 bg-rose-100 rounded-full blur-xl animate-pulse" />
              <div className="relative w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center shadow-sm">
                <WifiOff size={24} className="text-slate-400" />
              </div>
            </div>

            <p className="text-sm font-semibold text-slate-600">
              Kamera Offline
            </p>
            <p className="text-xs text-slate-400 text-center max-w-[200px]">
              {errorMessage || "Tidak dapat terhubung ke stream WebRTC."}
            </p>

            <button
              onClick={handleRetry}
              className="mt-2 px-4 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 hover:border-indigo-300 transition-all duration-200 active:scale-95"
            >
              Coba Hubungkan Kembali
            </button>
          </div>
        </div>

        {/* Overlay badges */}
        <span className="absolute top-2 left-2 bg-black/50 text-white text-[10px] font-mono px-2 py-0.5 rounded z-10 backdrop-blur-sm">
          CAM-01
        </span>

        {isDanger ? (
          <span className="absolute top-2 right-2 flex items-center gap-1 bg-rose-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded z-10 backdrop-blur-sm">
            <ShieldAlert size={10} />
            BAHAYA
          </span>
        ) : (
          connectionState === "live" && (
            <span className="absolute top-2 right-2 flex items-center gap-1 bg-emerald-500/80 text-white text-[10px] font-bold px-2 py-0.5 rounded z-10 backdrop-blur-sm">
              <ShieldCheck size={10} />
              AMAN
            </span>
          )
        )}
      </div>

      {/* ── Confidence Bars ──────────────────────────────────────── */}
      <div className="p-5 space-y-4 flex-1">
        <ConfidenceBar
          label="Fire"
          value={latestVision?.fire_confidence ?? 0}
          color="#d20f39"
          threshold={0.55}
        />
        <ConfidenceBar
          label="Smoke"
          value={latestVision?.smoke_confidence ?? 0}
          color="#fe640b"
          threshold={0.5}
        />
        <p className="text-[10px] text-slate-400 font-mono tabular-nums pt-1">
          Last detection:{" "}
          {latestVision ? fmtTime(latestVision.recorded_at) : "No events"}
        </p>
      </div>
    </div>
  );
});
