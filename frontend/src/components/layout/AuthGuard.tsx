"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
    } else {
      setChecked(true);
    }
  }, [router]);

  if (!checked) {
    return (
      <div className="flex-1 min-h-screen bg-ctp-base flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-ctp-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
