import React, { useState, useEffect, memo } from 'react';
import Image from 'next/image';
import { Camera, Flame, Eye, ImageOff, RefreshCw } from 'lucide-react';
import { VisionLog } from '@/types';
import { ConfidenceBar } from '@/components/ui/ConfidenceBar';
import { fmtTime } from '@/lib/utils';

export const VisionCard = memo(function VisionCard({ latestVision }: { latestVision: VisionLog | null }) {
 const [imgError, setImgError] = useState(false);
 
 // Reset error state when image URL changes
 useEffect(() => {
 setImgError(false);
 }, [latestVision?.image_url]);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
  const handleRetry = async () => {
    try {
      await fetch(`${API_BASE}/api/v1/vision/rtsp/retry`, { method: "POST" });
    } catch (err) {
      console.warn("RTSP retry notification failed", err);
    }
  };

 return (
 <div className="bg-surface-card border border-hairline rounded-2xl shadow-sm overflow-hidden flex flex-col">
 <div className="px-5 py-3 border-b border-hairline flex items-center justify-between">
 <div className="flex items-center gap-2">
 <div className="p-1.5 rounded-lg bg-violet-500/15">
 <Camera size={14} className="text-violet-500" />
 </div>
 <span className="text-sm font-semibold text-ink">Vision Feed</span>
 </div>
 <div className="flex items-center gap-3">
          <button 
            onClick={handleRetry}
            className="px-3 py-1.5 text-[10px] sm:text-[11px] font-bold text-white bg-primary hover:bg-primary/90 border border-transparent rounded-lg flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
          >
            <RefreshCw size={12} /> RETRY RTSP
          </button>
 <div className="flex items-center gap-1.5 text-xs text-emerald-500 font-semibold">
 <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
 LIVE
 </div>
 </div>
 </div>
 
 <div className={`relative aspect-video flex items-center justify-center transition-colors duration-300 ${latestVision && latestVision.fire_confidence > 0.5 ? "bg-red-500/15" : "bg-surface-card-elevated"}`}>
 
 {latestVision?.image_url && !imgError ? (
 <Image 
 src={latestVision.image_url}
 alt="Fire detection feed"
 fill
 className="object-contain bg-black transition-opacity duration-300"
 onError={() => setImgError(true)}
 unoptimized // Useful for rapidly changing URLs
 />
 ) : (
 <div className="flex flex-col items-center gap-2">
 {latestVision && latestVision.fire_confidence > 0.55 ? (
 <>
 <div className="absolute inset-0 border-4 border-red-500 animate-pulse pointer-events-none z-10" />
 <Flame size={48} strokeWidth={1.5} className="text-red-500" />
 </>
 ) : (
 imgError ? (
 <div className="text-center">
 <ImageOff size={40} className="text-muted mx-auto" />
 <p className="text-[10px] text-muted mt-2">Image Load Failed</p>
 </div>
 ) : (
 <Eye size={48} strokeWidth={1} className="text-slate-200" />
 )
 )}
 </div>
 )}
 
 <span className="absolute top-2 left-2 bg-black/50 text-white text-[10px] font-mono px-2 py-0.5 rounded z-20">CAM-01</span>
 </div>

 <div className="p-5 space-y-4 flex-1">
 <ConfidenceBar label="Fire" value={latestVision?.fire_confidence ?? 0} color="#d20f39" threshold={0.55} />
 <ConfidenceBar label="Smoke" value={latestVision?.smoke_confidence ?? 0} color="#fe640b" threshold={0.50} />
 <p className="text-[10px] text-muted font-mono tabular-nums pt-1">
 Last detection: {latestVision ? fmtTime(latestVision.recorded_at) : "No events"}
 </p>
 </div>
 </div>
 );
});
