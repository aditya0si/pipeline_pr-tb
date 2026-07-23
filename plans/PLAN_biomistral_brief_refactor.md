# PLAN — Refactor BioMistral AI Brief & Universal Pipeline Flow

---

## SECTION A — GOAL DEFINITION

### 1. What is being built or changed?
Refactor the BioMistral 7B prompt design, backend pipeline service flow, and Doctor Portal UI to guarantee:
1. **Zero Hallucinations & Zero Walls of Text**: BioMistral system prompt strictly enforces a 5-section JSON schema:
   - `patient_info`: `{ name: string, age: string, gender: string, reg_date: string }`
   - `document_type`: string (e.g. "Serology Report", "Prescription", "Liver Function Panel", "Consultation Note", "Radiology")
   - `flagged_findings`: list of `{ item: string, status: string, detail: string, is_critical: boolean }` (e.g. `HCV Screening: REACTIVE 🚨`, `Advise: Confirmation by ELISA`)
   - `actionable_recommendations`: list of strings (e.g. `Order HCV RNA Quantitative PCR / ELISA confirmation`)
   - `physician_quick_bullets`: 2-3 concise talking points for the 5-second doctor consultation
2. **Universal Document Handling**: Raw OCR text is ALWAYS passed directly to BioMistral regardless of document type (Serology, Prescription, LFT, Consultation note). Stage A (Pattern Analysis), Stage B (Rule Differentials), and Stage D (MELD Scores) are passed as optional supplemental context if numerical labs exist.
3. **Strict Sequential VRAM Eviction**:
   - Step 1: Patient uploads image & selects document class (`printed` / `table` / `handwritten`).
   - Step 2: Doctor clicks "Run Pipeline".
   - Step 3: Appropriate OCR engine loads (PaddleOCR / Granite Vision / Chandra) -> runs on image -> saves & displays Raw OCR text under `OCR Output (Raw)` -> unloads OCR model from GPU.
   - Step 4: BioMistral 7B loads into GPU -> receives Raw OCR + optional Stage A/B/D context -> executes structured JSON prompt -> unloads BioMistral from GPU.
4. **Doctor Efficiency Side-by-Side UI**:
   - Left Pane: Raw OCR Output with 3-way toggle (Tokens / Raw / Table) & search.
   - Right Pane: BioMistral Doctor Brief Cards (Patient Header, Doc Category Badge, Flagged Findings with 🚨, Actionable Next Steps, 5-Sec Consultation Bullets) + Conditional Stage A/B/D Cards (if numerical labs exist).

### 2. What does "done" look like?
- BioMistral prompt returns strict valid JSON without markdown prose paragraphs or fake CBC values.
- Serology report (e.g., Manoj Kumar Gupta, 58/M, HCV Screening Reactive) accurately extracts `HCV Screening: REACTIVE 🚨` and recommends ELISA confirmation without hallucinating complete blood count values.
- Non-hepatology reports (prescriptions, consultation notes, radiology) produce clean patient metadata, document type, key findings, and recommended next steps.
- Doctor Portal renders side-by-side view with Raw OCR on the left and BioMistral Doctor Efficiency Cards on the right.
- OCR model and BioMistral unload from VRAM in sequence without GPU memory leaks.

### 3. What is explicitly out of scope for this task?
- Changes to underlying OCR model weights.
- Database migration (existing `reports` table schema is preserved).

---

## SECTION B — TECH STACK

| Component | Choice | Reason |
|---|---|---|
| Backend Framework | FastAPI / Python (`pipeline_service.py`) | Pipeline orchestration |
| AI Model | BioMistral 7B via Ollama (`llm_client.py`) | Medical LLM brief generation |
| GPU Management | PyTorch CUDA cache flush + `gpu_manager.py` | VRAM eviction |
| Frontend | React 18 + TypeScript (`DoctorPortal.tsx`, `styles.css`) | Doctor Portal UI |

---

## SECTION C — SESSION MODULARIZATION

