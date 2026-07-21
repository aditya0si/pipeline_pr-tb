"""
granite_provider.py — IBM Granite Vision 4.1-4b OCR backend for tabular medical reports.

Model: ibm-granite/granite-vision-4.1-4b (4-bit NF4 quantisation, device_map="auto").
Loaded lazily on first use to keep the module importable on CPU-only environments.

OCR flow (mirrors granite_vision.ipynb):
  1. Load image (PIL, EXIF transpose, autocontrast, resize max 1600px).
  2. Optional pytesseract pre-OCR assist (skip if unavailable).
  3. Build a chat-template prompt asking Granite to extract patient info and all
     lab test rows (name, value, unit, reference range) from the medical image.
  4. model.generate() with max_new_tokens=700, do_sample=False,
     repetition_penalty=1.2, no_repeat_ngram_size=4.
  5. Return decoded text (extract_text) or parsed structured dicts (extract_structured).

Designed for TABLE-class documents (lab panels, tabular reports).
PRINTED_TEXT documents should use PaddleOCR (backend/ocr/providers/paddle_provider.py).
"""
from __future__ import annotations

import threading
from pathlib import Path

from loguru import logger

import cv2
import numpy as np

# ── Lazy singleton Granite Vision instance ─────────────────────────────────────
_MODEL = None
_MODEL_LOCK = threading.Lock()

DEFAULT_MODEL_ID = "ibm-granite/granite-vision-4.1-4b"

# Prompt used for free-form text extraction (mirrors granite_vision.ipynb)
TEXT_PROMPT = (
    "You are reading a printed medical lab report. Below is rough OCR text from the image "
    "(may have errors). Use BOTH the image and the OCR text to extract accurately. "
    "Trust the image for correctness; use OCR to help read numbers.\n\n"
    "Extract clearly and completely: patient name, age, gender, referred by, lab name, "
    "all dates, and EVERY test with its value, unit and reference range. Do not skip any test row. "
    "If something is not clearly readable, write [illegible] — do NOT guess or invent values. "
    "Keep Hindi in Hindi. List everything plainly, do not draw tables or use special symbols."
)

# Prompt used for structured extraction
STRUCTURED_PROMPT = (
    "You are reading a printed medical lab report. Below is rough OCR text from the image "
    "(may have errors). Use BOTH the image and the OCR text to extract accurately.\n\n"
    "Extract ALL lab test results as a JSON array of objects with these exact fields:\n"
    '  test_name (string), value (string/number), unit (string), reference_range (string), '
    'flag (string: "HIGH"/"LOW"/"NORMAL"/"CRITICAL_HIGH"/"CRITICAL_LOW"/"").\n'
    "If a field is not clearly readable, use an empty string. Do not invent values. "
    "Return ONLY the JSON array, no markdown, no explanation."
)


def _fix_windows_dll_path() -> None:
    """Safely register torch/lib DLL directory on Windows to prevent shm.dll load failures."""
    import os
    import sys
    if sys.platform == "win32" and hasattr(os, "add_dll_directory"):
        try:
            import site
            for site_dir in site.getsitepackages():
                torch_lib = os.path.join(site_dir, "torch", "lib")
                if os.path.isdir(torch_lib):
                    os.add_dll_directory(torch_lib)
        except Exception:
            pass


def _patch_transformers_masking() -> None:
    """Patch transformers.masking_utils.create_causal_mask if legacy version requires it."""
    import transformers
    from packaging import version

    # On transformers 5.x+, Granite Vision's remote modeling.py passes args natively.
    # The legacy v4 monkey-patch stripped required v5 kwargs and caused empty OCR/TypeErrors.
    if version.parse(transformers.__version__) >= version.parse("5.0.0"):
        return

    try:
        import sys
        import transformers.masking_utils
        orig_fn = getattr(transformers.masking_utils, "_orig_create_causal_mask", transformers.masking_utils.create_causal_mask)
        transformers.masking_utils._orig_create_causal_mask = orig_fn

        def _safe_create_causal_mask(*args, **kwargs):
            try:
                return orig_fn(*args, **kwargs)
            except Exception:
                embeds = kwargs.get("inputs_embeds") if "inputs_embeds" in kwargs else kwargs.get("input_embeds")
                if embeds is None and len(args) >= 2:
                    embeds = args[1]
                if embeds is not None:
                    try:
                        return orig_fn(
                            input_ids_shape=embeds.shape[:2],
                            dtype=embeds.dtype,
                            device=embeds.device
                        )
                    except Exception:
                        pass
                valid = {"input_ids_shape", "dtype", "device", "past_key_values_length", "sliding_window"}
                filtered = {k: v for k, v in kwargs.items() if k in valid}
                return orig_fn(*args, **filtered)

        transformers.masking_utils.create_causal_mask = _safe_create_causal_mask
        for mod_obj in list(sys.modules.values()):
            if mod_obj and hasattr(mod_obj, "create_causal_mask"):
                setattr(mod_obj, "create_causal_mask", _safe_create_causal_mask)
    except Exception as e:
        logger.error("Failed to apply transformers masking patch for Granite Vision: {}", e)
        raise


