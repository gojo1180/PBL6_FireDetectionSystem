"use client";

import { AppSidebar } from "@/components/layout/AppSidebar";
import { AuthGuard } from "@/components/layout/AuthGuard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-full overflow-hidden">
        <AppSidebar />
        <div className="flex-1 h-screen overflow-y-auto">
          {children}
        </div>
      </div>
    </AuthGuard>
  );
}
