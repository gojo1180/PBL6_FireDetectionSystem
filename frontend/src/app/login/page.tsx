"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Flame, Mail, Lock, ArrowRight, Loader2, Sun, Moon, ArrowLeft } from "lucide-react";
import { login } from "@/lib/api";
import { setToken, isAuthenticated } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isAuthenticated()) router.replace("/dashboard");
    document.documentElement.classList.remove('dark');
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await login({ email, password });
      setToken(data.access_token);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return <div className="min-h-screen" />;

  return (
    <div className="min-h-screen flex flex-col relative z-10">
      {/* Top bar */}
      <div className="px-6 py-4 flex justify-between items-center max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 rounded-full text-[var(--color-muted)] hover:bg-[var(--color-surface-card-elevated)] hover:text-[var(--color-body-strong)] transition-all">
            <ArrowLeft size={20} />
          </Link>
          <Link href="/" className="inline-flex items-center gap-2">
            <Flame size={20} className="text-[var(--color-primary)]" />
            <span className="font-semibold text-[16px] tracking-tight text-[var(--color-body-strong)]">
              BombaFusion
            </span>
          </Link>
        </div>
      </div>

      {/* Centered card */}
      <div className="flex-1 flex items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md relative">
          
          {/* Subtle Glow behind the card */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[var(--color-primary-glow)] rounded-full blur-[100px] opacity-[0.1] dark:opacity-[0.05] pointer-events-none z-[-1]"></div>

          <div className="text-center mb-8">
            <h1 className="display-sm text-[var(--color-body-strong)] mb-2">Welcome Back</h1>
            <p className="body-sm text-[var(--color-muted)]">Sign in to access your monitoring dashboard</p>
          </div>

          <form onSubmit={handleLogin} className="feature-card space-y-6 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-none p-8 md:p-10">
            {error && (
              <div className="px-4 py-3 rounded-[8px] bg-[var(--color-semantic-error)]/10 border border-[var(--color-semantic-error)]/20 text-sm text-[var(--color-semantic-error)] font-medium">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="caption-uppercase text-[var(--color-muted)]">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-muted-soft)]" />
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-[8px] bg-[var(--color-surface-card-elevated)] border border-[var(--color-hairline)] text-[var(--color-body-strong)] text-sm placeholder:text-[var(--color-muted-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 focus:border-[var(--color-primary)] transition-all"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="caption-uppercase text-[var(--color-muted)]">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-muted-soft)]" />
                <input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-[8px] bg-[var(--color-surface-card-elevated)] border border-[var(--color-hairline)] text-[var(--color-body-strong)] text-sm placeholder:text-[var(--color-muted-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 focus:border-[var(--color-primary)] transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="button-primary w-full shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed mt-2 h-[48px]"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <div className="flex items-center gap-2">
                  Sign In
                  <ArrowRight size={16} />
                </div>
              )}
            </button>

            <p className="text-center text-sm text-[var(--color-muted)] pt-2 border-t border-[var(--color-hairline)] mt-6">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-[var(--color-primary)] font-medium hover:text-[var(--color-primary-active)] transition-colors">
                Register
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
