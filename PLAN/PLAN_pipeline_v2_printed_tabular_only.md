# Plan: Pipeline v2 — Printed + Tabular Only (Granite Vision for Tables)

## TL;DR
Strip the MedVault pipeline down to two document types — **PRINTED_TEXT** (→ PaddleOCR, untouched) and **TABLE** (→ new Granite Vision 4.1-4b provider built from `granite_vision.ipynb`). Remove all handwritten/Qwen features and all classifier features (the ML auto-classifier is already disabled — routing is by explicit user `doc_type` hint). Do NOT touch any PaddleOCR files. The UI keeps only "Printed" and "Tabular" upload buttons; the "Classify" pipeline stage and classification panel are removed since the user now explicitly picks the type.

---

## Files to REMOVE (delete entirely)

### Backend — Qwen / handwritten / classifier
- `backend/qwen_vl_provider.py` — Qwen2.5-VL handwritten provider (root-level duplicate)
- `backend/qwen_vl_server.py` — Qwen-VL handwritten microservice server
- `backend/qwen_llama_server.py` — llama.cpp Qwen handwritten server
- `backend/ocr/providers/qwen_provider.py` — Qwen2.5-VL provider (the real one used by agents)
- `backend/ocr/ocr2_handwritten.py` — handwritten OCR dispatcher (Qwen→Surya fallback)
- `backend/agents/handwritten_ocr_agent.py` — Agent 3b handwritten OCR agent
- `backend/ocr/providers/surya_provider.py` — Surya fallback (only used by handwritten + table fallback; table will use Granite, so Surya is no longer referenced)
- `backend/ocr_handwritten.json` — handwritten OCR benchmark output
- `backend/benchmark_pipeline.py` — benchmarks handwritten→Qwen path
- `backend/benchmark_results.json` — stale benchmark output referencing handwritten
- `backend/check_providers.py` — checks Qwen provider availability

### Classifier-only files (scripts + tests + notebooks + eval)
- `scripts/train_classifier.py`
- `scripts/eval_classifier.py`
- `scripts/tune_weights.py`
- `scripts/diagnose_features.py`
- `notebooks/02_classifier_training.ipynb`
- `tests/test_classifier.py`
- `tests/test_classifier_module.py`
- `eval_reports/baseline_classifier.json`
- `eval_reports/pipeline_classification_ocr_report.json`

### Frontend — dead code
- `frontend/src/components/GpuStatusPanel.tsx` — never imported/rendered; references Qwen row

### Sample images (handwritten)
- `tests/sample_images/handwritten_1.png` … `tests/sample_images/handwritten_5.png`

> NOTE: `backend/agents/classification_agent.py` and `document_classifier.py` are referenced in tests/scripts but **do not exist** in the workspace (already removed). Tests importing them will be deleted, so the dangling references disappear.

---

## Files to MODIFY

### Phase A — New Granite Vision OCR provider (backend)

**New file: `backend/ocr/providers/granite_provider.py`**
- Mirror the structure of `backend/ocr/providers/paddle_provider.py` and `qwen_provider.py`.
- Implement `GraniteVisionProvider` class with:
  - Lazy singleton model load (4-bit NF4 via `BitsAndBytesConfig`, `device_map="auto"`) using `ibm-granite/granite-vision-4.1-4b`.
  - `AutoProcessor.from_pretrained(model_id, trust_remote_code=True)` + `AutoModelForImageTextToText.from_pretrained(...)`.
  - `extract_text(filepath, filetype) -> str` — load image (PIL, EXIF transpose, autocontrast, resize max 1600px), build chat template with medical-lab extraction prompt, `model.generate(max_new_tokens=700, do_sample=False, repetition_penalty=1.2, no_repeat_ngram_size=4)`, decode.
  - `extract_structured(filepath, filetype) -> list[dict]` — reuse `extract_text` then run `heuristics.extract_structured_results` to parse name/value/unit/range.
  - Optional `pytesseract` pre-OCR assist (wrap in try/except; skip if unavailable).
