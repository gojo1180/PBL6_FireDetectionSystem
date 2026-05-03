"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Flame, Mail, Lock, User, ArrowRight, Loader2 } from "lucide-react";
import { register } from "@/lib/api";
import { setToken, isAuthenticated } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) router.replace("/dashboard");
  }, [router]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const data = await register({
        email,
        password,
        full_name: fullName,
      });
      setToken(data.access_token);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
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
            <h1 className="text-3xl font-bold text-ctp-text mb-2">Create Account</h1>
            <p className="text-ctp-subtext0 text-sm">Register to start monitoring your facilities</p>
          </div>

          <form onSubmit={handleRegister} className="p-8 rounded-2xl bg-ctp-mantle border border-ctp-crust shadow-xl space-y-5">
            {error && (
              <div className="px-4 py-3 rounded-xl bg-ctp-red/10 border border-ctp-red/20 text-sm text-ctp-red font-medium">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold text-ctp-subtext0 uppercase tracking-wider">Full Name</label>
              <div className="relative">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ctp-overlay0" />
                <input
                  id="register-name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-ctp-base border border-ctp-crust text-ctp-text text-sm placeholder:text-ctp-overlay0 focus:outline-none focus:ring-2 focus:ring-ctp-blue/40 focus:border-ctp-blue transition-all"
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-ctp-subtext0 uppercase tracking-wider">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ctp-overlay0" />
                <input
                  id="register-email"
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
                  id="register-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-ctp-base border border-ctp-crust text-ctp-text text-sm placeholder:text-ctp-overlay0 focus:outline-none focus:ring-2 focus:ring-ctp-blue/40 focus:border-ctp-blue transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-ctp-subtext0 uppercase tracking-wider">Confirm Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ctp-overlay0" />
                <input
                  id="register-confirm"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-ctp-base border border-ctp-crust text-ctp-text text-sm placeholder:text-ctp-overlay0 focus:outline-none focus:ring-2 focus:ring-ctp-blue/40 focus:border-ctp-blue transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              id="register-submit"
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-ctp-blue text-white font-semibold text-sm hover:bg-ctp-sapphire transition-all duration-200 shadow-lg shadow-ctp-blue/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  Create Account
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <p className="text-center text-sm text-ctp-subtext0 pt-2">
              Already have an account?{" "}
              <Link href="/login" className="text-ctp-blue font-semibold hover:underline">
                Sign In
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
