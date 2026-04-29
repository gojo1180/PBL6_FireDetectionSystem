"""
Summarization Service — Hugging Face Spaces (Gradio API).

This module provides the summarization interface for the Fire News feature.
Instead of loading a heavy model into local RAM, it delegates inference
to the Gradio API running on the HF Space "nizu31/summary-kebakaran"
which hosts the "nizu31/mt5-summary-kebakaran" model.

The Space exposes a named endpoint `/summarize_text` that accepts a text
string and returns the mT5-generated summary.
"""

import json
import logging
import requests
from fastapi import HTTPException

from core.config import settings

logger = logging.getLogger(__name__)

# ── Configuration from .env via pydantic-settings ──────────────────────────
HF_SPACE_URL = settings.HF_SUMMARY_MODEL_URL  
HF_API_KEY = settings.HF_API_KEY


def run_summarization_model(
    full_text: str,
    max_length: int = 150,
    min_length: int = 40,
):
    """
    Summarize the given full article text via the HF Space Gradio API.

    Uses the two-step Gradio call protocol:
      1. POST /gradio_api/call/summarize_text  → returns an EVENT_ID
      2. GET  /gradio_api/call/summarize_text/{EVENT_ID} → streams the result

    Handles cold-start (Space sleeping / 503) gracefully.
    """
    # ── Guard: empty input ──────────────────────────────────────────────
    if not full_text or not full_text.strip():
        yield "Tidak ada konten artikel yang bisa dirangkum."
        return

    # ── Guard: missing configuration ────────────────────────────────────
    if not HF_SPACE_URL or not HF_API_KEY:
        raise HTTPException(
            status_code=500,
            detail=(
                "Konfigurasi Hugging Face belum lengkap. "
                "Pastikan HF_SUMMARY_MODEL_URL dan HF_API_KEY sudah diatur di file .env."
            ),
        )

    headers = {
        "Authorization": f"Bearer {HF_API_KEY}",
        "Content-Type": "application/json",
    }

    # ── Step 1: Submit the job ──────────────────────────────────────────
    submit_url = f"{HF_SPACE_URL.rstrip('/')}/gradio_api/call/summarize_text"
    payload = {"data": [full_text]}

    try:
        submit_resp = requests.post(submit_url, headers=headers, json=payload, timeout=30)
    except requests.exceptions.ConnectionError as exc:
        logger.error(f"Connection error to HF Space: {exc}")
        raise HTTPException(
            status_code=500,
            detail="Gagal terhubung ke server Hugging Face Space. Periksa koneksi internet.",
        )
    except requests.exceptions.Timeout as exc:
        logger.error(f"Timeout submitting to HF Space: {exc}")
        raise HTTPException(
            status_code=500,
            detail="Request ke Hugging Face Space timeout. Coba lagi nanti.",
        )
    except requests.exceptions.RequestException as exc:
        logger.error(f"Unexpected request error (submit): {exc}")
        raise HTTPException(
            status_code=500,
            detail=f"Terjadi kesalahan jaringan: {str(exc)}",
        )

    if submit_resp.status_code == 503:
        logger.warning("HF Space returned 503 — Space is sleeping / model loading.")
        yield "Model AI sedang diaktifkan di server utama, silakan coba lagi dalam 10-20 detik."
        return

    if submit_resp.status_code == 401:
        logger.error("HF Space returned 401 — invalid API key.")
        raise HTTPException(
            status_code=500,
            detail="API Key Hugging Face tidak valid (401 Unauthorized). Periksa HF_API_KEY di .env.",
        )

    if not submit_resp.ok:
        logger.error(f"HF Space submit error {submit_resp.status_code}: {submit_resp.text}")
        raise HTTPException(
            status_code=500,
            detail=f"Hugging Face Space error {submit_resp.status_code}: {submit_resp.text}",
        )

    # Extract event_id from the submit response
    try:
        event_id = submit_resp.json().get("event_id")
        if not event_id:
            raise ValueError("No event_id in response")
    except Exception as exc:
        logger.error(f"Failed to parse event_id: {submit_resp.text} — {exc}")
        raise HTTPException(
            status_code=500,
            detail="Gagal mendapatkan event_id dari Hugging Face Space.",
        )

    # ── Step 2: Fetch the result (SSE stream) ───────────────────────────
    result_url = f"{HF_SPACE_URL.rstrip('/')}/gradio_api/call/summarize_text/{event_id}"

    try:
        result_resp = requests.get(result_url, headers=headers, timeout=120, stream=True)
    except requests.exceptions.RequestException as exc:
        logger.error(f"Error fetching result from HF Space: {exc}")
        raise HTTPException(
            status_code=500,
            detail=f"Gagal mengambil hasil dari Hugging Face Space: {str(exc)}",
        )

    if not result_resp.ok:
        logger.error(f"HF Space result error {result_resp.status_code}: {result_resp.text}")
        raise HTTPException(
            status_code=500,
            detail=f"Hugging Face Space error saat mengambil hasil: {result_resp.status_code}",
        )

    # Parse the SSE stream to extract the summary text.
    # Gradio streams events like:
    #   event: complete
    #   data: ["summary text here"]
    previous_text = ""
    yielded_any = False
    try:
        for line in result_resp.iter_lines(decode_unicode=True):
            if line is None:
                continue
            line = line.strip()
            if line.startswith("data:"):
                data_str = line[len("data:"):].strip()
                if data_str:
                    try:
                        data = json.loads(data_str)
                        # Gradio returns data as a list: ["summary text"]
                        if isinstance(data, list) and len(data) > 0:
                            current_text = data[0]
                            delta = current_text[len(previous_text):]
                            if delta:
                                yield delta
                                previous_text = current_text
                                yielded_any = True
                    except json.JSONDecodeError:
                        continue
    except Exception as exc:
        logger.error(f"Error parsing SSE stream: {exc}")
        raise HTTPException(
            status_code=500,
            detail="Gagal memproses respons dari Hugging Face Space.",
        )

    if not yielded_any:
        logger.error(f"No summary extracted from SSE stream. Full response: {result_resp.text}")
        raise HTTPException(
            status_code=500,
            detail="Format respons dari Hugging Face Space tidak sesuai. Tidak ada ringkasan ditemukan.",
        )
