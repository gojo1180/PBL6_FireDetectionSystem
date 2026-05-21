"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getNews, extractNews, NewsArticle } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import {
  Newspaper,
  Sparkles,
  ExternalLink,
  Clock,
  Globe,
  Loader2,
  AlertCircle,
  RefreshCw,
  ImageOff,
  ArrowLeft,
  MapPin,
  Timer,
  Tag,
  FileText,
  Zap,
  RotateCcw,
} from "lucide-react";

// ─── Helper: format date ────────────────────────────────────────────
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Baru saja";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return "Baru saja";
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "Baru saja";
    if (hours < 24) return `${hours} jam lalu`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "Kemarin";
    if (days < 7) return `${days} hari lalu`;
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  } catch {
    return dateStr || "Baru saja";
  }
}

// ─── Skeleton Loaders ───────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse shadow-sm">
      <div className="h-36 rounded-xl bg-slate-100 mb-3" />
      <div className="space-y-2">
        <div className="h-4 bg-slate-100 rounded-md w-full" />
        <div className="h-4 bg-slate-100 rounded-md w-2/3" />
        <div className="flex gap-2 mt-3">
          <div className="h-5 bg-slate-100 rounded-full w-16" />
          <div className="h-5 bg-slate-100 rounded-full w-20" />
        </div>
      </div>
    </div>
  );
}

// ─── News Card Component (Grid Card Style) ──────────────────────────
function NewsCard({
  article,
  isSelected,
  onClick,
  index,
}: {
  article: NewsArticle;
  isSelected: boolean;
  onClick: () => void;
  index: number;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35 }}
      id={`news-card-${index}`}
      onClick={onClick}
      className={`w-full text-left rounded-2xl border transition-all duration-300 overflow-hidden group shadow-sm hover:shadow-md ${
        isSelected
          ? "border-indigo-300 bg-indigo-50/60 ring-2 ring-indigo-200"
          : "border-slate-100 bg-white hover:border-slate-200"
      }`}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[16/9] w-full bg-slate-100 overflow-hidden">
        {article.image_url && !imgError ? (
          <img
            src={article.image_url}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
            <Newspaper size={28} className="text-slate-300" />
          </div>
        )}
        {/* Source badge overlay */}
        {article.source && (
          <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-white/90 backdrop-blur-sm text-[10px] font-bold text-slate-700 uppercase tracking-wide shadow-sm">
            {article.source}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3
          className={`text-sm font-semibold line-clamp-2 leading-snug mb-2.5 transition-colors ${
            isSelected ? "text-indigo-700" : "text-slate-800 group-hover:text-indigo-600"
          }`}
        >
          {article.title}
        </h3>

        {article.description && (
          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">
            {article.description}
          </p>
        )}

        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
          <Clock size={11} />
          <span>{formatShortDate(article.pubDate)}</span>
        </div>
      </div>
    </motion.button>
  );
}

