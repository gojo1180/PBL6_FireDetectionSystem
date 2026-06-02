"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, X, Sparkles, Box, Radio } from "lucide-react";

export interface TourStep {
 targetId: string;
 title: string;
 description: string;
 type: "section" | "button" | "center";
}

interface TutorialTourProps {
 active: boolean;
 steps: TourStep[];
 onClose: () => void;
 onComplete: () => void;
}

export function TutorialTour({ active, steps, onClose, onComplete }: TutorialTourProps) {
 const [currentStep, setCurrentStep] = useState(0);
 const [rect, setRect] = useState<DOMRect | null>(null);
 const tooltipRef = useRef<HTMLDivElement>(null);
 const [tooltipHeight, setTooltipHeight] = useState(200);

 // Measure tooltip height when step changes
 useEffect(() => {
 if (active && tooltipRef.current) {
 const h = tooltipRef.current.getBoundingClientRect().height;
 if (h > 0) {
 setTooltipHeight(h);
 }
 }
 }, [currentStep, active]);

 useEffect(() => {
 if (!active) return;
 const handleResize = () => {
 if (tooltipRef.current) {
 const h = tooltipRef.current.getBoundingClientRect().height;
 if (h > 0) setTooltipHeight(h);
 }
 };
 window.addEventListener("resize", handleResize);
 return () => window.removeEventListener("resize", handleResize);
 }, [active]);

 // Sync / reset step when activated
 useEffect(() => {
 if (active) {
 setCurrentStep(0);
 }
 }, [active]);

 // Track target element dimensions and position
 useEffect(() => {
 if (!active) return;
 const step = steps[currentStep];
 if (!step || step.type === "center" || step.targetId === "center") {
 setRect(null);
 return;
 }

 const element = document.getElementById(step.targetId);
 if (element) {
 const updateRect = () => {
 const r = element.getBoundingClientRect();
 if (r.width > 0 && r.height > 0) {
 setRect(r);
 }
 };

 // Auto-open mobile sidebar if we are highlighting a sidebar element on mobile
 const isSidebarTarget = step.targetId === "logout-btn" || step.targetId.startsWith("sidebar-link-");
 if (isSidebarTarget && window.innerWidth < 1024) {
 const rectBefore = element.getBoundingClientRect();
 const isHidden = rectBefore.left < 0 || rectBefore.width === 0;
 if (isHidden) {
 const sidebarToggle = document.getElementById("mobile-sidebar-toggle");
 if (sidebarToggle) {
 sidebarToggle.click();
 // Wait for sidebar slide-in animation to complete
 const animTimer = setTimeout(updateRect, 350);
 window.addEventListener("resize", updateRect);
 window.addEventListener("scroll", updateRect);
 return () => {
 clearTimeout(animTimer);
 window.removeEventListener("resize", updateRect);
 window.removeEventListener("scroll", updateRect);
 };
 }
 }
 }

 // Smooth scroll target element into center of viewport
 element.scrollIntoView({ behavior: "smooth", block: "center" });

 // Run multiple rect updates to handle smooth scrolling and layout shifts
 updateRect();
 const t1 = setTimeout(updateRect, 100);
 const t2 = setTimeout(updateRect, 350);
 const t3 = setTimeout(updateRect, 600);
 const t4 = setTimeout(updateRect, 1000);
 
 window.addEventListener("resize", updateRect);
 window.addEventListener("scroll", updateRect);

 return () => {
 clearTimeout(t1);
 clearTimeout(t2);
 clearTimeout(t3);
 clearTimeout(t4);
 window.removeEventListener("resize", updateRect);
 window.removeEventListener("scroll", updateRect);
 };
 } else {
 setRect(null);
 }
 }, [currentStep, active, steps]);

 if (!active) return null;

 const currentStepData = steps[currentStep];
 const isLastStep = currentStep === steps.length - 1;
 const stepType = currentStepData.type || "section";

 // Dynamic padding & rx based on type
 const padding = stepType === "button" ? 4 : stepType === "section" ? 16 : 8;
 const rx = stepType === "button" ? 8 : stepType === "section" ? 16 : 12;

 const closeMobileSidebar = () => {
 const closeBtn = document.getElementById("mobile-sidebar-close");
 if (closeBtn) {
 closeBtn.click();
 } else {
 const overlay = document.getElementById("mobile-sidebar-overlay");
 if (overlay) overlay.click();
 }
 };

 const handleNext = () => {
 const nextStep = steps[currentStep + 1];
 const isCurrentSidebar = currentStepData.targetId === "logout-btn" || currentStepData.targetId.startsWith("sidebar-link-");
 const isNextSidebar = nextStep && (nextStep.targetId === "logout-btn" || nextStep.targetId.startsWith("sidebar-link-"));
 
 if (isCurrentSidebar && !isNextSidebar && window.innerWidth < 1024) {
 closeMobileSidebar();
 }
 
 if (isLastStep) {
 onComplete();
 } else {
 setCurrentStep((prev) => prev + 1);
 }
 };

 const handlePrev = () => {
 const prevStep = steps[currentStep - 1];
 const isCurrentSidebar = currentStepData.targetId === "logout-btn" || currentStepData.targetId.startsWith("sidebar-link-");
 const isPrevSidebar = prevStep && (prevStep.targetId === "logout-btn" || prevStep.targetId.startsWith("sidebar-link-"));
 
 if (isCurrentSidebar && !isPrevSidebar && window.innerWidth < 1024) {
 closeMobileSidebar();
 }
 
 if (currentStep > 0) {
 setCurrentStep((prev) => prev - 1);
 }
 };

 // Determine tooltip positioning styles based on target element bounding box
 const getTooltipStyle = (): React.CSSProperties => {
 if (!rect || stepType === "center") {
 return {
 position: "fixed",
 top: "50%",
 left: "50%",
 transform: "translate(-50%, -50%)",
 zIndex: 9999,
 };
 }

 const tooltipWidth = Math.min(340, window.innerWidth - 32);
 const spaceAbove = rect.top;
 const spaceBelow = window.innerHeight - rect.bottom;

 const leftPos = Math.max(
 16,
 Math.min(window.innerWidth - tooltipWidth - 16, rect.left + rect.width / 2 - tooltipWidth / 2)
 );

 const margin = 16;

 if (spaceBelow >= tooltipHeight + margin) {
 return {
 position: "fixed",
 top: `${rect.bottom + 12}px`,
 left: `${leftPos}px`,
 width: `${tooltipWidth}px`,
 zIndex: 9999,
 };
 } 
 
 if (spaceAbove >= tooltipHeight + margin) {
 return {
 position: "fixed",
 top: `${rect.top - tooltipHeight - 12}px`,
 left: `${leftPos}px`,
 width: `${tooltipWidth}px`,
 zIndex: 9999,
 };
 }

 // Fallback: Place at bottom of viewport if element is too tall and overlaps
 return {
 position: "fixed",
 bottom: "24px",
 left: `${leftPos}px`,
 width: `${tooltipWidth}px`,
 zIndex: 9999,
 };
 };

 return (
 <div className="fixed inset-0 z-[9990] overflow-hidden pointer-events-none">
 {/* ─── SVG SPOTLIGHT OVERLAY ─── */}
 <AnimatePresence>
 {rect && stepType !== "center" ? (
 <svg className="fixed inset-0 w-full h-full z-[9995] pointer-events-auto">
 <defs>
 <mask id="spotlight-mask">
 {/* Cover everything with solid white (keeps it visible/dimmed) */}
 <rect width="100%" height="100%" fill="white" />
 {/* Black cutout creates transparent hole */}
 <rect
 x={rect.x - padding}
 y={rect.y - padding}
 width={rect.width + padding * 2}
 height={rect.height + padding * 2}
 rx={rx}
 fill="black"
 />
 </mask>
 </defs>
 <g mask="url(#spotlight-mask)">
 <rect
 width="100%"
 height="100%"
 fill="rgba(15, 23, 42, 0.65)"
 className="transition-all duration-300"
 />
 </g>
 {/* Pulsing Outline Border Around Spotlight */}
 <rect
 x={rect.x - padding}
 y={rect.y - padding}
 width={rect.width + padding * 2}
 height={rect.height + padding * 2}
 rx={rx}
 fill="none"
 stroke={stepType === "button" ? "#6366f1" : "#10b981"}
 strokeWidth="2.5"
 className={stepType === "button" ? "animate-pulse" : "opacity-80"}
 />
 </svg>
 ) : (
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[9995] pointer-events-auto"
 />
 )}
 </AnimatePresence>

 {/* ─── INTERACTIVE TOOLTIP CARD ─── */}
 <AnimatePresence mode="wait">
 <motion.div
 key={currentStep}
 ref={tooltipRef}
 initial={{ opacity: 0, scale: 0.95, y: rect ? 10 : 0 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.95 }}
 transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
 style={getTooltipStyle()}
 className="bg-surface-card/90 backdrop-blur-xl border border-hairline shadow-[0_20px_50px_rgba(99,102,241,0.12)] rounded-2xl p-6 flex flex-col pointer-events-auto max-w-[90vw]"
 >
 {/* Header */}
 <div className="flex items-center justify-between mb-3.5">
 <span className="text-[10px] font-extrabold uppercase tracking-wider text-body bg-surface-card-elevated px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
 <Sparkles size={11} className="text-primary" />
 Langkah {currentStep + 1} dari {steps.length}
 </span>
 <div className="flex items-center gap-2">
 {/* Type Badge */}
 {stepType === "button" && (
 <span className="text-[9px] font-extrabold uppercase tracking-widest text-indigo-700 bg-primary/10 px-2 py-0.5 rounded border border-indigo-100 flex items-center gap-1">
 <Radio size={10} className="animate-pulse" />
 Tombol
 </span>
 )}
 {stepType === "section" && (
 <span className="text-[9px] font-extrabold uppercase tracking-widest text-emerald-700 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-100 flex items-center gap-1">
 <Box size={10} />
 Seksi
 </span>
 )}
 {stepType === "center" && (
 <span className="text-[9px] font-extrabold uppercase tracking-widest text-amber-700 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-100">
 Info
 </span>
 )}
 <button
 onClick={onClose}
 className="p-1 rounded text-muted hover:text-body hover:bg-slate-100/50 transition-colors ml-1"
 aria-label="Tutup"
 >
 <X size={14} />
 </button>
 </div>
 </div>

 {/* Title & Body */}
 <h4 className="text-sm font-extrabold text-ink tracking-tight mb-1.5 flex items-center gap-1.5">
 {currentStepData.title}
 </h4>
 <p className="text-xs text-body leading-relaxed mb-5">
 {currentStepData.description}
 </p>

 {/* Action Buttons */}
 <div className="flex items-center justify-between mt-auto pt-3 border-t border-hairline">
 <button
 onClick={handlePrev}
 disabled={currentStep === 0}
 className={`px-2.5 py-1 text-xs font-bold rounded-lg flex items-center gap-1 transition-all ${
 currentStep === 0
 ? "text-muted cursor-not-allowed"
 : "text-body hover:text-ink hover:bg-surface-card-elevated"
 }`}
 >
 <ChevronLeft size={13} />
 Kembali
 </button>

 <div className="flex items-center gap-2">
 <button
 onClick={onClose}
 className="px-2 py-1 text-xs font-semibold text-muted hover:text-body transition-colors"
 >
 Lewati
 </button>
 <button
 onClick={handleNext}
 className="px-3.5 py-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-[0_4px_10px_rgba(99,102,241,0.2)] hover:shadow-[0_4px_14px_rgba(99,102,241,0.3)] transition-all rounded-lg flex items-center gap-0.5"
 >
 {isLastStep ? "Selesai" : "Lanjut"}
 {!isLastStep && <ChevronRight size={13} />}
 </button>
 </div>
 </div>
 </motion.div>
 </AnimatePresence>
 </div>
 );
}
