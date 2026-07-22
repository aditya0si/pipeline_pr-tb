"""
backend/services/ocr_service.py — OCR provider layer.

  - ``OCRProvider`` ABC + Paddle/Granite wrappers
  - cached factory singletons (``_get_paddle_wrapper`` / ``_get_granite_wrapper``)
  - ``AutoOCRProvider`` (2-class routing: PRINTED_TEXT / TABLE)
  - ``OCR_ENGINES`` registry + ``build_ocr``

Heavy imports (paddle/granite/torch) stay lazy inside the
functions/constructors exactly as before, so importing this module is cheap and
CPU-only safe.
"""
from __future__ import annotations

import os
import threading
from abc import ABC, abstractmethod
from typing import Optional

from loguru import logger


def _looks_like_vision_error(text: str) -> bool:
    """Detect when a vision-capable endpoint returned a text-only-model error."""
    t = (text or "").lower()
    return (
        "does not support image" in t
        or "not a multimodal" in t
        or ("multimodal" in t and "support" in t)
    )


class OCRProvider(ABC):
    @abstractmethod
    def extract_text(self, filepath: str, filetype: str) -> str: ...


class PaddleOCRProviderWrapper(OCRProvider):
    """MedVault wrapper around the PaddleOCR GPU backend for printed reports."""
    def __init__(self, use_gpu: bool = True, lang: str = "en", use_angle_cls: bool = True):
        from backend.ocr.providers.paddle_provider import PaddleOCRProvider
        self._provider = PaddleOCRProvider(use_gpu=use_gpu, lang=lang, use_angle_cls=use_angle_cls)
    def extract_text(self, filepath: str, filetype: str) -> str:  # pragma: no cover - GPU/OCR runtime
        return self._provider.extract_text(filepath, filetype)

    def extract_structured(self, filepath: str, filetype: str) -> list[dict]:  # pragma: no cover - GPU/OCR runtime
        return self._provider.extract_structured(filepath, filetype)


class GraniteVisionProviderWrapper(OCRProvider):
    """MedVault wrapper around IBM Granite Vision 4.1-4b for tabular report OCR (GPU)."""
    def __init__(self, model_id: str = "ibm-granite/granite-vision-4.1-4b",
                 device: str = "", torch_dtype: str = "float16", load_in_4bit: bool = True):
        try:
            from ocr.providers.granite_provider import GraniteVisionProvider
        except ImportError:
            from backend.ocr.providers.granite_provider import GraniteVisionProvider
        self._provider = GraniteVisionProvider(
            model_id=model_id,
            device=device or None,
            torch_dtype=torch_dtype,
            load_in_4bit=load_in_4bit,
        )
    def extract_text(self, filepath: str, filetype: str) -> str:  # pragma: no cover - GPU/OCR runtime
        return self._provider.extract_text(filepath, filetype)

    def extract_structured(self, filepath: str, filetype: str) -> list[dict]:  # pragma: no cover - GPU/OCR runtime
        return self._provider.extract_structured(filepath, filetype)


class ChandraOCRProviderWrapper(OCRProvider):
    """MedVault wrapper around Chandra OCR (INT4 NF4) for handwritten report OCR."""
    def __init__(self, model_id: str = "datalab-to/chandra-ocr-2", max_megapixels: float = 1.0):
        try:
            from ocr.providers.chandra_provider import ChandraOCRProvider
        except ImportError:
            from backend.ocr.providers.chandra_provider import ChandraOCRProvider
        self._provider = ChandraOCRProvider(model_id=model_id, max_megapixels=max_megapixels)

    def extract_text(self, filepath: str, filetype: str) -> str:  # pragma: no cover - GPU/OCR runtime
        return self._provider.extract_text(filepath, filetype)

    def extract_structured(self, filepath: str, filetype: str) -> list[dict]:  # pragma: no cover - GPU/OCR runtime
        return self._provider.extract_structured(filepath, filetype)


# Module-level singletons for caching
_paddle_wrapper_cache = None
_paddle_wrapper_lock = threading.Lock()
_granite_wrapper_cache = None
_granite_wrapper_lock = threading.Lock()
_chandra_wrapper_cache = None
_chandra_wrapper_lock = threading.Lock()