def _load_model(model_id: str, device: str, torch_dtype, load_in_4bit: bool = True):
    """Load and return (processor, model) tuple. Called lazily inside _get_model."""
    _fix_windows_dll_path()
    _patch_transformers_masking()
    from transformers import AutoProcessor, AutoModelForImageTextToText, BitsAndBytesConfig

    if load_in_4bit:
        quant_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_compute_dtype=torch_dtype,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_use_double_quant=True,
        )
        processor = AutoProcessor.from_pretrained(model_id, trust_remote_code=True)
        model = AutoModelForImageTextToText.from_pretrained(
            model_id,
            trust_remote_code=True,
            quantization_config=quant_config,
            device_map="auto",
        )
    else:
        processor = AutoProcessor.from_pretrained(model_id, trust_remote_code=True)
        model = AutoModelForImageTextToText.from_pretrained(
            model_id,
            trust_remote_code=True,
            torch_dtype=torch_dtype,
            device_map=device or "auto",
        )
    _patch_transformers_masking()
    model.eval()
    return processor, model


def _get_model(model_id: str, device: str, torch_dtype, load_in_4bit: bool = True):
    """Return cached (processor, model) singleton. Thread-safe."""
    global _MODEL
    if _MODEL is None:
        with _MODEL_LOCK:
            if _MODEL is None:
                _MODEL = _load_model(model_id, device, torch_dtype, load_in_4bit)
    return _MODEL


def _cuda_available() -> bool:
    try:
        import torch
        return torch.cuda.is_available()
    except ImportError:
        return False


def _load_cv2(filepath: str, filetype: str) -> np.ndarray:
    """Load and preprocess an image file into a BGR ndarray."""
    from image_processing import preprocess_image
    return preprocess_image(filepath)


def _cv2_to_pil(img: np.ndarray):
    """Convert BGR ndarray to PIL RGB Image."""
    from PIL import Image
    return Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))


def _preprocess_image_pil(filepath: str) -> "Image.Image":
    """Load a PIL image with EXIF transpose and autocontrast (mirrors granite_vision.ipynb)."""
    from PIL import Image, ImageOps

    pil = Image.open(filepath)
    pil = ImageOps.exif_transpose(pil).convert("RGB")
    pil = ImageOps.autocontrast(pil, cutoff=1)

    # Resize to max 1600px on longest side (mirrors notebook)
    w, h = pil.size
    if max(w, h) > 1600:
        scale = 1600 / max(w, h)
        pil = pil.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    return pil


