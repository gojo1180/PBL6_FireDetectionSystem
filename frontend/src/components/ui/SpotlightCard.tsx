import React, { useRef, useState, MouseEvent } from 'react';

export interface SpotlightCardProps {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
  warn?: boolean;
}

export function SpotlightCard({
  children,
  className = "",
  spotlightColor = "rgba(255, 255, 255, 0.05)",
  warn = false,
}: SpotlightCardProps) {
  const divRef = useRef<HTMLDivElement>(null);
  
  // Track if mouse is over to optionally follow, but we will start with opacity 1
  const [isHovered, setIsHovered] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  // Center position when not hovered
  const gradientPosition = isHovered 
    ? `${position.x}px ${position.y}px`
    : `50% 50%`;

  return (
    <div 
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative overflow-hidden card transition-colors duration-300 bg-ctp-mantle border ${
        warn ? "border-ctp-red/50 shadow-[0_0_15px_rgba(237,135,150,0.2)]" : "border-ctp-crust shadow-lg"
      } ${className}`}
    >
      {/* Background Spotlight - Always Visible */}
      <div
        className="pointer-events-none absolute inset-0 z-0 transition-all duration-500"
        style={{
          background: `radial-gradient(500px circle at ${gradientPosition}, ${warn ? 'rgba(237, 135, 150, 0.2)' : spotlightColor}, transparent 70%)`,
        }}
      />
      
      {/* Warn Pulse Overlay */}
      {warn && (
        <div className="pointer-events-none absolute inset-0 z-0 animate-pulse bg-ctp-red/10" />
      )}

      {/* Inner reflection border */}
      <div className="pointer-events-none absolute inset-0 z-0 rounded-2xl border border-white/5" />

      {/* Content wrapper */}
      <div className="relative z-10 w-full h-full">
        {children}
      </div>
    </div>
  );
}
