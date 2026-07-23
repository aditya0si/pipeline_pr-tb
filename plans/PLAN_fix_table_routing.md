# PLAN_fix_table_routing.md

## SECTION A — GOAL DEFINITION

### 1. What is being built or changed?
Ensure image documents classified as `table`/`tabular` are reliably routed to IBM Granite Vision 4.1-4b for OCR across all backend endpoints and pipeline execution paths. Specifically:
- Explicitly pass stored report `doc_type` hints into `AutoOCRProvider` during report analysis, structured OCR extractions, and pipeline runs.
- Prevent silent fallback from Granite Vision to `PaddleOCR` when OCRing `TABLE` documents, raising explicit runtime errors when Granite Vision is unavailable or fails.
- Fix `ocr_engine` reporting so API responses reflect the actual provider instance (`type(ocr.last_provider).__name__`).

### 2. What does "done" look like — what is the observable outcome?
- `analyze_report` and `ocr_structured_report` endpoints pass `doc_type_hint=row["doc_type"] or "printed"` to `AutoOCRProvider`.
- `run_pipeline` defaults unpopulated `doc_type` hints to `"auto"` (forcing loud errors if missing/unspecified) instead of defaulting to `"printed"`.
- `AutoOCRProvider._route()` raises `RuntimeError` when `doc_type == "TABLE"` and Granite Vision is unavailable.
- `AutoOCRProvider.extract_text()` does not silently switch to `PaddleOCR` when Granite Vision returns empty or errors on a `TABLE` document.
- API responses report `ocr_engine` accurately as `GraniteVisionProviderWrapper` when Granite runs.
- All unit tests in `backend/tests/test_table_routing.py` and the full backend test suite pass.

### 3. What is explicitly out of scope for this task?
- Re-enabling ML auto-classification inside `AutoOCRProvider._classify()` (remains explicitly disabled).
- Modifying database schemas or frontend upload forms.
- Modifying legacy/unused routing scripts (`ocr_router_agent.py`, `ocr/router.py`).

---

## SECTION B — TECH STACK

- **Language / Framework**: Python 3.10+, FastAPI
- **Database**: SQLite (`medapp.db`)
- **OCR Providers**: `AutoOCRProvider`, `GraniteVisionProviderWrapper`, `PaddleOCRProviderWrapper`
- **Testing**: `pytest`, `unittest.mock`

Existing Stack Touched:
- `pipeline_v1/backend/routes/reports_routes.py`
- `pipeline_v1/backend/services/pipeline_service.py`
- `pipeline_v1/backend/services/ocr_service.py`
- `pipeline_v1/backend/tests/test_table_routing.py`

---

## SECTION C — SESSION MODULARIZATION

### Session 1: Ensure explicit doc_type hint passing in routes & pipeline service
- **OBJECTIVE**: Guarantee `doc_type` hint is passed to `AutoOCRProvider` in all execution paths and eliminate silent fallback to `"printed"`.
- **SCOPE**:
  - `pipeline_v1/backend/routes/reports_routes.py` (`analyze_report`, `ocr_structured_report`)
  - `pipeline_v1/backend/services/pipeline_service.py` (`run_pipeline`)
- **OUTPUT**:
  - `AutoOCRProvider` initialized with `row["doc_type"]` in report routes.
  - `run_pipeline` uses `"auto"` as default `hint_doc_type` if missing, failing loudly instead of misrouting tables to Paddle.
- **CONNECTS TO**: Session 2 (depends on explicit hint reaching the router to enforce Granite routing).
- **FAILURE SURFACE**: Unpopulated or `None` `doc_type` fields in older DB records triggering `ValueError` if hint is `"auto"`. Handled by defaulting `row["doc_type"] or "printed"` in routes where legacy records may exist.

### Session 2: Prevent silent Granite-to-Paddle fallback for TABLE docs & fix engine reporting
- **OBJECTIVE**: Enforce strict error handling for `TABLE` documents when Granite Vision is unavailable or fails, and accurately report actual provider name.
- **SCOPE**:
  - `pipeline_v1/backend/services/ocr_service.py` (`_route`, `extract_text`)
  - `pipeline_v1/backend/routes/reports_routes.py` (`ocr_engine` calculation)
- **OUTPUT**:
  - `TABLE` routing raises `RuntimeError` if Granite Vision is `None`.
  - `extract_text` self-check logs error and raises/returns without trying PaddleOCR on `TABLE` docs.
  - `ocr_engine` correctly set to `type(ocr.last_provider).__name__`.
- **CONNECTS TO**: Session 3 (tests will verify strict error raising and provider reporting).
- **FAILURE SURFACE**: Handled exceptions swallow `RuntimeError` if callers catch generic `Exception`. Ensured error message is informative.

### Session 3: Unit testing and pipeline verification
- **OBJECTIVE**: Add unit test coverage for table routing, failure modes, hint propagation, and run full test suite.
- **SCOPE**:
  - `pipeline_v1/backend/tests/test_table_routing.py`
  - Full test suite execution (`pytest`)
- **OUTPUT**:
  - Tests covering tabular hint routing, missing hint `ValueError`, Granite unavailable `RuntimeError`, and `run_pipeline` hint behavior.
  - Passing pytest test suite.
- **CONNECTS TO**: Completion & Handoff.
- **FAILURE SURFACE**: Existing tests failing due to strict `RuntimeError` on table Granite failure; update mocks appropriately.

---

## SECTION D — PROGRESS CHECKLIST

- [x] Session 1: Pass explicit doc_type hints in endpoints and pipeline
  - [x] Verify `analyze_report` passes `doc_type_hint=row["doc_type"] or "printed"`
  - [x] Verify `ocr_structured_report` passes `doc_type_hint=row["doc_type"] or "printed"`
  - [x] Update `run_pipeline` hint default to `"auto"`
  - [x] Verified: `AutoOCRProvider` initialized with exact stored `doc_type`

- [x] Session 2: Stop silent Granite to Paddle fallback for TABLE docs
  - [x] Update `AutoOCRProvider._route()` to raise `RuntimeError` when Granite is unavailable for `TABLE`
  - [x] Update `AutoOCRProvider.extract_text()` self-check to avoid Paddle swap on `TABLE` failures
  - [x] Update `ocr_engine` reporting across endpoints to use `type(ocr.last_provider).__name__`
  - [x] Verified: TABLE docs fail loudly if Granite is unavailable and report exact provider name when active

- [x] Session 3: Test suite & verification
  - [x] Add unit tests in `backend/tests/test_table_routing.py`
  - [x] Run pytest on `test_table_routing.py`
  - [x] Run full pytest suite across `backend/tests/`
  - [x] Verified: All test cases pass cleanly with zero regressions
