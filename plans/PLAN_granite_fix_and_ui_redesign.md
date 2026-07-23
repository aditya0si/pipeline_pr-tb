# PLAN_granite_fix_and_ui_redesign.md — Fix Granite OCR Backend Plumbing & Redesign Doctor Portal UI

---

## SECTION A — GOAL DEFINITION

1. **What is being built or changed?**
   - **Phase A (Backend Fixes)**:
     - Extend `_get_model` and `_load_model` in `backend/ocr/providers/granite_provider.py` to accept `model_id`, `device`, `torch_dtype`, and `load_in_4bit`.
     - Update `GraniteVisionProvider.__init__` to store and pass `device`, `torch_dtype`, and `load_in_4bit`, pinning `device="cuda"` when GPU is available.
     - Update `_preload_granite()` in `backend/gpu_manager.py` to pass all 4 arguments to `_get_model` so background preloading succeeds without cold-start timeouts.
     - Enhance pytesseract integration in `granite_provider.py` to attempt `lang="eng+hin"` and safely fall back to `lang="eng"` if Hindi language data is missing. Add `pytesseract` and pin `transformers>=5.0.0` in `requirements.txt` and document OS requirements in `SETUP.md`.
     - Add dedicated `ocr_duration_seconds` timing around OCR extraction in `backend/services/pipeline_service.py` (`ocr["processing_time_seconds"]`), and surface `llm_duration_seconds` in `metadata`.
   - **Phase B (Frontend Redesign)**:
     - Update `frontend/src/api.ts` to add optional `duration_seconds` and `llm_duration_seconds` fields to `PipelineResult` interface.
     - Redesign `DoctorPortal.tsx` to a responsive two-column grid (`.pipeline-columns`): Raw OCR Text (left column) and BioMistral Analysis + Color-coded Lab Results Table (right column), collapsing to 1 column on screens `< 900px`.
     - Add inline model label and "Copy OCR Text" button above the left Raw OCR column.
     - Expand top metrics banner in `DoctorPortal.tsx` to display 5 metric chips: 🚀 OCR Engine, 📄 Document Type, ⏱️ OCR Duration, 🧠 LLM Duration, ⏳ Total Time.

2. **What does "done" look like?**
   - Background preloading for Granite Vision completes cleanly on server startup (`_granite_loaded=True`).
   - TABLE uploads process without 60s cold-start timeouts or TypeError signature mismatches.
   - Separate OCR duration and LLM duration are measured and returned in API responses.
   - Doctor Portal UI displays a responsive 2-column layout (Raw OCR left / BioMistral + Lab Table right) with a 5-chip metrics banner and Copy-to-Clipboard functionality.
   - Automated pytest suite and TypeScript frontend build pass cleanly.

3. **What is explicitly out of scope?**
   - Altering Chandra OCR or PaddleOCR inference logic.
   - Adding abnormal-values callouts or download-as-txt buttons.

---

## SECTION B — TECH STACK

- **Backend**: Python 3.12, PyTorch, Transformers (>=5.0.0), BitsAndBytes (INT4 NF4), PyTesseract, FastAPI, SQLite
- **Frontend**: React 19, TypeScript, Vite, CSS Variables & CSS Grid

---

## SECTION C — SESSION MODULARIZATION

### Session 1: Backend Granite Provider & GPU Manager Plumbing Fixes (A1, A2, A3, A4, A7)
- **OBJECTIVE**: Fix `_get_model` and `GraniteVisionProvider.__init__` signatures, fix `_preload_granite()`, handle `pytesseract` language fallback gracefully, and update `requirements.txt` / `SETUP.md`.
- **SCOPE**: `backend/ocr/providers/granite_provider.py`, `backend/gpu_manager.py`, `backend/requirements.txt`, `SETUP.md`.
- **OUTPUT**: Preload call succeeds on startup, Granite Vision provider accepts config kwargs, and pytesseract safely falls back to `eng`.
- **CONNECTS TO**: Session 2.
- **FAILURE SURFACE**: PyTesseract binary missing on Windows — catch `Exception` and fall back to image-only prompt cleanly.

