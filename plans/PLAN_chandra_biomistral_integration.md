# PLAN_chandra_biomistral_integration.md

---

## SECTION A — GOAL DEFINITION

1. **What is being built or changed?**
   - Add `chandra-ocr` as a third OCR routing engine (`handwritten`) for handwritten document images alongside PaddleOCR (`printed`) and Granite Vision (`tabular`).
   - Integrate `BioMistral-7B GGUF (4-bit)` running locally via Ollama to perform clinical LLM analysis on raw OCR output for `DiagnosisAgent` and `SummaryAgent`.
   - Implement a sequential VRAM lifecycle scheduler to manage 8GB VRAM limits across Chandra (~4-5GB), Granite (~3-4GB), and BioMistral (~5GB), ensuring clean allocation and eviction.
   - Update both backend API routes / DB schema and frontend upload / workbench UI components.

2. **What does "done" look like — what is the observable outcome?**
   - Frontend provides three document types: `Printed`, `Tabular`, and `Handwritten`.
   - Uploading a handwritten document triggers `ChandraOCRProvider`, returning accurate OCR markdown text.
   - Post-OCR, the pipeline invokes BioMistral locally via Ollama and produces LLM-augmented diagnosis and doctor/patient summaries without API keys or cloud dependencies.
   - `/api/gpu/status` reflects state for all providers (`paddle_loaded`, `granite_loaded`, `chandra_loaded`, `ollama_reachable`).
   - The system operates robustly under 8GB VRAM without CUDA OOM crashes.

3. **What is explicitly out of scope?**
   - Concurrent execution of Granite and Chandra on GPU.
   - External/cloud API calls.
   - Retraining or fine-tuning model weights.
   - Running the Gradio app from `chandra_pplne` (only model/inference logic is ported into `pipeline_v1`).

---

## SECTION B — TECH STACK

- **Languages & Frameworks**: Python 3.12, FastAPI, PyTorch (CUDA 12.9), React 19, TypeScript
- **OCR Engines**:
  - `PaddleOCR` (printed text)
  - `IBM Granite Vision 4.1-4b` (tables/tabular)
  - `datalab-to/chandra-ocr-2` (INT4 NF4) via `chandra-ocr[hf]` (handwritten text) — *Chosen for high handwritten accuracy and ~4-5GB VRAM usage.*
- **LLM Serving**: `Ollama` serving `bartowski/BioMistral-7B-GGUF:Q4_K_M` (with `llama3.2:3b` as fallback) — *Chosen for local 4-bit medical domain reasoning fitting within ~5GB VRAM.*
- **Database**: SQLite (`medapp.db`) via `aiosqlite`
- **VRAM Management**: Custom `VRAMScheduler` & context managers in `gpu_manager.py` using `torch.cuda.empty_cache()` and Ollama `keep_alive=0`.

---

## SECTION C — SESSION MODULARIZATION

### Session 1: Chandra OCR Provider Integration
- **OBJECTIVE**: Port Chandra OCR model loading and inference logic from `chandra_pplne` into `pipeline_v1` as `ChandraOCRProvider`.
- **SCOPE**:
  - `pipeline_v1/backend/ocr/providers/chandra_provider.py` [NEW]
  - `pipeline_v1/backend/agents/handwritten_ocr_agent.py` [NEW]
  - `pipeline_v1/backend/services/ocr_service.py`
  - `pipeline_v1/backend/agents/ocr_router_agent.py`
  - `pipeline_v1/backend/routes/reports_routes.py`
  - `pipeline_v1/requirements.txt`
- **OUTPUT**: Uploading `handwritten` documents routes to Chandra OCR, generating raw OCR text.
- **CONNECTS TO**: Session 2 (VRAM lifecycle management).
- **FAILURE SURFACE**: Missing `chandra-ocr` package, uncached HuggingFace weights, or VRAM collision if Granite is active.

