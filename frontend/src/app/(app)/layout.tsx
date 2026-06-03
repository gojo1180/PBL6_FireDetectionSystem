"use client";

import { AppSidebar } from "@/components/layout/AppSidebar";
import { AuthGuard } from "@/components/layout/AuthGuard";
import OneSignalProvider from "@/components/OneSignalProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <OneSignalProvider>
        <div className="flex h-full overflow-hidden">
          <AppSidebar />
          <div className="flex-1 h-screen overflow-y-auto">
            {children}
          </div>
        </div>
      </OneSignalProvider>
    </AuthGuard>
  );
}
