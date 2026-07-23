# PLAN_prepare_and_push_repo.md

## SECTION A — GOAL DEFINITION

### 1. What is being built or changed?
Prepare and sanitize the MedVault Medical OCR pipeline repository to ensure all code, docstrings, plan files, and git history reflect clean ownership by Aditya Singh, removing all traces/references to external collaborators (Ashutosh / Shreyash). Then push the clean codebase to the GitHub repository `https://github.com/aditya0si/pipeline_pr-tb`.

### 2. What does "done" look like — what is the observable outcome?
- Zero occurrences of "Ashutosh", "Shreyash", or third-party collaborator handles in project markdown, plan files, comments, or configs.
- Git config set to `user.name = "Aditya Singh"` and `user.email = "oliaditya05@gmail.com"`.
- Clean commit history created under Aditya Singh.
- Remote `origin` updated to `https://github.com/aditya0si/pipeline_pr-tb.git`.
- Code successfully pushed to `main` branch at `https://github.com/aditya0si/pipeline_pr-tb.git`.

### 3. What is explicitly out of scope for this task?
- Changing existing medical OCR pipeline functionality, endpoints, or UI features.
- Modifying open-source library licenses or model citations (e.g., IBM Granite Vision, PaddleOCR).

---

## SECTION B — TECH STACK

- **Version Control**: Git (`git config`, `git commit`, `git push`)
- **Remote Platform**: GitHub (`https://github.com/aditya0si/pipeline_pr-tb.git`)
- **Languages / Tools**: Python, TypeScript, Markdown

Existing Stack Touched:
- `pipeline_v1/.git/`
- `pipeline_v1/PLAN/*.md`
- `pipeline_v1/ALIGNMENT.md`
- `pipeline_v1/SETUP.md`
- `pipeline_v1/goal.md`
- `pipeline_v1/pipeline_ibm.md`
- `pipeline_v1/memories/repo/medvault-memory.md`

---

## SECTION C — SESSION MODULARIZATION

### Session 1: Code & Document Sanitization
- **OBJECTIVE**: Remove all occurrences and traces of external collaborator names ("Ashutosh", "Shreyash", previous git urls) from text files and plans.
- **SCOPE**:
  - `pipeline_v1/PLAN/*.md`
  - `pipeline_v1/ALIGNMENT.md`
  - `pipeline_v1/SETUP.md`
  - `pipeline_v1/goal.md`
  - `pipeline_v1/pipeline_ibm.md`
  - `pipeline_v1/memories/repo/medvault-memory.md`
- **OUTPUT**: Text files completely free of collaborator references.
- **CONNECTS TO**: Session 2 (clean repository content is ready for git history configuration).
- **FAILURE SURFACE**: Unchecked files containing residual metadata; verified by automated regex script.

### Session 2: Git History & Remote Sanitization
- **OBJECTIVE**: Configure git user identity to Aditya Singh, set clean commit history, and configure target remote.
- **SCOPE**:
  - `git config user.name "Aditya Singh"`
  - `git config user.email "oliaditya05@gmail.com"`
  - `git remote set-url origin https://github.com/aditya0si/pipeline_pr-tb.git`
  - Remove secondary `dest` remote if present.
- **OUTPUT**: Clean git repository metadata pointing strictly to `aditya0si/pipeline_pr-tb.git`.
- **CONNECTS TO**: Session 3 (ready to commit and push).
- **FAILURE SURFACE**: Git authentication failure or existing remote mismatch; verified via `git remote -v`.

### Session 3: Commit & Push to GitHub Target Repository
- **OBJECTIVE**: Stage clean files, commit under Aditya Singh, and push to target GitHub repository.
- **SCOPE**:
  - `git add .`
  - `git commit -m "feat: Medical OCR Pipeline (Printed & Tabular Engine with IBM Granite Vision)"`
  - `git push -u origin main` (or `--force` if initializing new clean history).
- **OUTPUT**: Code successfully pushed to `https://github.com/aditya0si/pipeline_pr-tb.git`.
- **CONNECTS TO**: Session 4 (ready for final verification).
- **FAILURE SURFACE**: Network timeout or permission error on remote repo; handled via explicit push verification.

### Session 4: Final Verification
- **OBJECTIVE**: Confirm remote repository contains clean files and zero collaborator traces.
- **SCOPE**:
  - Remote check and git status verification.
- **OUTPUT**: Clean repository ready for executive presentation at IBM.
- **CONNECTS TO**: Completion & Handoff.
- **FAILURE SURFACE**: Residual untracked files; verified via `git status`.

---

## SECTION D — PROGRESS CHECKLIST

- [x] Session 1: Code & Document Sanitization
  - [x] Sanitize `PLAN/*.md` files
  - [x] Sanitize `ALIGNMENT.md`, `SETUP.md`, `goal.md`, `pipeline_ibm.md`
  - [x] Sanitize `memories/repo/medvault-memory.md`
  - [x] Verified: Automated regex check returns 0 matches for collaborator names

- [x] Session 2: Git History & Remote Sanitization
  - [x] Set `user.name` to "Aditya Singh" and `user.email` to "oliaditya05@gmail.com"
  - [x] Remove `dest` remote
  - [x] Set `origin` to `https://github.com/aditya0si/pipeline_pr-tb.git`
  - [x] Verified: `git remote -v` points to target repository

- [x] Session 3: Commit & Push to GitHub Target Repository
  - [x] Stage clean files (`git add .`)
  - [x] Create clean commit under Aditya Singh
  - [x] Push to `https://github.com/aditya0si/pipeline_pr-tb`
  - [x] Verified: `git push` completes with exit code 0

- [x] Session 4: Final Verification
  - [x] Verify `git status` clean working tree
  - [x] Confirm repository is ready for presentation
