# PLAN_fix_ui_granite_metrics.md — Fix UI Layout, Granite Vision Empty Text & Execution Metrics

---

## SECTION A — GOAL DEFINITION

1. **What is being built or changed?**
   - **UI Restructuring**: In `DoctorPortal.tsx` (and pipeline result components), remove the "Extracted Lab Results" table tab/panel. Keep only **Raw OCR Text** and **AI Diagnosis Summary (BioMistral 7B Analysis)** so both raw OCR text and LLM clinical narrative are clearly presented.
   - **Granite Vision 4.1-4b Fix**: Fix empty string decoding in `granite_provider.py` caused by `prompt_len` token slice misalignment (`out[0, prompt_len:]` returning empty tensor when generated output shape <= prompt length). Add an automatic fallback to `PaddleOCR` in `ocr_service.py` if Granite returns empty text so `TABLE` images never return blank results.
   - **UI Header Metrics Bar**: Update the result header bar in `DoctorPortal.tsx` to prominently display:
     - The exact OCR library/engine used (`Chandra OCR (INT4 NF4)`, `PaddleOCR (GPU)`, or `Granite Vision 4.1-4b (GPU)`).
     - The total end-to-end processing time from initial upload through OCR and BioMistral LLM analysis to completion (e.g. `18.42s`).

2. **What does "done" look like?**
   - Uploading a handwritten report shows raw OCR text under Panel 1 and BioMistral summary under Panel 2, with NO "Extracted Lab Results" table cluttering the view.
   - Uploading a tabular image routes to Granite Vision 4.1-4b (or PaddleOCR fallback if Granite output is blank) and successfully produces non-empty OCR text + LLM analysis.
   - The result panel top bar explicitly shows the library used (e.g., `Chandra OCR (INT4 NF4)`) and total execution duration (e.g., `Total Time: 12.3s`).

3. **What is explicitly out of scope?**
   - Training new models or changing quantization formats (NF4 / 4-bit remains).
   - Altering database schema tables created in previous sessions.

---

## SECTION B — TECH STACK

- **Languages**: Python 3.12, TypeScript / React 19
- **Libraries & Models**:
  - `transformers`, `torch`, `bitsandbytes` (Granite Vision 4.1-4b NF4, Chandra OCR INT4)
  - `PaddleOCR` (Printed text OCR)
  - `OllamaLLMClient` (BioMistral 7B GGUF)
  - `FastAPI`, `Uvicorn` (Backend API)
  - `Vite`, `React` (Frontend SPA)
- **Decision rationale**:
  - `out[0, prompt_len:]` fallback guard: If `out.shape[1] > prompt_len`, slice from `prompt_len`; otherwise decode `out[0]` directly to prevent empty output strings.
  - OCR fallback for `TABLE`: If Granite produces blank output, fall back to PaddleOCR instead of returning blank text.

---

## SECTION C — SESSION MODULARIZATION

### Session 1: Granite Vision Model Generation Fix & OCR Fallback
- **OBJECTIVE**: Fix `granite_provider.py` empty text generation and add PaddleOCR fallback for `TABLE` documents in `ocr_service.py`.
- **SCOPE**: `backend/ocr/providers/granite_provider.py`, `backend/services/ocr_service.py`.
- **OUTPUT**: Granite Vision outputs decoded text properly; table images never return empty text.
- **CONNECTS TO**: Session 2 (pipeline service metrics).
- **FAILURE SURFACE**: Token slicing bounds error or tokenizer mismatch.

### Session 2: Pipeline Service Total Duration & Engine Name Standardization
- **OBJECTIVE**: Track total start-to-end execution time in `run_pipeline()` and standardize engine names (`Chandra OCR (INT4 NF4)`, `PaddleOCR (GPU)`, `Granite Vision 4.1-4b (GPU)`).
- **SCOPE**: `backend/services/pipeline_service.py`.
- **OUTPUT**: `PipelineResult.metadata` contains `duration_seconds` and standardized `ocr.engine` labels.
- **CONNECTS TO**: Session 3 (UI updates).
- **FAILURE SURFACE**: Duration calculation missing when OCR text is reused.

### Session 3: UI Restructuring & Metrics Bar in DoctorPortal
- **OBJECTIVE**: Remove "Extracted Lab Results" panel in `DoctorPortal.tsx`, display Raw OCR Text + BioMistral Analysis, and add the engine & total execution time header bar.
- **SCOPE**: `frontend/src/pages/DoctorPortal.tsx`, `frontend/src/api.ts`.
- **OUTPUT**: Frontend displays raw text, BioMistral summary, engine badge, and total duration cleanly.
- **CONNECTS TO**: Verification.
- **FAILURE SURFACE**: Missing optional properties in API response.

---

## SECTION D — PROGRESS CHECKLIST

- [x] **Session 1: Granite Vision Generation Fix & Fallback**
  - [x] Fix `gen_tokens` slice in `granite_provider.py` (`out[0, prompt_len:]` vs `out[0]`)
  - [x] Update `ocr_service.py` to fall back to PaddleOCR if Granite Vision returns empty text for `TABLE`
  - [x] Test Granite Vision text extraction with sample table image

- [x] **Session 2: Duration Tracking & Engine Standard Labels**
  - [x] Calculate `start_time` to `end_time` total duration in `pipeline_service.py`
  - [x] Return `duration_seconds` in `metadata`
  - [x] Standardize `ocr.engine` names to user-friendly titles

- [x] **Session 3: UI Column Restructuring & Metrics Header**
  - [x] Remove "Extracted Lab Results" table section from `DoctorPortal.tsx`
  - [x] Display Raw OCR Text (Panel 1) and BioMistral AI Diagnosis Summary (Panel 2)
  - [x] Add header metrics bar showing OCR engine name and total duration (seconds)
  - [x] Verify UI rendering across Handwritten, Printed, and Tabular uploads
