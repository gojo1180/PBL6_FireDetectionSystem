import React from "react";

export function StatusPill({ active, activeLabel, inactiveLabel }: { active: boolean; activeLabel: string; inactiveLabel: string }) {
  return (
    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${active ? "bg-ctp-red/15 text-ctp-red" : "bg-ctp-surface0 text-ctp-overlay0"}`}>
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}