- Add `pytesseract` to dependencies (already in backend/requirements.txt for Qwen — repurpose for Granite).

**Modify: `backend/agents/table_ocr_agent.py`**
- Swap primary engine from PaddleOCR PP-Structure to Granite Vision, keeping PaddleOCR basic as fallback.
- Update `_PP_STRUCTURE_ENGINE` constant to `"Granite-Vision-4.1-4b"`.
- Lazy-instantiate `GraniteVisionProvider` in the `provider` property.

**Modify: `backend/ocr/providers/__init__.py`**
- Remove `qwen_provider` and `surya_provider` from the docstring list; add `granite_provider`.

**Modify: `backend/ocr/router.py`**
- Remove `from .ocr2_handwritten import extract_handwritten` and the `"HANDWRITTEN"` dispatch entry. Keep `TABLE` and `PRINTED_TEXT`.

**Modify: `backend/ocr/ocr1_table.py`**
- Remove the Surya fallback import (`from .providers.surya_provider import _extract_table`).

**Modify: `backend/ocr/submodule_paths.py`**
- Remove `ocr_handwritten_trocr` and `ocr_handwritten_surya` path entries.

### Phase B — OCR service & routing (backend)

**Modify: `backend/services/ocr_service.py`**
- Delete `QwenVLProviderWrapper`, `_qwen_wrapper_cache`, `_qwen_wrapper_lock`, `_get_qwen_wrapper`, `_build_qwen`.
- Add `GraniteVisionProviderWrapper(OCRProvider)` mirroring `PaddleOCRProviderWrapper` (lazy `from backend.ocr.providers.granite_provider import GraniteVisionProvider`), with `extract_text` + `extract_structured`.
- Add `_granite_wrapper_cache`/`_get_granite_wrapper` singleton factory.
- In `AutoOCRProvider`:
  - Remove `HANDWRITTEN` from `_VALID_HINTS`; remove `qwen_*` constructor params; add `granite_*` params.
  - `_normalise_hint`: drop `handwritten`→`HANDWRITTEN` mapping.
  - `_route` / `extract_text` / `extract_structured`: route `TABLE` → Granite wrapper, `PRINTED_TEXT` → Paddle wrapper. Replace Paddle↔Qwen cross-fallback with Granite↔Paddle fallback for TABLE only.
  - Remove `class_weights` param.
- `OCR_ENGINES` registry: remove `qwen_*` keys; add `granite_*`.

**Modify: `backend/services/pipeline_service.py`**
- Update docstrings (remove "Qwen2.5-VL for HANDWRITTEN"). No logic change needed.

**Modify: `backend/agents/ocr_router_agent.py`**
- Remove `_make_handwritten_agent` and the `"HANDWRITTEN"`/`"handwritten"` entries from `AGENT_FACTORIES`. Keep `TABLE`→`TableOCRAgent` and `PRINTED_TEXT`/`"printed"`→`PrintedOCRAgent`.

**Modify: `backend/agents/ocr_result.py`**
- Update docstring referencing HANDWRITTEN route.

**Modify: `backend/gpu_manager.py`**
- Remove `_qwen_loaded`/`_qwen_error`/`_preload_qwen` and `qwen_*` fields from `GPUStatus`. Add `_granite_loaded`/`_granite_error`/`_preload_granite` and `granite_loaded`/`granite_error` fields. Update `preload_models` to preload Granite instead of Qwen.

**Modify: `backend/routes/pipeline_routes.py`**
- Update docstring (remove "Qwen-VL" from GPU preload description).

**Modify: `backend/routes/reports_routes.py`**
- Lines 70 & 273: change `doc_type` validation set from `{"printed", "tabular", "handwritten"}` to `{"printed", "tabular"}`. Update error message.
- Remove "handwritten→Qwen-VL" comment reference.

**Modify: `backend/routes/admin_routes.py`**
- Remove the `"pipeline"` provider entry's `class_weights` field and "PaddleOCR + Qwen2.5-VL" label; relabel to "PaddleOCR + Granite Vision".