// ─── Main Page Component ───────────────────────────────────────────
export default function FireNewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Full content & Summary state
  const [fullText, setFullText] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [modelType, setModelType] = useState<"mt5" | "extractive">("mt5");
  const [entities, setEntities] = useState<{
    LOKASI: string[];
    WAKTU: string[];
    OBJEK: string[];
  } | null>(null);

  const detailScrollRef = useRef<HTMLDivElement>(null);

  // ─── Fetch news ─────────────────────────────────────────────────
  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getNews();
      setArticles(data.articles);
    } catch (err) {
      console.error("[News] Fetch error:", err);
      setError(err instanceof Error ? err.message : "Gagal memuat berita");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  // ─── Select article ─────────────────────────────────────────────
  const handleSelectArticle = async (article: NewsArticle) => {
    setSelectedArticle(article);
    setSummary(null);
    setEntities(null);
    setSummaryError(null);
    setFullText(null);
    setLoadingContent(true);

    // Scroll to top of detail
    if (detailScrollRef.current) {
      detailScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
    // On mobile, scroll to detail section
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setTimeout(() => {
        document.getElementById("article-detail")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }

    try {
      const data = await extractNews(article.link);
      setFullText(data.full_text);
    } catch (err) {
      console.error("[News] Extract error:", err);
      setFullText(article.description || "Gagal memuat teks penuh.");
    } finally {
      setLoadingContent(false);
    }
  };

  // ─── Summarize article ──────────────────────────────────────────
  const handleSummarize = async () => {
    if (!selectedArticle) return;

    setSummarizing(true);
    setSummary("");
    setEntities(null);
    setSummaryError(null);

    try {
      const token = getToken();
      const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";
      const response = await fetch(`${BASE_URL}/api/v1/news/summarize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ 
          url: selectedArticle.link, 
          full_text: fullText,
          model_type: modelType
        }),
      });

      if (!response.ok) throw new Error(`Gagal merangkum: ${response.status}`);

      if (modelType === "mt5") {
        const reader = response.body?.getReader();
        if (!reader) throw new Error("Stream not supported");

        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          setSummary((prev) => (prev || "") + chunk);
        }
      } else {
        const data = await response.json();
        setSummary(data.summary);
        setEntities(data.entities);
      }
    } catch (err) {
      console.error("[News] Summarize error:", err);
      setSummaryError(err instanceof Error ? err.message : "Gagal merangkum");
    } finally {
      setSummarizing(false);
    }
  };

  // ─── Back to list (mobile) ──────────────────────────────────────
  const handleBack = () => {
    setSelectedArticle(null);
    setSummary(null);
    setEntities(null);
    setSummaryError(null);
    setFullText(null);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ─── Header ──────────────────────────────────────────────── */}
      <header className="h-16 border-b border-slate-100 bg-white flex items-center justify-between pl-16 lg:pl-6 pr-6 shrink-0 sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          {selectedArticle && (
            <button
              onClick={handleBack}
              className="lg:hidden flex items-center gap-1.5 text-indigo-600 font-semibold text-sm mr-2"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div className="p-2 rounded-lg bg-indigo-50">
            <Newspaper size={18} className="text-indigo-500" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-800 leading-none">Berita Kebakaran</h1>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">
              Laporan Terkini & Analisis AI
            </p>
          </div>
        </div>

        <button
          onClick={fetchNews}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-50 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 transition-all duration-200 text-slate-600 active:scale-95 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          <span className="hidden sm:inline">Perbarui</span>
        </button>
      </header>

      {/* ─── Content: 2-Column on Desktop, Stacked on Mobile ────── */}
      <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-64px)]">
        
        {/* ── Left: News Grid ────────────────────────────────────── */}
        <div className={`lg:w-[480px] xl:w-[520px] lg:border-r border-slate-100 lg:overflow-y-auto bg-slate-50 shrink-0 ${
          selectedArticle ? "hidden lg:block" : ""
        }`}>
          {/* Counter bar */}
          <div className="px-6 py-3 border-b border-slate-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              {loading ? "Memuat berita..." : `${articles.length} Berita ditemukan`}
            </p>
          </div>

          <div className="p-4">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
                {Array(6).fill(0).map((_, i) => <CardSkeleton key={i} />)}
              </div>
            ) : error ? (
              <div className="py-16 text-center flex flex-col items-center">
                <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
                  <AlertCircle size={24} className="text-red-400" />
                </div>
                <p className="text-sm text-slate-600 font-semibold mb-1">{error}</p>
                <p className="text-xs text-slate-400 mb-5">Periksa koneksi internet Anda</p>
                <button
                  onClick={fetchNews}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  Coba Lagi
                </button>
              </div>
            ) : articles.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center">
                <Newspaper size={40} className="text-slate-300 mb-3" />
                <p className="text-sm text-slate-500 font-medium">Belum ada berita hari ini</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
                {articles.map((article, idx) => (
                  <NewsCard
                    key={`${article.link}-${idx}`}
                    article={article}
                    isSelected={selectedArticle?.link === article.link}
                    onClick={() => handleSelectArticle(article)}
                    index={idx}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Article Detail ──────────────────────────────── */}
        <div
          id="article-detail"
          ref={detailScrollRef}
          className={`flex-1 lg:overflow-y-auto bg-white ${
            !selectedArticle ? "hidden lg:flex" : ""
          }`}
        >
          {selectedArticle ? (
            <motion.div
              key={selectedArticle.link}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="max-w-3xl mx-auto px-5 py-8 lg:px-12 lg:py-10"
            >
              {/* Mobile Back */}
              <button
                onClick={handleBack}
                className="lg:hidden flex items-center gap-2 text-indigo-600 font-semibold text-sm mb-6"
              >
                <ArrowLeft size={16} />
                Kembali ke daftar
              </button>

              {/* ── Article Header ─────────────────────────────────── */}
              <header className="mb-8">
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  {selectedArticle.source && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-[11px] font-bold uppercase tracking-wide">
                      <Globe size={11} />
                      {selectedArticle.source}
                    </span>
                  )}
                  {selectedArticle.pubDate && (
                    <span className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
                      <Clock size={12} />
                      {formatDate(selectedArticle.pubDate)}
                    </span>
                  )}
                </div>

                <h2 className="text-xl lg:text-2xl text-slate-900 font-bold leading-snug mb-5">
                  {selectedArticle.title}
                </h2>

                {/* Hero Image */}
                {selectedArticle.image_url && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl overflow-hidden border border-slate-100 shadow-sm bg-slate-50"
                  >
                    <img
                      src={selectedArticle.image_url}
                      alt=""
                      className="w-full h-auto max-h-[400px] object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </motion.div>
                )}
              </header>

              {/* ── Article Content ────────────────────────────────── */}
              <section className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <FileText size={15} className="text-slate-400" />
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Isi Artikel
                  </h3>
                </div>

                <AnimatePresence mode="wait">
                  {loadingContent ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-3"
                    >
                      {Array(5).fill(0).map((_, i) => (
                        <div key={i} className={`h-4 bg-slate-100 rounded-md animate-pulse ${
                          i === 4 ? "w-3/5" : i === 3 ? "w-4/5" : "w-full"
                        }`} />
                      ))}
                    </motion.div>
                  ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                        {fullText || selectedArticle.description}
                      </p>
                      <a
                        href={selectedArticle.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 mt-5 text-sm font-semibold text-indigo-600 hover:text-indigo-700 hover:gap-3 transition-all"
                      >
                        Baca di sumber asli
                        <ExternalLink size={14} />
                      </a>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              {/* ─── AI Summarization Section ─────────────────────── */}
              <section className="bg-slate-50 border border-slate-100 rounded-2xl p-6 lg:p-8">
                {/* Header row */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
                      <Sparkles size={18} className={`text-indigo-600 ${summarizing ? "animate-pulse" : ""}`} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Ringkasan AI</h3>
                      <p className="text-[11px] text-slate-400 font-medium">Powered by deep learning models</p>
                    </div>
                  </div>
                </div>

                {/* Model Selector */}
                <div className="flex bg-white p-1 rounded-xl border border-slate-150 w-fit mb-5">
                  <button
                    onClick={() => {
                      if (modelType !== "mt5") { setModelType("mt5"); setSummary(null); setEntities(null); }
                    }}
                    disabled={summarizing}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                      modelType === "mt5"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    mT5 Abstraktif
                  </button>
                  <button
                    onClick={() => {
                      if (modelType !== "extractive") { setModelType("extractive"); setSummary(null); setEntities(null); }
                    }}
                    disabled={summarizing}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                      modelType === "extractive"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Ekstraktif & NER
                  </button>
                </div>

                {/* Summarize Button or Loading */}
                {!summary && !summarizing && !summaryError && (
                  <button
                    onClick={handleSummarize}
                    disabled={loadingContent}
                    className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Zap size={15} />
                    Rangkum Sekarang
                  </button>
                )}

                {/* Loading state */}
                {summarizing && !summary && (
                  <div className="flex items-center justify-center gap-3 py-8">
                    <Loader2 size={20} className="text-indigo-500 animate-spin" />
                    <span className="text-sm text-slate-500 font-medium">Sedang merangkum artikel...</span>
                  </div>
                )}

                {/* Summary Result */}
                <AnimatePresence>
                  {(summary || summarizing) && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mt-1"
                    >
                      {/* Summary text */}
                      <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                          <div className={`w-2 h-2 rounded-full ${summarizing ? "bg-indigo-500 animate-pulse" : "bg-emerald-500"}`} />
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {modelType === "mt5" ? "Ringkasan Abstraktif" : "Ringkasan Ekstraktif"}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                          {summary}
                          {summarizing && <span className="inline-block w-1.5 h-4 bg-indigo-500 ml-0.5 animate-pulse rounded-sm" />}
                        </p>
                      </div>

                      {/* NER Entities */}
                      {modelType === "extractive" && entities && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3"
                        >
                          {/* LOKASI */}
                          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-2.5">
                              <MapPin size={13} className="text-indigo-500" />
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lokasi</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {entities.LOKASI && entities.LOKASI.length > 0 ? (
                                entities.LOKASI.map((loc, idx) => (
                                  <span key={idx} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                                    {loc}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-slate-400 italic">Tidak terdeteksi</span>
                              )}
                            </div>
                          </div>

                          {/* WAKTU */}
                          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-2.5">
                              <Timer size={13} className="text-violet-500" />
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Waktu</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {entities.WAKTU && entities.WAKTU.length > 0 ? (
                                entities.WAKTU.map((time, idx) => (
                                  <span key={idx} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-violet-50 text-violet-700 border border-violet-100">
                                    {time}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-slate-400 italic">Tidak terdeteksi</span>
                              )}
                            </div>
                          </div>

                          {/* OBJEK */}
                          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-2.5">
                              <Tag size={13} className="text-amber-500" />
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Objek</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {entities.OBJEK && entities.OBJEK.length > 0 ? (
                                entities.OBJEK.map((obj, idx) => (
                                  <span key={idx} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                                    {obj}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-slate-400 italic">Tidak terdeteksi</span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between mt-4 px-1">
                        <p className="text-[10px] text-slate-400 font-medium">
                          AI dapat membuat kesalahan. Periksa informasi penting.
                        </p>
                        {summary && !summarizing && (
                          <button
                            onClick={handleSummarize}
                            className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                          >
                            <RotateCcw size={11} />
                            Ulangi
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Error State */}
                {summaryError && (
                  <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-100 flex items-start gap-3">
                    <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-red-600 font-semibold">{summaryError}</p>
                      <button
                        onClick={handleSummarize}
                        className="text-xs text-red-500 font-medium underline mt-1"
                      >
                        Coba lagi
                      </button>
                    </div>
                  </div>
                )}
              </section>
            </motion.div>
          ) : (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-xs"
              >
                <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-5">
                  <Newspaper size={32} className="text-slate-300" />
                </div>
                <h3 className="text-base font-bold text-slate-700 mb-2">Pilih Berita</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Pilih artikel dari daftar di sebelah kiri untuk melihat detail lengkap dan ringkasan AI.
                </p>
              </motion.div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
