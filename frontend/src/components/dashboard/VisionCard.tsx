import React from 'react';
import { Camera, Flame, Eye } from 'lucide-react';
import { VisionLog } from '@/types';
import { ConfidenceBar } from '@/components/ui/ConfidenceBar';
import { fmtTime } from '@/lib/utils';

export function VisionCard({ latestVision }: { latestVision: VisionLog | null }) {
  return (
    <div className="card overflow-hidden flex flex-col">
      <div className="px-5 py-3 border-b border-ctp-crust flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera size={16} className="text-ctp-lavender" />
          <span className="text-sm font-semibold text-ctp-text">Vision Feed</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-ctp-green font-semibold">
          <span className="w-2 h-2 rounded-full bg-ctp-green animate-pulse" />
          LIVE
        </div>
      </div>
      <div className={`relative aspect-video flex items-center justify-center transition-colors duration-300 ${latestVision && latestVision.fire_confidence > 0 ? "bg-red-50" : "bg-ctp-crust"}`}>
        {/* Rendering live logic dynamically managed from parent or MJPEG placeholder */}
        {latestVision && latestVision.fire_confidence > 0 ? (
          <>
            <div className="absolute inset-0 border-4 border-ctp-red animate-pulse pointer-events-none z-10" />
            <Flame size={48} strokeWidth={1.5} className="text-ctp-red" />
          </>
        ) : (
          <Eye size={48} strokeWidth={1} className="text-ctp-surface1" />
        )}
        <span className="absolute top-2 left-2 bg-black/50 text-white text-[10px] font-mono px-2 py-0.5 rounded z-20">CAM-01</span>
      </div>
      <div className="p-5 space-y-4 flex-1">
        <ConfidenceBar label="Fire" value={latestVision?.fire_confidence ?? 0} color="#d20f39" threshold={0.6} />
        <ConfidenceBar label="Smoke" value={latestVision?.smoke_confidence ?? 0} color="#fe640b" threshold={0.4} />
        <p className="text-[10px] text-ctp-overlay0 font-mono tabular-nums pt-1">
          Last detection: {latestVision ? fmtTime(latestVision.recorded_at) : "No events"}
        </p>
      </div>
    </div>
  );
}
