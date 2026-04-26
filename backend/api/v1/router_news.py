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
        response = requests.get(
            NEWSDATA_BASE_URL,
            params={
                "apikey": NEWSDATA_API_KEY,
                "q": q,
                "language": language,
            },
            timeout=15,
        )
        response.raise_for_status()
        data = response.json()

    except requests.exceptions.Timeout:
        logger.error("[News] Timeout saat mengambil berita dari NewsData.io")
        raise HTTPException(
            status_code=504,
            detail="Timeout saat mengambil berita. Silakan coba lagi.",
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


# ─── POST /news/extract ─────────────────────────────────────────────
@router.post("/news/extract", response_model=ExtractResponse)
def extract_article(
    payload: ExtractRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Extract full article text from URL using newspaper3k without summarizing.
    """
    try:
        from newspaper import Article, Config
        
        # Create a robust configuration to bypass basic bot protections (like 403 Forbidden)
        config = Config()
        config.browser_user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        config.request_timeout = 15

        article = Article(payload.url, config=config)
        article.download()
        article.parse()
        full_text = article.text

        # ─── FALLBACK TO BEAUTIFULSOUP IF NEWSPAPER3K FAILS TO EXTRACT TEXT ───
        if not full_text or len(full_text.strip()) == 0:
            logger.warning(f"[News] newspaper3k returned empty for {payload.url}, trying BeautifulSoup fallback...")
            headers = {"User-Agent": config.browser_user_agent}
            resp = requests.get(payload.url, headers=headers, timeout=15)
            resp.raise_for_status()
            
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(resp.content, "html.parser")
            paragraphs = soup.find_all('p')
            full_text = "\n\n".join([p.get_text(strip=True) for p in paragraphs if len(p.get_text(strip=True)) > 20])

        if not full_text or len(full_text.strip()) == 0:
            raise HTTPException(
                status_code=422,
                detail="Konten artikel kosong atau dilindungi oleh sistem keamanan web.",
            )

        logger.info(f"[News] Extracted {len(full_text)} chars from: {payload.url[:80]}")
        return ExtractResponse(url=payload.url, full_text=full_text)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[News] newspaper3k extraction failed: {e}")
        raise HTTPException(
            status_code=422,
            detail=f"Gagal mengekstrak artikel: {str(e)}",
        )


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

    # Step 1: Extract full text with newspaper3k if not provided
    if not full_text:
        try:
            from newspaper import Article, Config

            config = Config()
            config.browser_user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            config.request_timeout = 15

            article = Article(payload.url, config=config)
            article.download()
            article.parse()
            full_text = article.text

            # Fallback to BeautifulSoup
            if not full_text or len(full_text.strip()) == 0:
                logger.warning(f"[News] newspaper3k returned empty for {payload.url}, trying BeautifulSoup fallback...")
                headers = {"User-Agent": config.browser_user_agent}
                resp = requests.get(payload.url, headers=headers, timeout=15)
                resp.raise_for_status()
                
                from bs4 import BeautifulSoup
                soup = BeautifulSoup(resp.content, "html.parser")
                paragraphs = soup.find_all('p')
                full_text = "\n\n".join([p.get_text(strip=True) for p in paragraphs if len(p.get_text(strip=True)) > 20])

            if not full_text or len(full_text.strip()) == 0:
                raise HTTPException(
                    status_code=422,
                    detail="Konten artikel kosong atau dilindungi oleh sistem keamanan web.",
                )

            logger.info(
                f"[News] Extracted {len(full_text)} chars from: {payload.url[:80]}"
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[News] newspaper3k extraction failed: {e}")
            raise HTTPException(
                status_code=422,
                detail=f"Gagal mengekstrak artikel: {str(e)}",
            )

    # Step 2: Summarize with AI model
    # ════════════════════════════════════════════════════════════════
    # This calls the summarization service.
    # To use your trained BERT/IndoBART model, edit:
    #   backend/services/summarization_service.py
    # ════════════════════════════════════════════════════════════════
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
    except Exception as e:
        logger.error(f"[News] Summarization failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Gagal merangkum artikel: {str(e)}",
        )
