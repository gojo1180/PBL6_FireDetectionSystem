"""
Fire News Router — Fetches fire incident news and provides AI summarization.

Endpoints:
  GET  /news           — Fetch latest fire news from NewsData.io
  POST /news/summarize — Extract full article text and summarize with AI
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, HttpUrl
from typing import Optional
import requests
import os
import logging

from core.security import get_current_user
from core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Fire News"])

# ─── Config ──────────────────────────────────────────────────────────
NEWSDATA_API_KEY = settings.NEWSDATA_API_KEY or ""
NEWSDATA_BASE_URL = "https://newsdata.io/api/1/news"


# ─── Schemas ─────────────────────────────────────────────────────────
class NewsArticle(BaseModel):
    title: str
    link: str
    image_url: Optional[str] = None
    description: Optional[str] = None
    source: Optional[str] = None
    pubDate: Optional[str] = None


class SummarizeRequest(BaseModel):
    url: str
    full_text: Optional[str] = None
    model_type: Optional[str] = "mt5"


class SummarizeResponse(BaseModel):
    url: str
    full_text: str
    summary: str


class ExtractRequest(BaseModel):
    url: str


class ExtractResponse(BaseModel):
    url: str
    full_text: str


# ─── GET /news ───────────────────────────────────────────────────────
@router.get("/news")
def get_fire_news(
    q: str = "kebakaran",
    language: str = "id",
    current_user: dict = Depends(get_current_user),
):
    """
    Fetch fire-related news articles from NewsData.io.
    Returns a clean list of articles with title, link, image, description, source.
    """
    if not NEWSDATA_API_KEY or NEWSDATA_API_KEY == "YOUR_NEWSDATA_API_KEY_HERE":
        raise HTTPException(
            status_code=500,
            detail="NEWSDATA_API_KEY belum dikonfigurasi di file .env",
        )

    try:
        from requests.adapters import HTTPAdapter
        from urllib3.util.retry import Retry

        session = requests.Session()
        retries = Retry(total=3, backoff_factor=1, status_forcelist=[500, 502, 503, 504])
        session.mount("https://", HTTPAdapter(max_retries=retries))

        response = session.get(
            NEWSDATA_BASE_URL,
            params={
                "apikey": NEWSDATA_API_KEY,
                "q": q,
                "language": language,
            },
            timeout=30, # Increased from 15 to 30
        )
        response.raise_for_status()
        data = response.json()

    except requests.exceptions.Timeout:
        logger.error("[News] Timeout saat mengambil berita dari NewsData.io setelah 30 detik")
        raise HTTPException(
            status_code=504,
            detail="Timeout saat mengambil berita (NewsData.io lambat). Silakan coba lagi.",
        )
    except requests.exceptions.RequestException as e:
        logger.error(f"[News] Error dari NewsData.io: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"Gagal mengambil berita: {str(e)}",
        )

    # Parse, clean, and strictly filter the results
    results = data.get("results", [])
    articles = []
    for item in results:
        title = item.get("title", "")
        desc = item.get("description", "") or ""
        
        # Filter condition: must contain 'kebakaran'
        combined_text = f"{title} {desc}".lower()
        if "kebakaran" not in combined_text:
            continue
            
        articles.append(
            NewsArticle(
                title=title if title else "Tanpa Judul",
                link=item.get("link", ""),
                image_url=item.get("image_url"),
                description=desc,
                source=item.get("source_name") or item.get("source_id", "Unknown"),
                pubDate=item.get("pubDate"),
            ).model_dump()
        )

    return {"status": "success", "total": len(articles), "articles": articles}


# ─── Shared extraction helpers ──────────────────────────────────────
_EXTRACT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/125.0.0.0 Safari/537.36"
)
_EXTRACT_TIMEOUT = 30          # seconds per attempt
_EXTRACT_MAX_RETRIES = 3       # total attempts before giving up
_EXTRACT_BACKOFF_FACTOR = 2    # seconds: 2, 4, 8 …


def _download_with_retry(article, max_retries: int = _EXTRACT_MAX_RETRIES):
    """Try article.download() up to *max_retries* times with exponential backoff."""
    import time
    last_exc: Exception | None = None
    for attempt in range(1, max_retries + 1):
        try:
            article.download()
            return  # success
        except Exception as exc:
            last_exc = exc
            if attempt < max_retries:
                wait = _EXTRACT_BACKOFF_FACTOR ** attempt
                logger.warning(
                    f"[News] newspaper3k download attempt {attempt}/{max_retries} "
                    f"failed ({exc}), retrying in {wait}s…"
                )
                time.sleep(wait)
    # all attempts exhausted
    raise last_exc  # type: ignore[misc]


def _bs4_extract(url: str, timeout: int = _EXTRACT_TIMEOUT, max_retries: int = _EXTRACT_MAX_RETRIES) -> str:
    """Fallback extractor using requests + BeautifulSoup with retry."""
    import time
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
    from bs4 import BeautifulSoup

    session = requests.Session()
    retries = Retry(
        total=max_retries,
        backoff_factor=_EXTRACT_BACKOFF_FACTOR,
        status_forcelist=[429, 500, 502, 503, 504],
    )
    session.mount("https://", HTTPAdapter(max_retries=retries))
    session.mount("http://", HTTPAdapter(max_retries=retries))

    resp = session.get(
        url,
        headers={"User-Agent": _EXTRACT_USER_AGENT},
        timeout=timeout,
    )
    resp.raise_for_status()

    soup = BeautifulSoup(resp.content, "html.parser")

    # Remove noisy elements
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "iframe"]):
        tag.decompose()

    paragraphs = soup.find_all("p")
    text = "\n\n".join(
        p.get_text(strip=True) for p in paragraphs if len(p.get_text(strip=True)) > 20
    )
    return text


# ─── POST /news/extract ─────────────────────────────────────────────
@router.post("/news/extract", response_model=ExtractResponse)
def extract_article(
    payload: ExtractRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Extract full article text from URL.

    Strategy (in order):
      1. newspaper3k with retries (timeout 30 s × 3 attempts)
      2. Direct requests + BeautifulSoup fallback (also with retries)
    """
    full_text: str = ""

    # ── Attempt 1: newspaper3k ────────────────────────────────────
    try:
        from newspaper import Article, Config

        config = Config()
        config.browser_user_agent = _EXTRACT_USER_AGENT
        config.request_timeout = _EXTRACT_TIMEOUT

        article = Article(payload.url, config=config)
        _download_with_retry(article)
        article.parse()
        full_text = article.text or ""
        logger.info(f"[News] newspaper3k extracted {len(full_text)} chars from: {payload.url[:80]}")
    except Exception as e:
        logger.warning(f"[News] newspaper3k completely failed for {payload.url[:80]}: {e}")
        # fall through to BeautifulSoup

    # ── Attempt 2: BeautifulSoup fallback ─────────────────────────
    if not full_text.strip():
        try:
            logger.info(f"[News] Trying BeautifulSoup fallback for {payload.url[:80]}…")
            full_text = _bs4_extract(payload.url)
            logger.info(f"[News] BS4 fallback extracted {len(full_text)} chars")
        except Exception as e:
            logger.error(f"[News] BS4 fallback also failed: {e}")
            # full_text stays empty — handled below

    # ── Final check ───────────────────────────────────────────────
    if not full_text.strip():
        raise HTTPException(
            status_code=422,
            detail="Konten artikel kosong atau dilindungi oleh sistem keamanan web.",
        )

    return ExtractResponse(url=payload.url, full_text=full_text)


