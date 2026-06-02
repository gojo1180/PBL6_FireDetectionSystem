import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import OneSignalProvider from "@/components/OneSignalProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0f172a",
};

export const metadata: Metadata = {
  title: "BombaAI",
  description: "Real-time IoT monitoring dashboard for fire and smoke detection using late-fusion AI.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/img/logo.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PBL6 Fire",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full scroll-smooth`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                document.documentElement.classList.remove('dark');
                localStorage.removeItem('theme');
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="h-full bg-transparent text-[var(--color-body)] transition-colors duration-500 selection:bg-[var(--color-primary)]/30">

        {/* Global Dynamic Background */}
        <div className="fixed inset-0 pointer-events-none z-[-2] bg-[#f8fafc] transition-colors duration-700"></div>
        <div className="fixed inset-0 pointer-events-none z-[-1] transition-opacity duration-1000 opacity-100">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[radial-gradient(circle,_rgba(224,231,255,1)_0%,_rgba(255,255,255,0)_70%)] opacity-80 blur-3xl"></div>
          <div className="absolute top-[20%] right-[-10%] w-[40%] h-[60%] bg-[radial-gradient(circle,_rgba(236,254,255,1)_0%,_rgba(255,255,255,0)_70%)] opacity-70 blur-3xl"></div>
          <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[50%] bg-[radial-gradient(circle,_rgba(243,232,255,1)_0%,_rgba(255,255,255,0)_70%)] opacity-60 blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.4)_0%,_transparent_50%)]"></div>
        </div>

        <div className="no-scrollbar h-full overflow-auto">
          <OneSignalProvider>
            {children}
          </OneSignalProvider>
        </div>
      </body>
    </html>
  );
}
