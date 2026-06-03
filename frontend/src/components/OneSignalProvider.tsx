"use client";

import { useEffect, useRef } from "react";
import OneSignal from "react-onesignal";

export default function OneSignalProvider({ children }: { children: React.ReactNode }) {
  const initialized = useRef(false);

  useEffect(() => {
    const initOneSignal = async () => {
      if (initialized.current) return;
      initialized.current = true;

      try {
        await OneSignal.init({
          appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "9c45b4c4-6b2e-4a71-a1cd-f5d974824168",
          safari_web_id: process.env.NEXT_PUBLIC_ONESIGNAL_SAFARI_ID || "web.onesignal.auto.6a2e4cfc-4f7f-4e0a-b787-2d0bd3e78806",
          allowLocalhostAsSecureOrigin: true, // Berguna untuk testing di local environment
          serviceWorkerParam: { scope: "/" },
          serviceWorkerPath: "/OneSignalSDKWorker.js",
        });
        
        // Meminta izin push notification dari user
        OneSignal.Slidedown.promptPush();
      } catch (error) {
        console.error("OneSignal Initialization Error:", error);
      }
    };

    initOneSignal();
  }, []);

  return <>{children}</>;
}
