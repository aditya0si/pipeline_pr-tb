# PLAN — Fix Table Images Not Routing to Granite OCR

## SECTION A — GOAL DEFINITION

### 1. What is being built or changed?
Images classified as table/tabular should be OCR'd by IBM Granite Vision 4.1-4b, but currently fail or silently misroute to PaddleOCR due to missing hints at `AutoOCRProvider` construction sites and silent fallback logic in `ocr_service.py`. This plan passes `row["doc_type"]` to `AutoOCRProvider` across all endpoint construction sites, removes the silent Granite $\rightarrow$ Paddle fallback for `TABLE` documents, reports accurate `ocr_engine` names, and adds test coverage in `test_table_routing.py`.

### 2. What does "done" look like?
- `analyze_report` and `ocr_structured_report` endpoints in `reports_routes.py` pass `doc_type_hint=row["doc_type"]` when creating `AutoOCRProvider`.
- `run_pipeline` in `pipeline_service.py` fetches the report's `doc_type` and defaults to `"auto"` if unprovided (failing loudly instead of silently defaulting to `"printed"`).
- `AutoOCRProvider._route()` and `extract_text()` in `ocr_service.py` raise a explicit `RuntimeError` when `doc_type == "TABLE"` and Granite is unavailable or fails, eliminating silent fallback to PaddleOCR for tables.
- `analyze_report` returns `ocr_engine = type(ocr.last_provider).__name__` (e.g. `GraniteVisionProviderWrapper`).
- `backend/tests/test_table_routing.py` passes with full coverage of all routing scenarios and loud failure behaviors.

### 3. What is explicitly out of scope?
- Re-enabling ML auto-classification.
- Modifying upload form accepted doc_types (`printed` and `tabular` remain unchanged).
- Touching legacy/unused files like `ocr_router_agent.py` or `ocr/router.py`.

---

## SECTION B — TECH STACK

- **Framework**: FastAPI (ASGI), Uvicorn
- **OCR Backends**: IBM Granite Vision 4.1-4b (`transformers` 4-bit NF4), PaddleOCR (`paddlepaddle`)
- **Database**: SQLite (`database.get_db()`)
- **Testing**: `pytest`

---

## SECTION C — SESSION MODULARIZATION

### Session 1: Pass `doc_type` hint into all `AutoOCRProvider` construction sites
- **Objective**: Ensure the user-provided `doc_type` from the DB reaches `AutoOCRProvider` in `analyze_report`, `ocr_structured_report`, and `run_pipeline`.
- **Scope**:
  - `backend/routes/reports_routes.py` (`analyze_report` line ~159, `ocr_structured_report` line ~218)
  - `backend/services/pipeline_service.py` (`run_pipeline` line ~246)
- **Output**: All endpoints pass `doc_type_hint=row["doc_type"]` when creating `AutoOCRProvider`. `run_pipeline` uses `"auto"` as the missing hint fallback.
- **Connects to**: Session 2 (Routing policy relies on accurate hints arriving at `AutoOCRProvider`).
- **Failure Surface**: Missing `doc_type` column on older report rows (handled via `row["doc_type"] or "printed"` fallback).

### Session 2: Remove silent Granite $\rightarrow$ Paddle fallback for `TABLE` documents
- **Objective**: Make Granite Vision failures/unavailability for `TABLE` documents fail loudly instead of silently returning PaddleOCR text.
- **Scope**: `backend/services/ocr_service.py` (`_route` line ~197-207, `extract_text` self-check line ~246-266).
- **Output**: If `doc_type == "TABLE"` and Granite is `None` or fails, `AutoOCRProvider` raises `RuntimeError("Granite Vision unavailable for TABLE document...")`. `PRINTED_TEXT` fallback to Granite remains intact.
- **Connects to**: Session 4 (Unit tests verify loud failure).
- **Failure Surface**: Unhandled exceptions breaking the API response if not caught as `HTTPException(400)` or standard service errors.

### Session 3: Surface accurate `ocr_engine` in responses
- **Objective**: Ensure `analyze_report` returns the specific provider name (`GraniteVisionProviderWrapper` / `PaddleOCRProviderWrapper`) instead of generic `AutoOCRProvider`.
- **Scope**: `backend/routes/reports_routes.py` (`analyze_report` line ~180).
- **Output**: `ocr_engine` field reflects `type(ocr.last_provider).__name__`.
- **Connects to**: Session 4 (Verification).
- **Failure Surface**: `last_provider` being `None` on early failure (handled via `getattr(ocr, "last_provider", None)` check).

### Session 4: Unit testing & manual verification
- **Objective**: Verify all changes via automated tests and manual execution.
- **Scope**: `backend/tests/test_table_routing.py`.
- **Output**: Test suite covering:
  1. `tabular` hint routes to `GraniteVisionProviderWrapper`.
  2. No hint / `"auto"` hint raises `ValueError`.
  3. `TABLE` document with Granite unavailable raises `RuntimeError`.
  4. `run_pipeline` with `tabular` report uses Granite.
- **Connects to**: Final verification.
- **Failure Surface**: Regressions in existing tests or API contracts.

---

## SECTION D — PROGRESS CHECKLIST

- [ ] Session 1: Pass `doc_type` hint into all `AutoOCRProvider` construction sites
  - [ ] Update `analyze_report` in `reports_routes.py` to pass `doc_type_hint=row["doc_type"] or "printed"`
  - [ ] Update `ocr_structured_report` in `reports_routes.py` to pass `doc_type_hint=row["doc_type"] or "printed"`
  - [ ] Update `run_pipeline` in `pipeline_service.py` to use `"auto"` default if `doc_type` is unprovided
- [ ] Session 2: Remove silent Granite $\rightarrow$ Paddle fallback for `TABLE` documents
  - [ ] Update `_route()` in `ocr_service.py` to raise `RuntimeError` when Granite is unavailable for `TABLE`
  - [ ] Update `extract_text()` self-check in `ocr_service.py` to raise/return error when Granite fails for `TABLE`
- [ ] Session 3: Surface accurate `ocr_engine` in responses
  - [ ] Update `analyze_report` in `reports_routes.py` to report `type(ocr.last_provider).__name__`
- [ ] Session 4: Unit testing & manual verification
  - [ ] Extend `backend/tests/test_table_routing.py` with new test cases
  - [ ] Run `pytest backend/tests/` and confirm all tests pass