def _get_paddle_wrapper(use_gpu: bool = True, lang: str = "en", use_angle_cls: bool = True):
    """Get cached PaddleOCRProviderWrapper instance."""
    global _paddle_wrapper_cache
    key = (use_gpu, lang, use_angle_cls)
    if _paddle_wrapper_cache is None or _paddle_wrapper_cache[0] != key:
        with _paddle_wrapper_lock:
            if _paddle_wrapper_cache is None or _paddle_wrapper_cache[0] != key:
                try:
                    _paddle_wrapper_cache = (key, PaddleOCRProviderWrapper(use_gpu=use_gpu, lang=lang, use_angle_cls=use_angle_cls))
                except Exception as e:
                    logger.warning("PaddleOCR wrapper failed to initialize: {}", e)
                    _paddle_wrapper_cache = (key, None)
    return _paddle_wrapper_cache[1]


def _fix_windows_dll_path() -> None:
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


def _get_granite_wrapper(model_id: str = "ibm-granite/granite-vision-4.1-4b",
                          device: str = "", torch_dtype: str = "float16",
                          load_in_4bit: bool = True):
    """Get cached GraniteVisionProviderWrapper instance."""
    global _granite_wrapper_cache
    _fix_windows_dll_path()
    try:
        from gpu_manager import wait_for_granite_ready, _preload_started
        if _preload_started:
            ready = wait_for_granite_ready(max_wait_seconds=60)
            if not ready:
                raise RuntimeError(
                    "Granite Vision is still loading model weights. "
                    "Please retry in 30 seconds — this only happens on first server start."
                )
    except RuntimeError:
        raise
    except Exception as e:
        logger.warning("wait_for_granite_ready check failed: {}", e)

    key = (model_id, device, torch_dtype, load_in_4bit)
    if _granite_wrapper_cache is None or _granite_wrapper_cache[0] != key:
        with _granite_wrapper_lock:
            if _granite_wrapper_cache is None or _granite_wrapper_cache[0] != key:
                try:
                    _granite_wrapper_cache = (key, GraniteVisionProviderWrapper(
                        model_id=model_id, device=device or "", torch_dtype=torch_dtype,
                        load_in_4bit=load_in_4bit))
                except Exception as e:
                    logger.warning("Granite Vision wrapper failed to initialize: {}", e)
                    _granite_wrapper_cache = (key, None)
    return _granite_wrapper_cache[1]


def _get_chandra_wrapper(model_id: str = "datalab-to/chandra-ocr-2", max_megapixels: float = 1.0):
    """Get cached ChandraOCRProviderWrapper instance."""
    global _chandra_wrapper_cache
    _fix_windows_dll_path()
    key = (model_id, max_megapixels)
    if _chandra_wrapper_cache is None or _chandra_wrapper_cache[0] != key:
        with _chandra_wrapper_lock:
            if _chandra_wrapper_cache is None or _chandra_wrapper_cache[0] != key:
                try:
                    _chandra_wrapper_cache = (key, ChandraOCRProviderWrapper(model_id=model_id, max_megapixels=max_megapixels))
                except Exception as e:
                    logger.warning("Chandra wrapper failed to initialize: {}", e)
                    _chandra_wrapper_cache = (key, None)
    return _chandra_wrapper_cache[1]


