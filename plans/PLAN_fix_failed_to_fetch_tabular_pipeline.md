# PLAN — Fix "Failed to Fetch" for Tabular Pipeline Run

## SECTION A — GOAL DEFINITION

### 1. What is being built or changed?
The pipeline endpoint `POST /api/pipeline/run` crashes with a **"Failed to fetch"** network error in the browser after 2–3 minutes when the user clicks **Run Pipeline** on a tabular (TABLE) image. This needs to be fixed so tabular documents complete successfully and return OCR results via Granite Vision.

### 2. What does "done" look like?
- Clicking **Run Pipeline** on a tabular report returns pipeline results (OCR text + diagnosis) within a reasonable time (no browser-side "Failed to fetch").
- The `ocr.engine` field in the response reflects `GraniteVisionProviderWrapper` (or `PaddleOCRProviderWrapper` as explicit fallback) — never an empty crash.
- The frontend shows a meaningful "loading" spinner instead of silently freezing.

### 3. What is explicitly out of scope?
- Changing the Granite Vision model weights or quantization strategy.
- Fixing Paddle OCR for non-tabular flows (that path currently works).

---

## SECTION B — ROOT CAUSE ANALYSIS

### Bug 1 — The `run_pipeline` endpoint is **fully synchronous** on the ASGI event loop