### Session 2: VRAM Lifecycle Manager
- **OBJECTIVE**: Extend `gpu_manager.py` with explicit eviction mechanisms (`evict_chandra()`, `evict_ollama()`) and VRAM context managers.
- **SCOPE**:
  - `pipeline_v1/backend/gpu_manager.py`
  - `pipeline_v1/backend/routes/pipeline_routes.py`
- **OUTPUT**: `/api/gpu/status` displays `chandra_loaded` & `ollama_reachable`. Explicit eviction methods prevent multi-model VRAM overload.
- **CONNECTS TO**: Session 3 (Pipeline & LLM Client integration).
- **FAILURE SURFACE**: Delayed CUDA memory release or race conditions between concurrent requests.

### Session 3: BioMistral LLM Client & Pipeline Service Integration
- **OBJECTIVE**: Implement `OllamaLLMClient`, wire it into `DiagnosisAgent`/`SummaryAgent`, update `pipeline_service.py` with full VRAM lifecycle logic, and perform DB schema updates.
- **SCOPE**:
  - `pipeline_v1/backend/services/llm_client.py` [NEW]
  - `pipeline_v1/backend/services/pipeline_service.py`
  - `pipeline_v1/backend/config.py`
  - `pipeline_v1/backend/database.py`
  - `pipeline_v1/.env.example`
- **OUTPUT**: `run_pipeline()` completes OCR, evicts OCR models as needed, queries BioMistral via Ollama, returns `llm_narrative`, and evicts LLM VRAM.
- **CONNECTS TO**: Session 4 (Ollama environment setup).
- **FAILURE SURFACE**: Ollama connection failures, LLM prompt parsing errors, or missing DB migration columns.

### Session 4: Ollama Local Environment & Model Setup
- **OBJECTIVE**: Automate local setup of Ollama daemon and pull/create `biomistral` (GGUF 4-bit) & `llama3.2:3b`.
- **SCOPE**:
  - `pipeline_v1/scripts/setup_ollama.ps1` [NEW]
  - `pipeline_v1/Modelfile.biomistral` [NEW]
- **OUTPUT**: Running Ollama daemon exposing `biomistral` model at `http://localhost:11434`.
- **CONNECTS TO**: Session 5 (Frontend UI & end-to-end integration).
- **FAILURE SURFACE**: Ollama CLI installation failure or HuggingFace model download timeouts.

### Session 5: Frontend UI & Status Endpoint Updates
- **OBJECTIVE**: Add `handwritten` doc_type option to upload/workbench pages, add status polling, and render LLM analysis results.
- **SCOPE**:
  - `pipeline_v1/frontend/src/pages/PatientPortal.tsx`
  - `pipeline_v1/frontend/src/pages/OCRWorkbench.tsx`
  - `pipeline_v1/backend/routes/reports_routes.py`
- **OUTPUT**: Patient upload UI supports `Handwritten` documents. Workbench displays `BioMistral Medical Analysis` section.
- **CONNECTS TO**: Session 6 (Background automatic task LLM integration).
- **FAILURE SURFACE**: Frontend state mismatches during multi-stage processing or unhandled API errors.

### Session 6: Automatic Background Report Processing Integration
- **OBJECTIVE**: Integrate BioMistral LLM analysis phase into `process_report_automatic` in `pipeline_service.py`.
- **SCOPE**:
  - `pipeline_v1/backend/services/pipeline_service.py`
- **OUTPUT**: Asynchronous report uploads run both OCR and LLM analysis in background threads, persisting results to `reports.llm_analysis`.
- **CONNECTS TO**: Session 7 (Verification & Testing).
- **FAILURE SURFACE**: Background thread crashes or database locks during async updates.

### Session 7: Verification, Testing & Documentation
- **OBJECTIVE**: Write unit/smoke tests covering Chandra provider, LLM client, VRAM manager, and router agent; update reference documentation.
- **SCOPE**:
  - `pipeline_v1/tests/test_chandra_provider.py` [NEW]
  - `pipeline_v1/tests/test_llm_client.py` [NEW]
  - `pipeline_v1/tests/test_gpu_manager.py`
  - `pipeline_v1/tests/test_ocr_service.py`
  - `pipeline_v1/tests/test_smoke.py`
  - `pipeline_v1/SETUP.md`
  - `pipeline_v1/README.md`
  - `pipeline_v1/CODEBASE_REFERENCE.md`
