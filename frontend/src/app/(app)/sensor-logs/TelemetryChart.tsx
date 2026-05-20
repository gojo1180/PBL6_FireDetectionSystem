"use client";

import React from "react";
import { SensorLog } from "@/types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ─── Composio Design Tokens (dark mode) ──────────────────────────────
const COLORS = {
  hairlineSoft: "#1a1a1a",
  muted: "#888888",
  mutedSoft: "#666666",
  surfaceCardElevated: "#222222",
  hairline: "#222222",
  ink: "#ffffff",
  body: "#a8a8a8",
  canvas: "#0f0f0f",
};

const LINE_COLORS = {
  temperature: "#5e6ad2", // Lavender-blue (primary)
  cng: "#22c55e",         // Green
  co: "#f59e0b",          // Amber
  flame: "#ef4444",       // Red
};

// ─── Format timestamp for X axis ─────────────────────────────────────
function fmtAxisTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function fmtTooltipTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("id-ID", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ─── Custom Tooltip ──────────────────────────────────────────────────
function ComposioTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      style={{
        background: COLORS.surfaceCardElevated,
        border: `1px solid ${COLORS.hairline}`,
        borderRadius: "8px",
        padding: "14px 18px",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "12px",
        color: COLORS.body,
        minWidth: "220px",
      }}
    >
      <p
        style={{
          color: COLORS.ink,
          fontSize: "11px",
          fontWeight: 600,
          marginBottom: "10px",
          letterSpacing: "0.5px",
          textTransform: "uppercase",
        }}
      >
        {fmtTooltipTime(label)}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {payload.map((entry: any, idx: number) => (
          <div
            key={idx}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "2px",
                  background: entry.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ color: COLORS.mutedSoft }}>{entry.name}</span>
            </span>
            <span style={{ color: COLORS.ink, fontWeight: 500 }}>
              {typeof entry.value === "number" ? entry.value.toFixed(2) : entry.value}
              {entry.name === "Temperature" ? "°C" : entry.name === "Flame" ? "" : " ppm"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Chart Component ─────────────────────────────────────────────────
interface TelemetryChartProps {
  data: (SensorLog & { is_anomaly?: boolean })[];
  loading: boolean;
}

export default function TelemetryChart({ data, loading }: TelemetryChartProps) {
  if (loading) {
    return (
      <div className="h-[480px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-[12px] font-mono text-muted">Memuat data grafik…</p>
        </div>
      </div>
    );
  }

  // Reduce X-axis label density based on data length
  const tickInterval = data.length > 200 ? Math.floor(data.length / 12) : data.length > 50 ? Math.floor(data.length / 8) : 0;

  return (
    <ResponsiveContainer width="100%" height={480}>
      <LineChart data={data} margin={{ top: 16, right: 24, bottom: 8, left: 8 }}>
        <CartesianGrid
          vertical={false}
          stroke={COLORS.hairlineSoft}
          strokeDasharray="none"
        />
        <XAxis
          dataKey="recorded_at"
          tickFormatter={fmtAxisTime}
          tick={{
            fontSize: 11,
            fill: COLORS.muted,
            fontFamily: "'JetBrains Mono', monospace",
          }}
          tickLine={false}
          axisLine={{ stroke: COLORS.hairlineSoft }}
          interval={tickInterval}
          angle={-30}
          textAnchor="end"
          height={60}
        />
        <YAxis
          tick={{
            fontSize: 11,
            fill: COLORS.muted,
            fontFamily: "'JetBrains Mono', monospace",
          }}
          tickLine={false}
          axisLine={false}
          width={50}
        />
        <Tooltip content={<ComposioTooltip />} />

        {/* Temperature line */}
        <Line
          type="monotone"
          dataKey="temperature"
          name="Temperature"
          stroke={LINE_COLORS.temperature}
          strokeWidth={2}
          dot={false}
          activeDot={{
            r: 4,
            fill: LINE_COLORS.temperature,
            stroke: COLORS.surfaceCardElevated,
            strokeWidth: 2,
          }}
        />

        {/* MQ-4 (CNG / Methane) */}
        <Line
          type="monotone"
          dataKey="cng_level"
          name="MQ-4 (CNG)"
          stroke={LINE_COLORS.cng}
          strokeWidth={2}
          dot={false}
          activeDot={{
            r: 4,
            fill: LINE_COLORS.cng,
            stroke: COLORS.surfaceCardElevated,
            strokeWidth: 2,
          }}
        />

        {/* MQ-9 (CO) */}
        <Line
          type="monotone"
          dataKey="co_level"
          name="MQ-9 (CO)"
          stroke={LINE_COLORS.co}
          strokeWidth={2}
          dot={false}
          activeDot={{
            r: 4,
            fill: LINE_COLORS.co,
            stroke: COLORS.surfaceCardElevated,
            strokeWidth: 2,
          }}
        />

        {/* Flame */}
        <Line
          type="monotone"
          dataKey="flame_detected"
          name="Flame"
          stroke={LINE_COLORS.flame}
          strokeWidth={2}
          dot={false}
          strokeDasharray="6 3"
          activeDot={{
            r: 4,
            fill: LINE_COLORS.flame,
            stroke: COLORS.surfaceCardElevated,
            strokeWidth: 2,
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