### Session 1: Universal BioMistral System Prompt & Fallback Parser
- **OBJECTIVE**: Redesign `STAGE_C_SYSTEM_PROMPT` in `model_reasoner.py` and `DIAGNOSIS_SYSTEM_PROMPT` in `diagnosis_agent.py` to enforce the 5-section JSON schema for ALL document types using raw OCR text.
- **SCOPE**: `backend/diagnosis/model_reasoner.py`, `backend/agents/diagnosis_agent.py`.
- **OUTPUT**: `run_universal_clinical_brief(raw_ocr_text, stage_a_b_d_context, llm_client)` returning validated 5-section JSON structure.
- **CONNECTS TO**: Session 2.
- **FAILURE SURFACE**: LLM fails to parse JSON -> fallback heuristic extractor parses patient metadata and regex flags directly from raw OCR text.

### Session 2: Pipeline Wiring & VRAM Eviction Lifecycle
- **OBJECTIVE**: Wire `pipeline_service.py` to ALWAYS invoke `run_universal_clinical_brief()` with raw OCR text for every document type. Ensure OCR model is evicted before BioMistral is loaded, and BioMistral is evicted after execution.
- **SCOPE**: `backend/services/pipeline_service.py`, `backend/gpu_manager.py`.
- **OUTPUT**: Seamless end-to-end pipeline execution for Serology, Prescriptions, LFTs, and General Notes.
- **CONNECTS TO**: Session 3.
- **FAILURE SURFACE**: VRAM leak if Ollama or Chandra eviction fails -> add explicit CUDA memory flush (`torch.cuda.empty_cache()`).

### Session 3: Doctor Portal UI Side-by-Side Redesign
- **OBJECTIVE**: Update `DoctorPortal.tsx` `PipelineAccordion` to display BioMistral's 5-section brief in high-visibility cards (Patient Header, Category Badge, 🚨 Flagged Items, Next Steps, 5-Second Consultation Bullets) directly adjacent to Raw OCR text.
- **SCOPE**: `frontend/src/pages/DoctorPortal.tsx`, `frontend/src/styles.css`.
- **OUTPUT**: Side-by-side UI layout enabling doctors to comprehend reports in under 5 seconds.
- **CONNECTS TO**: Session 4.
- **FAILURE SURFACE**: Overflow on small screens -> responsive grid layout collapsing to stacked view on mobile.

### Session 4: Test Suite & Serology Verification
- **OBJECTIVE**: Create unit test verifying the Serology HCV Reactive report (and non-lab documents) produce exact structured JSON with zero hallucinations.
- **SCOPE**: `backend/tests/test_diagnosis_stageC.py`, `scripts/smoke_test.py`.
- **OUTPUT**: 100% passing test suite across LFT, Serology, and Prescription samples.

---

## SECTION D — PROGRESS CHECKLIST

- [ ] Session 1: Universal BioMistral System Prompt & Fallback Parser
  - [ ] Update `STAGE_C_SYSTEM_PROMPT` in `model_reasoner.py` for 5-section JSON schema
  - [ ] Support `raw_ocr_text` input alongside optional Stage A/B/D context
  - [ ] Update fallback regex parser for non-prose key-value extraction when LLM is offline
  - [ ] Verify `DiagnosisAgent` delegates cleanly without producing raw prose dumps

- [ ] Session 2: Pipeline Wiring & VRAM Eviction Lifecycle
  - [ ] Wire `pipeline_service.py` to pass raw OCR text to BioMistral for ALL report types
  - [ ] Verify sequential GPU eviction (OCR run -> OCR evict -> BioMistral load -> BioMistral run -> BioMistral evict)
  - [ ] Store structured BioMistral brief in `reports.llm_analysis` as JSON

- [ ] Session 3: Doctor Portal UI Side-by-Side Redesign
  - [ ] Patient Metadata Banner (Name, Age, Gender, Date)
  - [ ] Document Category Tag (Serology, LFT, Prescription, Note)
  - [ ] 🚨 Flagged Findings Chips & Actionable Next Steps List
  - [ ] 5-Second Doctor Consultation Quick Bullets
  - [ ] Conditional Stage A/B/D Cards (Pattern, Differentials, MELD) if numerical labs exist

- [ ] Session 4: Test Suite & Serology Verification
  - [ ] Add unit test for Serology HCV Reactive report
  - [ ] Run full test suite (`pytest backend/tests/test_diagnosis_*.py`)
  - [ ] Execute smoke test demo script
