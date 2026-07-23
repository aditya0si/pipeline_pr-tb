# PLAN — Fix Granite Vision GPU Loading (PyTorch CUDA for RTX 5060 Blackwell)

## SECTION A — GOAL DEFINITION

### 1. What is being built or changed?
Replacing the CPU-only PyTorch build in the project venv with a CUDA 12.8 (sm_120 Blackwell-compatible) build so that Granite Vision 4.1-4b loads and runs on the **NVIDIA GeForce RTX 5060 Laptop GPU (8GB, sm_12.0)** instead of falling back to slow CPU inference.

### 2. What does "done" look like?
- `torch.cuda.is_available()` returns `True` inside the project venv.
- `_preload_granite()` in `gpu_manager.py` completes at startup without error.
- `POST /api/pipeline/run` for a TABLE-type image completes in under 2 minutes on first cold start (model already warm), and under 30 seconds on subsequent runs.
- The `ocr.engine` field in the pipeline JSON response shows `GraniteVisionProviderWrapper`.

### 3. What is explicitly out of scope?
- Changing PaddleOCR's GPU setup (already working on CUDA 12.9 via its own runtime).
- Changing model weights or quantization strategy.

---

## SECTION B — ROOT CAUSE ANALYSIS

### Root Cause 1 — PyTorch CPU-only wheel installed (primary)
**Evidence**: `Torch version: 2.13.0+cpu`, `CUDA available: False`

`requirements.txt` line `torch` (with no `--index-url`) causes pip to install the default CPU wheel from PyPI. The CPU torch has no CUDA runtime. When Granite Vision calls `_get_model(device="cuda")`, `device_map="auto"` auto-selects CPU because `torch.cuda.is_available()` is `False`. Loading 4B parameters fully on CPU takes 5+ minutes — the request times out.

PaddleOCR is immune because it ships its own bundled CUDA 12.9 runtime, fully independent of PyTorch.

### Root Cause 2 — RTX 5060 is Blackwell (sm_12.0) — needs special PyTorch build
**Evidence**: `nvidia-smi compute_cap = 12.0`

sm_12.0 (Blackwell) requires PyTorch built against CUDA 12.8+. The standard `torch==2.x.x+cu121/cu124` wheels do NOT include sm_120 PTX. The correct build index is:
```
https://download.pytorch.org/whl/cu128
```
PyTorch 2.6.0+ nightly or the cu128 release wheels support sm_120.

### Root Cause 3 — Granite preloading skipped with SKIP_GPU_PRELOAD=1
**Evidence**: Backend was launched with `$env:MEDVAULT_SKIP_GPU_PRELOAD="1"` in previous sessions. Even after fixing PyTorch, the startup preloader will be dormant. Must launch backend WITHOUT the skip flag so `gpu_manager._preload_granite()` runs at startup and warms the GPU.

---

## SECTION B — TECH STACK

- **GPU**: NVIDIA GeForce RTX 5060 Laptop GPU, 8151 MiB VRAM, Compute Capability 12.0 (Blackwell)
- **OS**: Windows, Driver 592.82, CUDA 12.9 runtime available
- **Python**: 3.12 (required by PaddlePaddle GPU wheel)
- **PyTorch target**: `torch==2.6.0+cu128` from `https://download.pytorch.org/whl/cu128` (sm_120 support)
- **bitsandbytes**: `0.49.2` (already installed, needs verification with CUDA torch)
- **Model**: `ibm-granite/granite-vision-4.1-4b` 4-bit NF4, loaded via `transformers` + `bitsandbytes`

---

## SECTION C — SESSION MODULARIZATION

### Session 1: Install CUDA-enabled PyTorch (cu128 for sm_120 Blackwell)
- **OBJECTIVE**: Replace `torch 2.13.0+cpu` with a CUDA 12.8 build that supports RTX 5060 (sm_12.0).
- **SCOPE**: pip install in project venv only. Does NOT touch PaddlePaddle (separate CUDA runtime).
- **OUTPUT**: `torch.cuda.is_available()` returns `True`.
- **COMMAND**:
  ```powershell
  .\.venv\Scripts\pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128 --force-reinstall
  ```
- **CONNECTS TO**: Session 2 (preload will now succeed).
- **FAILURE SURFACE**: `[ASSUMPTION]` cu128 index may not have the latest nightly for sm_120. If sm_120 ops are not in the released wheel, we fall back to cu121 + PTX JIT compilation (slower first run but functional).

### Session 2: Fix requirements.txt to pin the correct CUDA torch index
- **OBJECTIVE**: Ensure future `pip install -r requirements.txt` doesn't regress to the CPU wheel.
- **SCOPE**: `backend/requirements.txt`
- **OUTPUT**: `requirements.txt` comments out bare `torch` and adds instructions for the CUDA wheel with the correct index URL.
- **CONNECTS TO**: Session 3.
- **FAILURE SURFACE**: None — this is documentation/pinning.

### Session 3: Verify gpu_manager Granite preload at startup
- **OBJECTIVE**: Confirm `_preload_granite()` in `gpu_manager.py` runs successfully at backend startup with CUDA torch.
- **SCOPE**: `backend/gpu_manager.py` — add more descriptive startup logs. Launch backend WITHOUT `MEDVAULT_SKIP_GPU_PRELOAD`.
- **OUTPUT**: Backend startup log shows `[GPU preload] Granite Vision 4.1-4b loaded on cuda (4-bit NF4)`.
- **CONNECTS TO**: Session 4.
- **FAILURE SURFACE**: OOM (8GB VRAM is borderline for PaddleOCR + Granite 4-bit simultaneously). If OOM occurs: load Granite first, then Paddle — or reduce Paddle's GPU memory allocation.

### Session 4: Verify end-to-end TABLE pipeline uses GPU
- **OBJECTIVE**: Run `POST /api/pipeline/run` with the tabular IMG_3903.jpeg and verify `ocr.engine` = `GraniteVisionProviderWrapper`.
- **SCOPE**: Backend pipeline endpoint. No frontend changes needed.
- **OUTPUT**: Pipeline returns OCR text from Granite Vision, completes in <2 minutes.
- **FAILURE SURFACE**: If bitsandbytes doesn't recognize sm_120, it may fall to float16 full precision (uses more VRAM). May need `bitsandbytes` upgrade.

---

## SECTION D — PROGRESS CHECKLIST

- [x] Session 1: Install CUDA-enabled PyTorch cu128 for sm_120
  - [x] Run pip install with `--index-url https://download.pytorch.org/whl/cu128 --force-reinstall`
  - [x] Verify `torch.cuda.is_available()` returns `True`
  - [x] Verify `torch.cuda.get_device_name(0)` returns RTX 5060
- [x] Session 2: Fix requirements.txt torch pin
  - [x] Comment out bare `torch` / `torchvision` lines
  - [x] Add note with correct cu128 install command
- [x] Session 3: Verify Granite preloads at startup
  - [x] Launch backend WITHOUT `MEDVAULT_SKIP_GPU_PRELOAD`
  - [x] Confirm startup log: `[GPU preload] Granite Vision 4.1-4b loaded on cuda (4-bit NF4)`
  - [x] Confirm `GET /api/gpu/status` returns `granite_loaded: true`
- [x] Session 4: End-to-end TABLE pipeline verification
  - [x] Run pipeline on a TABLE image
  - [x] Confirm `ocr.engine == "GraniteVisionProviderWrapper"`
  - [x] Confirm pipeline completes without timeout
