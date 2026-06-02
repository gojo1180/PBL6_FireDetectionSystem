"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Avoid hydration mismatch by waiting for component to mount
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className="flex items-center gap-2 px-3.5 py-2 rounded-lg border bg-white/50 border-slate-200/60 text-slate-600">
        <div className="w-4 h-4" />
      </button>
    );
  }

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center justify-center gap-2 w-9 h-9 sm:w-auto sm:px-3.5 sm:py-2 rounded-lg border transition-all duration-200 text-sm font-semibold bg-white/50 dark:bg-black/30 backdrop-blur-sm border-slate-200/60 dark:border-slate-700/60 hover:border-indigo-300/80 dark:hover:border-indigo-500/80 text-slate-600 dark:text-slate-300"
      title="Toggle Light/Dark Mode"
    >
      {theme === "dark" ? (
        <Sun size={16} className="text-amber-400" />
      ) : (
        <Moon size={16} className="text-indigo-500" />
      )}
      <span className="hidden sm:inline">
        {theme === "dark" ? "Light" : "Dark"}
      </span>
    </button>
  );
}
