# PLAN — Fix Granite Vision Cold-Start Timeout on Pipeline Run

## SECTION A — GOAL DEFINITION

### 1. What is being built or changed?
The pipeline endpoint times out with "Pipeline execution timed out (5m limit)" because Granite Vision's model weights take 7–8 minutes to load from disk during the background preload, and the frontend's 5-minute timeout fires before loading completes. Needs to be fixed so the first `Run Pipeline` call succeeds without timeout.

### 2. What does "done" look like?
- Clicking "Run Pipeline" on a TABLE document returns results within 5 minutes on first run after server start.
- Subsequent runs are near-instant (model already in GPU VRAM).
- The pipeline response includes `ocr.engine = "GraniteVisionProviderWrapper"`.

### 3. What is explicitly out of scope?
- Improving model weights loading speed (hardware-dependent).
- Changing quantization strategy (4-bit NF4 stays).

---

## SECTION B — ROOT CAUSE ANALYSIS

### Root Cause 1 — Model weights loading takes 7–8 min from HF cache (contended disk)
**Evidence**: Log shows `Loading weights: 1%|1 | 11/1083 [00:24<36:22,  2.04s/it]` — 2+ seconds per shard. That's a projected 36 minutes for all 1083 shards.

The HuggingFace cache stores model weights as hard-linked blobs. On first access with `trust_remote_code=True`, the transformers library also checks the HF Hub for metadata (making 30+ HTTP HEAD requests before loading starts). Each of these has ~250ms latency. Combined with disk contention from PaddleOCR's GPU initialization running concurrently, the load is extremely slow.

### Root Cause 2 — Pipeline thread blocks waiting for preload lock
**Evidence**: `_get_model` in `granite_provider.py` uses `with _MODEL_LOCK` — when the preload background thread holds this lock, any pipeline call to `extract_text` blocks silently until the lock is released. With a 7–8 minute load time, the 5-minute frontend timeout fires first.

### Root Cause 3 — Pipeline doesn't wait for preload; it tries to load concurrently
**Evidence**: `run_pipeline` in `pipeline_service.py` immediately calls `AutoOCRProvider.extract_text()` → `_get_granite_wrapper()` → `GraniteVisionProviderWrapper.__init__()` → `GraniteVisionProvider.__init__()`. None of these check whether the preload is still running. The request blocks on the model lock.

---

## SECTION C — FIXES (3 sessions)

### Session 1: Set TRANSFORMERS_OFFLINE=1 + HF_HUB_DISABLE_IMPLICIT_TOKEN=1 to eliminate HF network calls during preload
**Problem**: Each preload attempt makes 30+ HTTP requests to huggingface.co to verify model metadata. At ~250ms each, that's ~8 seconds of pure network overhead before weight loading even begins.

**Fix**: Set `TRANSFORMERS_OFFLINE=1` in the uvicorn launch so transformers loads from local HF cache without network checks. The model is already cached (`~/.cache/huggingface/hub/models--ibm-granite--granite-vision-4.1-4b`).

- **File**: `start.ps1`, `start.sh`
- **Output**: Preload eliminates ~8s of HF Hub network overhead; loads from cache directly.

### Session 2: Load Paddle and Granite sequentially, Granite first (before Paddle occupies VRAM)
**Problem**: `_do_preload()` loads Paddle first, then Granite. Paddle allocates GPU VRAM upfront (~500MB–1GB). Then Granite's 4-bit quantized model (~3.5GB) must fight for the remaining VRAM bandwidth. Loading order matters.

**Fix**: Swap the order in `gpu_manager.py` so Granite loads first (while GPU VRAM is clean), then Paddle. This prevents VRAM contention during weight loading.

- **File**: `backend/gpu_manager.py` — swap `_preload_paddle()` and `_preload_granite()` call order in `_do_preload()`.

### Session 3: Add pipeline preload-wait guard — surface a "Loading model, retry in 30s" response instead of timing out
**Problem**: When `run_pipeline` is called while the background preload thread is still loading Granite, it blocks on `_MODEL_LOCK` for minutes. The frontend sees a timeout.

**Fix**: Add a `wait_for_granite_ready(timeout=60)` helper in `gpu_manager.py` that checks `_granite_loaded` and waits in a polling loop. Call it from `_get_granite_wrapper()` in `ocr_service.py` before acquiring the model lock. If granite isn't ready within 60s, raise a clear exception: `"Granite Vision is still loading. Please retry in 30 seconds."` This way the frontend shows a meaningful error instead of a timeout.

- **Files**:
  - `backend/gpu_manager.py` — add `wait_for_granite_ready()` and `is_granite_loading()` helpers
  - `backend/services/ocr_service.py` — call `wait_for_granite_ready()` in `_get_granite_wrapper()`

---

## SECTION D — PROGRESS CHECKLIST

- [x] Session 1: Set TRANSFORMERS_OFFLINE=1 to eliminate HF network overhead at startup
  - [x] Add `TRANSFORMERS_OFFLINE=1` and `HF_HUB_DISABLE_SYMLINKS_WARNING=1` to backend launch in `start.ps1`
  - [x] Add same env vars to `start.sh`
  - [x] Relaunch backend and confirm preload skips HF network calls in logs
- [x] Session 2: Swap Granite-first preload order in gpu_manager.py
  - [x] Move `_preload_granite()` before `_preload_paddle()` in `_do_preload()`
  - [x] Relaunch and confirm Granite loads before Paddle in startup logs
- [x] Session 3: Add preload-wait guard and user-friendly retry message
  - [x] Add `wait_for_granite_ready()` and `is_granite_loading()` to `gpu_manager.py`
  - [x] Call `wait_for_granite_ready()` at start of `_get_granite_wrapper()` in `ocr_service.py`
  - [x] Test: clicking Run Pipeline while model still loading returns "Granite Vision is still loading" error
  - [x] Test: clicking Run Pipeline after preload completes returns OCR results
