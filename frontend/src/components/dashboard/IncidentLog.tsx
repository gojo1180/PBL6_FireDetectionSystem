"use client";

import React, { useState, useEffect } from 'react';
import { Bell, ShieldCheck } from 'lucide-react';
import { FusionAlert } from '@/types';
import { fmtTime } from '@/lib/utils';
import { resolveAlert, markAlertFeedback } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';

export function IncidentLog({ alertsList, onClearAlert }: { alertsList: FusionAlert[], onClearAlert?: () => void }) {
  const [now, setNow] = useState(new Date().getTime());
  const [confirmingAlertId, setConfirmingAlertId] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date().getTime()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleClear = async () => {
    if (!confirmingAlertId) return;
    try {
      await resolveAlert(confirmingAlertId);
      setConfirmingAlertId(null);
      if (onClearAlert) onClearAlert();
    } catch (e) {
      console.error("Failed to clear alert", e);
    }
  };

  const handleMarkFalseAlarm = async (alertId: string) => {
    try {
      await markAlertFeedback(alertId, true);
      if (onClearAlert) onClearAlert();
    } catch (e) {
      console.error("Failed to mark alert as false alarm", e);
    }
  };

  return (
    <div className="bg-white/60 backdrop-blur-md border border-slate-200/40 rounded-2xl shadow-sm flex flex-col max-h-[380px]">
      <div className="px-5 py-3 border-b border-slate-200/40 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-50">
            <Bell size={14} className="text-amber-500" />
          </div>
          <span className="text-sm font-semibold text-slate-700">Incident Log</span>
        </div>
        <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2.5 py-1 rounded-full">
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
              <ShieldCheck size={28} className="text-slate-200 mb-2" />
              <p className="text-sm text-slate-400">No incidents recorded.</p>
            </motion.div>
          ) : (
            alertsList.map((a) => {
              const age = now - new Date(a.triggered_at).getTime();
              const isLingering = !a.is_resolved && age >= 10000;
              const isBlinking = !a.is_resolved && !isLingering;
              const displayMessage = isLingering ? "Menunggu Verifikasi Keamanan..." : a.alert_message;

              return (
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
                  className={`p-3.5 rounded-xl border transition-colors ${
                    isBlinking ? 'animate-pulse ' : ''
                  }${
                    a.risk_level === "FIRE_DANGER" || a.risk_level === "DANGER" ? "border-red-200 bg-red-50/60"
                      : a.risk_level === "CCTV_ALERT" || a.risk_level === "WARNING" ? "border-amber-200 bg-amber-50/60"
                        : a.risk_level === "SENSOR_ALERT" ? "border-yellow-200 bg-yellow-50/60"
                          : "border-slate-100 bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${a.risk_level === "FIRE_DANGER" || a.risk_level === "DANGER" ? "bg-red-500 text-white"
                          : a.risk_level === "CCTV_ALERT" || a.risk_level === "WARNING" ? "bg-amber-500 text-white"
                            : "bg-yellow-100 text-yellow-700"
                        }`}>{a.risk_level}</span>
                      <span className="text-[10px] font-mono text-slate-400">{fmtTime(a.triggered_at)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {a.is_false_positive == null && (
                        <button
                          onClick={() => handleMarkFalseAlarm(a.id)}
                          title="Mark as False Alarm (Used for retraining)"
                          className="text-[10px] text-amber-600 hover:text-white bg-amber-50 hover:bg-amber-500 px-2 py-0.5 rounded-full transition-colors"
                        >
                          False Alarm
                        </button>
                      )}
                      {!a.is_resolved && (
                        <button
                          onClick={() => setConfirmingAlertId(a.id)}
                          className="text-[10px] text-slate-500 hover:text-white bg-slate-100 hover:bg-slate-500 px-2 py-0.5 rounded-full transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                  <p className={`text-xs leading-relaxed line-clamp-2 ${isLingering ? 'text-slate-400 italic' : 'text-slate-600'}`}>
                    {displayMessage}
                  </p>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* CONFIRMATION MODAL */}
      {confirmingAlertId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm px-4">
          <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-slate-200/50 shadow-2xl max-w-md w-full animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <ShieldCheck size={20} className="text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Konfirmasi Resolusi Alert</h3>
            </div>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              Apakah Anda yakin kondisi di lokasi sudah benar-benar aman? Tindakan ini akan menyembunyikan peringatan dari layar utama.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button 
                onClick={() => setConfirmingAlertId(null)} 
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={handleClear} 
                className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-500 text-white hover:bg-red-600 transition-all shadow-lg shadow-red-500/25 active:scale-95"
              >
                Ya, Tandai Aman
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
