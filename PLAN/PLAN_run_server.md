# PLAN — Run Server

## SECTION A — GOAL DEFINITION

1. **What is being built or changed?**
   No source code or database schema changes will be performed. The goal is to start the existing MedVault backend (FastAPI/Uvicorn on port 3000) and frontend (React/Vite on port 3001) servers, verify their status, and provide the user with accessible links.

2. **What does "done" look like?**
   - Backend FastAPI server running on `http://localhost:3000` (docs at `http://localhost:3000/docs`).
   - Frontend React/Vite server running on `http://localhost:3001`.
   - Access URLs provided to the user.

3. **What is explicitly out of scope for this task?**
   Code modifications, feature development, or database migrations (unless startup errors require immediate fixes).

---

## SECTION B — TECH STACK

- **Backend**: FastAPI / Uvicorn running under Python virtual environment (`.venv`).
- **Frontend**: React + Vite (Node.js / npm).
- **Execution Environment**: Windows PowerShell (`start.ps1` or explicit background tasks for backend & frontend).

---

## SECTION C — SESSION MODULARIZATION

### Session 1: Server Initialization & Link Provision
- **OBJECTIVE**: Launch backend and frontend servers on ports 3000 and 3001 respectively, verify availability, and output access links.
- **SCOPE**: `pipeline_v1/start.ps1`, backend uvicorn process, frontend vite process.
- **OUTPUT**: Active backend (port 3000) and frontend (port 3001) processes.
- **CONNECTS TO**: End user interaction with the running web application.
- **FAILURE SURFACE**: Port conflicts on 3000/3001, missing dependencies in `.venv` or `node_modules`, environment `.env` file missing.

---

## SECTION D — PROGRESS CHECKLIST

- [x] Session 1: Server Initialization & Link Provision
  - [x] Execute server startup script (`start.ps1` or background processes)
  - [x] Confirm Backend is responding on `http://localhost:3000`
  - [x] Confirm Frontend is responding on `http://localhost:3001`
  - [x] Provide active links to the user
