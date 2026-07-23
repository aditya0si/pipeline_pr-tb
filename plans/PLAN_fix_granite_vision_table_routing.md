# PLAN — Fix Granite Vision Table Routing

## SECTION A — GOAL DEFINITION

1. **What is being built or changed?**
   Fixing Granite Vision initialization and document routing in `backend/services/ocr_service.py` and `backend/ocr/providers/granite_provider.py` so that documents classified/hinted as `TABLE` or `tabular` reliably execute via Granite Vision (`GraniteVisionProvider`) instead of falling back to PaddleOCR.

2. **What does "done" look like?**
   - Granite Vision provider wrapper initializes cleanly without `shm.dll` / DLL import exception crashes on Windows.
   - `AutoOCRProvider` routes `TABLE` and `tabular` documents to Granite Vision.
   - `ocr_engine` in pipeline results for `TABLE` documents reports Granite Vision (or `GraniteVisionProviderWrapper`).
   - Automated unit/integration tests verify `TABLE` routing to Granite Vision.

3. **What is explicitly out of scope for this task?**
   Re-training OCR models or modifying non-tabular PaddleOCR functionality for printed text documents.

---

## SECTION B — TECH STACK

- **Backend**: FastAPI / Uvicorn, Python 3 virtual environment (`.venv`).
- **AI/OCR Frameworks**: PyTorch (`torch`), HuggingFace Transformers (`AutoProcessor`, `AutoModelForImageTextToText`), BitsAndBytes (`load_in_4bit`), PaddleOCR (fallback engine for printed text).
- **Execution & OS**: Windows PowerShell environment.

---

## SECTION C — SESSION MODULARIZATION

### Session 1: Safe Granite Initialization & Import Ordering
- **OBJECTIVE**: Prevent `shm.dll` / DLL procedure loading errors when `GraniteVisionProvider` initializes on Windows by enforcing safe PyTorch initialization order and robust exception handling.
- **SCOPE**:
  - `pipeline_v1/backend/ocr/providers/granite_provider.py`
  - `pipeline_v1/backend/services/ocr_service.py`
- **OUTPUT**: Robust initialization wrapper for Granite Vision that loads PyTorch DLL dependencies safely on Windows.
- **CONNECTS TO**: Session 2.
- **FAILURE SURFACE**: Persistent OS-level C++ redistributable missing dependency if native DLLs are completely absent on the host system.

### Session 2: Table Routing Verification & Test Validation
- **OBJECTIVE**: Verify `AutoOCRProvider` and `run_pipeline` preserve `TABLE` document class and route table documents to `GraniteVisionProvider`.
- **SCOPE**:
  - `pipeline_v1/backend/services/ocr_service.py`
  - `pipeline_v1/backend/services/pipeline_service.py`
  - `pipeline_v1/backend/tests/` or dedicated verification script
- **OUTPUT**: Verified table OCR execution returning `GraniteVisionProviderWrapper` / Granite Vision engine metadata.
- **CONNECTS TO**: End user verification of table report OCR.
- **FAILURE SURFACE**: Memory allocation failure if GPU VRAM is insufficient for 4-bit Granite model loading.

---

## SECTION D — PROGRESS CHECKLIST

- [x] Session 1: Safe Granite Initialization & Import Ordering
  - [x] Add safe PyTorch DLL & C++ runtime initialization in `granite_provider.py`
  - [x] Update `_get_granite_wrapper` in `ocr_service.py` to handle Windows DLL loading gracefully
  - [x] Verify Granite Vision provider wrapper initializes without `shm.dll` error
- [x] Session 2: Table Routing Verification & Test Validation
  - [x] Verify `TABLE` / `tabular` document classification hints route directly to Granite Vision
  - [x] Verify `ocr_engine` in pipeline result reflects Granite Vision for tabular documents
  - [x] Run verification tests ensuring table OCR succeeds