**Modify: `backend/print_ocr_server.py`**
- Remove the Qwen/handwritten reference in the docstring.

**Modify: `backend/config.py`**
- Remove any `QWEN_*` env settings; add `GRANITE_MODEL_ID` default.

**Modify: `backend/pipeline.py`** (root-level)
- Remove `HANDWRITTEN` from `DocumentClass` enum; remove `_get_qwen_engine`/`_qwen_engine`; route `TABLE` → Granite, `PRINTED_TEXT` → Paddle. (Verify if still used before editing.)

### Phase C — Frontend UI

**Modify: `frontend/src/api.ts`**
- `GpuStatus` interface: remove `qwen_loaded`, `qwen_error`, `qwen_using_microservice`; add `granite_loaded`, `granite_error`.
- `PipelineResult`: **remove the `classification` field entirely** (classifier is gone; user picks type explicitly). Keep `ocr`, `lab_report`, `diagnosis`, `summary`, `evaluation`, `metadata`.

**Modify: `frontend/src/pages/DoctorPortal.tsx`**
- `PIPELINE_STAGES`: remove `"Classify"` → `["Preprocess", "OCR", "Extract + Diagnose"]`.
- Remove `classClass` helper (or keep only TABLE/PRINTED_TEXT mappings).
- **Remove Panel 1 "Classification Result"** entirely. Renumber remaining panels (OCR Text → 1, Lab Results → 2, Diagnosis → 3).
- Update empty-state text to remove "classification".
- Remove `const cls = result.classification;` and its usage in `PipelineAccordion`.

**Modify: `frontend/src/pages/OCRWorkbench.tsx`**
- Remove `qwen_vl` engine entry and the `pipeline` entry's "Handwritten→Qwen-VL"/"Document classifier" capabilities. Add a `granite` engine entry: `{ id: "granite", name: "Granite Vision 4.1", accuracy: 0, languages: ["Multimodal"], capabilities: ["Tabular", "Vision-Language", "GPU"] }`. Update `pipeline` entry to `"Printed→PaddleOCR", "Tabular→Granite Vision"`.
- Remove the "Handwritten" upload button. Keep "Printed" and "Tabular" (update Tabular subtitle to "Tables / lab panels (Granite Vision)").
- `renderEngines` routing diagram: replace "Handwritten → Qwen2.5-VL" branch with "Tabular → Granite Vision" branch.

**Modify: `frontend/src/pages/PatientPortal.tsx`**
- Remove the "Handwritten" upload button. Keep "Printed" and "Tabular".

**Modify: `frontend/src/pages/Settings.tsx`**
- Change hint from "PaddleOCR + Qwen2.5-VL" to "PaddleOCR + Granite Vision".

**Modify: `frontend/src/styles.css`**
- Remove `.cls-handwritten` rule. Keep `.cls-table`, `.cls-printed`, `.cls-unknown`, `.class-chip`, `.fallback-note`.

**Modify: `frontend/tests/pipeline.spec.ts`**
- Remove assertion that classification panel is populated (panel no longer exists).
- Remove `classification` property assertion from API contract test.

### Phase D — Tests, benchmarks, docs, deps

**Modify/delete tests:**
- `tests/test_backend_units.py` — remove `classification_agent` import block and `document_classifier` import. Remove handwritten OCR assertions.
- `tests/test_ocr_agents.py` — remove `HandwrittenOCRAgent` tests.
- `tests/test_ocr_router.py` / `test_ocr_routing.py` — remove HANDWRITTEN routing cases; add TABLE→Granite cases.
- `tests/test_pipeline_e2e.py` / `tests/test_pipeline_e2e_ibm_spec.py` — remove `ClassificationAgent` import and classification stage; remove handwritten cases.
- `tests/test_classifier.py`, `tests/test_classifier_module.py` — **delete**.
- `tests/test_preprocessing.py` — keep (preprocessing is type-agnostic).
- `tests/test_pipeline_routes.py` / `tests/test_pipeline_run_service.py` — remove classification/handwritten assertions; update expected `doc_type` set.
- `tests/test_routes_integration.py` — update `doc_type` validation to `printed`/`tabular` only.

