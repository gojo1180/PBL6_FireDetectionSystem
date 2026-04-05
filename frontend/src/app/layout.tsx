import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Sentinel Fusion — IoT Fire & Smoke Detection",
  description: "Real-time IoT monitoring dashboard for fire and smoke detection using late-fusion AI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="h-full flex bg-ctp-base">
        {/* ─── Fixed Sidebar ─── */}
        <aside className="hidden lg:flex flex-col w-[260px] h-screen sticky top-0 bg-ctp-mantle border-r border-ctp-crust shrink-0">
          {/* Logo */}
          <div className="h-16 flex items-center gap-3 px-6 border-b border-ctp-crust shrink-0">
            <div className="w-8 h-8 rounded-lg bg-ctp-blue flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>
            </div>
            <div>
              <span className="font-bold text-ctp-text tracking-tight">Sentinel</span>
              <span className="font-bold text-ctp-blue tracking-tight">Fusion</span>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            <span className="px-3 text-[10px] uppercase tracking-widest font-semibold text-ctp-overlay0 mb-2 block">Monitoring</span>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-ctp-blue/10 text-ctp-blue font-semibold text-sm transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              Dashboard
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-ctp-subtext0 hover:bg-ctp-surface0/60 hover:text-ctp-text font-medium text-sm transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
              Devices
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-ctp-subtext0 hover:bg-ctp-surface0/60 hover:text-ctp-text font-medium text-sm transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              History
            </a>

            <span className="px-3 pt-6 text-[10px] uppercase tracking-widest font-semibold text-ctp-overlay0 mb-2 block">System</span>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-ctp-subtext0 hover:bg-ctp-surface0/60 hover:text-ctp-text font-medium text-sm transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
              Settings
            </a>
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

        {/* ─── Main Content ─── */}
        <div className="flex-1 min-h-screen overflow-y-auto">
          {children}
        </div>
      </body>
    </html>
  );
}
