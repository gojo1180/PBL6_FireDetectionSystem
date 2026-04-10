"use client";

import React from 'react';
import { Activity } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';

export interface ChartPoint {
  time: string;
  CNG: number;
  CO: number;
  LPG: number;
}

export function GasTrendChart({ chartData }: { chartData: ChartPoint[] }) {
  return (
    <div className="lg:col-span-2 card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-bold text-ctp-text">Gas Concentration Trend</h3>
          <p className="text-xs text-ctp-subtext0 mt-0.5">Last 15 readings · realtime</p>
        </div>
        <Activity size={16} className="text-ctp-overlay0" />
      </div>
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ccd0da" />
            <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#9ca0b0" }} tickLine={false} axisLine={{ stroke: "#ccd0da" }} />
            <YAxis tick={{ fontSize: 10, fill: "#9ca0b0" }} tickLine={false} axisLine={{ stroke: "#ccd0da" }} width={40} />
            <Tooltip contentStyle={{ background: "#e6e9ef", border: "1px solid #dce0e8", borderRadius: "12px", fontSize: "12px", color: "#4c4f69" }} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px", color: "#6c6f85" }} />
            <Line type="monotone" dataKey="CNG" stroke="#1e66f5" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            <Line type="monotone" dataKey="CO" stroke="#fe640b" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            <Line type="monotone" dataKey="LPG" stroke="#179299" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[260px] flex items-center justify-center text-sm text-ctp-overlay0">Waiting for sensor data…</div>
      )}
    </div>
  );
}
