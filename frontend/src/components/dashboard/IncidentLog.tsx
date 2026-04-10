import React from 'react';
import { Bell, ShieldCheck } from 'lucide-react';
import { FusionAlert } from '@/types';
import { fmtTime } from '@/lib/utils';

export function IncidentLog({ alertsList }: { alertsList: FusionAlert[] }) {
  return (
    <div className="card flex flex-col max-h-[380px]">
      <div className="px-5 py-3 border-b border-ctp-crust flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-ctp-yellow" />
          <span className="text-sm font-semibold">Incident Log</span>
        </div>
        <span className="bg-ctp-surface0 text-ctp-subtext0 text-[10px] font-bold px-2 py-0.5 rounded-md">
          {alertsList.filter((a) => !a.is_resolved).length} active
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {alertsList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-10">
            <ShieldCheck size={28} className="text-ctp-surface1 mb-2" />
            <p className="text-sm text-ctp-overlay0">No incidents recorded.</p>
          </div>
        ) : (
          alertsList.map((a) => (
            <div key={a.id} className={`p-3 rounded-xl border transition-colors ${
              a.risk_level === "DANGER" ? "border-ctp-red/30 bg-ctp-red/5"
              : a.risk_level === "WARNING" ? "border-ctp-yellow/30 bg-ctp-yellow/5"
              : "border-ctp-crust bg-ctp-base"
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  a.risk_level === "DANGER" ? "bg-ctp-red text-white" : "bg-ctp-yellow/20 text-ctp-yellow"
                }`}>{a.risk_level}</span>
                <span className="text-[10px] font-mono text-ctp-overlay0">{fmtTime(a.triggered_at)}</span>
              </div>
              <p className="text-xs text-ctp-subtext1 leading-relaxed line-clamp-2">{a.alert_message}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
