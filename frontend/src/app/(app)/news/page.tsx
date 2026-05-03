"use client";

import { useEffect, useState, useCallback } from "react";
import { getNews, extractNews, NewsArticle, SummarizeResponse } from "@/lib/api";
import { getToken } from "@/lib/auth";
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
    <div className="p-4 animate-pulse">
      <div className="flex gap-3">
        <div className="w-20 h-16 rounded-lg bg-ctp-surface0 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-ctp-surface0 rounded w-full" />
          <div className="h-4 bg-ctp-surface0 rounded w-3/4" />
          <div className="h-3 bg-ctp-surface0 rounded w-1/3" />
        </div>
      </div>
    </div>
  );
}

// ─── News Card ──────────────────────────────────────────────────────
function NewsCard({
  article,
  isSelected,
  onClick,
}: {
  article: NewsArticle;
  isSelected: boolean;
  onClick: () => void;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <button
      id={`news-card-${article.link}`}
      onClick={onClick}
      className={`w-full text-left p-4 transition-all duration-200 border-b border-ctp-crust/50 group hover:bg-ctp-blue/5 ${
        isSelected
          ? "bg-ctp-blue/10 border-l-[3px] border-l-ctp-blue"
          : "border-l-[3px] border-l-transparent"
      }`}
    >
      <div className="flex gap-3">
        {/* Thumbnail */}
        <div className="w-20 h-[60px] rounded-lg overflow-hidden shrink-0 bg-ctp-surface0">
          {article.image_url && !imgError ? (
            <img
              src={article.image_url}
              alt=""
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageOff size={18} className="text-ctp-overlay0" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3
            className={`text-sm font-semibold line-clamp-2 leading-tight ${
              isSelected ? "text-ctp-blue" : "text-ctp-text"
            }`}
          >
            {article.title}
          </h3>
          <div className="flex items-center gap-2 mt-1.5">
            {article.source && (
              <span className="text-[11px] text-ctp-overlay0 flex items-center gap-1">
                <Globe size={10} />
                {article.source}
              </span>
            )}
            {article.pubDate && (
              <span className="text-[11px] text-ctp-overlay0 flex items-center gap-1">
                <Clock size={10} />
                {formatDate(article.pubDate)}
              </span>
            )}
          </div>
        </div>

        {/* Arrow */}
        <ChevronRight
          size={16}
          className={`shrink-0 self-center transition-all duration-200 ${
            isSelected
              ? "text-ctp-blue translate-x-0.5"
              : "text-ctp-surface1 group-hover:text-ctp-overlay0"
          }`}
        />
      </div>
    </button>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────
export default function FireNewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Full content lazy loading state
  const [fullText, setFullText] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  // Summarization state
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // ─── Fetch news ─────────────────────────────────────────────────
  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getNews();
      setArticles(data.articles);
      if (data.articles.length > 0 && !selectedArticle) {
        setSelectedArticle(data.articles[0]);
      }
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
    setSummaryError(null);
    setFullText(null);
    setLoadingContent(true);

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
    setSummary(null);
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
        body: JSON.stringify({ url: selectedArticle.link, full_text: fullText }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Gagal merangkum artikel`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Stream not supported");

      const decoder = new TextDecoder();
      setSummary(""); // Start empty to append

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        setSummary((prev) => (prev || "") + chunk);
      }
    } catch (err) {
      console.error("[News] Summarize error:", err);
      setSummaryError(
        err instanceof Error ? err.message : "Gagal merangkum artikel"
      );
    } finally {
      setSummarizing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* ─── Header ──────────────────────────────────────────────── */}
      <header className="h-14 border-b border-ctp-crust bg-ctp-mantle flex items-center justify-between pl-16 lg:pl-6 pr-6 shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-2 text-sm">
          <Newspaper size={16} className="text-ctp-blue" />
          <span className="font-semibold text-ctp-text">Fire News</span>
          <span className="text-ctp-overlay0">/</span>
          <span className="text-ctp-overlay0 text-xs">
            Berita Kebakaran Terkini
          </span>
        </div>
        <button
          id="refresh-news-btn"
          onClick={fetchNews}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-ctp-base border border-ctp-crust hover:border-ctp-blue/50 hover:text-ctp-blue transition-all duration-200 text-ctp-subtext0 disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </header>

      {/* ─── Master-Detail Body ──────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Left Pane: News List ─────────────────────────────────── */}
        <div className="w-full md:w-[380px] lg:w-[400px] border-r border-ctp-crust bg-ctp-mantle/50 flex flex-col shrink-0 overflow-hidden">
          {/* List header */}
          <div className="px-4 py-3 border-b border-ctp-crust/50 bg-ctp-mantle shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-ctp-overlay0">
              {loading
                ? "Memuat..."
                : `${articles.length} Berita Ditemukan`}
            </p>
          </div>

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <>
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
              </>
            ) : error ? (
              <div className="p-6 text-center">
                <AlertCircle
                  size={32}
                  className="text-ctp-red mx-auto mb-3"
                />
                <p className="text-sm text-ctp-red font-medium">{error}</p>
                <button
                  onClick={fetchNews}
                  className="mt-3 text-xs text-ctp-blue hover:underline"
                >
                  Coba Lagi
                </button>
              </div>
            ) : articles.length === 0 ? (
              <div className="p-6 text-center">
                <Newspaper
                  size={32}
                  className="text-ctp-overlay0 mx-auto mb-3"
                />
                <p className="text-sm text-ctp-subtext0">
                  Tidak ada berita ditemukan
                </p>
              </div>
            ) : (
              articles.map((article, idx) => (
                <NewsCard
                  key={`${article.link}-${idx}`}
                  article={article}
                  isSelected={selectedArticle?.link === article.link}
                  onClick={() => handleSelectArticle(article)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Right Pane: Article Detail ───────────────────────────── */}
        <div className="hidden md:flex flex-1 flex-col overflow-y-auto bg-ctp-base">
          {selectedArticle ? (
            <div className="max-w-3xl mx-auto w-full p-6 lg:p-8 space-y-6">
              {/* Article Header */}
              <div className="space-y-4">
                {/* Source & Date */}
                <div className="flex items-center gap-3 flex-wrap">
                  {selectedArticle.source && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ctp-blue/10 text-ctp-blue text-xs font-semibold">
                      <Globe size={12} />
                      {selectedArticle.source}
                    </span>
                  )}
                  {selectedArticle.pubDate && (
                    <span className="text-xs text-ctp-overlay0 flex items-center gap-1">
                      <Clock size={12} />
                      {formatDate(selectedArticle.pubDate)}
                    </span>
                  )}
                </div>

                {/* Title */}
                <h1 className="text-2xl lg:text-3xl font-bold text-ctp-text leading-tight">
                  {selectedArticle.title}
                </h1>

                {/* Hero Image */}
                {selectedArticle.image_url && (
                  <div className="rounded-2xl overflow-hidden border border-ctp-crust">
                    <img
                      src={selectedArticle.image_url}
                      alt={selectedArticle.title}
                      className="w-full h-auto max-h-[400px] object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                )}

                {/* Content */}
                {loadingContent ? (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-4 bg-ctp-surface0 rounded w-full" />
                    <div className="h-4 bg-ctp-surface0 rounded w-full" />
                    <div className="h-4 bg-ctp-surface0 rounded w-5/6" />
                    <div className="h-4 bg-ctp-surface0 rounded w-4/6" />
                  </div>
                ) : (
                  (fullText || selectedArticle.description) && (
                    <p className="text-ctp-subtext0 leading-relaxed text-[15px] whitespace-pre-wrap">
                      {fullText || selectedArticle.description}
                    </p>
                  )
                )}

                {/* Open Original */}
                <a
                  href={selectedArticle.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-ctp-blue hover:underline font-medium"
                >
                  Buka artikel asli
                  <ExternalLink size={14} />
                </a>
              </div>

              {/* ─── AI Summary Section ───────────────────────────── */}
              <div className="border-t border-ctp-crust pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-ctp-text uppercase tracking-wide flex items-center gap-2">
                    <Sparkles size={16} className="text-ctp-blue" />
                    AI Summary
                  </h2>
                </div>

                {/* Summarize Button */}
                <button
                  id="summarize-btn"
                  onClick={handleSummarize}
                  disabled={summarizing}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all duration-300 disabled:opacity-60 disabled:cursor-wait
                    bg-gradient-to-r from-ctp-blue to-ctp-sapphire text-white
                    hover:shadow-lg hover:shadow-ctp-blue/25 hover:-translate-y-0.5
                    active:translate-y-0"
                >
                  {summarizing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Merangkum artikel...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      Rangkum Artikel dengan AI
                    </>
                  )}
                </button>

                {/* Summary Result Box */}
                {summary && (
                  <div className="relative p-5 rounded-2xl bg-ctp-blue/5 border border-ctp-blue/20 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-lg bg-ctp-blue/15 flex items-center justify-center">
                        <Sparkles size={14} className="text-ctp-blue" />
                      </div>
                      <span className="text-xs font-bold text-ctp-blue uppercase tracking-wider">
                        Hasil Ringkasan
                      </span>
                    </div>
                    <p className="text-ctp-text leading-relaxed text-[15px] whitespace-pre-wrap">
                      {summary}
                      {summarizing && <span className="animate-pulse font-bold ml-1 text-ctp-blue">|</span>}
                    </p>
                  </div>
                )}

                {/* Loading state before first chunk arrives */}
                {summarizing && !summary && (
                  <div className="relative p-5 rounded-2xl bg-ctp-blue/5 border border-ctp-blue/20 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center gap-2 mb-3">
                      <Loader2 size={14} className="text-ctp-blue animate-spin" />
                      <span className="text-xs font-bold text-ctp-blue uppercase tracking-wider">
                        AI sedang memproses...
                      </span>
                    </div>
                  </div>
                )}

                {/* Summary Error */}
                {summaryError && (
                  <div className="p-4 rounded-xl bg-ctp-red/5 border border-ctp-red/20">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={16} className="text-ctp-red shrink-0" />
                      <p className="text-sm text-ctp-red">{summaryError}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Empty State */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-ctp-surface0 flex items-center justify-center mx-auto mb-4">
                  <Newspaper size={28} className="text-ctp-overlay0" />
                </div>
                <p className="text-ctp-subtext0 font-medium">
                  Pilih berita untuk melihat detail
                </p>
                <p className="text-xs text-ctp-overlay0 mt-1">
                  Klik salah satu berita di panel kiri
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
