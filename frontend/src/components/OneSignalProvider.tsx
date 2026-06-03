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
          appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID as string,
          safari_web_id: process.env.NEXT_PUBLIC_ONESIGNAL_SAFARI_ID as string,
          allowLocalhostAsSecureOrigin: true,
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
