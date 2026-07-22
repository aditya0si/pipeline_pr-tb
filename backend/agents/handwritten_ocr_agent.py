"""
handwritten_ocr_agent.py — Agent for handwritten medical document OCR.

Extracts text from handwritten medical documents (prescriptions, doctor notes)
using Chandra OCR (datalab-to/chandra-ocr-2, INT4 NF4).
"""
from __future__ import annotations

import os
import tempfile
import time
from typing import Optional

from loguru import logger

from agents.ocr_result import OCRResult

_ENGINE_CHANDRA = "Chandra-INT4"
_ENGINE_NONE = "none"


class HandwrittenOCRAgent:
    """Agent for handwritten OCR using Chandra OCR Provider."""

    def __init__(self, chandra_provider=None):
        self._chandra_provider = chandra_provider

    @property
    def chandra_provider(self):
        if self._chandra_provider is None:
            try:
                from ocr.providers.chandra_provider import ChandraOCRProvider
            except ImportError:
                from backend.ocr.providers.chandra_provider import ChandraOCRProvider
            self._chandra_provider = ChandraOCRProvider()
        return self._chandra_provider

    def run(self, image) -> OCRResult:
        """OCR a handwritten ``image`` (BGR ndarray or filepath string/Path) using Chandra."""
        import cv2
        import numpy as np
        from pathlib import Path

        start = time.time()
        created_tmp = False
        if isinstance(image, (str, Path)):
            tmp = str(image)
        else:
            fd, tmp = tempfile.mkstemp(suffix=".png")
            os.close(fd)
            ok = cv2.imwrite(tmp, image)
            if not ok:
                raise IOError("Failed to write temporary image for handwritten OCR")
            created_tmp = True

        try:
            try:
                text = self.chandra_provider.extract_text(tmp, "image")
                if text and text.strip():
                    return OCRResult(
                        raw_output=text,
                        engine=_ENGINE_CHANDRA,
                        confidence=0.85,
                        processing_time_seconds=time.time() - start,
                    )
            except Exception as e:
                logger.warning("Chandra handwritten OCR failed: {}", e)

            return OCRResult(
                raw_output="",
                engine=_ENGINE_NONE,
                confidence=0.0,
                processing_time_seconds=time.time() - start,
            )
        finally:
            if created_tmp:
                try:
                    os.remove(tmp)
                except OSError:
                    pass