**Modify `backend/benchmark_pipeline.py`** (or delete): remove `stage_ocr_handwritten` and Qwen references.

**Modify `backend/check_providers.py`**: remove Qwen check; add Granite model availability check.

**Modify requirements:**
- `backend/requirements.txt`: remove `qwen-vl-utils`; keep `torch`, `torchvision`, `transformers>=4.51`, `accelerate`, `bitsandbytes>=0.46.1` (now for Granite). Add `pytesseract`. Update the Qwen comment block to describe Granite Vision 4.1-4b.
- `requirements.txt` (root): same cleanup.

**Modify docs:**
- `Dockerfile` — remove Qwen model download / qwen server startup steps.
- `README.md`, `SETUP.md`, `setup_env.ps1`, `start.ps1`, `start.sh` — remove Qwen/handwritten references; document Granite Vision as the tabular engine.
- `ports.md` — remove Qwen port 8002; Granite runs in-process.
- `pipeline_ibm.md`, `reference.md`, `goal.md`, `ALIGNMENT.md`, `IMPLEMENTATION_STATUS.md`, `CODEBASE_REFERENCE.md` — update references.
- `AGENTS/AGENTS.md`, `backend/agents/pipeline_v1_AGENTS.md` — remove handwritten agent and classification agent.

---

## Steps (grouped into phases)

### Phase A — Granite provider + backend OCR plumbing
1. Create `backend/ocr/providers/granite_provider.py` (`GraniteVisionProvider`) from notebook pattern.
2. Add `GraniteVisionProviderWrapper` + `_get_granite_wrapper` in `backend/services/ocr_service.py`.
3. Modify `backend/agents/table_ocr_agent.py` to use Granite as primary engine.
4. Modify `backend/ocr/router.py`, `ocr1_table.py`, `submodule_paths.py`, `providers/__init__.py`.
5. Modify `backend/gpu_manager.py` (Granite preload + status fields).
6. Modify `backend/services/ocr_service.py` `AutoOCRProvider` (remove Qwen/handwritten, route TABLE→Granite).
7. Modify `backend/routes/reports_routes.py` (`doc_type` validation → printed/tabular).

### Phase B — Remove Qwen/handwritten/classifier files
8. Delete all files in the REMOVE list.
9. Modify `backend/agents/ocr_router_agent.py` (remove handwritten factory).
10. Modify `backend/pipeline.py` (root) — remove HANDWRITTEN enum + Qwen engine.
11. Modify `backend/routes/admin_routes.py`, `pipeline_routes.py`, `print_ocr_server.py`, `config.py`.

### Phase C — Frontend
12. `frontend/src/api.ts` — remove qwen_* fields, remove `classification` from `PipelineResult`.
13. `DoctorPortal.tsx` — remove Classify stage + Panel 1.
14. `OCRWorkbench.tsx` — remove Handwritten button + Qwen engine, add Granite engine + Tabular→Granite routing diagram.
15. `PatientPortal.tsx` — remove Handwritten button.
16. `Settings.tsx` + `styles.css` — update hint text, remove `.cls-handwritten`.
17. `frontend/tests/pipeline.spec.ts` — remove classification assertions.

### Phase D — Tests, benchmarks, docs, deps
18. Update/delete tests.
19. Delete/rewrite `backend/benchmark_pipeline.py`, `check_providers.py`.
20. Update requirements, Dockerfile, README.md, SETUP.md, setup scripts, ports.md, markdown docs, AGENTS docs.

---

## Relevant files (key references)

