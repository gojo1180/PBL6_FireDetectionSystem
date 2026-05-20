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
  ChevronRight,
  ImageOff,
  ArrowLeft,
  Share2,
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

// ─── Skeleton Loaders ───────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div className="p-5 animate-pulse border-b border-hairline/50">
      <div className="flex gap-4">
        <div className="w-24 h-16 rounded-xl bg-surface-card-elevated shrink-0" />
        <div className="flex-1 space-y-3">
          <div className="h-4 bg-surface-card-elevated rounded-md w-full" />
          <div className="h-3 bg-surface-card-elevated rounded-md w-2/3" />
          <div className="flex gap-2">
            <div className="h-2 bg-surface-card-elevated rounded-md w-12" />
            <div className="h-2 bg-surface-card-elevated rounded-md w-12" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── News Card Component ────────────────────────────────────────────
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      id={`news-card-${article.link}`}
      onClick={onClick}
      className={`w-full text-left p-4 lg:p-5 transition-all duration-300 border-b border-hairline/30 group relative overflow-hidden ${
        isSelected
          ? "bg-primary/5"
          : "hover:bg-surface-card-elevated/50"
      }`}
    >
      {/* Active Indicator */}
      {isSelected && (
        <motion.div
          layoutId="active-indicator"
          className="absolute left-0 top-0 bottom-0 w-1 bg-primary"
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}

      <div className="flex gap-4 relative z-10">
        {/* Thumbnail */}
        <div className="w-24 h-[68px] rounded-xl overflow-hidden shrink-0 bg-surface-card-elevated border border-hairline/50 relative group-hover:border-primary/30 transition-colors">
          {article.image_url && !imgError ? (
            <img
              src={article.image_url}
              alt=""
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-surface-card">
              <ImageOff size={18} className="text-muted-soft" />
            </div>
          )}
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            {article.source && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                <Globe size={10} />
                {article.source}
              </span>
            )}
            <span className="text-[10px] text-muted-soft">•</span>
            {article.pubDate && (
              <span className="text-[10px] text-muted-soft flex items-center gap-1 font-medium">
                <Clock size={10} />
                {formatDate(article.pubDate).split(",")[0]}
              </span>
            )}
          </div>
          <h3
            className={`text-sm font-semibold line-clamp-2 leading-snug transition-colors ${
              isSelected ? "text-primary" : "text-ink group-hover:text-primary/90"
            }`}
          >
            {article.title}
          </h3>
        </div>

        {/* Arrow */}
        <div className="self-center ml-2">
          <ChevronRight
            size={16}
            className={`transition-all duration-300 ${
              isSelected
                ? "text-primary translate-x-1"
                : "text-muted-soft opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5"
            }`}
          />
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
  const [showMobileDetail, setShowMobileDetail] = useState(false);

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
      if (data.articles.length > 0 && !selectedArticle) {
        // Don't auto-select on mobile to avoid showing detail immediately
        if (typeof window !== "undefined" && window.innerWidth >= 768) {
           handleSelectArticle(data.articles[0], false);
        }
      }
    } catch (err) {
      console.error("[News] Fetch error:", err);
      setError(err instanceof Error ? err.message : "Gagal memuat berita");
    } finally {
      setLoading(false);
    }
  }, [selectedArticle]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  // ─── Select article ─────────────────────────────────────────────
  const handleSelectArticle = async (article: NewsArticle, mobile = true) => {
    setSelectedArticle(article);
    if (mobile) setShowMobileDetail(true);
    
    setSummary(null);
    setEntities(null);
    setSummaryError(null);
    setFullText(null);
    setLoadingContent(true);

    // Reset scroll position
    if (detailScrollRef.current) {
      detailScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
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

  return (
    <div className="flex flex-col h-screen bg-canvas overflow-hidden">
      {/* ─── Header ──────────────────────────────────────────────── */}
      <header className="h-16 border-b border-hairline bg-canvas/80 backdrop-blur-xl flex items-center justify-between px-6 shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
            <Newspaper size={20} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-ink leading-none">Berita Kebakaran</h1>
            <p className="text-[10px] text-muted font-medium mt-1 uppercase tracking-widest">
              Laporan Terkini & Analisis AI
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={fetchNews}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-surface-card border border-hairline hover:border-primary/50 hover:text-primary transition-all duration-300 text-body active:scale-95 disabled:opacity-50 group"
          >
            <RefreshCw size={14} className={`${loading ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"}`} />
            <span className="hidden sm:inline">Perbarui</span>
          </button>
        </div>
      </header>

      {/* ─── Master-Detail Layout ─────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* ── Left Pane: News List ─────────────────────────────────── */}
        <aside 
          className={`absolute inset-0 md:relative md:flex md:w-[380px] lg:w-[420px] xl:w-[460px] border-r border-hairline bg-canvas-deep flex flex-col shrink-0 overflow-hidden z-20 transition-transform duration-300 ${
            showMobileDetail ? "-translate-x-full md:translate-x-0" : "translate-x-0"
          }`}
        >
          {/* List Toolbar */}
          <div className="px-6 py-4 bg-canvas/50 border-b border-hairline flex items-center justify-between shrink-0">
            <span className="text-[10px] font-bold text-muted uppercase tracking-[0.2em]">
              {loading ? "Sinkronisasi..." : `${articles.length} Berita Terdeteksi`}
            </span>
          </div>

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {loading ? (
              Array(6).fill(0).map((_, i) => <CardSkeleton key={i} />)
            ) : error ? (
              <div className="p-10 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-semantic-error/10 flex items-center justify-center mb-4">
                  <AlertCircle size={32} className="text-semantic-error" />
                </div>
                <p className="text-sm text-body font-semibold mb-4">{error}</p>
                <button
                  onClick={fetchNews}
                  className="px-6 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:shadow-lg transition-all"
                >
                  Coba Lagi
                </button>
              </div>
            ) : articles.length === 0 ? (
              <div className="p-10 text-center opacity-50 flex flex-col items-center">
                <Newspaper size={48} className="text-muted mb-4" />
                <p className="text-sm font-medium">Belum ada berita hari ini</p>
              </div>
            ) : (
              <div className="divide-y divide-hairline/20">
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
        </aside>

        {/* ── Right Pane: Article Detail ───────────────────────────── */}
        <main 
          ref={detailScrollRef}
          className={`absolute inset-0 md:relative md:flex flex-1 flex-col overflow-y-auto bg-canvas z-30 transition-transform duration-300 md:translate-x-0 ${
            showMobileDetail ? "translate-x-0" : "translate-x-full"
          }`}
        >
          {selectedArticle ? (
            <div className="w-full">
              {/* Mobile Back Button & Header */}
              <div className="md:hidden sticky top-0 bg-canvas/90 backdrop-blur-md border-b border-hairline px-4 h-14 flex items-center justify-between z-40">
                <button 
                  onClick={() => setShowMobileDetail(false)}
                  className="flex items-center gap-2 text-primary font-bold text-sm"
                >
                  <ArrowLeft size={18} />
                  Daftar Berita
                </button>
                <div className="flex gap-3">
                  <button className="p-2 text-muted hover:text-primary transition-colors">
                    <Share2 size={18} />
                  </button>
                </div>
              </div>

              <motion.div 
                key={selectedArticle.link}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="max-w-4xl mx-auto p-6 lg:p-12 space-y-10"
              >
                {/* Article Header */}
                <header className="space-y-6">
                  <div className="flex items-center gap-4 flex-wrap">
                    {selectedArticle.source && (
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold uppercase tracking-wider">
                        <Globe size={12} />
                        {selectedArticle.source}
                      </div>
                    )}
                    {selectedArticle.pubDate && (
                      <div className="text-xs text-muted flex items-center gap-2 font-medium">
                        <Clock size={14} className="text-muted-soft" />
                        {formatDate(selectedArticle.pubDate)}
                      </div>
                    )}
                  </div>

                  <h2 className="text-2xl lg:text-3xl text-ink font-bold leading-tight">
                    {selectedArticle.title}
                  </h2>

                  {/* Hero Image */}
                  {selectedArticle.image_url && (
                    <motion.div 
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="rounded-3xl overflow-hidden border border-hairline/50 shadow-2xl shadow-primary/5 bg-surface-card"
                    >
                      <img
                        src={selectedArticle.image_url}
                        alt=""
                        className="w-full h-auto max-h-[500px] object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </motion.div>
                  )}
                </header>

                {/* Content Section */}
                <div className="relative">
                  <AnimatePresence mode="wait">
                    {loadingContent ? (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-4"
                      >
                        <div className="h-4 bg-surface-card-elevated rounded-md w-full animate-pulse" />
                        <div className="h-4 bg-surface-card-elevated rounded-md w-full animate-pulse delay-75" />
                        <div className="h-4 bg-surface-card-elevated rounded-md w-5/6 animate-pulse delay-150" />
                        <div className="h-4 bg-surface-card-elevated rounded-md w-4/6 animate-pulse delay-300" />
                      </motion.div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="prose prose-invert max-w-none"
                      >
                        <p className="body-md text-body leading-relaxed whitespace-pre-wrap selection:bg-primary/30">
                          {fullText || selectedArticle.description}
                        </p>
                        
                        <div className="mt-8 pt-8 border-t border-hairline flex flex-wrap gap-4 items-center justify-between">
                          <a
                            href={selectedArticle.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:gap-3 transition-all"
                          >
                            Baca selengkapnya di sumber asli
                            <ExternalLink size={16} />
                          </a>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ─── AI Magic Section ───────────────────────────── */}
                <section className="relative group">
                  {/* Decorative glow */}
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-accent-cyan rounded-[2rem] opacity-20 blur-xl group-hover:opacity-30 transition-opacity duration-500" />
                  
                  <div className="relative bg-surface-card border border-hairline/50 rounded-[2rem] p-8 lg:p-10 shadow-xl overflow-hidden">
                    {/* Background pattern */}
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                      <Sparkles size={120} className="text-primary" />
                    </div>

                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                          <Sparkles size={24} className={summarizing ? "animate-pulse" : ""} />
                        </div>
                        <div>
                          <h3 className="text-lg text-ink font-bold">Ringkasan Cerdas AI</h3>
                          <p className="text-xs text-muted font-medium mt-0.5">Analisis instan menggunakan model bahasa canggih</p>
                        </div>
                      </div>

                      {!summary && !summarizing && (
                        <button
                          onClick={handleSummarize}
                          className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-primary text-white font-bold text-sm hover:shadow-lg hover:shadow-primary/20 transition-all group"
                        >
                          <Sparkles size={16} className="mr-2 group-hover:rotate-12 transition-transform" />
                          Rangkum Sekarang
                        </button>
                      )}
                    </div>

                    {/* Model Selector Toggle */}
                    <div className="flex bg-canvas-deep p-1 rounded-xl border border-hairline/30 w-fit mb-8 relative z-10">
                      <button
                        onClick={() => {
                          if (modelType !== "mt5") {
                            setModelType("mt5");
                            setSummary(null);
                            setEntities(null);
                          }
                        }}
                        disabled={summarizing}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          modelType === "mt5"
                            ? "bg-primary text-white shadow-sm"
                            : "text-muted hover:text-ink hover:bg-surface-card-elevated"
                        }`}
                      >
                        mT5 (Abstraktif)
                      </button>
                      <button
                        onClick={() => {
                          if (modelType !== "extractive") {
                            setModelType("extractive");
                            setSummary(null);
                            setEntities(null);
                          }
                        }}
                        disabled={summarizing}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          modelType === "extractive"
                            ? "bg-primary text-white shadow-sm"
                            : "text-muted hover:text-ink hover:bg-surface-card-elevated"
                        }`}
                      >
                        BiLSTM-CRF & TextRank (Ekstraktif & NER)
                      </button>
                    </div>

                    <AnimatePresence>
                      {(summarizing || summary) && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-4"
                        >
                          <div className={`p-6 rounded-2xl bg-canvas-deep border border-hairline/30 relative overflow-hidden ${summarizing ? "animate-pulse-slow" : ""}`}>
                            <div className="flex items-center gap-2 mb-4 text-[10px] font-bold text-primary uppercase tracking-widest">
                              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                              Wawasan Utama {modelType === "mt5" ? "(mT5 Abstraktif)" : "(BiLSTM-CRF Ekstraktif)"}
                            </div>
                            
                            <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
                              {summary}
                              {summarizing && <span className="inline-block w-2 h-5 bg-primary ml-1 animate-blink" />}
                            </p>

                            {summaryError && (
                              <div className="mt-4 p-4 rounded-xl bg-semantic-error/10 border border-semantic-error/20 flex items-center gap-3">
                                <AlertCircle size={18} className="text-semantic-error" />
                                <p className="text-xs text-semantic-error font-medium">{summaryError}</p>
                              </div>
                            )}
                          </div>

                          {/* Entities Section (NER) */}
                          {modelType === "extractive" && entities && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="mt-6 pt-6 border-t border-hairline/30 space-y-4"
                            >
                              <h4 className="text-xs font-bold text-muted uppercase tracking-wider">
                                Entitas Kebakaran Terdeteksi (NER)
                              </h4>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {/* LOKASI */}
                                <div className="p-4 rounded-2xl bg-canvas-deep border border-hairline/30 flex flex-col gap-2 shadow-inner">
                                  <span className="text-[10px] font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
                                    📍 Lokasi
                                  </span>
                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                    {entities.LOKASI && entities.LOKASI.length > 0 ? (
                                      entities.LOKASI.map((loc, idx) => (
                                        <span
                                          key={idx}
                                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary/10 border border-primary/20 text-primary"
                                        >
                                          {loc}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-xs text-muted-soft italic">Tidak terdeteksi</span>
                                    )}
                                  </div>
                                </div>

                                {/* WAKTU */}
                                <div className="p-4 rounded-2xl bg-canvas-deep border border-hairline/30 flex flex-col gap-2 shadow-inner">
                                  <span className="text-[10px] font-bold text-purple flex items-center gap-1.5 uppercase tracking-wider">
                                    🕒 Waktu
                                  </span>
                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                    {entities.WAKTU && entities.WAKTU.length > 0 ? (
                                      entities.WAKTU.map((time, idx) => (
                                        <span
                                          key={idx}
                                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-500/10 border border-purple-500/20 text-purple-400"
                                        >
                                          {time}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-xs text-muted-soft italic">Tidak terdeteksi</span>
                                    )}
                                  </div>
                                </div>

                                {/* OBJEK */}
                                <div className="p-4 rounded-2xl bg-canvas-deep border border-hairline/30 flex flex-col gap-2 shadow-inner">
                                  <span className="text-[10px] font-bold text-amber-500 flex items-center gap-1.5 uppercase tracking-wider">
                                    🏷️ Objek Kebakaran
                                  </span>
                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                    {entities.OBJEK && entities.OBJEK.length > 0 ? (
                                      entities.OBJEK.map((obj, idx) => (
                                        <span
                                          key={idx}
                                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400"
                                        >
                                          {obj}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-xs text-muted-soft italic">Tidak terdeteksi</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                          
                          <div className="flex items-center justify-between px-2">
                             <p className="text-[10px] text-muted-soft font-medium">AI can make mistakes. Check important info.</p>
                             {summary && !summarizing && (
                               <button 
                                 onClick={handleSummarize}
                                 className="text-[10px] font-bold text-primary hover:underline uppercase tracking-wider"
                               >
                                 Regenerasi
                               </button>
                             )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </section>
              </motion.div>
            </div>
          ) : (
            /* Empty Detail State */
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-xs space-y-6"
              >
                <div className="w-24 h-24 rounded-[2rem] bg-surface-card border border-hairline flex items-center justify-center mx-auto shadow-xl">
                  <Newspaper size={40} className="text-muted-soft" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg text-ink">Eksplorasi Berita</h3>
                  <p className="text-sm text-muted leading-relaxed">
                    Pilih laporan kebakaran dari panel sebelah kiri untuk melihat detail mendalam dan ringkasan AI.
                  </p>
                </div>
              </motion.div>
            </div>
          )}
        </main>
      </div>

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .animate-blink {
          animation: blink 1s step-end infinite;
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.85; }
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
