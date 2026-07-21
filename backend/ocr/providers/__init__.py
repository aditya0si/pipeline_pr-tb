"""
backend.ocr.providers — OCR engine provider implementations.

Each module in this package wraps a specific OCR backend:

  * ``paddle_provider``  — PaddleOCR (printed / table OCR, GPU)
  * ``granite_provider`` — IBM Granite Vision 4.1-4b (tabular report OCR, GPU, 4-bit NF4)

This ``__init__.py`` makes ``backend.ocr.providers`` a regular importable
package so that ``from backend.ocr.providers.paddle_provider import ...``
resolves reliably (it was previously relying on implicit namespace-package
resolution, which is fragile and caused silent ImportError failures in
``gpu_manager.preload_models`` and ``services.ocr_service``).
"""
