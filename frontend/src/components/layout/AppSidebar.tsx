"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Cctv, Server, Menu, X, LogOut } from "lucide-react";
import { getUser, removeToken } from "@/lib/auth";

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
    { href: "/settings", label: "Devices", icon: Server },
  ];

  const initials = userName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

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

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeSidebar}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-colors ${
                  isActive
                    ? "bg-ctp-blue/10 text-ctp-blue"
                    : "text-ctp-subtext0 hover:bg-ctp-surface0/60 hover:text-ctp-text"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer — User + Logout */}
        <div className="px-4 py-4 border-t border-ctp-crust shrink-0 space-y-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-ctp-lavender text-white flex items-center justify-center text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ctp-text truncate">{userName}</p>
              <p className="text-[11px] text-ctp-subtext0 truncate">{userEmail}</p>
            </div>
          </div>
          <button
            id="logout-btn"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-ctp-red text-sm font-medium hover:bg-ctp-red/10 transition-colors"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