- **OUTPUT**: Clean passing test suite (`pytest`) and complete setup & architecture documentation.
- **CONNECTS TO**: Final project delivery.
- **FAILURE SURFACE**: Uncaught edge cases or broken test assertions.

---

## SECTION D — PROGRESS CHECKLIST

- [x] **Session 1: Chandra OCR Provider Integration**
  - [x] Create `pipeline_v1/backend/ocr/providers/chandra_provider.py`
  - [x] Implement `ChandraOCRProvider` with load, unload, extract_text, extract_structured, and image resizing
  - [x] Add `ChandraOCRProviderWrapper` and `_get_chandra_wrapper` to `ocr_service.py`
  - [x] Update `AutoOCRProvider` hints and routing for `"HANDWRITTEN"`
  - [x] Create `HandwrittenOCRAgent` in `pipeline_v1/backend/agents/handwritten_ocr_agent.py`
  - [x] Register `"HANDWRITTEN"` / `"handwritten"` in `AGENT_FACTORIES` in `ocr_router_agent.py`
  - [x] Update `reports_routes.py` upload validation to accept `"handwritten"`
  - [x] Add `chandra-ocr[hf]` and `hf_transfer` to `requirements.txt`

- [x] **Session 2: VRAM Lifecycle Manager**
  - [x] Add `_chandra_loaded`, `_ollama_reachable`, `_ollama_model_name` to `gpu_manager.py`
  - [x] Implement `evict_chandra()` and `evict_ollama()` in `gpu_manager.py`
  - [x] Implement `ping_ollama()` helper
  - [x] Add `chandra_vram_context()` context manager
  - [x] Update `GPUStatus` dataclass and `gpu_status()` endpoint response

- [x] **Session 3: BioMistral LLM Client & Pipeline Service Integration**
  - [x] Create `pipeline_v1/backend/services/llm_client.py` with `OllamaLLMClient`
  - [x] Add Ollama & Chandra settings to `config.py` and `.env.example`
  - [x] Update `database.py` schema migration for `llm_analysis`, `llm_engine`, `llm_duration`
  - [x] Wire VRAM lifecycle and `OllamaLLMClient` into `run_pipeline()` in `pipeline_service.py`
  - [x] Ensure `DiagnosisAgent` and `SummaryAgent` receive `llm_client` when Ollama is active

- [x] **Session 4: Ollama Local Environment & Model Setup**
  - [x] Create `pipeline_v1/Modelfile.biomistral`
  - [x] Create `pipeline_v1/scripts/setup_ollama.ps1`
  - [x] Verify local Ollama daemon serves `biomistral` and `llama3.2:3b`

- [x] **Session 5: Frontend UI & Status Endpoint Updates**
  - [x] Add `GET /api/reports/{report_id}/status` endpoint in `reports_routes.py`
  - [x] Add `Handwritten` option to `PatientPortal.tsx` doc_type selector with timing badge
  - [x] Add `Handwritten` option and `BioMistral Medical Analysis` display panel in `OCRWorkbench.tsx`

- [x] **Session 6: Automatic Background Report Processing Integration**
  - [x] Update `process_report_automatic` in `pipeline_service.py` with Chandra eviction and LLM analysis phase
  - [x] Persist `llm_analysis`, `llm_engine`, and `llm_duration` to SQLite `reports` table

- [x] **Session 7: Verification, Testing & Documentation**
  - [x] Create `tests/test_chandra_provider.py`
  - [x] Create `tests/test_llm_client.py`
  - [x] Update `tests/test_gpu_manager.py`, `tests/test_ocr_service.py`, and `tests/test_smoke.py`
  - [x] Run `pytest` and verify all tests pass
  - [x] Update `SETUP.md`, `README.md`, and `CODEBASE_REFERENCE.md`

