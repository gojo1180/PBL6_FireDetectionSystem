"use client";

import Link from "next/link";
import { Flame, Shield, Cpu, AlertTriangle, Eye, ArrowRight, User, Terminal, Database, Cloud, Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { isAuthenticated } from "@/lib/auth";
import { motion } from "framer-motion";

// Reusable animation variants
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }
} as const;

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15
    }
  }
} as const;

const flowLineVariant = {
  hidden: { height: 0, opacity: 0 },
  visible: { height: "100%", opacity: 1, transition: { duration: 0.8, ease: "easeInOut" } }
} as const;

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setMounted(true);
    setAuthed(isAuthenticated());
    document.documentElement.classList.remove('dark');
  }, []);

  if (!mounted) return <div className="min-h-screen bg-[#f8fafc]" />;

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">

      {/* ─── NAVBAR ─── */}
      <div className="fixed top-4 left-0 right-0 z-50 px-4 md:px-8 flex justify-center">
        <motion.nav
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-6xl h-[64px] bg-white/75 backdrop-blur-xl border border-white/40 shadow-[0_8px_32px_rgba(99,102,241,0.06)] rounded-2xl flex items-center justify-between px-6 md:px-8"
        >
          <Link href="/" className="flex items-center gap-2.5 cursor-pointer group">
            <motion.div
              whileHover={{ scale: 1.1, rotate: [0, -10, 10, 0] }}
              transition={{ duration: 0.4 }}
              className="p-1.5 rounded-xl bg-indigo-50 border border-indigo-100/50 flex items-center justify-center animate-pulse"
            >
              <Flame size={20} className="text-indigo-600 drop-shadow-[0_2px_8px_rgba(99,102,241,0.3)]" />
            </motion.div>
            <span className="font-extrabold text-[17px] tracking-tight bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-800 bg-clip-text text-transparent group-hover:opacity-85 transition-opacity">
              BombaAI
            </span>
          </Link>
          
          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors relative py-1.5 group">
              Fitur
              <span className="absolute bottom-0 left-1/2 w-0 h-0.5 bg-indigo-500 transition-all duration-300 group-hover:w-full group-hover:left-0"></span>
            </a>
            <a href="#architecture" className="text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors relative py-1.5 group">
              Arsitektur
              <span className="absolute bottom-0 left-1/2 w-0 h-0.5 bg-indigo-500 transition-all duration-300 group-hover:w-full group-hover:left-0"></span>
            </a>
            <a href="#team" className="text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors relative py-1.5 group">
              Tim
              <span className="absolute bottom-0 left-1/2 w-0 h-0.5 bg-indigo-500 transition-all duration-300 group-hover:w-full group-hover:left-0"></span>
            </a>
          </div>
          
          <div className="flex items-center gap-3">
            {authed ? (
              <Link
                href="/dashboard"
                className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-[0_4px_14px_rgba(99,102,241,0.2)] hover:shadow-[0_6px_20px_rgba(99,102,241,0.3)] transition-all hover:scale-105 active:scale-95"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-all"
                >
                  Masuk
                </Link>
                <Link
                  href="/register"
                  className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-[0_4px_14px_rgba(99,102,241,0.2)] hover:shadow-[0_6px_20px_rgba(99,102,241,0.3)] transition-all hover:scale-105 active:scale-95 rounded-xl"
                >
                  Daftar
                </Link>
              </>
            )}
          </div>
        </motion.nav>
      </div>

      <main className="relative z-10 flex-grow pt-[96px] md:pt-[112px]">
        {/* ─── HERO SECTION ─── */}
        <section className="relative px-6 py-[96px] md:py-[120px] flex flex-col items-center justify-center">
          {/* Spotlight Glow Backdrop */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.4, scale: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--color-primary-glow)] rounded-full blur-[150px] pointer-events-none z-0 transition-colors duration-700"
          ></motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="max-w-5xl w-full space-y-10 relative z-10 flex flex-col items-center text-center"
          >
            <div className="flex flex-col items-center gap-6">
              <motion.span variants={fadeUp} className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-[var(--color-surface-card-elevated)] border border-[var(--color-hairline-strong)] text-[var(--color-body-strong)] caption-uppercase transition-colors duration-500 shadow-sm">
                System Architecture v2.0
              </motion.span>

              <motion.h1 variants={fadeUp} className="display-mega md:display-mega text-[var(--color-body-strong)] max-w-4xl mx-auto leading-[1.05] transition-colors duration-500">
                Next-Gen Fire Detection System
              </motion.h1>

              <motion.p variants={fadeUp} className="body-md text-[var(--color-muted)] max-w-2xl mx-auto transition-colors duration-500">
                Menggabungkan keandalan Computer Vision, telemetri multi-sensor IoT, dan kecerdasan buatan Late-Fusion untuk akurasi deteksi tanpa preseden.
              </motion.p>

              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href={authed ? "/dashboard" : "/login"}
                  className="button-primary flex items-center gap-2 shadow-sm hover:shadow-md"
                >
                  Live Dashboard
                  <ArrowRight size={16} />
                </Link>
                <a
                  href="#architecture"
                  className="button-secondary-dark flex items-center gap-2 shadow-sm"
                >
                  <Terminal size={16} className="text-[var(--color-muted)]" />
                  Lihat Arsitektur
                </a>
              </motion.div>
            </div>
          </motion.div>
        </section>

        {/* ─── COMPARISON SECTION ─── */}
        <section id="features" className="px-6 pb-[96px] pt-[32px] scroll-mt-28">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeUp}
              className="mb-16 text-center md:text-left"
            >
              <h2 className="display-lg text-[var(--color-body-strong)] mb-4 transition-colors duration-500">Kendala Produk Kami Dibanding Yang Lainnya</h2>
              <p className="body-md text-[var(--color-muted)] transition-colors duration-500">Mengapa pendekatan tunggal seringkali gagal, dan bagaimana kami mengatasinya.</p>
            </motion.div>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              className="flex flex-col gap-6"
            >
              {/* Top: 2 Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                <motion.div variants={fadeUp} className="feature-card flex flex-col justify-start shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:-translate-y-1 transition-transform duration-300">
                  <div className="w-10 h-10 rounded-[8px] bg-[var(--color-surface-strong)] text-[var(--color-body-strong)] flex items-center justify-center mb-6 transition-colors duration-500 shadow-sm dark:shadow-none border border-[var(--color-hairline-soft)]">
                    <AlertTriangle size={20} />
                  </div>
                  <h3 className="title-md text-[var(--color-body-strong)] mb-2 transition-colors duration-500">Kendala Sensor Konvensional</h3>
                  <p className="body-md text-[var(--color-body)] transition-colors duration-500">
                    Sistem lama hanya mengandalkan sensor asap yang pasif. Mereka harus menunggu partikel asap fisik masuk ke dalam alat, sehingga sangat terlambat menyadari kebakaran dan sering memicu alarm palsu akibat asap rokok atau aktivitas memasak biasa.
                  </p>
                </motion.div>

                <motion.div variants={fadeUp} className="feature-card flex flex-col justify-start shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:-translate-y-1 transition-transform duration-300">
                  <div className="w-10 h-10 rounded-[8px] bg-[var(--color-surface-strong)] text-[var(--color-body-strong)] flex items-center justify-center mb-6 transition-colors duration-500 shadow-sm dark:shadow-none border border-[var(--color-hairline-soft)]">
                    <Eye size={20} />
                  </div>
                  <h3 className="title-md text-[var(--color-body-strong)] mb-2 transition-colors duration-500">Kendala Kamera Pintar Saja</h3>
                  <p className="body-md text-[var(--color-body)] transition-colors duration-500">
                    Kamera AI canggih memang cepat melihat api, namun sangat mudah terkecoh oleh pantulan cahaya matahari, lampu berkedip, atau warna cerah. Selain itu, kamera tidak bisa mendeteksi kebakaran jika terhalang oleh dinding atau objek besar.
                  </p>
                </motion.div>
              </div>

              {/* Bottom: 1 Full Card */}
              <motion.div variants={fadeUp} className="feature-card flex flex-col md:flex-row items-center gap-8 relative overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:-translate-y-1 transition-transform duration-300">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-primary-glow)] rounded-full blur-[100px] opacity-[0.15] dark:opacity-10 pointer-events-none transition-opacity duration-500"></div>

                <div className="shrink-0 w-16 h-16 rounded-[8px] bg-[var(--color-primary)] text-[var(--color-on-primary)] flex items-center justify-center relative z-10 transition-colors duration-500 shadow-md">
                  <Shield size={32} />
                </div>
                <div className="flex-1 relative z-10 text-center md:text-left">
                  <h3 className="display-sm text-[var(--color-body-strong)] mb-2 transition-colors duration-500">Solusi Kami: Penggabungan Cerdas (Late-Fusion)</h3>
                  <p className="body-md text-[var(--color-body)] transition-colors duration-500">
                    Kami tidak memilih salah satu, kami menggunakan <span className="text-[var(--color-body-strong)] font-medium">keduanya</span>. Sistem kami memvalidasi penglihatan kamera pintar dengan data akurat dari sensor gas fisik secara bersamaan. Jika kamera melihat api tetapi sensor gas tidak merasakan anomali, sistem tidak akan panik. Hasilnya? Tingkat alarm palsu menurun drastis dan deteksi jauh lebih pasti.
                  </p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ─── ARCHITECTURE SECTION ─── */}
        <section id="architecture" className="px-6 py-[96px] border-t border-[var(--color-hairline)] transition-colors duration-500 overflow-hidden scroll-mt-28">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeUp}
              className="mb-16 text-center md:text-left"
            >
              <h2 className="display-lg text-[var(--color-body-strong)] mb-4 transition-colors duration-500">Arsitektur Yang Digunakan</h2>
              <p className="body-md text-[var(--color-muted)] transition-colors duration-500">Proses di balik layar bagaimana sistem kami melindungi Anda setiap detiknya.</p>
            </motion.div>

            {/* ─── VISUAL PIPELINE ARCHITECTURE ─── */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              className="w-full flex flex-col items-center"
            >

              {/* Step 1: Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl relative z-10">
                <motion.div variants={fadeUp} className="feature-card flex flex-col items-center text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:-translate-y-1 transition-transform duration-300">
                  <div className="w-12 h-12 rounded-full bg-[var(--color-primary-glow)]/10 dark:bg-[var(--color-primary-glow)]/20 text-[var(--color-primary)] flex items-center justify-center mb-4 border border-[var(--color-primary-glow)]/30">
                    <Eye size={24} />
                  </div>
                  <h3 className="title-md text-[var(--color-body-strong)] mb-2">Mata Digital (Kamera)</h3>
                  <p className="body-sm text-[var(--color-muted)]">Mengawasi ruangan non-stop 30 kali per detik untuk mencari bentuk fisik api atau asap.</p>
                </motion.div>

                <motion.div variants={fadeUp} className="feature-card flex flex-col items-center text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:-translate-y-1 transition-transform duration-300">
                  <div className="w-12 h-12 rounded-full bg-[var(--color-accent-violet)]/10 dark:bg-[var(--color-accent-violet)]/20 text-[var(--color-accent-violet)] flex items-center justify-center mb-4 border border-[var(--color-accent-violet)]/30">
                    <Flame size={24} />
                  </div>
                  <h3 className="title-md text-[var(--color-body-strong)] mb-2">Hidung Digital (Sensor)</h3>
                  <p className="body-sm text-[var(--color-muted)]">Mendeteksi anomali suhu dan gas berbahaya secara langsung di udara sekitar.</p>
                </motion.div>
              </div>

              {/* Connecting Lines Downwards */}
              <div className="flex w-full max-w-md justify-around relative h-20 -my-3 z-0 hidden md:flex">
                {/* Left line: Kamera to Engine */}
                <div className="w-[4px] h-full rounded-full bg-[var(--color-surface-card-elevated)] border-x border-[var(--color-hairline)] relative overflow-hidden">
                  <motion.div variants={flowLineVariant} className="absolute left-0 w-full bg-gradient-to-b from-transparent via-[var(--color-primary)] to-[var(--color-primary-glow)] animate-data-flow"></motion.div>
                </div>
                {/* Right line: Sensor to Engine */}
                <div className="w-[4px] h-full rounded-full bg-[var(--color-surface-card-elevated)] border-x border-[var(--color-hairline)] relative overflow-hidden">
                  <motion.div variants={flowLineVariant} className="absolute left-0 w-full bg-gradient-to-b from-transparent via-[var(--color-accent-violet)] to-[#b084f6] animate-data-flow" style={{ animationDelay: '0.7s' }}></motion.div>
                </div>
              </div>

              {/* Mobile connecting line */}
              <div className="w-[4px] h-12 rounded-full bg-[var(--color-surface-card-elevated)] border-x border-[var(--color-hairline)] relative overflow-hidden md:hidden my-3 mx-auto z-0">
                <motion.div variants={flowLineVariant} className="absolute left-0 w-full bg-gradient-to-b from-transparent via-[var(--color-primary)] to-[var(--color-primary-glow)] animate-data-flow"></motion.div>
              </div>

              {/* Step 2: Engine */}
              <motion.div variants={fadeUp} className="feature-card w-full max-w-3xl relative z-10 flex flex-col items-center text-center border-[var(--color-primary)]/50 shadow-[0_0_40px_var(--color-primary-glow)] dark:shadow-none hover:-translate-y-1 transition-transform duration-300">
                <div className="absolute inset-0 bg-[var(--color-primary-glow)]/5 dark:bg-[var(--color-primary-glow)]/10 rounded-[16px] pointer-events-none"></div>
                <div className="w-16 h-16 rounded-full bg-[var(--color-surface-strong)] text-[var(--color-body-strong)] flex items-center justify-center mb-4 shadow-md border border-[var(--color-hairline-strong)]">
                  <Cpu size={32} />
                </div>
                <h3 className="display-sm text-[var(--color-body-strong)] mb-2">Otak Utama (Late-Fusion Engine)</h3>
                <p className="body-md text-[var(--color-muted)] mb-6">
                  Sistem AI pusat ini menyatukan dan menganalisis laporan dari <strong>Kamera</strong> dan <strong>Sensor</strong> secara bersamaan. Ia secara cerdas menyaring alarm palsu dan hanya akan membunyikan tanda bahaya jika kedua perangkat memvalidasi ancaman.
                </p>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-surface-card-elevated)] border border-[var(--color-hairline-strong)]">
                  <div className="w-2 h-2 rounded-full bg-[var(--color-semantic-success)] animate-pulse shadow-[0_0_8px_var(--color-semantic-success)]"></div>
                  <span className="caption text-[var(--color-body-strong)] font-code">Validasi silang aktif</span>
                </div>
              </motion.div>

              {/* Connecting Line to Output */}
              <div className="h-20 w-[4px] rounded-full bg-[var(--color-surface-card-elevated)] border-x border-[var(--color-hairline)] relative overflow-hidden -my-3 z-0 hidden md:block">
                <motion.div variants={flowLineVariant} className="absolute left-0 w-full bg-gradient-to-b from-transparent via-[var(--color-semantic-success)] to-[#4de393] animate-data-flow" style={{ animationDelay: '1.2s' }}></motion.div>
              </div>
              <div className="w-[4px] h-12 rounded-full bg-[var(--color-surface-card-elevated)] border-x border-[var(--color-hairline)] relative overflow-hidden md:hidden my-3 mx-auto z-0">
                <motion.div variants={flowLineVariant} className="absolute left-0 w-full bg-gradient-to-b from-transparent via-[var(--color-semantic-success)] to-[#4de393] animate-data-flow"></motion.div>
              </div>

              {/* Step 3: Result */}
              <motion.div variants={fadeUp} className="feature-card w-full max-w-md flex flex-col items-center text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none bg-[var(--color-surface-strong)] border-[var(--color-semantic-success)]/30 hover:-translate-y-1 transition-transform duration-300 z-10">
                <div className="w-12 h-12 rounded-full bg-[var(--color-semantic-success)] text-[var(--color-canvas)] flex items-center justify-center mb-4 shadow-[0_0_15px_var(--color-semantic-success)]">
                  <Shield size={24} />
                </div>
                <h3 className="title-md text-[var(--color-body-strong)] mb-1">Ruangan Anda Terlindungi</h3>
                <p className="body-sm text-[var(--color-muted)]">Bebas dari kepanikan akibat alarm palsu.</p>
              </motion.div>

            </motion.div>
          </div>
        </section>

        {/* ─── TEAM SECTION ─── */}
        <section id="team" className="py-[96px] border-t border-[var(--color-hairline)] transition-colors duration-500 overflow-hidden scroll-mt-28">
          <div className="max-w-5xl mx-auto px-6">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeUp}
              className="mb-16 text-center md:text-left"
            >
              <h2 className="display-lg text-[var(--color-body-strong)] mb-4 transition-colors duration-500">Meet Our Developers</h2>
              <p className="body-md text-[var(--color-muted)] transition-colors duration-500">Tim pengembang berdedikasi di balik arsitektur BombaAI.</p>
            </motion.div>

            {/* Grid 3 Top, 2 Bottom Layout */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              className="flex flex-col gap-6"
            >

              {/* Top 3 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {[
                  { name: "Muhammad Tammam Tanjung", nim: "2307412024" },
                  { name: "Nalendra Regina Khanza", nim: "2307412011" },
                  { name: "Naufal Hasan", nim: "2307412010" }
                ].map((member, idx) => (
                  <motion.div
                    variants={fadeUp}
                    key={idx}
                    className="feature-card flex flex-col items-center text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:shadow-[0_10px_40px_rgb(0,0,0,0.08)]"
                  >
                    <div className="w-[64px] h-[64px] rounded-[9999px] bg-[var(--color-surface-strong)] flex items-center justify-center mb-6 border border-[var(--color-hairline-strong)] transition-colors duration-500 shadow-sm dark:shadow-none">
                      <User size={24} className="text-[var(--color-muted)]" />
                    </div>
                    <h4 className="title-md text-[var(--color-body-strong)] mb-1 transition-colors duration-500">{member.name}</h4>
                    <p className="caption text-[var(--color-muted)] mb-6 font-code transition-colors duration-500">ID: {member.nim}</p>
                    <div className="mt-auto inline-flex items-center px-2 py-1 bg-[var(--color-surface-card-elevated)] rounded-[4px] border border-[var(--color-hairline)] transition-colors duration-500 shadow-sm dark:shadow-none">
                      <span className="caption-uppercase text-[var(--color-muted)]">PNJ Developer</span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Bottom 2 Centered */}
              <div className="flex flex-col sm:flex-row justify-center gap-6">
                {[
                  { name: "Nizham Aufar", nim: "2307412016" },
                  { name: "Venu Wicaksono", nim: "2307412028" }
                ].map((member, idx) => (
                  <motion.div
                    variants={fadeUp}
                    key={idx}
                    className="feature-card w-full sm:w-[calc(33.333%-1rem)] flex flex-col items-center text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:shadow-[0_10px_40px_rgb(0,0,0,0.08)]"
                  >
                    <div className="w-[64px] h-[64px] rounded-[9999px] bg-[var(--color-surface-strong)] flex items-center justify-center mb-6 border border-[var(--color-hairline-strong)] transition-colors duration-500 shadow-sm dark:shadow-none">
                      <User size={24} className="text-[var(--color-muted)]" />
                    </div>
                    <h4 className="title-md text-[var(--color-body-strong)] mb-1 transition-colors duration-500">{member.name}</h4>
                    <p className="caption text-[var(--color-muted)] mb-6 font-code transition-colors duration-500">ID: {member.nim}</p>
                    <div className="mt-auto inline-flex items-center px-2 py-1 bg-[var(--color-surface-card-elevated)] rounded-[4px] border border-[var(--color-hairline)] transition-colors duration-500 shadow-sm dark:shadow-none">
                      <span className="caption-uppercase text-[var(--color-muted)]">PNJ Developer</span>
                    </div>
                  </motion.div>
                ))}
              </div>

            </motion.div>

          </div>
        </section>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="bg-[var(--color-canvas)]/80 backdrop-blur-lg border-t border-[var(--color-hairline)] p-[64px_32px] transition-colors duration-500 relative z-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start justify-between gap-12">

          <div className="flex flex-col items-start gap-4">
            <div className="flex items-center gap-2">
              <Flame size={24} className="text-[var(--color-muted)]" />
              <span className="font-semibold text-sm text-[var(--color-muted)] transition-colors duration-500">BombaAI</span>
            </div>
            <p className="body-sm text-[var(--color-muted)] max-w-xs transition-colors duration-500">
              &copy; 2026 BombaAI.<br />
              Developer Infrastructure for Fire Detection.
            </p>
          </div>

          <div className="flex flex-wrap gap-12">
            <div className="flex flex-col gap-3">
              <span className="title-sm text-[var(--color-body-strong)] transition-colors duration-500">Resources</span>
              <a href="https://github.com/Tammam" target="_blank" rel="noreferrer" className="body-sm text-[var(--color-muted)] hover:text-[var(--color-body-strong)] transition-colors flex items-center gap-2">
                <Database size={14} /> Repository
              </a>
              <a href="#" className="body-sm text-[var(--color-muted)] hover:text-[var(--color-body-strong)] transition-colors flex items-center gap-2">
                <Cloud size={14} /> Documentation
              </a>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
}
