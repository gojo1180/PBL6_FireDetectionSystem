"use client";

import React, { memo } from 'react';
import { Activity } from 'lucide-react';
import {
 LineChart, Line, XAxis, YAxis, CartesianGrid,
 Tooltip, ResponsiveContainer, Legend
} from 'recharts';

export interface ChartPoint {
 time: string;
 CO: number;
 LPG: number;
 Smoke: number;
 CNG: number;
}

export const GasTrendChart = memo(function GasTrendChart({ chartData }: { chartData: ChartPoint[] }) {
 return (
 <div className="bg-surface-card backdrop-blur-md border border-hairline rounded-2xl shadow-sm p-6">
 <div className="flex items-center justify-between mb-6">
 <div>
 <h3 className="text-sm font-bold text-ink">Gas Concentration Trend</h3>
 <p className="text-xs text-muted mt-0.5">Last 15 readings · realtime</p>
 </div>
 <div className="p-2 rounded-lg bg-primary/10">
 <Activity size={16} className="text-indigo-400" />
 </div>
 </div>
 {chartData.length > 0 ? (
 <ResponsiveContainer width="100%" height={260}>
 <LineChart data={chartData}>
 <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
 <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
 <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} width={40} />
 <Tooltip
 contentStyle={{
 background: "rgba(255, 255, 255, 0.8)",
 backdropFilter: "blur(8px)",
 border: "1px solid rgba(255, 255, 255, 0.3)",
 borderRadius: "12px",
 fontSize: "12px",
 color: "#334155",
 boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.05)"
 }}
 />
 <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px", color: "#64748b" }} />
 <Line type="monotone" dataKey="CO" stroke="#f59e0b" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: "#f59e0b", stroke: "#fff", strokeWidth: 2 }} />
 <Line type="monotone" dataKey="LPG" stroke="#14b8a6" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: "#14b8a6", stroke: "#fff", strokeWidth: 2 }} />
 <Line type="monotone" dataKey="Smoke" stroke="#8b5cf6" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: "#8b5cf6", stroke: "#fff", strokeWidth: 2 }} />
 <Line type="monotone" dataKey="CNG" stroke="#6366f1" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: "#6366f1", stroke: "#fff", strokeWidth: 2 }} />
 </LineChart>
 </ResponsiveContainer>
 ) : (
 <div className="h-[260px] flex items-center justify-center text-sm text-muted">Waiting for sensor data…</div>
 )}
 </div>
 );
});