class AutoOCRProvider(OCRProvider):
    """
    MedVault OCRProvider that routes documents to the right backend based on
    explicit user doc_type hint (no ML classifier involved).

    Routing policy:
        * TABLE       -> Granite Vision 4.1-4b (GPU, 4-bit).
        * PRINTED_TEXT-> PaddleOCR on GPU.
        * HANDWRITTEN -> Chandra OCR (GPU, INT4).
    """
    _VALID_HINTS = {"auto", "printed", "printed_text", "table", "tabular", "handwritten", "handwrite", "handwritten_text"}

    def __init__(self,
                 paddle_use_gpu: bool = True,
                 paddle_lang: str = "en",
                 paddle_use_angle_cls: bool = True,
                 granite_model_id: str = "ibm-granite/granite-vision-4.1-4b",
                 granite_device: str = "",
                 granite_torch_dtype: str = "float16",
                 granite_load_in_4bit: bool = True,
                 chandra_model_id: str = "datalab-to/chandra-ocr-2",
                 chandra_max_megapixels: float = 1.0,
                 doc_type_hint: str = ""):
        self._paddle_cfg = dict(use_gpu=paddle_use_gpu, lang=paddle_lang, use_angle_cls=paddle_use_angle_cls)
        self._granite_cfg = dict(
            model_id=granite_model_id,
            device=granite_device or "",
            torch_dtype=granite_torch_dtype,
            load_in_4bit=granite_load_in_4bit,
        )
        self._chandra_cfg = dict(
            model_id=chandra_model_id,
            max_megapixels=chandra_max_megapixels,
        )
        self.last_doc_type: str = "printed"
        self.last_confidence: float = 0.0
        self._doc_type_hint = self._normalise_hint(doc_type_hint)

    @classmethod
    def _normalise_hint(cls, hint: str) -> str:
        """Normalise a user hint to one of the canonical labels or ``auto``."""
        if not hint:
            return "auto"
        h = hint.strip().lower()
        if h not in cls._VALID_HINTS:
            logger.warning("Unknown doc_type_hint '{}'; ignoring", h)
            return "auto"
        if h in ("printed", "printed_text"):
            return "PRINTED_TEXT"
        if h in ("table", "tabular"):
            return "TABLE"
        if h in ("handwritten", "handwrite", "handwritten_text"):
            return "HANDWRITTEN"
        return "auto"

    def _classify(self, filepath: str, filetype: str) -> tuple:
        if self._doc_type_hint == "auto":
            self.last_confidence = 1.0
            return "PRINTED_TEXT", 1.0
        self.last_confidence = 1.0
        return self._doc_type_hint, 1.0

    def _route(self, filepath: str, filetype: str) -> tuple:
        if getattr(self, "last_provider", None) is not None:
            return self.last_doc_type, self.last_provider

        doc_type, _ = self._classify(filepath, filetype)
        self.last_doc_type = doc_type

        try:
            from agents.ocr_router_agent import AGENT_FACTORIES
            if doc_type in AGENT_FACTORIES:
                factory = AGENT_FACTORIES[doc_type]
                fake_agent = factory()
                if fake_agent is not None:
                    class _Adapter(OCRProvider):
                        def extract_text(self, fp, ft):
                            res = fake_agent.run(fp)
                            return getattr(res, "raw_output", str(res))
                        def extract_structured(self, fp, ft):
                            return []
                    adapter = _Adapter()
                    self.last_provider = adapter
                    return doc_type, adapter
        except Exception:
            pass

        if doc_type == "HANDWRITTEN":
            chandra = _get_chandra_wrapper(**self._chandra_cfg)
            if chandra is not None:
                self.last_provider = chandra
                return "HANDWRITTEN", chandra
            logger.error("Chandra Vision unavailable for HANDWRITTEN document")
            raise RuntimeError("Chandra Vision OCR provider is unavailable for HANDWRITTEN document.")

        if doc_type == "TABLE":
            granite = _get_granite_wrapper(**self._granite_cfg)
            if granite is not None:
                self.last_provider = granite
                return "TABLE", granite
            logger.error("Granite Vision unavailable for TABLE document; failing loudly")
            raise RuntimeError("Granite Vision OCR provider is unavailable for TABLE document.")

        # PRINTED_TEXT -> PaddleOCR
        paddle = _get_paddle_wrapper(**self._paddle_cfg)
        if paddle is not None:
            self.last_provider = paddle
            return doc_type, self.last_provider
        logger.warning("PaddleOCR unavailable for PRINTED_TEXT; falling back to Granite Vision")
        granite = _get_granite_wrapper(**self._granite_cfg)
        self.last_provider = granite
        return doc_type, self.last_provider

    @staticmethod
    def _is_empty(text: str) -> bool:
        """True when OCR produced no usable content (blank / whitespace only)."""
        return not (text or "").strip()

    def extract_text(self, filepath: str, filetype: str, doc_type_hint: str = "") -> str:  # pragma: no cover - GPU/OCR runtime
        self.last_provider = None
        if doc_type_hint:
            self._doc_type_hint = self._normalise_hint(doc_type_hint)
        doc_type, provider = self._route(filepath, filetype)
        err: Optional[Exception] = None
        try:
            text = provider.extract_text(filepath, filetype)
        except Exception as e:  # noqa: BLE001 - fall back on any OCR failure
            text = ""
            err = e

        # Self-check: if the primary engine returned nothing, try fallback if allowed.
        if self._is_empty(text) or _looks_like_vision_error(text):
            if doc_type == "TABLE":
                logger.warning(
                    "Granite Vision OCR (%s) %s for %s; falling back to PaddleOCR",
                    doc_type, "errored: " + str(err) if err else "returned empty text", filepath
                )
                paddle = _get_paddle_wrapper(**self._paddle_cfg)
                if paddle is not None:
                    try:
                        fallback_text = paddle.extract_text(filepath, filetype)
                        if fallback_text and fallback_text.strip():
                            self.last_provider = paddle
                            return fallback_text
                    except Exception as e2:
                        logger.warning("PaddleOCR fallback for TABLE also failed: {}", e2)
                return text or ""
            else:
                logger.warning(
                    "Primary OCR (PRINTED_TEXT) %s for %s; trying Granite Vision fallback",
                    "errored" if err else "returned empty", filepath,
                )
                granite = _get_granite_wrapper(**self._granite_cfg)
                if granite is not None:
                    try:
                        fallback_text = granite.extract_text(filepath, filetype)
                        if fallback_text and fallback_text.strip():
                            self.last_provider = granite
                            return fallback_text
                    except Exception as e2:  # noqa: BLE001
                        logger.warning("Fallback Granite Vision OCR also failed: {}", e2)
            return text or ""
        return text or ""

    def extract_structured(self, filepath: str, filetype: str, doc_type_hint: str = "") -> list:  # pragma: no cover - GPU/OCR runtime
        self.last_provider = None
        if doc_type_hint:
            self._doc_type_hint = self._normalise_hint(doc_type_hint)
        doc_type, provider = self._route(filepath, filetype)
        err: Optional[Exception] = None
        try:
            if hasattr(provider, "extract_structured"):
                result = provider.extract_structured(filepath, filetype)
                if result:
                    return result
        except Exception as e:  # noqa: BLE001 - fall back on any OCR failure
            err = e
        # If the primary engine produced nothing, try the other engine.
        if doc_type == "TABLE":
            logger.warning("Granite structured OCR failed ({}); falling back to PaddleOCR", err or "empty")
            paddle = _get_paddle_wrapper(**self._paddle_cfg)
            self.last_provider = paddle
            provider = paddle
        # Fallback: use heuristics on plain text for printed docs
        if doc_type in ("printed", "TABLE", "PRINTED_TEXT"):
            if provider is None:
                logger.error("extract_structured: no OCR provider available for fallback")
                return []
            text = provider.extract_text(filepath, filetype)
            return self._heuristic_structured(text)
        return []

    def _heuristic_structured(self, text: str) -> list:  # pragma: no cover
        """Fallback structured extraction using simple regex heuristics on plain text."""
        from heuristics import extract_structured_results
        lines = [{"text": line, "bounding_box": []} for line in text.split("\n") if line.strip()]
        try:
            return extract_structured_results(lines, None)
        except Exception as err:
            logger.warning("_heuristic_structured failed: {}", err)
            return []


