# PLAN_fix_ocr_theme_granite.md — Fix UI Dark Mode, Engine Labels, Granite Extraction & LLM Disambiguation

---

## SECTION A — GOAL DEFINITION

1. **What is being built or changed?**
   - **Dark Mode Contrast & Theme Fix**: Remove hardcoded inline light/dark color hexes (`#1e293b`, `#f8fafc`, `#f1f5f9`) from `DoctorPortal.tsx` and CSS styles. Ensure raw OCR text, AI summary text, panel backgrounds, and header metrics bars have high contrast and 100% legibility in both Dark Mode and Light Mode.
   - **Engine Label & Duration Display**: Fix engine label resolution so raw wrapper names (`GraniteVisionProviderWrapper`) are cleanly mapped to user-friendly titles (`Granite Vision 4.1-4b (GPU)`, `PaddleOCR (GPU)`, `Chandra OCR (INT4 NF4)`). Ensure total execution duration (in seconds) is displayed in the top header bar instead of `—`.
   - **Granite Vision Prompt & Clean Transcription**: Align `granite_provider.py` with `granite_vision.ipynb`. Update prompt to instruct Granite Vision to output plain transcribed text directly without conversational prefixes ("Here is the extracted information..."). Add post-processing to strip conversational intro boilerplate if generated.
   - **Raw OCR vs BioMistral Disambiguation**: Ensure Panel 1 strictly displays the clean raw OCR output from the selected OCR engine (Paddle/Chandra/Granite), and Panel 2 displays the actual BioMistral 7B LLM summary/analysis narrative (with clear fallback messaging when Ollama is offline).

2. **What does "done" look like?**
   - In Dark Mode, all text (raw OCR text `<pre>`, AI diagnosis summary `<p>`, and header metrics text) is bright, sharp, and easily readable.
   - The top header bar shows the friendly engine name (e.g. `PaddleOCR (GPU)` or `Granite Vision 4.1-4b (GPU)`) and the actual processing time (e.g. `14.2s`).
   - Panel 1 displays clean transcribed text without conversational chat prefixes.
   - Panel 2 displays BioMistral 7B's clinical summary/analysis.

3. **What is explicitly out of scope?**
   - Changing database schemas or altering quantization settings.

---

## SECTION B — TECH STACK

- **Frontend**: React 19, TypeScript, CSS Variables for Dark/Light mode theme contrast
- **Backend**: Python 3.12, FastAPI, SQLite
- **OCR & LLM**: `granite-vision-4.1-4b` (4-bit NF4), `PaddleOCR`, `Chandra OCR`, `BioMistral 7B` (Ollama GGUF)

---

## SECTION C — SESSION MODULARIZATION

### Session 1: Granite Vision Prompt Optimization & Notebook Alignment
- **OBJECTIVE**: Align `granite_provider.py` with `granite_vision.ipynb`, instruct model to omit conversational intros, and strip intro boilerplate from output.
- **SCOPE**: `backend/ocr/providers/granite_provider.py`.
- **OUTPUT**: Granite Vision returns clean transcribed text without "Here is the extracted information..." conversational prefixes.
- **CONNECTS TO**: Session 2 (backend engine naming & duration).
- **FAILURE SURFACE**: Regex stripping too aggressively — keep stripping targeted to common intro phrases.

### Session 2: Engine Label Standardization & Duration Persistence
- **OBJECTIVE**: Ensure `ocr_engine` is stored and returned as a user-friendly name (`Granite Vision 4.1-4b (GPU)`, `PaddleOCR (GPU)`, `Chandra OCR (INT4 NF4)`) across `reports_routes.py`, `pipeline_service.py`, `database.py`, and `api.ts`.
- **SCOPE**: `backend/services/pipeline_service.py`, `backend/routes/reports_routes.py`, `backend/database.py`, `frontend/src/api.ts`.
- **OUTPUT**: `r.ocr_engine` and `r.duration` / `processing_time_seconds` return friendly engine titles and accurate execution times.
- **CONNECTS TO**: Session 3 (Frontend Dark Mode & UI).
- **FAILURE SURFACE**: Missing duration field in API endpoints — add fallbacks for legacy report rows.

### Session 3: Dark Mode Contrast & UI Accordion Enhancements
- **OBJECTIVE**: Fix Dark Mode contrast in `DoctorPortal.tsx` by removing hardcoded light/dark inline colors. Style `<pre>`, `<p>`, and header banner with theme-aware CSS variables so text is 100% legible in both dark and light modes.
- **SCOPE**: `frontend/src/pages/DoctorPortal.tsx`, `frontend/src/index.css`.
- **OUTPUT**: Text in Panel 1, Panel 2, and header bar renders sharply regardless of light or dark theme selection.
- **CONNECTS TO**: Verification.
- **FAILURE SURFACE**: CSS variable missing in light mode — define fallback default colors.

---

## SECTION D — PROGRESS CHECKLIST

- [x] **Session 1: Granite Vision Prompt Optimization**
  - [x] Update `TEXT_PROMPT` in `granite_provider.py` to instruct model to omit conversational intros
  - [x] Add post-processing helper `_clean_granite_output(text)` to strip "Here is the extracted..." conversational prefixes
  - [x] Align generation parameters with `granite_vision.ipynb` (`max_new_tokens=700`, `repetition_penalty=1.2`, `no_repeat_ngram_size=4`)

- [x] **Session 2: Engine Label & Duration Persistence**
  - [x] Map provider wrapper names to friendly engine titles in `pipeline_service.py` & `reports_routes.py`
  - [x] Persist and return report duration in `reports_routes.py` and `api.ts`
  - [x] Fallback `duration` to `ocr.processing_time_seconds` when loading existing reports

- [x] **Session 3: Dark Mode Theme Fix & UI Accordion**
  - [x] Remove hardcoded inline colors (`#1e293b`, `#f8fafc`, `#f1f5f9`) from `DoctorPortal.tsx`
  - [x] Apply theme-aware CSS styling to `.ocr-text-output`, `.dx-summary`, and `.metrics-header-bar`
  - [x] Ensure Panel 1 (Raw OCR Text) and Panel 2 (BioMistral Analysis) render crisp, readable text in both Dark and Light themes
  - [x] Verify execution duration and friendly engine label in header bar
