"""
granite_provider.py — IBM Granite Vision 4.1-4b OCR backend for tabular medical reports.

100% aligned with granite_vision.ipynb (cell 5 & cell 12).
Loaded lazily on first use to keep the module importable on CPU-only environments.
"""
from __future__ import annotations

import os
import threading
from pathlib import Path
from typing import Any, Tuple

from loguru import logger
from PIL import Image, ImageOps

_MODEL = None
_MODEL_LOCK = threading.Lock()

DEFAULT_MODEL_ID = "ibm-granite/granite-vision-4.1-4b"


def _fix_windows_dll_path() -> None:
    """Safely register torch/lib DLL directory on Windows to prevent shm.dll load failures."""
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


def _load_model(model_id: str = DEFAULT_MODEL_ID, device: str = None, torch_dtype: Any = "float16", load_in_4bit: bool = True):
    """
    Load processor and model matching granite_vision.ipynb cell 5.
    """
    _fix_windows_dll_path()
    import torch
    from transformers import AutoProcessor, AutoModelForImageTextToText, BitsAndBytesConfig

    resolved_dtype = torch_dtype if isinstance(torch_dtype, torch.dtype) else getattr(torch, str(torch_dtype), torch.float16)

    if load_in_4bit:
        qconfig = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=resolved_dtype,
        )
        processor = AutoProcessor.from_pretrained(model_id, trust_remote_code=True)
        model = AutoModelForImageTextToText.from_pretrained(
            model_id,
            trust_remote_code=True,
            quantization_config=qconfig,
            device_map=device or "auto",
        ).eval()
    else:
        processor = AutoProcessor.from_pretrained(model_id, trust_remote_code=True)
        model = AutoModelForImageTextToText.from_pretrained(
            model_id,
            trust_remote_code=True,
            torch_dtype=resolved_dtype,
            device_map=device or "auto",
        ).eval()

    logger.info("Granite Vision model loaded successfully (4-bit NF4)")
    return processor, model


def _get_model(model_id: str = DEFAULT_MODEL_ID, device: str = None, torch_dtype: Any = "float16", load_in_4bit: bool = True):
    global _MODEL
    if _MODEL is None:
        with _MODEL_LOCK:
            if _MODEL is None:
                _MODEL = _load_model(model_id, device, torch_dtype, load_in_4bit)
    return _MODEL


def _preprocess_image(image_path: str) -> Image.Image:
    """
    Preprocess image matching granite_vision.ipynb cell 12:
      img = ImageOps.exif_transpose(Image.open(image_path)).convert("RGB")
      img = ImageOps.autocontrast(img, cutoff=1)
      w, h = img.size
      if max(w, h) > 1600:
          s = 1600/max(w,h); img = img.resize((int(w*s), int(h*s)))
    """
    img = ImageOps.exif_transpose(Image.open(image_path)).convert("RGB")
    img = ImageOps.autocontrast(img, cutoff=1)
    w, h = img.size
    if max(w, h) > 1600:
        s = 1600 / max(w, h)
        img = img.resize((int(w * s), int(h * s)))
    return img


class GraniteVisionProvider:
    """
    Granite Vision provider matching granite_vision.ipynb cell 12.
    """

    def __init__(self, model_id: str = DEFAULT_MODEL_ID, device: str = None,
                 torch_dtype: Any = "float16", load_in_4bit: bool = True, **kwargs):
        self.model_id = model_id
        import torch
        if not device:
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device
        self.torch_dtype = torch_dtype
        self.load_in_4bit = load_in_4bit

    def extract_text(self, filepath: str, filetype: str = "image", max_tokens: int = 700) -> str:
        """
        Extract text matching granite_vision.ipynb cell 12:
        """
        import torch

        processor, model = _get_model(self.model_id, self.device, self.torch_dtype, self.load_in_4bit)
        img = _preprocess_image(filepath)

        # PyTesseract pre-OCR assist (if available)
        ocr_text = ""
        try:
            import pytesseract
            try:
                ocr_text = pytesseract.image_to_string(img, lang="eng+hin")
            except Exception:
                # Fall back to eng if hindi traineddata is missing
                ocr_text = pytesseract.image_to_string(img, lang="eng")
        except Exception:
            pass

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
            prompt = (
                "You are reading a printed medical lab report. Use the image to extract accurately.\n\n"
                "Extract clearly and completely: patient name, age, gender, referred by, lab name, "
                "all dates, and EVERY test with its value, unit and reference range. Do not skip any test row. "
                "If something is not clearly readable, write [illegible] — do NOT guess or invent values. "
                "Keep Hindi in Hindi. List everything plainly, do not draw tables or use special symbols."
            )

        conv = [{"role": "user", "content": [{"type": "image"}, {"type": "text", "text": prompt}]}]
        text = processor.apply_chat_template(conv, tokenize=False, add_generation_prompt=True)
        inputs = processor(text=text, images=[img], return_tensors="pt", padding=True, do_pad=True).to(model.device)

        with torch.no_grad():
            out = model.generate(
                **inputs,
                max_new_tokens=max_tokens,
                min_new_tokens=80,
                do_sample=False,
                repetition_penalty=1.2,
                no_repeat_ngram_size=4,
                use_cache=True,
            )

        prompt_token_count = inputs["input_ids"].shape[1]
        decoded = processor.decode(out[0, prompt_token_count:], skip_special_tokens=True).strip()

        prefixes_to_strip = [
            "Here is the extracted information based on both the image of the ultrasound report and the provided OCR context:",
            "Here is the extracted information based on both the image of the report and the provided OCR context:",
            "Here is the extracted information based on both the image of the lab report and the provided OCR context:",
            "Here is the extracted information based on the image:",
            "Here is the extracted information:",
            "Based on the image and provided OCR text:",
            "Based on the image:"
        ]
        for prefix in prefixes_to_strip:
            if decoded.startswith(prefix):
                decoded = decoded[len(prefix):].strip()

        logger.info("Granite Vision extracted {} chars from {}", len(decoded), filepath)
        return decoded

    def extract_structured(self, filepath: str, filetype: str = "image") -> list[dict]:
        """
        Extract structured lab test results.
        """
        text = self.extract_text(filepath, filetype)
        if not text:
            return []

        # Parse test rows from text lines
        results = []
        for line in text.splitlines():
            line = line.strip()
            if not line or line.startswith("Patient") or line.startswith("Lab") or line.startswith("Referred"):
                continue
            parts = [p.strip() for p in line.split(":") if p.strip()]
            if len(parts) >= 2:
                results.append({
                    "test_name": parts[0],
                    "value": parts[1],
                    "unit": "",
                    "reference_range": "",
                    "flag": "NORMAL",
                })
        return results