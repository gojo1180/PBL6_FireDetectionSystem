import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "BombaFusion — IoT Fire & Smoke Detection",
  description: "Real-time IoT monitoring dashboard for fire and smoke detection using late-fusion AI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full scroll-smooth`}>
      <body className="h-full bg-ctp-base">
        {children}
      </body>
    </html>
  );
}