# ─── POST /news/summarize ───────────────────────────────────────────
@router.post("/news/summarize")
def summarize_article(
    payload: SummarizeRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Summarize the article using the AI model (BERT/IndoBART).
    If full_text is already provided in the request, it skips newspaper3k extraction.
    """
    full_text = payload.full_text

    # Step 1: Extract full text if not provided
    if not full_text:
        # ── Attempt 1: newspaper3k with retries ──────────────────
        try:
            from newspaper import Article, Config

            config = Config()
            config.browser_user_agent = _EXTRACT_USER_AGENT
            config.request_timeout = _EXTRACT_TIMEOUT

            article = Article(payload.url, config=config)
            _download_with_retry(article)
            article.parse()
            full_text = article.text or ""
            logger.info(f"[News] newspaper3k extracted {len(full_text)} chars from: {payload.url[:80]}")
        except Exception as e:
            logger.warning(f"[News] newspaper3k failed in summarize for {payload.url[:80]}: {e}")

        # ── Attempt 2: BeautifulSoup fallback ────────────────────
        if not full_text or not full_text.strip():
            try:
                logger.info(f"[News] Trying BS4 fallback for summarize: {payload.url[:80]}…")
                full_text = _bs4_extract(payload.url)
            except Exception as e:
                logger.error(f"[News] BS4 fallback also failed in summarize: {e}")

        if not full_text or not full_text.strip():
            raise HTTPException(
                status_code=422,
                detail="Konten artikel kosong atau dilindungi oleh sistem keamanan web.",
            )

    # Step 2: Summarize with AI model
    # ════════════════════════════════════════════════════════════════
    # This calls the summarization service.
    # To use your trained BERT/IndoBART model, edit:
    #   backend/services/summarization_service.py
    # ════════════════════════════════════════════════════════════════
    if payload.model_type == "extractive":
        try:
            from services.summarization_service import run_extractive_ner_model
            return run_extractive_ner_model(full_text)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[News] Extractive/NER Summarization failed: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Gagal merangkum artikel dengan model Extractive & NER: {str(e)}",
            )

    try:
        from services.summarization_service import run_summarization_model

        return StreamingResponse(
            run_summarization_model(full_text),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[News] Summarization failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Gagal merangkum artikel: {str(e)}",
        )
