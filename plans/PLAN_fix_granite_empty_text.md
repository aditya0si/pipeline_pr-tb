# PLAN_fix_granite_empty_text.md

## SECTION A — GOAL DEFINITION

### 1. What is being built or changed?
Fix IBM Granite Vision 4.1-4b returning empty text during table image OCR by pinning `transformers==5.6.2` (the exact version used in `granite_vision.ipynb`), making the transformers masking patch fail loudly if broken, and adding comprehensive diagnostic logging to inspect raw generation tokens.

### 2. What does "done" look like — what is the observable outcome?
- `transformers==5.6.2` installed in virtual environment (`pip show transformers` yields `5.6.2`).
- `backend/requirements.txt` and root `requirements.txt` explicitly pin `transformers==5.6.2`.
- `_patch_transformers_masking()` in `granite_provider.py` logs errors loudly and raises exceptions if patching fails.
- `_run_inference()` logs input prompt length, generated tensor shape, raw generated token IDs, and decoded character count.
- Direct test of `extract_text()` on a sample table image (`Patient_Kastoor/Lab_Report/`) returns non-empty, readable OCR text.
- `/api/doctor/analyze` and `/api/pipeline/run` for tabular images return `ocr_engine: GraniteVisionProviderWrapper` with non-empty `ocr_text`.
- All tests in `backend/tests/test_table_routing.py` pass cleanly.

### 3. What is explicitly out of scope for this task?
- Rewriting model architecture or changing the base model.
- Modifying PaddleOCR or non-tabular document processing.
- Modifying frontend UI layout or database schema.

---

## SECTION B — TECH STACK

- **Framework**: PyTorch, HuggingFace Transformers (pinned to `5.6.2`)
- **Quantization**: `bitsandbytes` (4-bit NF4)
- **OCR Engine**: `GraniteVisionProviderWrapper` (`ibm-granite/granite-vision-4.1-4b`)
- **Python**: virtual environment (`.venv`)

Existing Stack Touched:
- `pipeline_v1/backend/requirements.txt`
- `pipeline_v1/requirements.txt`
- `pipeline_v1/backend/ocr/providers/granite_provider.py`
- `pipeline_v1/backend/tests/test_table_routing.py`

---

## SECTION C — SESSION MODULARIZATION

### Session 1: Pin transformers dependency & update virtual environment
- **OBJECTIVE**: Pin `transformers==5.6.2` across project requirement files and reinstall in `.venv`.
- **SCOPE**:
  - `pipeline_v1/backend/requirements.txt`
  - `pipeline_v1/requirements.txt`
- **OUTPUT**:
  - Updated requirement files with explicit `transformers==5.6.2` pin.
  - Reinstalled `transformers==5.6.2` inside `.venv`.
- **CONNECTS TO**: Session 2 (ensures Granite Vision model runs under the correct transformers version).
- **FAILURE SURFACE**: Network issues or dependency conflicts during `pip install`; handle via explicit `pip install transformers==5.6.2`.

### Session 2: Make masking patch fail loudly & add inference diagnostics
- **OBJECTIVE**: Ensure broken masking monkey-patches fail loudly and log detailed generation token metrics.
- **SCOPE**:
  - `pipeline_v1/backend/ocr/providers/granite_provider.py` (`_patch_transformers_masking`, `_run_inference`, `extract_text`)
- **OUTPUT**:
  - `_patch_transformers_masking` logs error and raises exception on failure instead of `pass`.
  - `_run_inference` logs prompt length, tensor shapes, raw generated token IDs, and decoded text sample.
  - `extract_text` logs error if output is empty.
- **CONNECTS TO**: Session 3 (provides exact visibility into model output during manual & automated verification).
- **FAILURE SURFACE**: `_patch_transformers_masking` raising error on startup if `transformers` internals changed; verified by pinning `transformers==5.6.2`.

### Session 3: Direct model verification, pipeline test & test suite execution
- **OBJECTIVE**: Validate Granite OCR produces non-empty text on table images and pass test suite.
- **SCOPE**:
  - Verification script on sample image (`Patient_Kastoor/Lab_Report/`)
  - `backend/tests/test_table_routing.py`
- **OUTPUT**:
  - Successful non-empty OCR extraction from sample table image.
  - Passing pytest suite.
- **CONNECTS TO**: Completion & handoff to user.
- **FAILURE SURFACE**: Cold-start or CUDA OOM during test; handle via `bitsandbytes` 4-bit config.

---

## SECTION D — PROGRESS CHECKLIST

- [x] Session 1: Pin transformers to 5.6.2
  - [x] Pin `transformers==5.6.2` in `backend/requirements.txt`
  - [x] Pin `transformers==5.6.2` in root `requirements.txt`
  - [x] Reinstall `transformers==5.6.2` in `.venv`
  - [x] Verified: `pip show transformers` shows version 5.6.2

- [x] Session 2: Masking patch error handling & diagnostics
  - [x] Replace `except Exception: pass` in `_patch_transformers_masking()` with loud logging & re-raise
  - [x] Add raw token & decoded length diagnostics to `_run_inference()`
  - [x] Add empty result logging to `extract_text()`
  - [x] Verified: Granite provider logs raw token details and fails loudly on patch failure

- [x] Session 3: Verification & test suite
  - [x] Test Granite Vision `extract_text()` on a real table image from `Patient_Kastoor/Lab_Report/`
  - [x] Verify decoded text is non-empty and contains test names/values
  - [x] Run `python -m pytest backend/tests/test_table_routing.py -v`
  - [x] Verified: Granite Vision produces non-empty tabular OCR and test suite passes