**File**: [`backend/routes/pipeline_routes.py`](file:///c:/Users/oliad/Desktop/pipeline_tablehandwritten/pipeline_v1/backend/routes/pipeline_routes.py) — line 74.

```python
result = run_pipeline(content, ...)   # <-- blocks the async event loop
```

`run_pipeline` calls `ocr.extract_text(...)` which triggers Granite Vision model loading + inference synchronously inside the ASGI event loop thread. FastAPI / Uvicorn runs on a **single async event loop**. Blocking it for 2–3 minutes (while Granite loads 4-bit weights from disk) causes the TCP keepalive to expire and the browser reports **"Failed to fetch"**.

**Fix**: Move `run_pipeline(...)` into a thread pool executor via `asyncio.get_event_loop().run_in_executor(None, ...)` so the ASGI loop is free during the long GPU wait.

---

### Bug 2 — No server-level timeout configured

**File**: [`backend/main.py`](file:///c:/Users/oliad/Desktop/pipeline_tablehandwritten/pipeline_v1/backend/main.py) — line 93.

The FastAPI app has no `timeout_keep_alive` or middleware-level timeout set. Uvicorn's default keep-alive is **5 seconds**. If the connection idles (no bytes sent) for longer than 5 s, the browser connection is reset and shows "Failed to fetch".

**Fix**: Launch Uvicorn with `--timeout-keep-alive 300` so long-running GPU jobs don't get dropped.

---

### Bug 3 — CORS origins are missing port 3003 (frontend port)

**File**: [`backend/main.py`](file:///c:/Users/oliad/Desktop/pipeline_tablehandwritten/pipeline_v1/backend/main.py) — lines 98-103.

```python
allow_origins=[
    "http://localhost:3001",   # ← old dev port
    "http://127.0.0.1:3001",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
]
```

The frontend is now on **port 3003**. Any cross-origin `POST /api/pipeline/run` (e.g. if Vite proxy is bypassed or CORS preflight fires) will fail with a CORS error that also surfaces as "Failed to fetch" in the browser.

**Fix**: Add `http://localhost:3003` and `http://127.0.0.1:3003` to `allow_origins`.

---

### Bug 4 — Frontend has no `AbortController` timeout on the pipeline fetch

**File**: [`frontend/src/api.ts`](file:///c:/Users/oliad/Desktop/pipeline_tablehandwritten/pipeline_v1/frontend/src/api.ts) — line 91.

```typescript
return request<PipelineResult>("/pipeline/run", { method: "POST", body: fd });
```

The base `request()` function uses a plain `fetch()` with **no timeout signal**. When the backend blocks for 2–3 minutes and the TCP connection eventually resets, the browser reports "Failed to fetch" with no context. There's no way for the user to know if it's in-progress or crashed.

**Fix**: Add an `AbortController` with a 5-minute signal specifically for the pipeline call, and update the `DoctorPortal.tsx` error message to show "Pipeline timed out — the server may still be processing, please try again".

---

### Bug 5 — `GraniteVisionProviderWrapper.__init__` does **eager model construction**

**File**: [`backend/services/ocr_service.py`](file:///c:/Users/oliad/Desktop/pipeline_tablehandwritten/pipeline_v1/backend/services/ocr_service.py) — lines 54-60.

```python
class GraniteVisionProviderWrapper(OCRProvider):
    def __init__(self, ...):
        from backend.ocr.providers.granite_provider import GraniteVisionProvider
        self._provider = GraniteVisionProvider(...)   # <-- instantiates on init
```

And `_get_granite_wrapper` calls this inside the lock on the request thread — so model instantiation (and any slow weight loading) happens inside `_get_granite_wrapper`, which is called inside `extract_text`, which is called on the ASGI loop (Bug 1 amplified).

**Fix**: This is mitigated by fixing Bug 1 (offloading to executor), but we should also confirm `GraniteVisionProvider.__init__` is lazy (it is — it defers to `_get_model` only on first `extract_text` call).

---

## SECTION C — SESSION MODULARIZATION

### Session 1: Fix the blocking ASGI call (Critical — primary fix)
- **OBJECTIVE**: Run `run_pipeline()` in a thread pool executor so the ASGI event loop is never blocked.
- **SCOPE**: `backend/routes/pipeline_routes.py`
- **OUTPUT**: `POST /api/pipeline/run` is fully async — the browser connection stays alive during GPU processing.
- **CONNECTS TO**: Session 2 (Uvicorn keep-alive needs to match).
- **FAILURE SURFACE**: Thread pool exhaustion if many concurrent pipeline requests arrive. Acceptable for single-user local deployment.

### Session 2: Extend Uvicorn keep-alive & launch script
- **OBJECTIVE**: Raise keep-alive timeout from 5s to 300s so long GPU jobs don't drop the connection.
- **SCOPE**: `pipeline_v1/start.ps1`, `pipeline_v1/start.sh`
- **OUTPUT**: Backend launched with `--timeout-keep-alive 300`.
- **CONNECTS TO**: Session 3.
- **FAILURE SURFACE**: None — this is a pure additive flag.

### Session 3: Fix CORS origins to include port 3003
- **OBJECTIVE**: Add frontend port 3003 to the allowed origins list.
- **SCOPE**: `backend/main.py`
- **OUTPUT**: CORS preflight for `http://localhost:3003` succeeds.
- **CONNECTS TO**: Session 4.
- **FAILURE SURFACE**: None.

### Session 4: Add frontend timeout signal + better error messaging
- **OBJECTIVE**: Give the pipeline `fetch` a 5-minute `AbortController` timeout and surface a user-friendly error if it fires.
- **SCOPE**: `frontend/src/api.ts`, `frontend/src/pages/DoctorPortal.tsx`
- **OUTPUT**: Frontend shows "Pipeline timed out — retry" instead of blank "Failed to fetch".
- **CONNECTS TO**: End of fix chain.
- **FAILURE SURFACE**: None.

---

## SECTION D — PROGRESS CHECKLIST

- [x] Session 1: Fix blocking ASGI call in pipeline_routes.py
  - [x] Convert `run_pipeline_endpoint` to fully `async` using `run_in_executor`
  - [x] Verify endpoint returns response without freezing the ASGI loop
- [x] Session 2: Extend Uvicorn keep-alive in start scripts
  - [x] Add `--timeout-keep-alive 300` to `start.ps1`
  - [x] Add `--timeout-keep-alive 300` to `start.sh`
- [x] Session 3: Fix CORS origins in main.py
  - [x] Add `http://localhost:3003` and `http://127.0.0.1:3003` to `allow_origins`
- [x] Session 4: Frontend timeout + error message
  - [x] Add 5-minute `AbortController` signal to `runPipeline` API call
  - [x] Update `DoctorPortal.tsx` error message for timeout case
