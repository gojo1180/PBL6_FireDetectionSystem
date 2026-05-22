"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Cctv, Server, Menu, X, LogOut, Newspaper, Database, Flame } from "lucide-react";
import { getUser, removeToken } from "@/lib/auth";
import { motion } from "framer-motion";

export function AppSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const [userName, setUserName] = useState("User");
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    const user = getUser();
    if (user) {
      setUserName(user.full_name || user.email.split("@")[0]);
      setUserEmail(user.email);
    }
  }, []);

  const closeSidebar = () => setIsOpen(false);

  const handleLogout = () => {
    removeToken();
    router.push("/");
  };

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/cctv", label: "Live CCTV", icon: Cctv },
    { href: "/sensor-logs", label: "Sensor Logs", icon: Database },
    { href: "/settings", label: "Devices", icon: Server },
  ];

  const initials = userName
    ? userName
        .split(" ")
        .filter(Boolean)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="lg:hidden fixed top-3 left-4 z-40 p-2.5 rounded-xl bg-white/80 backdrop-blur-md border border-slate-200/50 text-slate-700 shadow-sm hover:bg-slate-50 hover:scale-105 active:scale-95 transition-all cursor-pointer"
      >
        <Menu size={20} className="text-slate-600" />
      </button>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity duration-300"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar Content */}
      <aside
        className={`fixed top-0 left-0 z-50 h-screen w-[270px] flex flex-col bg-white/75 backdrop-blur-xl border-r border-slate-200/40 shadow-[0_8px_32px_rgba(99,102,241,0.02)] transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo Header */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-slate-100/50 shrink-0">
          <Link href="/" onClick={closeSidebar} className="flex items-center gap-2.5 group">
            <motion.div
              whileHover={{ scale: 1.1, rotate: [0, -10, 10, 0] }}
              transition={{ duration: 0.4 }}
              className="p-1.5 rounded-xl bg-indigo-50 border border-indigo-100/50 flex items-center justify-center shadow-sm"
            >
              <img src="/img/logo.png" alt="BombaAI Logo" className="w-5 h-5 object-contain drop-shadow-[0_2px_8px_rgba(99,102,241,0.3)]" />
            </motion.div>
            <div className="flex flex-col">
              <span className="font-extrabold text-[17px] tracking-tight bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-800 bg-clip-text text-transparent group-hover:opacity-85 transition-opacity">
                BombaAI
              </span>
              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest -mt-0.5">
                Fire Detection
              </span>
            </div>
          </Link>
          {/* Close button for mobile inside sidebar */}
          <button
            onClick={closeSidebar}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100/50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          <span className="px-3 text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2.5 block">
            Monitoring
          </span>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeSidebar}
                className={`relative flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-300 group ${
                  isActive
                    ? "text-indigo-600 font-bold"
                    : "text-slate-500 hover:text-slate-800 hover:pl-5"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-pill"
                    className="absolute inset-0 bg-gradient-to-r from-indigo-50/80 to-violet-50/50 rounded-xl border border-indigo-100/30 z-0"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                {isActive && (
                  <motion.div
                    layoutId="active-indicator"
                    className="absolute left-0 top-3 bottom-3 w-1 bg-indigo-600 rounded-r-full z-10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-3 w-full">
                  <Icon
                    size={18}
                    className={`transition-transform duration-300 group-hover:scale-110 ${
                      isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-indigo-500"
                    }`}
                  />
                  <span className="flex-1">{item.label}</span>
                </span>
              </Link>
            );
          })}

          {/* Intelligence Section */}
          <span className="px-3 pt-6 text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2.5 block">
            Intelligence
          </span>
          {[{ href: "/news", label: "Fire News", icon: Newspaper }].map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeSidebar}
                className={`relative flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-300 group ${
                  isActive
                    ? "text-indigo-600 font-bold"
                    : "text-slate-500 hover:text-slate-800 hover:pl-5"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-pill"
                    className="absolute inset-0 bg-gradient-to-r from-indigo-50/80 to-violet-50/50 rounded-xl border border-indigo-100/30 z-0"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                {isActive && (
                  <motion.div
                    layoutId="active-indicator"
                    className="absolute left-0 top-3 bottom-3 w-1 bg-indigo-600 rounded-r-full z-10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-3 w-full">
                  <Icon
                    size={18}
                    className={`transition-transform duration-300 group-hover:scale-110 ${
                      isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-indigo-500"
                    }`}
                  />
                  <span className="flex-1">{item.label}</span>
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Footer — User + Logout */}
        <div className="px-4 py-5 border-t border-slate-100/50 shrink-0 space-y-4">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-50/40 border border-slate-100/30 shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-[0_4px_12px_rgba(99,102,241,0.2)]">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">{userName}</p>
              <p className="text-[10px] font-medium text-slate-400 truncate">{userEmail}</p>
            </div>
          </div>
          <button
            id="logout-btn"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-red-500 hover:text-red-600 text-sm font-bold bg-red-50/30 hover:bg-red-50 border border-red-100/20 hover:border-red-200/50 active:scale-[0.98] transition-all duration-200 cursor-pointer"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
