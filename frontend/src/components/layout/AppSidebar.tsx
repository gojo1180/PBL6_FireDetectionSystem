"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Cctv, Server, History, Settings, Menu, X } from "lucide-react";

export function AppSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const closeSidebar = () => setIsOpen(false);

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="lg:hidden fixed top-3 left-4 z-40 p-2 rounded-lg bg-ctp-mantle border border-ctp-crust text-ctp-text shadow-md hover:bg-ctp-surface0 transition-colors"
      >
        <Menu size={20} />
      </button>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar Content */}
      <aside
        className={`fixed top-0 left-0 z-50 h-screen w-[260px] flex flex-col bg-ctp-mantle border-r border-ctp-crust transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-ctp-crust shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-ctp-blue flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></svg>
            </div>
            <div>
              <span className="font-bold text-ctp-text tracking-tight">Bomba</span>
              <span className="font-bold text-ctp-blue tracking-tight">Fusion</span>
            </div>
          </div>
          {/* Close button for mobile inside sidebar */}
          <button onClick={closeSidebar} className="lg:hidden text-ctp-subtext0 hover:text-ctp-text">
            <X size={20} />
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <span className="px-3 text-[10px] uppercase tracking-widest font-semibold text-ctp-overlay0 mb-2 block">Monitoring</span>
          
          <Link
            href="/"
            onClick={closeSidebar}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-colors ${
              pathname === "/" ? "bg-ctp-blue/10 text-ctp-blue" : "text-ctp-subtext0 hover:bg-ctp-surface0/60 hover:text-ctp-text"
            }`}
          >
            <LayoutDashboard size={18} />
            Dashboard
          </Link>
          
          <Link
            href="/cctv"
            onClick={closeSidebar}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-colors ${
              pathname === "/cctv" ? "bg-ctp-blue/10 text-ctp-blue" : "text-ctp-subtext0 hover:bg-ctp-surface0/60 hover:text-ctp-text"
            }`}
          >
            <Cctv size={18} />
            Live CCTV
          </Link>

          <Link
            href="#"
            onClick={closeSidebar}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-ctp-subtext0 hover:bg-ctp-surface0/60 hover:text-ctp-text font-medium text-sm transition-colors"
          >
            <Server size={18} />
            Devices
          </Link>

          <Link
            href="#"
            onClick={closeSidebar}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-ctp-subtext0 hover:bg-ctp-surface0/60 hover:text-ctp-text font-medium text-sm transition-colors"
          >
            <History size={18} />
            History
          </Link>
        </nav>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-ctp-crust shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-ctp-lavender text-white flex items-center justify-center text-xs font-bold">AD</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ctp-text truncate">Admin</p>
              <p className="text-xs text-ctp-subtext0 truncate">Fire Station #1</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
