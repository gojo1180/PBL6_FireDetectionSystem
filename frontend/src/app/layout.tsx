import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppSidebar } from "@/components/layout/AppSidebar";
import "./globals.css";
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Sentinel Fusion — IoT Fire & Smoke Detection",
  description: "Real-time IoT monitoring dashboard for fire and smoke detection using late-fusion AI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="h-full flex bg-ctp-base overflow-hidden">
        <AppSidebar />

        {/* ─── Main Content ─── */}
        <div className="flex-1 h-screen overflow-y-auto">
          {children}
        </div>
      </body>
    </html>
  );
}
