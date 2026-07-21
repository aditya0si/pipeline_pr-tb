"""
backend/routes/pipeline_routes.py — POST /api/pipeline/run (Session 8).

The unified entry-point that orchestrates the full agentic DAG
(preprocess -> OCR router -> extract -> validate -> diagnose ->
[summary] -> [evaluate]) over an uploaded medical-lab image and returns a single
``PipelineResult`` JSON.

The heavy OCR / LLM paths live behind the existing offline agents (faked via
``ocr_router_agent.AGENT_FACTORIES`` in tests), so the default request path is
LLM-free / network-free / GPU-free. A malformed upload returns 400 — never 500.

Also exposes ``/api/gpu/status`` and ``/api/gpu/preload`` so the frontend can
monitor and trigger GPU model loading (PaddleOCR + Granite Vision).
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

router = APIRouter()


@router.get("/api/gpu/status")
def gpu_status_endpoint():
    """Return the current GPU / model-load status (no auth required)."""
    from gpu_manager import gpu_status
    return gpu_status().to_dict()


@router.post("/api/gpu/preload")
def gpu_preload_endpoint():
    """Trigger eager GPU model preloading (PaddleOCR + Granite Vision).

    Returns immediately; loading runs in a background thread. Poll
    ``/api/gpu/status`` to track progress.
    """
    from gpu_manager import preload_models
    preload_models(blocking=False)
    return {"status": "preload_started", "message": "Models are loading in the background. Poll /api/gpu/status for progress."}


@router.post("/api/pipeline/run", status_code=202)
async def run_pipeline_endpoint(
    file: UploadFile = File(...),
    evaluate: bool = Form(False, description="Merge Agent 7 evaluation metrics"),
    summary: bool = Form(False, description="Attach a doctor-facing summary"),
    use_graph: bool = Form(True, description="Orchestrate via the PipelineGraph DAG"),
    report_id: str = Form("", description="Optional: reuse stored OCR text for this report id instead of re-running OCR"),
    doc_type: str = Form("", description="Optional: explicit doc_type hint ('printed' or 'tabular')"),
):
    """
    Start full pipeline execution asynchronously over a multipart image upload.

    Returns HTTP 202 ``{"job_id": "<uuid>", "status": "pending"}`` immediately.
    Poll ``GET /api/pipeline/run/status/{job_id}`` to retrieve progress and completion results.
    """
    if file is None:
        raise HTTPException(status_code=400, detail="No image file provided")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty image file")

    # Cold-start check: if tabular requested while Granite is preloading, return 503 immediately
    norm_doc = (doc_type or "").strip().lower()
    if norm_doc in ("tabular", "table"):
        try:
            from gpu_manager import gpu_status, _preload_started
            st = gpu_status()
            if _preload_started and not st.granite_loaded:
                raise HTTPException(
                    status_code=503,
                    detail="Granite Vision model is currently loading weights on GPU. Please retry in 30 seconds."
                )
        except HTTPException:
            raise
        except Exception:
            pass

    import threading
    import uuid
    from services.pipeline_service import run_pipeline_async

    job_id = str(uuid.uuid4())
    thread = threading.Thread(
        target=run_pipeline_async,
        args=(job_id, content, evaluate, summary, use_graph, report_id or None, doc_type or ""),
        daemon=True,
    )
    thread.start()

    return {"job_id": job_id, "status": "pending", "message": "Pipeline execution started asynchronously."}


@router.get("/api/pipeline/run/status/{job_id}")
def get_pipeline_job_status(job_id: str):
    """Return current status and result for an asynchronous pipeline job."""
    from services.pipeline_service import get_job_state
    state = get_job_state(job_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Pipeline job '{job_id}' not found")
    return {
        "job_id": job_id,
        "status": state["status"],
        "result": state.get("result"),
        "error": state.get("error"),
        "started_at": state.get("started_at"),
        "completed_at": state.get("completed_at"),
    }
