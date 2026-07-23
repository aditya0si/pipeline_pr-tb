# PLAN — Change Ports & Relaunch

## SECTION A — GOAL DEFINITION

1. **What is being built or changed?**
   Updating port configuration across backend and frontend configuration/startup files to move Backend from port 3000 to port 3002, and Frontend from port 3001 to port 3003, then relaunching both servers.

2. **What does "done" look like?**
   - Port configurations updated in `start.ps1`, `start.sh`, `ports.md`, and `frontend/vite.config.ts`.
   - Backend FastAPI server running and responding on `http://localhost:3002`.
   - Frontend React/Vite server running and responding on `http://localhost:3003`.

3. **What is explicitly out of scope for this task?**
   Application feature changes, database schema modifications, or non-port related bug fixes.

---

## SECTION B — TECH STACK

- **Backend**: FastAPI / Uvicorn running on Python 3 (`.venv`).
- **Frontend**: React + Vite (Node.js / npm).
- **Execution Environment**: Windows PowerShell background process execution.

---

## SECTION C — SESSION MODULARIZATION

### Session 1: Port Configuration Updates
- **OBJECTIVE**: Update all configuration and startup scripts with backend port 3002 and frontend port 3003.
- **SCOPE**:
  - `pipeline_v1/start.ps1`
  - `pipeline_v1/start.sh`
  - `pipeline_v1/ports.md`
  - `pipeline_v1/frontend/vite.config.ts`
- **OUTPUT**: Updated source/script files with new port assignments.
- **CONNECTS TO**: Session 2 server startup.
- **FAILURE SURFACE**: Typo in port numbers or syntax error in `vite.config.ts` or `start.ps1`.

### Session 2: Server Relaunch & Verification
- **OBJECTIVE**: Launch the FastAPI backend and Vite frontend on ports 3002 and 3003 respectively, verify connectivity, and output links.
- **SCOPE**: Running background processes for backend and frontend.
- **OUTPUT**: Active backend (port 3002) and frontend (port 3003) web services.
- **CONNECTS TO**: User interactive testing via browser.
- **FAILURE SURFACE**: Port 3002/3003 already occupied by another process, or startup failure due to environment issues.

---

## SECTION D — PROGRESS CHECKLIST

- [x] Session 1: Port Configuration Updates
  - [x] Update backend port to 3002 and frontend port to 3003 in `pipeline_v1/start.ps1`
  - [x] Update backend port to 3002 and frontend port to 3003 in `pipeline_v1/start.sh`
  - [x] Update port documentation in `pipeline_v1/ports.md`
  - [x] Update default backend origin (3002) and frontend server port (3003) in `pipeline_v1/frontend/vite.config.ts`
- [x] Session 2: Server Relaunch & Verification
  - [x] Launch Backend process on port 3002
  - [x] Launch Frontend process on port 3003
  - [x] Verify Backend response at `http://localhost:3002`
  - [x] Verify Frontend response at `http://localhost:3003`
