"use client";

import React from 'react';
import { Bell, ShieldCheck } from 'lucide-react';
import { FusionAlert } from '@/types';
import { fmtTime } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';

export function IncidentLog({ alertsList, onClearAlert }: { alertsList: FusionAlert[], onClearAlert?: () => void }) {
  const handleClear = async (id: string) => {
    try {
      await apiFetch(`/api/v1/alerts/${id}/resolve`, { method: "PATCH" });
      if (onClearAlert) onClearAlert();
    } catch (e) {
      console.error("Failed to clear alert", e);
    }
  };
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
      <div className="flex-1 overflow-y-auto p-4 space-y-3 overflow-x-hidden">
        <AnimatePresence mode="popLayout" initial={true}>
          {alertsList.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className="flex flex-col items-center justify-center h-full text-center py-10"
            >
              <ShieldCheck size={28} className="text-ctp-surface1 mb-2" />
              <p className="text-sm text-ctp-overlay0">No incidents recorded.</p>
            </motion.div>
          ) : (
            alertsList.map((a, index) => (
              <motion.div
                key={a.id}
                layout
                initial={{ scale: 0.8, opacity: 0, x: 20 }}
                whileInView={{ scale: 1, opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "10px" }}
                exit={{ scale: 0.8, opacity: 0, x: -20, transition: { duration: 0.2 } }}
                transition={{
                  type: "spring",
                  stiffness: 350,
                  damping: 25
                }}
                className={`p-3 rounded-xl border transition-colors ${a.risk_level === "FIRE_DANGER" || a.risk_level === "DANGER" ? "border-ctp-red/30 bg-ctp-red/5"
                    : a.risk_level === "CCTV_ALERT" || a.risk_level === "WARNING" ? "border-ctp-peach/30 bg-ctp-peach/5"
                      : a.risk_level === "SENSOR_ALERT" ? "border-ctp-yellow/30 bg-ctp-yellow/5"
                        : "border-ctp-crust bg-ctp-base"
                  }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${a.risk_level === "FIRE_DANGER" || a.risk_level === "DANGER" ? "bg-ctp-red text-white"
                        : a.risk_level === "CCTV_ALERT" || a.risk_level === "WARNING" ? "bg-ctp-peach text-white"
                          : "bg-ctp-yellow/20 text-ctp-yellow"
                      }`}>{a.risk_level}</span>
                    <span className="text-[10px] font-mono text-ctp-overlay0">{fmtTime(a.triggered_at)}</span>
                  </div>
                  {!a.is_resolved && (
                    <button
                      onClick={() => handleClear(a.id)}
                      className="text-[10px] text-ctp-subtext0 hover:text-ctp-text bg-ctp-surface0 hover:bg-ctp-surface1 px-2 py-0.5 rounded transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <p className="text-xs text-ctp-subtext1 leading-relaxed line-clamp-2">{a.alert_message}</p>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
