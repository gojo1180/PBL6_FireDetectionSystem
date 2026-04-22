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

import logging

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════
# ██  PLUG YOUR BERT / IndoBART MODEL HERE  ██
# ═══════════════════════════════════════════════════════════════════════
#
# To integrate your trained model, replace the function body below.
#
# --- Example for IndoBART (Seq2Seq) ---
#
#   from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
#
#   MODEL_PATH = "path/to/your/trained-indobart"
#   tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
#   model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_PATH)
#
#   def run_summarization_model(full_text: str, max_length: int = 256) -> str:
#       inputs = tokenizer(
#           full_text,
#           return_tensors="pt",
#           max_length=1024,
#           truncation=True
#       )
#       summary_ids = model.generate(
#           inputs["input_ids"],
#           max_length=max_length,
#           num_beams=4,
#           length_penalty=2.0,
#           early_stopping=True,
#       )
#       return tokenizer.decode(summary_ids[0], skip_special_tokens=True)
#
# --- Example for BERT Extractive Summary ---
#
#   from transformers import pipeline
#
#   summarizer = pipeline("summarization", model="path/to/your/bert-model")
#
#   def run_summarization_model(full_text: str, max_length: int = 256) -> str:
#       result = summarizer(full_text, max_length=max_length, min_length=50)
#       return result[0]["summary_text"]
#
# ═══════════════════════════════════════════════════════════════════════


def run_summarization_model(full_text: str, max_length: int = 256) -> str:
    """
    Summarize the given full article text.

    This is a PLACEHOLDER implementation that returns a truncated excerpt.
    Replace this function body with your trained BERT or IndoBART model.

    Args:
        full_text: The full article text extracted by newspaper3k.
        max_length: Maximum length of the summary (used by real models).

    Returns:
        A summary string of the article.
    """
    if not full_text or not full_text.strip():
        return "Tidak ada konten artikel yang bisa dirangkum."

    # --- PLACEHOLDER: Simple extractive summary ---
    # Takes the first few sentences as a rough summary
    sentences = full_text.replace("\n", " ").split(".")
    sentences = [s.strip() for s in sentences if len(s.strip()) > 20]

    if not sentences:
        return "Konten artikel terlalu pendek untuk dirangkum."

    # Take first 3-5 sentences as summary
    summary_sentences = sentences[:5]
    summary = ". ".join(summary_sentences) + "."

    # Truncate if still too long
    if len(summary) > 800:
        summary = summary[:797] + "..."

    logger.info(f"[Summarizer] Generated placeholder summary ({len(summary)} chars)")
    return summary
