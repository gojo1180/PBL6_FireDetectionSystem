"use client";

import Link from "next/link";
import { Flame, Shield, Eye, Cpu, Zap, Bell, ArrowRight, Activity, Globe, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { isAuthenticated } from "@/lib/auth";

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setMounted(true);
    setAuthed(isAuthenticated());
  }, []);

  if (!mounted) return <div className="min-h-screen bg-ctp-base" />;

  return (
    <div className="min-h-screen flex flex-col bg-ctp-base">
      {/* ─── NAVBAR ─── */}
      <nav className="sticky top-0 z-50 border-b border-ctp-crust bg-ctp-mantle/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-ctp-blue to-ctp-sapphire flex items-center justify-center shadow-lg shadow-ctp-blue/20">
              <Flame size={18} className="text-white" />
            </div>
            <div>
              <span className="font-bold text-ctp-text tracking-tight text-lg">Bomba</span>
              <span className="font-bold text-ctp-blue tracking-tight text-lg">Fusion</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {authed ? (
              <Link
                href="/dashboard"
                className="px-5 py-2.5 rounded-xl bg-ctp-blue text-white font-semibold text-sm hover:bg-ctp-sapphire transition-all duration-200 shadow-lg shadow-ctp-blue/25"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-5 py-2.5 rounded-xl text-ctp-text font-medium text-sm hover:bg-ctp-surface0/60 transition-colors"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="px-5 py-2.5 rounded-xl bg-ctp-blue text-white font-semibold text-sm hover:bg-ctp-sapphire transition-all duration-200 shadow-lg shadow-ctp-blue/25"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden px-6 py-28 lg:py-36 flex flex-col items-center">
        {/* Decorative background glow blobs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-ctp-blue/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-ctp-red/6 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-ctp-sapphire/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-ctp-blue/10 border border-ctp-blue/20">
            <Activity size={14} className="text-ctp-blue" />
            <span className="text-xs font-semibold text-ctp-blue tracking-wide uppercase">Powered by Late-Fusion AI</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1]">
            <span className="text-ctp-text">Next-Gen</span>
            <br />
            <span className="bg-gradient-to-r from-ctp-blue via-ctp-sapphire to-ctp-teal bg-clip-text text-transparent">
              Fire Detection
            </span>
            <br />
            <span className="text-ctp-text">System</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-ctp-subtext0 max-w-2xl mx-auto leading-relaxed">
            Combining <strong className="text-ctp-text">YOLOv8 Computer Vision</strong>,{" "}
            <strong className="text-ctp-text">Multi-Sensor IoT Data</strong>, and{" "}
            <strong className="text-ctp-text">Late-Fusion AI</strong> for
            unprecedented fire &amp; smoke detection accuracy.
          </p>

          {/* CTA */}
          <div className="flex items-center justify-center gap-4 pt-4">
            <Link
              href={authed ? "/dashboard" : "/login"}
              className="group inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-ctp-blue text-white font-bold text-base hover:bg-ctp-sapphire transition-all duration-300 shadow-2xl shadow-ctp-blue/30 hover:shadow-ctp-sapphire/40 hover:scale-[1.02]"
            >
              Get Started
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl border border-ctp-crust text-ctp-text font-semibold text-base hover:bg-ctp-mantle transition-all duration-200"
            >
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* ─── FEATURES GRID ─── */}
      <section id="features" className="px-6 py-20 lg:py-28 bg-ctp-mantle border-t border-ctp-crust">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <span className="text-xs font-bold uppercase tracking-widest text-ctp-blue">Core Capabilities</span>
            <h2 className="text-3xl md:text-4xl font-bold text-ctp-text">Intelligent Threat Detection</h2>
            <p className="text-ctp-subtext0 max-w-lg mx-auto">
              Our multi-layered approach combines the best of vision AI and physical sensors.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="group relative p-8 rounded-2xl bg-ctp-base border border-ctp-crust hover:border-ctp-blue/30 transition-all duration-300 hover:shadow-xl hover:shadow-ctp-blue/5">
              <div className="w-14 h-14 rounded-2xl bg-ctp-blue/10 flex items-center justify-center mb-6 group-hover:bg-ctp-blue/15 transition-colors">
                <Eye size={28} className="text-ctp-blue" />
              </div>
              <h3 className="text-lg font-bold text-ctp-text mb-3">Real-Time RTSP Processing</h3>
              <p className="text-sm text-ctp-subtext0 leading-relaxed">
                Direct RTSP stream ingestion with YOLOv8 inference, delivering real-time threat
                detection with bounding-box overlays at up to 20 FPS.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group relative p-8 rounded-2xl bg-ctp-base border border-ctp-crust hover:border-ctp-teal/30 transition-all duration-300 hover:shadow-xl hover:shadow-ctp-teal/5">
              <div className="w-14 h-14 rounded-2xl bg-ctp-teal/10 flex items-center justify-center mb-6 group-hover:bg-ctp-teal/15 transition-colors">
                <Cpu size={28} className="text-ctp-teal" />
              </div>
              <h3 className="text-lg font-bold text-ctp-text mb-3">Multi-Sensor Data Fusion</h3>
              <p className="text-sm text-ctp-subtext0 leading-relaxed">
                CNG, CO, LPG, smoke, and flame sensor readings fused with CCTV vision data
                using Isolation Forest anomaly detection for robust risk scoring.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group relative p-8 rounded-2xl bg-ctp-base border border-ctp-crust hover:border-ctp-peach/30 transition-all duration-300 hover:shadow-xl hover:shadow-ctp-peach/5">
              <div className="w-14 h-14 rounded-2xl bg-ctp-peach/10 flex items-center justify-center mb-6 group-hover:bg-ctp-peach/15 transition-colors">
                <Bell size={28} className="text-ctp-peach" />
              </div>
              <h3 className="text-lg font-bold text-ctp-text mb-3">Automated Threat Alerts</h3>
              <p className="text-sm text-ctp-subtext0 leading-relaxed">
                Instant fusion alerts with risk scoring, evidence snapshots uploaded to cloud
                storage, and a real-time incident log delivered to your dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── STATS BAR ─── */}
      <section className="px-6 py-16 bg-ctp-base border-t border-ctp-crust">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <p className="text-3xl font-bold text-ctp-blue">5+</p>
            <p className="text-xs text-ctp-subtext0 mt-1 uppercase tracking-wide font-medium">Sensor Types</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-ctp-teal">&lt;2s</p>
            <p className="text-xs text-ctp-subtext0 mt-1 uppercase tracking-wide font-medium">Detection Latency</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-ctp-peach">24/7</p>
            <p className="text-xs text-ctp-subtext0 mt-1 uppercase tracking-wide font-medium">Monitoring</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-ctp-lavender">YOLOv8</p>
            <p className="text-xs text-ctp-subtext0 mt-1 uppercase tracking-wide font-medium">Vision Model</p>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="bg-ctp-mantle border-t border-ctp-crust pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 lg:gap-8 mb-12">
            {/* Brand Column */}
            <div className="md:col-span-1 space-y-4">
              <div className="flex items-center gap-2">
                <Flame size={20} className="text-ctp-blue" />
                <span className="font-bold text-lg text-ctp-text tracking-tight">Bomba<span className="text-ctp-blue">Fusion</span></span>
              </div>
              <p className="text-sm text-ctp-subtext0 leading-relaxed">
                Advanced IoT fire and smoke detection leveraging multi-sensor data and Late-Fusion AI for absolute facility safety.
              </p>
              <div className="flex items-center gap-4 pt-2">
                <a href="#" className="w-8 h-8 rounded-full bg-ctp-base border border-ctp-crust flex items-center justify-center text-ctp-subtext0 hover:text-ctp-blue hover:border-ctp-blue/30 transition-all">
                  <MessageCircle size={14} />
                </a>
                <a href="#" className="w-8 h-8 rounded-full bg-ctp-base border border-ctp-crust flex items-center justify-center text-ctp-subtext0 hover:text-ctp-text hover:border-ctp-surface1 transition-all">
                  <Globe size={14} />
                </a>
              </div>
            </div>

            {/* Links Columns */}
            <div>
              <h4 className="font-semibold text-ctp-text mb-4 text-sm">Product</h4>
              <ul className="space-y-3 text-sm text-ctp-subtext0">
                <li><a href="#features" className="hover:text-ctp-blue transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-ctp-blue transition-colors">Integrations</a></li>
                <li><a href="/login" className="hover:text-ctp-blue transition-colors">Dashboard</a></li>
                <li><a href="#" className="hover:text-ctp-blue transition-colors">Changelog</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-ctp-text mb-4 text-sm">Resources</h4>
              <ul className="space-y-3 text-sm text-ctp-subtext0">
                <li><a href="#" className="hover:text-ctp-blue transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-ctp-blue transition-colors">Hardware Setup</a></li>
                <li><a href="#" className="hover:text-ctp-blue transition-colors">API Reference</a></li>
                <li><a href="#" className="hover:text-ctp-blue transition-colors">Community</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-ctp-text mb-4 text-sm">Company</h4>
              <ul className="space-y-3 text-sm text-ctp-subtext0">
                <li><a href="#" className="hover:text-ctp-blue transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-ctp-blue transition-colors">Contact Support</a></li>
                <li><a href="#" className="hover:text-ctp-blue transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-ctp-blue transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-ctp-crust flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-ctp-overlay0">
              © {new Date().getFullYear()} BombaFusion. Built for enterprise safety.
            </p>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-ctp-green animate-pulse"></span>
              <span className="text-xs text-ctp-green font-medium">All systems operational</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
