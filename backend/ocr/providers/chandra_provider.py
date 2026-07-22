"""
chandra_provider.py — Chandra OCR INT4 backend for handwritten medical reports.

Model: datalab-to/chandra-ocr-2 (INT4 NF4 quantisation, device_map="auto").
Loaded lazily on demand and can be explicitly unloaded to free VRAM for other models.

Ported from chandra_pplne/app.py.
Designed for HANDWRITTEN-class documents (prescriptions, handwritten lab notes, doctor notes).
"""
from __future__ import annotations

import gc
import math
import threading
import time
from pathlib import Path
from typing import Optional, Tuple

from loguru import logger
from PIL import Image

_MODEL = None
_PROCESSOR = None
_MODEL_LOCK = threading.Lock()

DEFAULT_MODEL_ID = "datalab-to/chandra-ocr-2"


def detect_attn_implementation() -> Tuple[str, str]:
    try:
        import torch
        import flash_attn
        if torch.cuda.is_available():
            cap = torch.cuda.get_device_capability()
            if cap >= (9, 0):
                return "flash_attention_2", "FlashAttention-3 (native sm_90+)"
            elif cap >= (8, 0):
                return "flash_attention_2", "FlashAttention-2 (native sm_80+)"
    except Exception:
        pass
    return "sdpa", "SDPA (PyTorch native fallback)"


def get_compute_dtype():
    try:
        import torch
        if torch.cuda.is_available() and torch.cuda.is_bf16_supported():
            return torch.bfloat16
        return torch.float16
    except Exception:
        return None


def resize_image(image: Image.Image, max_megapixels: float = 1.0) -> Tuple[Image.Image, str]:
    if image is None:
        return None, ""

    w, h = image.size
    max_pixels = int(max_megapixels * 1_000_000)
    current_pixels = w * h

    if current_pixels <= max_pixels:
        vis_tokens = math.ceil(w / 28) * math.ceil(h / 28)
        info = f"Image size: {w}x{h} ({current_pixels/1e6:.2f} MP, ~{vis_tokens} visual tokens)"
        return image, info

    scale = math.sqrt(max_pixels / current_pixels)
    new_w = max(1, int(w * scale))
    new_h = max(1, int(h * scale))

    resized_img = image.resize((new_w, new_h), Image.Resampling.LANCZOS)
    vis_tokens = math.ceil(new_w / 28) * math.ceil(new_h / 28)

    info = f"Resized image: {w}x{h} ({current_pixels/1e6:.2f} MP) -> {new_w}x{new_h} ({new_w*new_h/1e6:.2f} MP, ~{vis_tokens} visual tokens)"
    return resized_img, info


def _load_chandra_model(model_id: str = DEFAULT_MODEL_ID):
    global _MODEL, _PROCESSOR
    with _MODEL_LOCK:
        if _MODEL is not None and _PROCESSOR is not None:
            return _MODEL, _PROCESSOR

        try:
            import torch
            from transformers import AutoModelForImageTextToText, AutoProcessor, BitsAndBytesConfig
        except ImportError as err:
            raise ImportError(
                "chandra-ocr, transformers, or torch missing. Run `pip install chandra-ocr[hf] bitsandbytes`."
            ) from err

        attn_impl, attn_desc = detect_attn_implementation()
        compute_dtype = get_compute_dtype()
        dtype_str = "bfloat16" if compute_dtype == torch.bfloat16 else "float16"

        logger.info(f"[Chandra] Loading model '{model_id}' with INT4 quantization (dtype={dtype_str}, attn={attn_desc})...")
        start_t = time.time()

        quant_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_compute_dtype=compute_dtype,
            bnb_4bit_use_double_quant=True,
            bnb_4bit_quant_type="nf4",
        )

        try:
            model = AutoModelForImageTextToText.from_pretrained(
                model_id,
                quantization_config=quant_config,
                device_map="auto",
                attn_implementation=attn_impl,
                low_cpu_mem_usage=True,
            )
            model.eval()

            processor = AutoProcessor.from_pretrained(model_id)
            processor.tokenizer.padding_side = "left"
            model.processor = processor

            _MODEL = model
            _PROCESSOR = processor

            elapsed = time.time() - start_t
            logger.info(f"[Chandra] Model loaded in {elapsed:.1f}s.")
            return _MODEL, _PROCESSOR
        except Exception as e:
            logger.error(f"[Chandra] Failed to load model: {e}")
            raise e


def unload_chandra_model():
    global _MODEL, _PROCESSOR
    with _MODEL_LOCK:
        if _MODEL is not None:
            logger.info("[Chandra] Unloading model from VRAM...")
            del _MODEL
            del _PROCESSOR
            _MODEL = None
            _PROCESSOR = None
            gc.collect()
            try:
                import torch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
            except Exception:
                pass
            logger.info("[Chandra] Model unloaded.")


class ChandraOCRProvider:
    """Provider interface for Chandra OCR (handwritten documents)."""

    def __init__(self, model_id: str = DEFAULT_MODEL_ID, max_megapixels: float = 1.0):
        self.model_id = model_id
        self.max_megapixels = max_megapixels

    def load(self) -> None:
        _load_chandra_model(self.model_id)

    def unload(self) -> None:
        unload_chandra_model()

    def extract_text(self, filepath: str, filetype: str = "image", prompt_type: str = "ocr_layout") -> str:
        p = Path(filepath)
        if not p.exists():
            raise FileNotFoundError(f"File not found: {filepath}")

        model, _ = _load_chandra_model(self.model_id)

        try:
            from chandra.model.schema import BatchInputItem
            from chandra.model.hf import generate_hf
            from chandra.output import parse_markdown
        except ImportError as e:
            logger.error(f"[Chandra] chandra package import error: {e}")
            raise RuntimeError("chandra-ocr library is not installed properly.") from e

        # Handle PDF vs Image
        images = []
        if filetype == "pdf" or p.suffix.lower() == ".pdf":
            try:
                import fitz  # PyMuPDF
                doc = fitz.open(str(p))
                for page in doc:
                    pix = page.get_pixmap(dpi=200)
                    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                    del pix
                    images.append(img)
                doc.close()
            except Exception as pdf_err:
                logger.warning(f"[Chandra] PyMuPDF failed to convert PDF: {pdf_err}")
                return ""
        else:
            try:
                with Image.open(str(p)) as img:
                    images.append(img.convert("RGB"))
            except Exception as img_err:
                logger.error(f"[Chandra] Failed to open image '{filepath}': {img_err}")
                return ""

        results_md = []
        for idx, orig_img in enumerate(images):
            resized_img, info = resize_image(orig_img, self.max_megapixels)
            logger.info(f"[Chandra] Page {idx+1}/{len(images)}: {info}")

            item = BatchInputItem(image=resized_img.convert("RGB"), prompt_type=prompt_type)
            results = generate_hf([item], model)
            result = results[0]

            if result.error:
                logger.warning(f"[Chandra] Generation error on page {idx+1}: {result.error}")
                continue

            md = parse_markdown(result.raw)
            if md:
                results_md.append(md.strip())

        return "\n\n--- Page Break ---\n\n".join(results_md)

    def extract_structured(self, filepath: str, filetype: str = "image") -> list[dict]:
        """Extract structured lab results from plain OCR text using regex heuristics."""
        text = self.extract_text(filepath, filetype)
        if not text:
            return []
        try:
            from heuristics import extract_structured_results
            lines = [{"text": line, "bounding_box": []} for line in text.split("\n") if line.strip()]
            return extract_structured_results(lines, None)
        except Exception as e:
            logger.warning(f"[Chandra] Heuristic structured extraction failed: {e}")
            return []