### Session 2: Pipeline Timing & Duration Metric Extensions (A5, A6)
- **OBJECTIVE**: Measure explicit `ocr_duration` (distinct from total duration) and expose `llm_duration_seconds` in payload metadata.
- **SCOPE**: `backend/services/pipeline_service.py`.
- **OUTPUT**: API response returns `ocr.processing_time_seconds` and `metadata.llm_duration_seconds`.
- **CONNECTS TO**: Session 3.
- **FAILURE SURFACE**: Metadata dict key mismatch — double-check default schema values.

### Session 3: Frontend TypeScript Contract & Two-Column UI Redesign (B1, B2, B3, B4, B5)
- **OBJECTIVE**: Update `api.ts` interfaces, implement 2-column grid in `styles.css` and `DoctorPortal.tsx`, build 5-chip metrics banner, add inline model header & copy button, and wire up color-coded lab results table.
- **SCOPE**: `frontend/src/api.ts`, `frontend/src/pages/DoctorPortal.tsx`, `frontend/src/styles.css`.
- **OUTPUT**: Responsive 2-column Doctor Portal UI with rich metrics banner, inline model headers, copy button, and color-coded lab results table.
- **CONNECTS TO**: Session 4 (Verification).
- **FAILURE SURFACE**: Mobile viewport layout overflow — add `@media (max-width: 900px)` breakpoint.

### Session 4: Verification & Automated Tests
- **OBJECTIVE**: Run pytest test suite and Vite build to confirm end-to-end correctness.
- **SCOPE**: Full codebase.
- **OUTPUT**: All tests green, zero build errors.

---

## SECTION D — PROGRESS CHECKLIST

- [x] **Session 1: Backend Granite Provider & GPU Manager Plumbing Fixes**
  - [x] Extend `_get_model` and `_load_model` in `granite_provider.py` to accept `(model_id, device, torch_dtype, load_in_4bit)`
  - [x] Store `device`, `torch_dtype`, `load_in_4bit` in `GraniteVisionProvider.__init__` and pin `device="cuda"` when available
  - [x] Update `_preload_granite` in `gpu_manager.py` to pass corrected arguments to `_get_model`
  - [x] Update `extract_text` in `granite_provider.py` to try `lang="eng+hin"` then fall back to `lang="eng"`
  - [x] Add `pytesseract` and pin `transformers>=5.0.0` in `requirements.txt` & document in `SETUP.md`

- [x] **Session 2: Pipeline Timing & Duration Metric Extensions**
  - [x] Measure explicit OCR start/end duration in `pipeline_service.py` and populate `ocr["processing_time_seconds"]`
  - [x] Expose `metadata["llm_duration_seconds"]` in `run_pipeline()` payload

- [x] **Session 3: Frontend TypeScript Contract & Two-Column UI Redesign**
  - [x] Update `PipelineResult` interface in `frontend/src/api.ts` with `duration_seconds?` and `llm_duration_seconds?`
  - [x] Add `.pipeline-columns`, 2-column grid layout, and `@media (max-width: 900px)` single-column fallback in `frontend/src/styles.css`
  - [x] Expand top metrics banner in `DoctorPortal.tsx` to 5 chips (🚀 Engine, 📄 Doc Type, ⏱️ OCR Time, 🧠 LLM Time, ⏳ Total Time)
  - [x] Add inline model label and "Copy OCR Text" button above left Raw OCR column
  - [x] Render color-coded lab results table (`flag-chip`) below BioMistral analysis narrative in right column

- [x] **Session 4: Verification & Automated Tests**
  - [x] Run pytest suite (`test_chandra_provider.py`, `test_llm_client.py`, `test_pipeline_run_service.py`)
  - [x] Run `npm run build` in `frontend/`