OCR_ENGINES = {
    "auto": lambda cfg: AutoOCRProvider(
        paddle_use_gpu=cfg.get("paddle_use_gpu", True),
        paddle_lang=cfg.get("paddle_lang", "en"),
        paddle_use_angle_cls=cfg.get("paddle_use_angle_cls", True),
        granite_model_id=cfg.get("granite_model_id", "ibm-granite/granite-vision-4.1-4b"),
        granite_device=cfg.get("granite_device", ""),
        granite_torch_dtype=cfg.get("granite_torch_dtype", "float16"),
        granite_load_in_4bit=cfg.get("granite_load_in_4bit", True),
        chandra_model_id=cfg.get("chandra_model_id", "datalab-to/chandra-ocr-2"),
        chandra_max_megapixels=cfg.get("chandra_max_megapixels", 1.0),
    ),
    "pipeline": lambda cfg: AutoOCRProvider(
        paddle_use_gpu=cfg.get("paddle_use_gpu", True),
        paddle_lang=cfg.get("paddle_lang", "en"),
        paddle_use_angle_cls=cfg.get("paddle_use_angle_cls", True),
        granite_model_id=cfg.get("granite_model_id", "ibm-granite/granite-vision-4.1-4b"),
        granite_device=cfg.get("granite_device", ""),
        granite_torch_dtype=cfg.get("granite_torch_dtype", "float16"),
        granite_load_in_4bit=cfg.get("granite_load_in_4bit", True),
        chandra_model_id=cfg.get("chandra_model_id", "datalab-to/chandra-ocr-2"),
        chandra_max_megapixels=cfg.get("chandra_max_megapixels", 1.0),
    ),
}


def build_ocr(engine: str = "auto", config: Optional[dict] = None) -> OCRProvider:
    """Instantiate and return an OCRProvider registered under ``engine``."""
    cfg = config or {}
    factory = OCR_ENGINES.get((engine or "auto").lower(), OCR_ENGINES["auto"])
    return factory(cfg)

