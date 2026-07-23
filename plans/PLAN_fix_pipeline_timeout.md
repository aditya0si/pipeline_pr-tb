# PLAN_fix_pipeline_timeout.md

## SECTION A — GOAL DEFINITION

### 1. What is being built or changed?
Fix the 5-minute "Connection lost during pipeline run" error caused by Vite dev proxy dropping the HTTP socket before long GPU inference finishes.
- **Phase 1 (Stopgap)**: Increase Vite dev proxy timeout in `frontend/vite.config.ts` from 300,000ms (5m) to 600,000ms (10m) so client `AbortController` handles timeouts cleanly. Reduce Granite Vision `max_new_tokens` from 700 to 400 in `granite_provider.py` to optimize generation latency.
- **Phase 2 (Async Job Pipeline)**: Refactor `POST /api/pipeline/run` to launch pipeline execution asynchronously in a background thread and return HTTP 202 `{job_id, status: "pending"}` immediately. Add `GET /api/pipeline/run/status/{job_id}` endpoint. Update frontend `runPipeline()` in `api.ts` to poll status until completion.
- **Phase 3 (Watchdog & Preload Gate)**: Add a cold-start check in `pipeline_routes.py` returning HTTP 503 when Granite is preloading, and a generation watchdog in `granite_provider.py`.

### 2. What does "done" look like — what is the observable outcome?
- Vite proxy timeout is set to 600,000ms.
- `POST /api/pipeline/run` returns 202 `{job_id, status: "pending"}` in <100ms.
- `GET /api/pipeline/run/status/{job_id}` returns `{status: "running"|"done"|"failed", result: ...}`.
- Frontend `runPipeline()` polls status and renders results without dropping connection or raising "Connection lost".
- Requesting a tabular pipeline run while Granite is preloading returns an immediate HTTP 503 "still loading" message.
- All unit tests in `backend/tests/test_table_routing.py` pass cleanly.

### 3. What is explicitly out of scope for this task?
- Adding external task queues like Redis, Celery, or RQ (in-process thread + dictionary job registry is used).
- Modifying underlying OCR models or database schema.

---

## SECTION B — TECH STACK

- **Frontend**: React, Vite, TypeScript (`frontend/vite.config.ts`, `frontend/src/api.ts`)
- **Backend**: FastAPI, Uvicorn (`backend/routes/pipeline_routes.py`, `backend/services/pipeline_service.py`)
- **OCR Engine**: IBM Granite Vision 4.1-4b (`backend/ocr/providers/granite_provider.py`)

Existing Stack Touched:
- `pipeline_v1/frontend/vite.config.ts`
- `pipeline_v1/frontend/src/api.ts`
- `pipeline_v1/backend/routes/pipeline_routes.py`
- `pipeline_v1/backend/services/pipeline_service.py`
- `pipeline_v1/backend/ocr/providers/granite_provider.py`
- `pipeline_v1/backend/tests/test_table_routing.py`

---

## SECTION C — SESSION MODULARIZATION

### Session 1: Stopgap — Timeout race fix & token reduction
- **OBJECTIVE**: Prevent proxy socket drops and reduce Granite generation latency.
- **SCOPE**:
  - `pipeline_v1/frontend/vite.config.ts`
  - `pipeline_v1/backend/ocr/providers/granite_provider.py` (`_run_inference`)
- **OUTPUT**:
  - `timeout: 600000` in `vite.config.ts`.
  - `max_new_tokens=400` in `granite_provider.py`.
- **CONNECTS TO**: Session 2 (provides immediate timeout protection while async architecture is implemented).
- **FAILURE SURFACE**: Syntax error in vite config; verified by dev server start.

### Session 2: Backend Async Job Registry & Status Endpoints
- **OBJECTIVE**: Implement in-process job registry, async execution runner, and status endpoint.
- **SCOPE**:
  - `pipeline_v1/backend/services/pipeline_service.py` (`JobState`, `run_pipeline_async`, `get_job_state`)
  - `pipeline_v1/backend/routes/pipeline_routes.py` (`POST /api/pipeline/run`, `GET /api/pipeline/run/status/{job_id}`)
- **OUTPUT**:
  - Async job creation and status tracking in `pipeline_service.py`.
  - HTTP 202 `POST /api/pipeline/run` and `GET /api/pipeline/run/status/{job_id}` endpoints in `pipeline_routes.py`.
- **CONNECTS TO**: Session 3 (frontend will consume the async job and status endpoint).
- **FAILURE SURFACE**: Thread safety or race conditions in job dict; handled by thread-safe dictionary updates.

### Session 3: Frontend Polling Integration, Watchdog & Cold-Start Gate
- **OBJECTIVE**: Update frontend `runPipeline()` to poll status asynchronously, add generation watchdog, and 503 cold-start gate.
- **SCOPE**:
  - `pipeline_v1/frontend/src/api.ts` (`runPipeline`)
  - `pipeline_v1/backend/routes/pipeline_routes.py` (503 cold-start gate)
  - `pipeline_v1/backend/ocr/providers/granite_provider.py` (watchdog)
- **OUTPUT**:
  - Frontend async polling loop in `api.ts`.
  - 503 check for cold Granite preloads in `pipeline_routes.py`.
  - Watchdog logging in `granite_provider.py`.
- **CONNECTS TO**: Session 4 (system ready for full end-to-end verification).
- **FAILURE SURFACE**: Infinite polling loop if status is never marked done/failed; handled by max polling timeout (10m).

### Session 4: End-to-End Verification & Test Suite Execution
- **OBJECTIVE**: Verify async pipeline run flow, poll UI, 503 gate, and run test suite.
- **SCOPE**:
  - Manual pipeline execution test
  - `backend/tests/test_table_routing.py`
- **OUTPUT**:
  - Passing pytest test suite.
  - Verified non-blocking pipeline execution without "Connection lost".
- **CONNECTS TO**: Completion & Handoff.
- **FAILURE SURFACE**: Regression in mocked pipeline tests; handle via test mock updates.

---

## SECTION D — PROGRESS CHECKLIST

- [x] Session 1: Stopgap — Timeout race fix & token reduction
  - [x] Set `timeout: 600000` in `frontend/vite.config.ts`
  - [x] Reduce `max_new_tokens=400` in `granite_provider.py`
  - [x] Verified: Proxy timeout increased and token limit optimized

- [x] Session 2: Backend Async Job Engine & Status Endpoints
  - [x] Implement `JobState` registry and `run_pipeline_async` in `pipeline_service.py`
  - [x] Update `POST /api/pipeline/run` in `pipeline_routes.py` to return HTTP 202 `{job_id, status}`
  - [x] Implement `GET /api/pipeline/run/status/{job_id}` in `pipeline_routes.py`
  - [x] Verified: Job endpoints return 202 and report status/results correctly

- [x] Session 3: Frontend Polling, Watchdog & Cold-Start Gate
  - [x] Update `runPipeline()` in `frontend/src/api.ts` to submit job and poll status
  - [x] Add HTTP 503 cold-start check in `pipeline_routes.py` when Granite is loading
  - [x] Add generation watchdog logging in `granite_provider.py`
  - [x] Verified: Frontend polls status cleanly and cold-start returns 503

- [x] Session 4: Verification & Test Suite
  - [x] Verify async pipeline run on a tabular report
  - [x] Run `python -m pytest backend/tests/test_table_routing.py -v`
  - [x] Verified: All test cases pass cleanly with zero regressions
