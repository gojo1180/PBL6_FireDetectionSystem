"use client";

import { AppSidebar } from "@/components/layout/AppSidebar";
import { AuthGuard } from "@/components/layout/AuthGuard";
import Script from "next/script";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      {/* OneSignal Script */}
      <Script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" strategy="afterInteractive" />
      <Script id="onesignal-init" strategy="afterInteractive">
        {`
          window.OneSignalDeferred = window.OneSignalDeferred || [];
          OneSignalDeferred.push(async function(OneSignal) {
            await OneSignal.init({
              appId: "${process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '9c45b4c4-6b2e-4a71-a1cd-f5d974824168'}",
              safari_web_id: "${process.env.NEXT_PUBLIC_ONESIGNAL_SAFARI_ID || 'web.onesignal.auto.6a2e4cfc-4f7f-4e0a-b787-2d0bd3e78806'}",
              notifyButton: {
                enable: true,
              },
            });
            // Show prompt
            OneSignal.Slidedown.promptPush();
          });
        `}
      </Script>

      <div className="flex h-full overflow-hidden">
        <AppSidebar />
        <div className="flex-1 h-screen overflow-y-auto">
          {children}
        </div>
      </div>
    </AuthGuard>
  );
}
