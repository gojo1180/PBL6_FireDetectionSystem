"use client";

import { useEffect, useRef } from "react";

export default function OneSignalProvider({ children }: { children: React.ReactNode }) {
  const initialized = useRef(false);

  useEffect(() => {
    const initOneSignal = async () => {
      if (initialized.current) return;
      if (typeof window === "undefined") return;

      initialized.current = true;

      const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
      if (!appId) {
        console.error("[OneSignal] NEXT_PUBLIC_ONESIGNAL_APP_ID is not set!");
        return;
      }

      try {
        // Dynamically import OneSignal to avoid SSR issues
        const OneSignalModule = await import("react-onesignal");
        const OneSignal = OneSignalModule.default;

        await OneSignal.init({
          appId: appId,
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerParam: { scope: "/" },
          serviceWorkerPath: "/OneSignalSDKWorker.js",
          notifyButton: {
            enable: false,
          },
        });

        console.log("[OneSignal] SDK initialized successfully!");

        // Prompt push notification permission
        OneSignal.Slidedown.promptPush();
      } catch (error) {
        console.error("[OneSignal] Initialization Error:", error);
      }
    };

    // Delay initialization slightly to ensure DOM and SW are ready
    const timer = setTimeout(initOneSignal, 1500);
    return () => clearTimeout(timer);
  }, []);

  return <>{children}</>;
}
