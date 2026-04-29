"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Flame, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { login } from "@/lib/api";
import { setToken, isAuthenticated } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) router.replace("/dashboard");
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

  return (
    <div className="min-h-screen h-screen overflow-y-auto flex flex-col bg-ctp-base">
      {/* Top bar */}
      <div className="px-6 py-4">
        <Link href="/" className="inline-flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-ctp-blue to-ctp-sapphire flex items-center justify-center">
            <Flame size={16} className="text-white" />
          </div>
          <span className="font-bold text-ctp-text">Bomba</span>
          <span className="font-bold text-ctp-blue">Fusion</span>
        </Link>
      </div>

      {/* Centered card */}
      <div className="flex-1 flex items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-ctp-text mb-2">Welcome Back</h1>
            <p className="text-ctp-subtext0 text-sm">Sign in to access your monitoring dashboard</p>
          </div>

          <form onSubmit={handleLogin} className="p-8 rounded-2xl bg-ctp-mantle border border-ctp-crust shadow-xl space-y-5">
            {error && (
              <div className="px-4 py-3 rounded-xl bg-ctp-red/10 border border-ctp-red/20 text-sm text-ctp-red font-medium">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold text-ctp-subtext0 uppercase tracking-wider">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ctp-overlay0" />
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-ctp-base border border-ctp-crust text-ctp-text text-sm placeholder:text-ctp-overlay0 focus:outline-none focus:ring-2 focus:ring-ctp-blue/40 focus:border-ctp-blue transition-all"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-ctp-subtext0 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ctp-overlay0" />
                <input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-ctp-base border border-ctp-crust text-ctp-text text-sm placeholder:text-ctp-overlay0 focus:outline-none focus:ring-2 focus:ring-ctp-blue/40 focus:border-ctp-blue transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-ctp-blue text-white font-semibold text-sm hover:bg-ctp-sapphire transition-all duration-200 shadow-lg shadow-ctp-blue/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <p className="text-center text-sm text-ctp-subtext0 pt-2">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-ctp-blue font-semibold hover:underline">
                Register
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
