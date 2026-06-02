"use client";

import React, { useState, useEffect } from 'react';
import { Bell, ShieldCheck } from 'lucide-react';
import { FusionAlert } from '@/types';
import { fmtTime } from '@/lib/utils';
import { resolveAlert, markAlertFeedback } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';

export function IncidentLog({ alertsList, onClearAlert }: { alertsList: FusionAlert[], onClearAlert?: () => void }) {
 const [confirmingAlertId, setConfirmingAlertId] = useState<string | null>(null);

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
 <div className="bg-surface-card backdrop-blur-md border border-hairline rounded-2xl shadow-sm flex flex-col max-h-[380px]">
 <div className="px-5 py-3 border-b border-hairline flex items-center justify-between shrink-0">
 <div className="flex items-center gap-2">
 <div className="p-1.5 rounded-lg bg-amber-500/15">
 <Bell size={14} className="text-amber-500" />
 </div>
 <span className="text-sm font-semibold text-ink">Incident Log</span>
 </div>
 <span className="bg-surface-strong text-body text-[10px] font-bold px-2.5 py-1 rounded-full">
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
 <ShieldCheck size={28} className="text-muted mb-2" />
 <p className="text-sm text-muted">No incidents recorded.</p>
 </motion.div>
 ) : (
 alertsList.map((a) => (
 <AlertItem 
 key={a.id} 
 a={a} 
 handleMarkFalseAlarm={handleMarkFalseAlarm}
 setConfirmingAlertId={setConfirmingAlertId}
 />
 ))
 )}
 </AnimatePresence>
 </div>

 {/* CONFIRMATION MODAL */}
 {confirmingAlertId && (
 <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm px-4">
 <div className="bg-surface-card backdrop-blur-md p-6 rounded-2xl border border-hairline shadow-2xl max-w-md w-full animate-in fade-in zoom-in-95 duration-200">
 <div className="flex items-center gap-3 mb-4">
 <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
 <ShieldCheck size={20} className="text-red-500" />
 </div>
 <h3 className="text-lg font-bold text-ink">Konfirmasi Resolusi Alert</h3>
 </div>
 <p className="text-sm text-body mb-6 leading-relaxed">
 Apakah Anda yakin kondisi di lokasi sudah benar-benar aman? Tindakan ini akan menyembunyikan peringatan dari layar utama.
 </p>
 <div className="flex items-center justify-end gap-3">
 <button 
 onClick={() => setConfirmingAlertId(null)} 
 className="px-4 py-2.5 rounded-xl text-sm font-semibold text-body hover:bg-surface-card-elevated transition-colors"
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

// ─── Extracted AlertItem Component ──────────────────────────────────────────
// Using React.memo prevents the item from re-rendering unless its props change.
// This localizes the "lingering" timeout state, eliminating the need for a global interval.
const AlertItem = React.memo(({ 
 a, 
 handleMarkFalseAlarm, 
 setConfirmingAlertId 
}: { 
 a: FusionAlert, 
 handleMarkFalseAlarm: (id: string) => void, 
 setConfirmingAlertId: (id: string) => void 
}) => {
 const initialAge = Date.now() - new Date(a.triggered_at).getTime();
 const [isLingering, setIsLingering] = useState(() => !a.is_resolved && initialAge >= 10000);

 useEffect(() => {
 if (a.is_resolved || isLingering) return;

 const age = Date.now() - new Date(a.triggered_at).getTime();
 if (age >= 10000) {
 setIsLingering(true);
 } else {
 const timeout = setTimeout(() => setIsLingering(true), 10000 - age);
 return () => clearTimeout(timeout);
 }
 }, [a.is_resolved, a.triggered_at, isLingering]);

 const isBlinking = !a.is_resolved && !isLingering;
 const displayMessage = isLingering ? "Menunggu Verifikasi Keamanan..." : a.alert_message;

 return (
 <motion.div
 layout
 initial={{ opacity: 0, y: -10 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
 transition={{ duration: 0.2 }}
 className={`p-3.5 rounded-xl border transition-colors ${
 isBlinking ? 'animate-pulse ' : ''
 }${
 a.risk_level === "FIRE_DANGER" || a.risk_level === "DANGER" ? "border-red-500/30 bg-red-500/10"
 : a.risk_level === "CCTV_ALERT" || a.risk_level === "WARNING" ? "border-amber-500/30 bg-amber-500/10"
 : a.risk_level === "SENSOR_ALERT" ? "border-yellow-500/30 bg-yellow-500/10"
 : "border-hairline bg-surface-card-elevated"
 }`}
 >
 <div className="flex items-center justify-between mb-1.5">
 <div className="flex items-center gap-2">
 <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${a.risk_level === "FIRE_DANGER" || a.risk_level === "DANGER" ? "bg-red-500 text-white"
          : a.risk_level === "CCTV_ALERT" || a.risk_level === "WARNING" ? "bg-amber-500 text-white"
          : "bg-yellow-500/15 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400"
        }`}>{a.risk_level}</span>
 <span className="text-[10px] font-mono text-muted">{fmtTime(a.triggered_at)}</span>
 </div>
 <div className="flex items-center gap-2">
 {a.is_false_positive == null && (
 <button
 onClick={() => handleMarkFalseAlarm(a.id)}
 title="Mark as False Alarm (Used for retraining)"
 className="text-[10px] text-amber-600 hover:text-white bg-amber-500/15 hover:bg-amber-500 px-2 py-0.5 rounded-full transition-colors"
 >
 False Alarm
 </button>
 )}
 {!a.is_resolved && (
 <button
 onClick={() => setConfirmingAlertId(a.id)}
 className="text-[10px] text-body hover:text-white bg-surface-strong hover:bg-surface-card-elevated0 px-2 py-0.5 rounded-full transition-colors"
 >
 Clear
 </button>
 )}
 </div>
 </div>
 <p className={`text-xs leading-relaxed line-clamp-2 ${isLingering ? 'text-muted italic' : 'text-body'}`}>
 {displayMessage}
 </p>
 </motion.div>
 );
});
