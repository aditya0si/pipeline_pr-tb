# PLAN_align_granite_exact_notebook.md — Align Granite Vision Provider 100% with granite_vision.ipynb

---

## SECTION A — GOAL DEFINITION

1. **What is being built or changed?**
   - Refactor `backend/ocr/providers/granite_provider.py` to follow `granite_vision.ipynb` (cell 5 and cell 12) line-for-line with zero extra modifications or custom regex stripping.
   - Match exact image preprocessing: `PIL.ImageOps.exif_transpose()`, `convert("RGB")`, `autocontrast(cutoff=1)`, resize longest edge > 1600px to 1600px.
   - Match exact model loading: `AutoProcessor` and `AutoModelForImageTextToText` with `BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_compute_dtype=torch.float16)`.
   - Match exact prompt construction from `granite_vision.ipynb`.
   - Match exact `model.generate()` parameters: `max_new_tokens=700`, `min_new_tokens=80`, `do_sample=False`, `repetition_penalty=1.2`, `no_repeat_ngram_size=4`, `use_cache=True`.
   - Match exact decoding: `processor.decode(out[0, inputs["input_ids"].shape[1]:], skip_special_tokens=True)`.

2. **What does "done" look like?**
   - Granite Vision provider runs identical logic to `granite_vision.ipynb`.
   - `extract_text` returns complete non-empty OCR text for tabular documents.
   - All tests in pytest pass cleanly.

3. **What is explicitly out of scope?**
   - Modifying PaddleOCR or Chandra OCR providers.

---

## SECTION B — TECH STACK

- **Language**: Python 3.12
- **Frameworks**: PyTorch, HuggingFace Transformers, BitsAndBytes (4-bit NF4), PIL / ImageOps, PyTesseract

---

## SECTION C — SESSION MODULARIZATION

### Session 1: 1-to-1 Notebook Alignment in `granite_provider.py`
- **OBJECTIVE**: Replace inference & text extraction in `granite_provider.py` with the exact logic from `granite_vision.ipynb` (cell 5 & 12).
- **SCOPE**: `backend/ocr/providers/granite_provider.py`.
- **OUTPUT**: `granite_provider.py` mirrors `granite_vision.ipynb` 1-to-1.
- **CONNECTS TO**: Session 2 (Verification).
- **FAILURE SURFACE**: PyTesseract missing on system — handled gracefully with fallback prompt when `pytesseract` is absent.

### Session 2: Runtime & Test Verification
- **OBJECTIVE**: Verify Granite Vision text extraction on test image and run pytest test suite.
- **SCOPE**: `tests/test_pipeline_run_service.py`, `tests/test_chandra_provider.py`, `tests/test_llm_client.py`.
- **OUTPUT**: 100% passing tests.

---

## SECTION D — PROGRESS CHECKLIST

- [x] **Session 1: 1-to-1 Notebook Alignment**
  - [x] Update `_preprocess_image` to match notebook (`exif_transpose`, `convert("RGB")`, `autocontrast(cutoff=1)`, max 1600px resize)
  - [x] Update `_load_model` to match cell 5 (`load_in_4bit=True`, `nf4`, `float16`)
  - [x] Update `extract_text` to match cell 12 (`max_new_tokens=700`, `min_new_tokens=80`, `repetition_penalty=1.2`, `no_repeat_ngram_size=4`, `use_cache=True`)
  - [x] Use exact `processor.decode(out[0, inputs["input_ids"].shape[1]:], skip_special_tokens=True)`

- [x] **Session 2: Runtime & Test Verification**
  - [x] Test `extract_text` on sample tabular image
  - [x] Run full pytest test suite