class GraniteVisionProvider:
    """
    MedVault OCRProvider backed by IBM Granite Vision 4.1-4b for tabular reports.

    Config keys (all optional):
        model_id     (str,  default "ibm-granite/granite-vision-4.1-4b")
        device       (str,  default "cuda" if available else "cpu")
        torch_dtype  (str,  default "float16")
        load_in_4bit (bool, default True)
    """

    def __init__(self, model_id: str = DEFAULT_MODEL_ID, device: str = None,
                 torch_dtype: str = "float16", load_in_4bit: bool = True):
        self.model_id = model_id
        if not device:
            self.device = "cuda" if _cuda_available() else "cpu"
        else:
            self.device = device
        self.torch_dtype_name = torch_dtype
        self.load_in_4bit = load_in_4bit

    def _get_dtype(self):
        import torch
        return getattr(torch, self.torch_dtype_name, torch.float16)

    def _run_inference(self, pil_img: "Image.Image", prompt: str, max_new_tokens: int = 400) -> str:
        """Run Granite Vision inference and return decoded text."""
        import torch

        dtype = self._get_dtype()
        processor, model = _get_model(self.model_id, self.device, dtype, self.load_in_4bit)

        conv = [{
            "role": "user",
            "content": [{"type": "image"}, {"type": "text", "text": prompt}],
        }]
        text = processor.apply_chat_template(conv, tokenize=False, add_generation_prompt=True)
        inputs = processor(
            text=text,
            images=[pil_img],
            return_tensors="pt",
            padding=True,
            do_pad=True,
        ).to(model.device)

        prompt_len = inputs["input_ids"].shape[1]
        with torch.no_grad():
            out = model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                min_new_tokens=80,
                do_sample=False,
                repetition_penalty=1.2,
                no_repeat_ngram_size=4,
                use_cache=True,
            )
        gen_tokens = out[0, prompt_len:]
        decoded = processor.decode(gen_tokens, skip_special_tokens=True).strip()
        logger.info(
            "Granite Vision inference: prompt_len={}, gen_shape={}, gen_tokens_count={}, decoded_len={}, sample='{}'",
            prompt_len, tuple(out.shape), len(gen_tokens), len(decoded), decoded[:150].replace("\n", " ")
        )
        if not decoded:
            raw_ids = gen_tokens.tolist()[:50]
            logger.error("Granite Vision output decoded to EMPTY string! Raw generated token IDs: {}", raw_ids)
        return decoded

    def extract_text(self, filepath: str, filetype: str) -> str:
        """
        Transcribe a tabular/printed report image via Granite Vision.

        Returns the full decoded model output as a string.
        """
        # Try pytesseract pre-OCR assist first (mirrors granite_vision.ipynb flow)
        ocr_text = ""
        try:
            import pytesseract
            pil = _preprocess_image_pil(filepath)
            ocr_text = pytesseract.image_to_string(pil, lang="eng+hin")
        except Exception:
            # pytesseract or tesseract binary not available — skip
            pass

        # Build enhanced prompt that incorporates rough OCR text when available
        if ocr_text:
            prompt = (
                "You are reading a printed medical lab report. Below is rough OCR text from the image "
                "(may have errors). Use BOTH the image and the OCR text to extract accurately. "
                "Trust the image for correctness; use OCR to help read numbers.\n\n"
                f"OCR TEXT:\n{ocr_text}\n\n"
                "Extract clearly and completely: patient name, age, gender, referred by, lab name, "
                "all dates, and EVERY test with its value, unit and reference range. Do not skip any test row. "
                "If something is not clearly readable, write [illegible] — do NOT guess or invent values. "
                "Keep Hindi in Hindi. List everything plainly, do not draw tables or use special symbols."
            )
        else:
            prompt = TEXT_PROMPT

        pil = _preprocess_image_pil(filepath)
        res = self._run_inference(pil, prompt, max_new_tokens=400)
        if not res:
            logger.error("Granite Vision extract_text returned EMPTY result for filepath: {}", filepath)
        return res

    def extract_structured(self, filepath: str, filetype: str) -> list[dict]:
        """
        Extract structured lab test results from a tabular report.

        Returns a list of dicts with keys: test_name, value, unit, reference_range, flag.
        Falls back to heuristic extraction on plain text if JSON parsing fails.
        """
        import json
        import re

        pil = _preprocess_image_pil(filepath)
        raw = self._run_inference(pil, STRUCTURED_PROMPT, max_new_tokens=700)

        # Try to parse JSON array from the response
        try:
            json_match = re.search(r"\[.*\]", raw, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group(0))
                if isinstance(parsed, list):
                    return parsed
        except (json.JSONDecodeError, TypeError):
            pass

        # Fallback: use heuristic extractor on the raw text
        from heuristics import extract_structured_results
        lines = [{"text": line, "bounding_box": []} for line in raw.split("\n") if line.strip()]
        try:
            from database import RULES_CONFIG
            return extract_structured_results(lines, RULES_CONFIG)
        except Exception:
            return extract_structured_results(lines, None)