# PLAN_create_demo_md.md — Create Detailed MedVault Pipeline Reference Documentation

---

## SECTION A — GOAL DEFINITION

1. **What is being built or changed?**
   - Create a comprehensive technical documentation file `demo.md` in the root of `pipeline_v1/` explaining the complete architecture, routing rules, VRAM lifecycle management, function names, file paths, and frontend/backend interactions of the MedVault OCR & AI pipeline.

2. **What does "done" look like?**
   - A complete, highly structured `demo.md` file exists in `pipeline_v1/` containing code file paths, exact function names, routing matrices, VRAM eviction mechanics, and UI component mappings.

3. **What is explicitly out of scope?**
   - Making any functional changes to Python code or React UI components.

---

## SECTION B — TECH STACK

- **Documentation**: Markdown (GitHub Flavored Markdown with Mermaid diagram, file links, and code blocks)
- **Backend Stack Documented**: FastAPI, PyTorch, Transformers, BitsAndBytes (INT4 / NF4), PaddleOCR, Chandra OCR, IBM Granite Vision 4.1-4b, Ollama / BioMistral 7B, SQLite
- **Frontend Stack Documented**: React 19, TypeScript, Vite

---

## SECTION C — SESSION MODULARIZATION

### Session 1: Draft Complete `demo.md`
- **OBJECTIVE**: Write `pipeline_v1/demo.md` detailing every pipeline stage, file path, function name, routing rule, VRAM lifecycle, and UI component.
- **SCOPE**: `pipeline_v1/demo.md`.
- **OUTPUT**: Complete `demo.md` file.
- **CONNECTS TO**: End of task.
- **FAILURE SURFACE**: Missing file path or function signature — double-check exact backend file paths and exported symbols.

---

## SECTION D — PROGRESS CHECKLIST

- [x] **Session 1: Draft Complete `demo.md`**
  - [x] Write Pipeline Overview & Architectural Diagram (Mermaid)
  - [x] Document Document Type Routing Matrix & File Paths
  - [x] Document OCR Engines (`paddle_provider.py`, `granite_provider.py`, `chandra_provider.py`)
  - [x] Document VRAM Lifecycle & Eviction Management (`gpu_manager.py`)
  - [x] Document Pipeline Orchestration & Agent Flow (`pipeline_service.py`, `ocr_service.py`, `extraction_agent.py`, `diagnosis_agent.py`)
  - [x] Document Database Schema (`database.py`) & API Endpoints (`reports_routes.py`, `pipeline_routes.py`)
  - [x] Document Frontend UI Accordion & Metrics (`DoctorPortal.tsx`, `styles.css`)
