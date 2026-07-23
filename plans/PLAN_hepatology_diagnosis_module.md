# PLAN: Hepatology Diagnosis Module — Stages A → D (Revised)

## SECTION A — GOAL DEFINITION

### 1. What is being built or changed?
A comprehensive, 4-stage hepatology diagnosis pipeline module (`backend/diagnosis/`) that processes structured laboratory test extraction outputs (`LabReport` / `LabResult` list) through four deterministic and probabilistic stages:
- **Stage A (Pattern Analysis & Scoring)**: `pattern_analyser.py` & `scoring.py` calculate fold-over-ULN, De Ritis ratio (AST/ALT), R-Factor ((ALT/56)/(ALP/147)), synthetic dysfunction flags, urgent lab alerts, and clinical risk scores (MELD, Child-Pugh, FIB-4).
- **Stage B (Rule-Based Differentials)**: `rule_engine.py` applies deterministic diagnostic rules matching pattern findings and biochemical markers against 10 target hepatology conditions with calculated probability weights (HIGH/MODERATE/LOW), supporting/against evidence, recommended tests, and references. Handle all-normal labs without inventing diseases.
- **Stage C (AI Clinical Brief - Structured)**: `model_reasoner.py` loads BioMistral (with VRAM eviction hooks `evict_chandra()` & `evict_ollama()`) to generate a **structured JSON clinical brief** (`flags_to_discuss`, `tests_to_order`, `patterns_identified`, `urgent_actions`, `disclaimer`), rather than prose paragraphs. Fallback reformats rule engine outputs into the same structured shape.
- **Stage D (Report Generation & Pipeline Wiring)**: `report_generator.py` & `engine.py` assemble the unified report and bullet-point text summary. The pipeline service (`pipeline_service.py`) is updated around line 217 to optionally invoke `run_diagnosis(lab_json)` when `DIAGNOSIS_MODULE_ENABLED=1`.

### 2. What does "done" look like?
- All 7 Python modules in `backend/diagnosis/` (`__init__.py`, `hepatology_kb.py`, `pattern_analyser.py`, `scoring.py`, `rule_engine.py`, `model_reasoner.py`, `report_generator.py`, `engine.py`) are fully implemented and passing unit tests.
- Comprehensive test suite in `backend/tests/` (`test_diagnosis_stageA.py`, `test_diagnosis_stageB.py`, `test_diagnosis_stageC.py`, `test_diagnosis_e2e.py`) passes 100% on CPU/CI.
- Stage C output is confirmed to be structured JSON (scannable brief, no walls of text).
- `scripts/smoke_test.py` runs end-to-end against printed, tabular, and handwritten sample files without VRAM leaks or crashes.
- Flag-off behavior (`DIAGNOSIS_MODULE_ENABLED=0`) preserves exact legacy behavior.

### 3. What is explicitly out of scope?
- Replacing or modifying the existing `DiagnosisAgent` (Agent 6) in `backend/agents/diagnosis_agent.py` (kept intact as legacy/parallel path).
- Direct modification of OCR engine logic or OCR models (Granite/Chandra/Paddle).
- Database schema migrations or changes to frontend UI APIs (the module attaches under `"diagnosis"` key in the result payload).

---

## SECTION B — TECH STACK

- **Language**: Python 3.12
- **Frameworks & Libraries**:
  - `pydantic` v2 (for schema validation matching `schemas.py`)
  - `pytest` (test execution)
  - `loguru` (logging)
  - `httpx` (Ollama LLM client integration for Stage C)
- **Integration Points**:
  - `backend/hepatology_kb.py` (reused reference range lookup & normalization)
  - `backend/gpu_manager.py` (`evict_chandra`, `evict_ollama` VRAM lifecycle hooks)
  - `backend/services/pipeline_service.py` (pipeline wiring point)
  - `backend/schemas.py` (`LabReport`, `LabResult`)

---

## SECTION C — SESSION MODULARIZATION

### Session 1: Knowledge Base Re-export & Stage A Pattern Analyser & Clinical Scores
- **OBJECTIVE**: Implement `backend/diagnosis/__init__.py`, `backend/diagnosis/hepatology_kb.py`, `backend/diagnosis/pattern_analyser.py`, and `backend/diagnosis/scoring.py` with full CPU unit tests.
- **SCOPE**:
  - `backend/diagnosis/__init__.py`
  - `backend/diagnosis/hepatology_kb.py`
  - `backend/diagnosis/pattern_analyser.py`
  - `backend/diagnosis/scoring.py`
  - `backend/tests/test_diagnosis_stageA.py`
- **OUTPUT**:
  - `hepatology_kb.py` re-exporting base functions & defining `HEPATOLOGY_REFERENCE_RANGES` & `HEPATOLOGY_KB`.
  - `pattern_analyser.py` calculating fold_over_uln, De Ritis, R-Factor, synthetic dysfunction, and urgent flags.
  - `scoring.py` implementing MELD, Child-Pugh, and FIB-4 formulas returning `{value, interpretation, note_if_inputs_defaulted}`.
  - `test_diagnosis_stageA.py` passing 6 unit test scenarios.
- **CONNECTS TO**: Session 2 (Rule engine requires pattern analyser output and KB definitions).
- **FAILURE SURFACE**: Division-by-zero in AST/ALT or R-factor when values missing; missing reference ranges; logarithmic domain errors in MELD.

### Session 2: Stage B Rule Engine
- **OBJECTIVE**: Implement `backend/diagnosis/rule_engine.py` and its test suite `backend/tests/test_diagnosis_stageB.py`.
- **SCOPE**:
  - `backend/diagnosis/rule_engine.py`
  - `backend/tests/test_diagnosis_stageB.py`
