# PLAN: Fix All 70 Bugs — MedVault Pipeline v1

---

## SECTION A — GOAL DEFINITION

**What is being built or changed?**
A systematic, session-by-session bug-fix pass across 13 files in `pipeline_v1/backend` and `pipeline_v1/frontend/src`. All 70 confirmed bugs (14 critical, 14 high, 24 medium, 16 low) will be resolved.

**What does "done" look like?**
- No `ImportError`, `AttributeError`, or `ModuleNotFoundError` on any route.
- A fresh DB install works end-to-end: upload → OCR → LLM analysis columns present → status endpoint responds.
- HANDWRITTEN uploads route through Chandra without crashing.
- BioMistral VRAM is freed after every LLM call (`keep_alive: 0` in payload).
- OCRWorkbench has all 3 doc-type buttons (printed, tabular, handwritten).
- `serve_file` endpoint requires auth token.
- `models.py` ORM matches actual DB schema.
- DB path is unified — one source of truth.
- All `except Exception` blocks that swallow real errors are distinguished.
- Unit tests pass with `PYTHONPATH=backend`.

**Out of scope:**
- Adding new features.
- Refactoring the agentic DAG or changing the VRAM allocation strategy.
- Changing the database engine (staying SQLite + raw SQL).
- Frontend redesign.

---

## SECTION B — TECH STACK

| Layer | Tech | Notes |
|---|---|---|
| Backend | Python 3.12, FastAPI, SQLite (raw SQL) | Staying with existing raw-SQL pattern; SQLAlchemy ORM only for `models.py` |
| GPU / LLM | PyTorch, HuggingFace Transformers, Ollama REST API | Fixing lifecycle, not changing providers |
| Frontend | React 18, TypeScript, Vite | Fixing state bugs and missing UI elements |
| Testing | unittest / pytest (existing suite) | All existing tests must continue to pass |
| Package manager | uv / pip | Existing `.venv` |

**Files touched:**
- `backend/database.py`
- `backend/config.py`
- `backend/models.py`
- `backend/gpu_manager.py`
- `backend/main.py`
- `backend/services/llm_client.py`
- `backend/services/pipeline_service.py`
- `backend/services/ocr_service.py`
- `backend/ocr/providers/chandra_provider.py`
- `backend/agents/handwritten_ocr_agent.py`
- `backend/routes/reports_routes.py`
- `backend/schemas.py`
- `frontend/src/pages/PatientPortal.tsx`
- `frontend/src/pages/OCRWorkbench.tsx`
- `frontend/src/api.ts`

---

## SECTION C — SESSION MODULARIZATION

---

### Session 1: Database & Config Foundation (Critical Infrastructure)
**Objective:** Fix all DB schema, path, and config bugs so every subsequent session has a stable data layer.

**Bugs fixed:** C5, C6, M1, M2, H10 (partial), Bug #35, #36, #37, #38, #39, #40, #41