- `granite_vision.ipynb` cells `#VSC-9717cf3e` (model load) & `#VSC-313a547c` (extract_text fn) — **the integration template** for `granite_provider.py`.
- `backend/ocr/providers/paddle_provider.py` — structural template for the new provider (do NOT modify).
- `backend/ocr/providers/qwen_provider.py` — being removed; reference for the VLM provider pattern being replaced.
- `backend/services/ocr_service.py` — `AutoOCRProvider`, `OCR_ENGINES`, wrappers (central routing).
- `backend/agents/table_ocr_agent.py` — swap primary engine to Granite.
- `backend/agents/ocr_router_agent.py` — `AGENT_FACTORIES` routing table.
- `backend/gpu_manager.py` — `GPUStatus`, `preload_models`.
- `backend/routes/reports_routes.py` lines 70, 273 — `doc_type` validation.
- `frontend/src/api.ts` lines 53-61, 96-101 — `GpuStatus`, `PipelineResult`.
- `frontend/src/pages/DoctorPortal.tsx` lines 12, 23-28, 336-345 — stages, classClass, Panel 1.
- `frontend/src/pages/OCRWorkbench.tsx` lines 80-81, 246-249, 330-355 — engines, upload buttons, routing diagram.

---

## Verification

1. **Backend import smoke test**: `python -c "import backend.main"` loads without referencing deleted modules.
2. **Granite provider unit test**: new `tests/test_granite_provider.py` — mock `AutoModelForImageTextToText`/`AutoProcessor`, assert `extract_text` returns decoded string and `extract_structured` returns list of dicts.
3. **Routing test**: `tests/test_ocr_routing.py` — assert `doc_type='tabular'` → Granite wrapper, `doc_type='printed'` → Paddle wrapper; assert `doc_type='handwritten'` raises 422 at `reports_routes`.
4. **Run pytest**: `pytest tests/ -q` — all remaining tests green.
5. **Frontend typecheck**: `cd frontend && npm run build` — no errors from removed `classification` field.
6. **Frontend E2E**: `cd frontend && npx playwright test` — T1-T3 pass; T4/T5 updated assertions pass.
7. **Manual**: start backend + frontend; upload a printed report → PaddleOCR; upload a tabular report → Granite Vision; confirm no "Handwritten" button anywhere; confirm DoctorPortal shows 3 stages with no Classification panel.
8. **GPU status**: `GET /api/gpu/status` returns `granite_loaded`/`granite_error` (no `qwen_*` fields).

---

## Decisions

- **Classifier removed entirely**: the ML auto-classifier is already disabled (`_classify` raises if hint is `auto`); routing is by explicit user `doc_type`. Removing the "Classify" UI stage and classification panel is consistent. User explicitly picks Printed or Tabular at upload.
- **Granite Vision 4.1-4b (4-bit NF4)** is the tabular engine, loaded in-process on GPU (mirrors notebook). No separate microservice port needed (unlike Qwen's :8002).
- **PaddleOCR files are untouched** per requirement. Paddle remains the PRINTED_TEXT engine.
- **Surya provider removed**: it was only a fallback for handwritten + table; table now uses Granite (with Paddle basic as fallback inside `table_ocr_agent`).
- **`pytesseract`** is added as a dependency (Granite notebook uses it for OCR-assist); `PrintedOCRAgent` already has optional Tesseract support.
- **Scope excluded**: PDF page rendering, extraction heuristics, diagnosis/extraction/summary/evaluation agents, auth, database schema (the `classification` column in `reports`/`models.py` can stay nullable and unused).

---

## Further Considerations

1. **Granite GPU memory vs Paddle**: Granite 4.1-4b in 4-bit (~2.5GB) + PaddleOCR on the same 8GB RTX 5060. Recommendation: load Granite lazily (only on first tabular request) rather than eager preload, OR keep eager preload but monitor OOM. Recommend lazy load.
2. **Root `pipeline.py` vs `backend/pipeline.py`**: two `pipeline.py` files exist with overlapping `AutoOCRProvider`/`DocumentClass`. Confirm which is the live entrypoint (likely `backend/services/pipeline_service.py` is the real one). The root `pipeline.py` may be dead/legacy — verify before investing in edits.
3. **`backend/ocr_printed.json`**: confirm whether `benchmark_pipeline.py` is still run in CI before deleting; if benchmarks are valued, rewrite to benchmark Printed→Paddle and Tabular→Granite instead of deleting.