- **OUTPUT**:
  - `rule_engine.py` evaluating 8 core hepatology rules, calculating probability weights (HIGH/MODERATE/LOW), supporting/against evidence, recommended tests, and references. Handle all-normal labs with "No abnormal hepatic pattern detected" (probability 0.0, LOW).
  - `test_diagnosis_stageB.py` passing 5 unit test scenarios.
- **CONNECTS TO**: Session 3 (AI clinical brief consumes findings + differentials).
- **FAILURE SURFACE**: Incorrect threshold matching; false positive disease matches on normal labs; missing reference attributes.

### Session 3: Stage C AI Clinical Brief Reasoner (Structured Output)
- **OBJECTIVE**: Implement `backend/diagnosis/model_reasoner.py` and `backend/tests/test_diagnosis_stageC.py`.
- **SCOPE**:
  - `backend/diagnosis/model_reasoner.py`
  - `backend/tests/test_diagnosis_stageC.py`
- **OUTPUT**:
  - `model_reasoner.py` triggering VRAM eviction (`evict_chandra()`, `evict_ollama()`), invoking BioMistral with a prompt requiring structured JSON output (`flags_to_discuss`, `tests_to_order`, `patterns_identified`, `urgent_actions`, `disclaimer`).
  - Fallback logic when model fails or `DIAGNOSIS_STAGE_C_ENABLED=0` returning rule-based differentials in the same structured JSON shape with disclaimer.
  - Mocked test suite `test_diagnosis_stageC.py` passing 4 test scenarios without GPU requirement.
- **CONNECTS TO**: Session 4 (Engine orchestration & pipeline wiring).
- **FAILURE SURFACE**: Ollama timeout or connection refusal; invalid JSON output from LLM; VRAM eviction failure; missing safety disclaimer.

### Session 4: Stage D Report Generator, Engine Orchestrator & Pipeline Wiring
- **OBJECTIVE**: Implement `backend/diagnosis/report_generator.py`, `backend/diagnosis/engine.py`, update `backend/services/pipeline_service.py`, and implement `backend/tests/test_diagnosis_e2e.py`.
- **SCOPE**:
  - `backend/diagnosis/report_generator.py`
  - `backend/diagnosis/engine.py`
  - `backend/services/pipeline_service.py`
  - `backend/tests/test_diagnosis_e2e.py`
- **OUTPUT**:
  - Full A→B→C→D execution pipeline in `run_diagnosis(lab_json)`.
  - Structured report generation containing `clinical_brief` and `recommendations`.
  - `generate_text_summary(report)` returning concise bullet-point summary with mandatory disclaimer.
  - Opt-in pipeline wiring in `pipeline_service.py` under `DIAGNOSIS_MODULE_ENABLED` (default `"0"`).
  - Passing end-to-end test suite (`test_diagnosis_e2e.py`).
- **CONNECTS TO**: Session 5 (Smoke testing & verification).
- **FAILURE SURFACE**: Environment variable parsing errors; schema mismatch when attaching diagnosis output to report dict; missing disclaimers.

### Session 5: Smoke Test & Documentation
- **OBJECTIVE**: Implement `scripts/smoke_test.py` and update documentation.
- **SCOPE**:
  - `scripts/smoke_test.py`
  - `README.md`
- **OUTPUT**:
  - `scripts/smoke_test.py` verifying full pipeline execution across printed, tabular, and handwritten test files with VRAM tracking.
  - Updated `README.md` detailing architecture, environment variables (`DIAGNOSIS_MODULE_ENABLED`, `DIAGNOSIS_STAGE_C_ENABLED`), and clinical disclaimers.
- **CONNECTS TO**: Completion & handoff.
- **FAILURE SURFACE**: Path resolution errors in test scripts; OOM under sequential execution without eviction.

---

## SECTION D — PROGRESS CHECKLIST

- [x] Session 1: Knowledge Base & Stage A Pattern Analyser & Clinical Scores
  - [x] Implement `backend/diagnosis/__init__.py` and `backend/diagnosis/hepatology_kb.py`
  - [x] Implement `backend/diagnosis/pattern_analyser.py`
  - [x] Implement `backend/diagnosis/scoring.py` with note_if_inputs_defaulted
  - [x] Create and pass `backend/tests/test_diagnosis_stageA.py` (6 tests)
- [x] Session 2: Stage B Rule Engine
  - [x] Implement `backend/diagnosis/rule_engine.py` with 8 rules, evidence lists, and all-normal handling
  - [x] Create and pass `backend/tests/test_diagnosis_stageB.py` (5 tests)
- [x] Session 3: Stage C AI Clinical Brief Reasoner (Structured Output)
  - [x] Implement `backend/diagnosis/model_reasoner.py` with VRAM eviction and structured JSON output
  - [x] Implement fallback returning structured JSON brief when AI is disabled/fails
  - [x] Create and pass `backend/tests/test_diagnosis_stageC.py` (4 tests with mocks)
- [x] Session 4: Stage D Report Generator, Engine & Pipeline Wiring
  - [x] Implement `backend/diagnosis/report_generator.py` with structured report and bullet-point text summary
  - [x] Implement `backend/diagnosis/engine.py` (`run_diagnosis`)
  - [x] Wire `run_diagnosis` into `backend/services/pipeline_service.py` under `DIAGNOSIS_MODULE_ENABLED`
  - [x] Create and pass `backend/tests/test_diagnosis_e2e.py` (6 tests)
- [x] Session 5: Smoke Test & Documentation
  - [x] Implement `scripts/smoke_test.py`
  - [x] Update `README.md` with architecture, configuration, and limitations
  - [x] Verify full test suite execution (`pytest -ra`)