**Scope — `backend/database.py`:**
- Add `llm_analysis TEXT`, `llm_engine TEXT`, `llm_duration REAL` directly to `_SCHEMA_SQL` CREATE TABLE (fix C5 / Bug #37).
- Add table-existence guard in `_migrate_reports_schema()` before `ALTER TABLE` loop (fix Bug #36 / C10).
- Call `_migrate_reports_schema(conn)` inside `init_db()` after `executescript` (fix C5).
- Fix SQLAlchemy engine to use the same `DB_PATH` as raw SQL — change `create_engine(f"sqlite:///{DB_PATH}")` (fix C6 / Bug #35).
- Remove premature `conn.commit()` from `_notify()` and `_audit()` — callers commit (fix Bug #38).

**Scope — `backend/config.py`:**
- Change `settings.upload_dir.mkdir()` to `parents=True, exist_ok=True` (fix M1 / Bug #39).
- Add startup validator warning when `jwt_secret == "dev-secret-change-me"` (fix M2 / Bug #40).
- Remove `db_path` from `Settings` (or wire it to set `os.environ["DB_PATH"]` before `database` imports) to unify DB path config (fix Bug #41).

**Output:** `database.py` creates the full correct schema on fresh install. `config.py` no longer has import-time side-effect crashes. DB path is unified.

**Connects To:** Session 2 depends on `llm_analysis` columns existing in schema. Session 3 depends on stable `get_db()`.

**Failure Surface:** `_migrate_reports_schema` table-existence guard — test by deleting `medvault.db` and restarting. SQLAlchemy engine path — verify with `sessionmaker()` query on fresh DB.

---

### Session 2: LLM Client — VRAM Lifecycle & Error Handling
**Objective:** Fix BioMistral VRAM lifecycle (C12) and all `llm_client.py` bugs.

**Bugs fixed:** C12, H4, Bug #6, #7, #8

**Scope — `backend/services/llm_client.py`:**
- Add `"keep_alive": settings.ollama_keep_alive` (or `0` directly) to the `payload` dict in `_call()` (fix C12 / Bug #8).
- Expand `except` to catch `httpx.TimeoutException` and `httpx.NetworkError` instead of only `ConnectError`/`ReadTimeout` (fix H4 / Bug #7).
- Add recursion guard: if `self.fallback_model == self.model`, do not recurse (fix Bug #6).

**Output:** `OllamaLLMClient._call()` sends `keep_alive: 0`, catches all httpx transport errors, and has no infinite-recursion path.

**Connects To:** Session 4 (pipeline_service) depends on llm_client being correct.

**Failure Surface:** Ollama must be running for live test. Mock httpx in unit tests with `unittest.mock.patch`.

---

### Session 3: GPU Manager — Race Conditions & Import Fixes
**Objective:** Fix all `gpu_manager.py` bugs.

**Bugs fixed:** Bug #1, #2, #3, #4, #5

**Scope — `backend/gpu_manager.py`:**
- Fix `preload_models()` guard: change condition to `if _preload_started: return` (no re-trigger after completion) (fix Bug #1).
- Fix `wait_for_granite_ready()`: wrap both `_preload_done` and `_granite_loaded` reads in a single `with _lock:` block (fix Bug #2).
- Fix inconsistent import in `gpu_status()`: change `from config import settings` to use the same import style as the rest of the file (fix Bug #3).
- Add `_preload_chandra()` stub that sets `_chandra_loaded = True` when Chandra is actually used (or at minimum wires the status flag correctly) (fix Bug #5).
- Document that `evict_chandra()` correctly nulls both `_chandra_loaded` and `svc._chandra_wrapper_cache` — Bug #4 is low risk, add a comment (fix Bug #4).

**Output:** `preload_models()` is idempotent. Status flags are accurate. No missing import.

**Connects To:** Session 4 depends on `evict_chandra()` and `ping_ollama()` being correct.

**Failure Surface:** Threading race — test `preload_models()` called twice in quick succession.

---

### Session 4: Pipeline Service — Connection Leaks & Logic Errors
**Objective:** Fix the DB connection leak, wrong patient_id, wrong SummaryAgent call, and WEBP detection.

**Bugs fixed:** C8, C11, C14, M7, M8, M9, Bug #9, #10, #11, #12, #13, #14

**Scope — `backend/services/pipeline_service.py`:**
- Fix connection leak: remove the intermediate `conn = get_db()` calls at lines 148 and 193; instead keep one `conn` open per retry and do writes with that single connection (fix C8 / Bug #9).
- Initialize `ocr = None` before the `if not reused:` branch so `getattr(ocr, ...)` on line 398 is safe on refactor (fix M7 / Bug #10).
- In `process_report_automatic`, check `len(extract_res.lab_results) == 0` before calling `DiagnosisAgent` — log a warning and skip LLM if empty (fix M8 / Bug #11).
- Fix `SummaryAgent.run()` call: pass `ocr_text` instead of `None` (fix C11 / Bug #12).
- Fix `run_pipeline()` hardcoded `patient_id="tmp"`: fetch `patient_id` from DB when `report_id` is provided (fix C14 / Bug #13).
- Fix WEBP detection: `content[8:12] == b'WEBP'` in addition to `_sig[:4] == b'RIFF'` (fix M9 / Bug #14).

**Output:** No connection leaks per retry. LLM receives valid lab results. SummaryAgent gets real text. Patient ID stored correctly.

**Connects To:** Session 5 depends on correct OCR service routing. Session 6 depends on stable pipeline output for frontend.

**Failure Surface:** Connection leak — watch SQLite "database is locked" errors under load. Empty lab result skip — add unit test for ExtractionAgent → empty result path.

---

### Session 5: OCR Service & Chandra Provider — Crash Fixes
**Objective:** Fix the non-existent `RULES_CONFIG` import, `build_ocr` broken args, None provider crash, and Chandra model loading bugs.

**Bugs fixed:** C2, C3, C4, H1, H2, H3, M3, M4, Bug #15, #16, #17, #18, #19, #25, #26, #27, #28, #29

**Scope — `backend/services/ocr_service.py`:**
- Remove `from database import RULES_CONFIG` — replace with either a hardcoded default config dict or import from `hepatology_kb.py` / `medical_rules.json` (fix C2 / Bug #26).
- Fix `build_ocr()` to actually apply the `engine` parameter and configure the returned provider correctly; add a `doc_type_hint` parameter (fix C3 / Bug #27).
- Add `if paddle is None: raise RuntimeError("PaddleOCR failed to initialize")` before `provider.extract_text()` (fix C4 / Bug #29).
- Add `chandra_model_id` and `chandra_max_megapixels` to `OCR_ENGINES` lambdas (fix M4 / Bug #28).
- Remove or document the dead `last_provider` route cache (fix M3 / Bug #25).

**Scope — `backend/ocr/providers/chandra_provider.py`:**
- Fix double-checked lock: remove the outer unsynchronized `if _MODEL is not None` check; only check inside `with _MODEL_LOCK:` (fix H1 / Bug #15).
- Remove the redundant `dtype=compute_dtype` kwarg when `quantization_config` is passed (fix H2 / Bug #16).
- Add `del pix` after `Image.frombytes()` in the PDF page loop to release PyMuPDF Pixmap memory (fix H3 / Bug #17).
- Remove `from database import RULES_CONFIG` and replace with a local default (fix C2 / Bug #18).
- Add a try/except around `Image.open` with a clear error message (fix Bug #19).

**Output:** `build_ocr()` works. `RULES_CONFIG` import crash is gone. Chandra loads correctly without conflicting args. PDF memory is freed per page.

**Connects To:** Session 6 (handwritten agent) depends on Chandra provider being stable.

**Failure Surface:** Removing `dtype=` kwarg — test model loading with just `quantization_config`. PDF pixmap leak — test with a 10-page PDF and monitor VRAM.

---

### Session 6: Handwritten OCR Agent — Import & Module Fix
**Objective:** Fix the import path crash and lazy-import cv2/numpy.

**Bugs fixed:** C1, L1, L2, Bug #20, #21, #22

**Scope — `backend/agents/handwritten_ocr_agent.py`:**
- Change `from backend.ocr.providers.chandra_provider import ChandraOCRProvider` → `from ocr.providers.chandra_provider import ChandraOCRProvider` (fix C1 / Bug #20).
- Move `import cv2` and `import numpy as np` inside the `run()` method body as lazy imports (fix L1 / Bug #21).
- Add a comment about BGR→RGB channel order handling (fix L2 / Bug #22, documentation only).

**Output:** HANDWRITTEN uploads no longer crash on import. `cv2` import failure doesn't break non-handwritten routes.

**Connects To:** Session 4's pipeline_service now correctly routes handwritten to Chandra without crashing.

**Failure Surface:** Test by sending a handwritten upload to `POST /api/test/upload?doc_type=handwritten`.

---

### Session 7: Reports Routes — Auth, Connection Leaks & OCR Reuse
**Objective:** Fix unauthenticated file serving, connection leaks, redundant OCR re-runs, and doc_type label consistency.

**Bugs fixed:** C7, C9, H5, H6, M5, M6, Bug #30, #31, #32, #33, #34

**Scope — `backend/routes/reports_routes.py`:**
- Add token auth to `serve_file()`: decode token from query param or `Authorization` header, raise 401 if missing/invalid (fix C7 / Bug #32).
- Wrap all DB operations in `try/finally: conn.close()` in `patient_reports()`, `test_reports()`, and `serve_file()` (fix H5 / Bug #30).
- In `analyze_report()`: check `row["ocr_text"]` first — if `row["status"] == "done"` and `ocr_text` is non-empty, skip re-OCR (fix H6 / Bug #31).
- Remove unused `bg: BackgroundTasks = None` parameter (or use it properly with `bg.add_task(...)` for the background thread) (fix M5 / Bug #34).
- Normalize `doc_type` storage: before INSERT, map `"tabular"` → `"TABLE"` and `"handwritten"` → `"HANDWRITTEN"` so pipeline_service comparisons are consistent (fix M6 / Bug #33).

> [!NOTE]
> **ASSUMPTION:** Doctor-route auth (C9) is in `doctor_routes.py`, not `reports_routes.py`. Session 7 covers `reports_routes.py` auth. Doctor routes auth is a separate sub-item in this session.

**Output:** File serving requires authentication. DB connections never leak. OCR is not re-run on analyzed reports. `doc_type` is stored consistently.

**Connects To:** Session 8 (models.py) builds on the stable DB schema confirmed by Sessions 1 & 7.

**Failure Surface:** Auth on `serve_file` — test with missing token (expect 401), valid token (expect 200), tampered token (expect 401).

---

### Session 8: ORM Models — Sync with Real DB Schema
**Objective:** Update `models.py` to match the actual DB schema so ORM queries don't silently fail.

**Bugs fixed:** H9, H10, Bug #24, #25

**Scope — `backend/models.py`:**
- Add all missing `reports` columns: `filename`, `filepath`, `filetype`, `shared_at`, `status`, `doc_type`, `ocr_engine`, `duration`, `error`, `analyzed`, `structured_results`, `analysis`, `llm_analysis`, `llm_engine`, `llm_duration` (fix H9 / Bug #24).
- Rename `file_path` → `filepath` and `created_at` → `shared_at` in the `Report` model (fix Bug #24).
- Add the 7 profile columns to `Patient` model: `date_of_birth`, `gender`, `blood_group`, `email`, `address`, `emergency_contact`, `emergency_phone` (fix H10 / Bug #25).

**Output:** ORM models accurately reflect all table columns. Any ORM-based query returns real data.

**Connects To:** Session 9 (schemas) builds on stable ORM/DB alignment.

**Failure Surface:** Run `Base.metadata.create_all(engine)` on a test DB and verify column counts.

---

### Session 9: Schemas & API Contracts — Type Mismatches
**Objective:** Fix Pydantic schema bugs and align with both frontend and DB types.

**Bugs fixed:** H14, M16, M17, Bug #20 (schema), #21, #22, #23

**Scope — `backend/schemas.py`:**
- Change `config: dict = {}` → `config: dict = Field(default_factory=dict)` in `ProviderReq`, `TemplateReq`, `InvoiceReq`, `PrescriptionReq` (fix M16 / Bug #20).
- Change `LabResultReq.value: float` → `value: Union[float, str]` to match SQLite TEXT storage (fix H14 / Bug #21).
- Change `LabResult.reference_range: ReferenceRange` → `Optional[ReferenceRange] = None` to match frontend nullable contract (fix M17 / Bug #22).

**Output:** Pydantic models accept real data. No schema validation surprises.

**Connects To:** Session 10 (frontend) depends on knowing the correct API shapes.

**Failure Surface:** Run the existing Pydantic test suite. Submit a lab result with a string value (e.g., `"<5"`) — should validate correctly.

---

### Session 10: Frontend — PatientPortal Bug Fixes
**Objective:** Fix all `PatientPortal.tsx` bugs.

**Bugs fixed:** H11, H12, L10, L11, L12, Bug #1, #2, #3, #4, #5, #6, #7

**Scope — `frontend/src/pages/PatientPortal.tsx`:**
- Add `disabled={uploading}` to all 3 doc-type buttons to prevent double-submit (fix H12 / Bug #1).
- Add `await` before `loadReports()` in the success path of `handleUpload` (fix H11 / Bug #3).
- Add null guard: `r.shared_at ? new Date(r.shared_at).toLocaleDateString(...) : "—"` (fix M22 / Bug #6).
- Replace `<a href=...><button>View</button></a>` with a styled `<a>` element or `onClick={() => window.open(...)}` on the button (fix L10 / Bug #7).
- Add `r.filetype` sanitization for CSS class: `className={\`tag \${["pdf","image"].includes(r.filetype) ? r.filetype : "unknown"}\`}` (fix L11 / Bug #5).
- Fix `setProgress(0)` double-call — remove the one in `catch`; let `finally` handle all cleanup (fix L12 / Bug #4).

**Output:** PatientPortal is safe against double-submits, invalid dates, and HTML nesting errors.

**Connects To:** Session 11 (OCRWorkbench) is independent but benefits from the same patterns established here.

**Failure Surface:** Click a doc-type button twice rapidly — only one upload should be sent.

---

### Session 11: Frontend — OCRWorkbench Bug Fixes
**Objective:** Add the missing Handwritten button, fix dead code, fix toggleStep OCR lock, and remove the mock queue.

**Bugs fixed:** C13, M18, M19, M20, M21, L13, L14, Bug #8, #9, #10, #11, #12, #13, #14, #15

**Scope — `frontend/src/pages/OCRWorkbench.tsx`:**
- Add "Handwritten" button in the upload flow (fix C13 / Bug #10):
  ```tsx
  <button onClick={() => handleRealUpload(pendingFile, "handwritten")}>
    Handwritten (Chandra OCR)
  </button>
  ```
- Wire `renderEngines` into `RENDERERS` under the `"pipeline"` tab or add a new "Engines" tab (fix M18 / Bug #8).
- Fix `toggleStep`: add `onClick={s.id === "ocr" ? undefined : () => toggleStep(s.id)}` (fix M19 / Bug #14).
- Make `RENDERERS` a `useMemo` with stable deps, or move it outside the component (fix L14 / Bug #13).
- Wrap `handleRealUpload` in `useCallback` (fix L13 / Bug #9).
- Add null guard: `res?.report_id?.slice(0, 8) ?? "unknown"` (fix Bug #11).
- Replace `MOCK_FILES` static queue with a real state-based upload queue that reflects `handleRealUpload` uploads (fix M21 / Bug #12).
- Change "Save Pipeline" button to persist to `localStorage` (fix M20 / Bug #15).

**Output:** OCRWorkbench supports all 3 doc types. Engine panel is reachable. OCR step cannot be disabled. Pipeline config persists across navigation.

**Connects To:** Session 12 (api.ts) fixes the underlying API calls these components use.

**Failure Surface:** Send a handwritten upload from OCRWorkbench — verify Chandra is invoked.

---

### Session 12: API Layer & CORS — Contract Fixes
**Objective:** Fix API contract gaps, relative URL bug, CORS config, and polling error handling.

**Bugs fixed:** M13, M23, M24, L15, L16, Bug #16, #26, #27, #28, #29

**Scope — `frontend/src/api.ts`:**
- Fix `fileUrl` to return an absolute URL using `API_BASE` env var or `window.location.origin` (fix M23 / Bug #27).
- Add `ocr_provider_id` to `analyzeReport` call signature (fix L15 / Bug #26).
- Fix polling error discrimination: check HTTP status code or error type — not string matching on message (fix M24 / Bug #28).

**Scope — `backend/main.py`:**
- Expand CORS `allow_origins` to include a wider port range, or use `allow_origin_regex` for localhost (fix M13 / Bug #16).
- Classify GPU preload exceptions: log CUDA OOM as ERROR severity, not as a print statement (fix M14 / Bug #18).
- Add lifespan shutdown path: call `evict_chandra()` and `evict_ollama()` after `yield` (fix M15 / Bug #19).

**Output:** API URLs work in `target="_blank"` production tabs. CORS doesn't silently fail. GPU errors surface clearly.

**Connects To:** Sessions 10–11 depend on these API calls being correct.

**Failure Surface:** Open a file link in a new tab — should resolve correctly. Verify `ocr_provider_id` appears in network request payload.

---

### Session 13: Verification — Run Tests & End-to-End Smoke Test
**Objective:** Run all existing unit tests, confirm no regressions, and do a full pipeline smoke test.

**Scope:**
1. Run `$env:PYTHONPATH="backend"; .venv\Scripts\python -m pytest tests/ -v`
2. Delete `medvault.db` → restart server → verify fresh DB initializes with all columns.
3. Upload a printed PDF → confirm `status=done`, `llm_analysis` populated.
4. Upload a tabular image → confirm `status=done`, Granite routing.
5. Upload a handwritten image → confirm `status=done`, Chandra routing.
6. Verify OCRWorkbench has all 3 buttons and Handwritten routes correctly.
7. Verify `GET /api/file/{id}` returns 401 without token.
8. Verify VRAM freed after BioMistral run (check `ollama ps` shows 0 loaded models after pipeline).

**Output:** All 7 existing tests pass. 5 smoke test scenarios succeed. `ollama ps` shows clean VRAM after pipeline.

**Failure Surface:** Any test regression in Sessions 1–12 becomes visible here.

---

## SECTION D — PROGRESS CHECKLIST

- [x] **Session 1: Database & Config Foundation**
  - [x] `llm_analysis`, `llm_engine`, `llm_duration` added to `_SCHEMA_SQL` CREATE TABLE
  - [x] `_migrate_reports_schema()` has table-existence guard
  - [x] `init_db()` calls `_migrate_reports_schema()` at startup
  - [x] SQLAlchemy engine uses same `DB_PATH` as raw SQL
  - [x] `_notify()` and `_audit()` no longer do premature `conn.commit()`
  - [x] `config.py` uses `parents=True, exist_ok=True` in `mkdir`
  - [x] `jwt_secret` validator warns on insecure default
  - [x] DB path unified between config.py and database.py
  - [x] Fresh DB init verified end-to-end (delete DB, restart server)

- [x] **Session 2: LLM Client**
  - [x] `"keep_alive": 0` in `_call()` payload
  - [x] `except` catches `httpx.TimeoutException` and `httpx.NetworkError`
  - [x] Recursion guard when `fallback_model == model`
  - [x] Unit test: mock httpx.WriteTimeout → confirm fallback triggers

- [x] **Session 3: GPU Manager**
  - [x] `preload_models()` guard is `if _preload_started: return`
  - [x] `wait_for_granite_ready()` reads both flags under lock
  - [x] `gpu_status()` import style is consistent
  - [x] `_chandra_loaded` flag updated correctly on eviction/load
  - [x] `preload_models()` called twice → no double-load

- [x] **Session 4: Pipeline Service**
  - [x] Single `conn` per retry loop — no intermediate `conn = get_db()`
  - [x] `ocr = None` initialized before `if not reused:` branch
  - [x] Empty lab results → skip `DiagnosisAgent`, log warning
  - [x] `SummaryAgent.run(ocr_text, ...)` — not `None`
  - [x] `patient_id` fetched from DB when `report_id` is provided
  - [x] WEBP detection uses `content[8:12] == b'WEBP'`

- [x] **Session 5: OCR Service & Chandra Provider**
  - [x] `RULES_CONFIG` import removed from both files
  - [x] `build_ocr()` applies engine parameter
  - [x] None check before `provider.extract_text()`
  - [x] `chandra_model_id` / `chandra_max_megapixels` in `OCR_ENGINES` lambdas
  - [x] Dead `last_provider` cache removed or documented
  - [x] Chandra double-checked lock fixed (only check inside `_MODEL_LOCK`)
  - [x] `dtype=` kwarg removed when `quantization_config` is present
  - [x] `del pix` after each PDF page pixmap
  - [x] `Image.open` error has clear message

- [x] **Session 6: Handwritten OCR Agent**
  - [x] Import path: `from ocr.providers.chandra_provider import ChandraOCRProvider`
  - [x] `import cv2` and `import numpy` moved inside `run()` method
  - [x] HANDWRITTEN upload test succeeds without crash

- [x] **Session 7: Reports Routes**
  - [x] `serve_file()` requires valid auth token (401 without token)
  - [x] `serve_file()` returns 404 (not 500) if file missing from disk
  - [x] Doctor routes have auth check
  - [x] `try/finally: conn.close()` in all 3 affected endpoints
  - [x] `analyze_report()` reuses stored `ocr_text` when `status=done`
  - [x] `bg: BackgroundTasks` removed or properly used
  - [x] `doc_type` normalized to `TABLE` / `HANDWRITTEN` before DB insert

- [x] **Session 8: ORM Models**
  - [x] `Report` model has all 15+ columns matching DB schema
  - [x] `Report.filepath` (no underscore), `Report.shared_at` (not `created_at`)
  - [x] `Patient` model has all 7 profile columns
  - [x] `Base.metadata.create_all()` verified on test DB

- [x] **Session 9: Schemas**
  - [x] `Field(default_factory=dict)` in all 4 Pydantic models
  - [x] `LabResultReq.value: Union[float, str]`
  - [x] `LabResult.reference_range: Optional[ReferenceRange] = None`
  - [x] Submit string lab value `"<5"` — validates without error

- [x] **Session 10: PatientPortal.tsx**
  - [x] Doc-type buttons have `disabled={uploading}`
  - [x] `await loadReports()` in success path
  - [x] Null guard on `r.shared_at`
  - [x] `<a>` not wrapping `<button>`
  - [x] `r.filetype` CSS class sanitized
  - [x] `setProgress(0)` called only once (in finally)

- [x] **Session 11: OCRWorkbench.tsx**
  - [x] Handwritten button present in upload flow
  - [x] `renderEngines` wired into RENDERERS or a new tab
  - [x] `toggleStep("ocr")` is no-op
  - [x] `RENDERERS` is stable (useMemo or outside component)
  - [x] `handleRealUpload` in `useCallback`
  - [x] `res?.report_id?.slice(0, 8) ?? "unknown"`
  - [x] Upload queue reflects real uploads (not MOCK_FILES)
  - [x] "Save Pipeline" persists to localStorage

- [x] **Session 12: API Layer & CORS**
  - [x] `fileUrl` returns absolute URL
  - [x] `ocr_provider_id` in `analyzeReport`
  - [x] Polling uses status code for error classification
  - [x] CORS includes broader localhost range
  - [x] GPU preload errors logged at correct severity
  - [x] Lifespan shutdown evicts GPU models

- [x] **Session 13: Verification**
  - [x] `pytest tests/ -v` — all tests pass
  - [x] Fresh DB init works (delete + restart)
  - [x] Printed upload: `status=done`, `llm_analysis` populated
  - [x] Tabular upload: `status=done`, Granite routing confirmed
  - [x] Handwritten upload: `status=done`, Chandra routing confirmed
  - [x] `GET /api/file/{id}` without token → 401
  - [x] `ollama ps` shows 0 models after pipeline run
