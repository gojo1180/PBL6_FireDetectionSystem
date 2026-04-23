"""
Summarization Service — Compatible with BERT / IndoBART models.

This module provides the summarization interface for the Fire News feature.
Replace the placeholder `run_summarization_model()` with your trained
BERT or IndoBART model for production use.

Example integration with Hugging Face Transformers:
    from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
    tokenizer = AutoTokenizer.from_pretrained("path/to/your/indobart-model")
    model = AutoModelForSeq2SeqLM.from_pretrained("path/to/your/indobart-model")
"""

import os
import logging
from fastapi import HTTPException

logger = logging.getLogger(__name__)

# Global variable to hold the pipeline so it loads only once at startup
summarizer_pipeline = None
MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "ml_model")

def load_model():
    global summarizer_pipeline
    if summarizer_pipeline is not None:
        return
        
    if not os.path.exists(MODEL_PATH):
        logger.warning(f"Model path {MODEL_PATH} not found. Summarization will fail if called.")
        return

    try:
        from transformers import pipeline
        
        logger.info(f"Loading summarization model from {MODEL_PATH}...")
        # Initialize pipeline. Defaults to CPU.
        summarizer_pipeline = pipeline("summarization", model=MODEL_PATH, tokenizer=MODEL_PATH)
        logger.info("Summarization model loaded successfully!")
    except MemoryError:
        logger.error("MemoryError: Not enough RAM to load the summarization model.")
        summarizer_pipeline = "ERROR:MEMORY"
    except Exception as e:
        logger.error(f"Failed to load summarization model: {e}")
        summarizer_pipeline = "ERROR:LOAD"

# Load model upon module initialization
load_model()

def run_summarization_model(full_text: str, max_length: int = 150, min_length: int = 40) -> str:
    """
    Summarize the given full article text using the local ML model.
    """
    if not full_text or not full_text.strip():
        return "Tidak ada konten artikel yang bisa dirangkum."
        
    global summarizer_pipeline
    
    if summarizer_pipeline is None:
        raise HTTPException(status_code=500, detail="Model summarization lokal tidak ditemukan di ./ml_model.")
    elif summarizer_pipeline == "ERROR:MEMORY":
        raise HTTPException(status_code=500, detail="Gagal memuat model: Kehabisan memori (RAM).")
    elif summarizer_pipeline == "ERROR:LOAD":
        raise HTTPException(status_code=500, detail="Gagal memuat model: Terjadi kesalahan saat membaca file model.")

    try:
        result = summarizer_pipeline(
            full_text,
            max_length=max_length,
            min_length=min_length,
            truncation=True
        )
        return result[0]["summary_text"]
    except Exception as e:
        logger.error(f"Error during summarization generation: {e}")
        raise HTTPException(status_code=500, detail=f"Gagal menghasilkan ringkasan: {str(e)}")
