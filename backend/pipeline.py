"""
Core pipeline orchestrator for MedVault Hepatology OCR Pipeline.
Handles document classification and OCR routing.
"""
import os
import time
import re
from typing import Tuple, Optional
from enum import Enum
import numpy as np
from PIL import Image
import cv2


class DocumentClass(Enum):
    PRINTED_TEXT = "PRINTED_TEXT"
    TABLE = "TABLE"


class AutoOCRProvider:
    """
    OCR Router that selects the appropriate engine based on document class.
    - TABLE -> Granite Vision 4.1-4b (4-bit NF4 quantized VLM)
    - PRINTED_TEXT -> PaddleOCR (GPU-accelerated)
    """

    def __init__(self):
        self._granite_engine = None
        self._paddle_engine = None

    def _get_granite_engine(self):
        """Lazy-load Granite Vision 4.1-4b engine with 4-bit NF4 quantization."""
        if self._granite_engine is None:
            try:
                from backend.ocr.providers.granite_provider import GraniteVisionProvider
                self._granite_engine = GraniteVisionProvider()
            except ImportError:
                raise RuntimeError(
                    "Granite Vision engine not available. "
                    "Ensure transformers, accelerate, and bitsandbytes are installed."
                )
        return self._granite_engine

    def _get_paddle_engine(self):
        """Lazy-load PaddleOCR engine."""
        if self._paddle_engine is None:
            try:
                from engines.paddle_engine import PaddleOCREngine
                self._paddle_engine = PaddleOCREngine()
            except ImportError:
                raise RuntimeError(
                    "PaddleOCR engine not available. "
                    "Ensure paddlepaddle-gpu is installed with CUDA 12.9 support."
                )
        return self._paddle_engine

    def extract_text(self, image_path: str, doc_class: DocumentClass) -> Tuple[str, float]:
        """
        Route to appropriate OCR engine based on document class.

        Returns:
            Tuple of (extracted_text, duration_seconds)
        """
        start_time = time.time()

        if doc_class == DocumentClass.TABLE:
            engine = self._get_granite_engine()
            text = engine.extract_text(image_path, "image")
        else:
            # PRINTED_TEXT -> PaddleOCR
            engine = self._get_paddle_engine()
            text = engine.extract_text(image_path)

        duration = time.time() - start_time
        return text, duration



