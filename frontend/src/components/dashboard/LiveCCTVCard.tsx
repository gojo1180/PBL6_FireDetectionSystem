"use client";

import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import { Camera, WifiOff, RefreshCw, ShieldCheck, ShieldAlert } from "lucide-react";
import { VisionLog } from "@/types";
import { ConfidenceBar } from "@/components/ui/ConfidenceBar";
import { fmtTime } from "@/lib/utils";

// ─── Configuration ──────────────────────────────────────────────────────
const STREAM_TIMEOUT = 10000; // ms before marking stream as offline
const RECONNECT_INTERVAL = 6000; // auto-retry interval when offline

// ─── Props ──────────────────────────────────────────────────────────────
interface LiveCCTVCardProps {
  /** Latest vision log data for confidence bars */
  latestVision: VisionLog | null;
  /** If true, the card enters "danger" mode (red ring + red LIVE dot) */
  isDanger?: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────
export const LiveCCTVCard = memo(function LiveCCTVCard({
  latestVision,
  isDanger = false,
}: LiveCCTVCardProps) {
  const [streamUrl, setStreamUrl] = useState("");
  const [isOffline, setIsOffline] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);

  const streamTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  const API_BASE =
    process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  // ── Connect / reconnect to MJPEG stream ───────────────────────────
  const connectStream = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current);

    setIsOffline(false);
    setIsReconnecting(false);

    // Cache-bust with timestamp so the browser never serves a stale response
    const url = `${API_BASE}/api/v1/vision/stream?t=${Date.now()}`;
    setStreamUrl(url);

    // If the <img> doesn't fire onLoad within STREAM_TIMEOUT → offline
    streamTimeoutRef.current = setTimeout(() => {
      setIsOffline(true);
    }, STREAM_TIMEOUT);
  }, [API_BASE]);

  // Initial connection on mount
  useEffect(() => {
    connectStream();
    return () => {
      if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [connectStream]);

  // Auto-reconnect when offline
  useEffect(() => {
    if (isOffline && !isReconnecting) {
      setIsReconnecting(true);
      reconnectTimerRef.current = setTimeout(() => {
        setReconnectCount((prev) => prev + 1);
        connectStream();
      }, RECONNECT_INTERVAL);
    }
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [isOffline, isReconnecting, connectStream]);

  const handleStreamLoad = () => {
    if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current);
    setIsOffline(false);
    setIsReconnecting(false);
    setReconnectCount(0);
  };

  const handleStreamError = () => {
    if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current);
    setIsOffline(true);
  };

  const handleRetry = () => {
    setReconnectCount(0);
    connectStream();
  };

  // ── Derived styles based on danger state ───────────────────────────
  const liveDotColor = isDanger ? "bg-rose-500" : "bg-emerald-500";
  const liveLabelColor = isDanger ? "text-rose-500" : "text-emerald-500";
  const dangerRing = isDanger
    ? "ring-2 ring-rose-500/60 animate-pulse"
    : "";

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden flex flex-col">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-violet-50">
            <Camera size={14} className="text-violet-500" />
          </div>
          <span className="text-sm font-semibold text-slate-700">
            Live Area Monitor
          </span>
        </div>

        {/* LIVE / OFFLINE indicator */}
        {isOffline ? (
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-slate-300" />
            OFFLINE
          </div>
        ) : (
          <div className={`flex items-center gap-1.5 text-xs font-semibold ${liveLabelColor}`}>
            <span className={`w-2 h-2 rounded-full ${liveDotColor} animate-pulse`} />
            LIVE
          </div>
        )}
      </div>

      {/* ── Stream / Fallback ────────────────────────────────────── */}
      <div
        className={`relative aspect-video bg-slate-50 overflow-hidden transition-all duration-300 ${dangerRing}`}
      >
        {/* Online stream */}
        <div
          className={`absolute inset-0 transition-opacity duration-500 ${isOffline ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
        >
          {streamUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={streamUrl}
              alt="Live CCTV Stream"
              className="w-full h-full object-cover rounded-lg"
              onLoad={handleStreamLoad}
              onError={handleStreamError}
            />
          )}
        </div>

        {/* Offline fallback */}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-500 ${isOffline ? "opacity-100" : "opacity-0 pointer-events-none"
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
              Tidak dapat terhubung ke stream kamera. Sistem akan otomatis mencoba kembali.
            </p>

            {/* Reconnecting status */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200">
              <RefreshCw
                size={12}
                className={`text-indigo-500 ${isReconnecting ? "animate-spin" : ""}`}
              />
              <span className="text-[11px] text-slate-500 font-mono">
                {isReconnecting
                  ? `Menghubungkan... (${reconnectCount + 1})`
                  : "Menunggu..."}
              </span>
            </div>

            <button
              onClick={handleRetry}
              className="mt-1 px-4 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 hover:border-indigo-300 transition-all duration-200 active:scale-95"
            >
              Coba Lagi
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
          !isOffline && (
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
