# MedVault — Setup Guide

> Complete setup instructions for the modular Hepatology OCR pipeline.
> **Python 3.12 is strictly required.** See the constraint note below.

---

## ⚠️ Python 3.12 Constraint (Critical)

This project **requires Python 3.12 exactly**. No other version will work.

The reason is the PaddlePaddle GPU wheel that supports the RTX 5060 (Blackwell
sm_120) architecture is only published for CPython 3.12 on Windows:

```
paddlepaddle_gpu-3.3.1-cp312-cp312-win_amd64.whl
```

Using Python 3.11, 3.13, or 3.14 will result in wheel incompatibility errors and
the OCR stage will fail to load PaddlePaddle on the GPU. The automated setup
script (`setup_env.ps1`) enforces this constraint for you.

---

## System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| **Python** | **3.12** | **3.12.x** |
| [uv](https://docs.astral.sh/uv/) | latest | latest |
| Node.js | 20 | 22 |
| RAM | 8 GB | 16 GB |
| GPU | — | NVIDIA with 8 GB VRAM (CUDA 12.x) |
| OS | Windows 10+ | Windows 11 |

> **Note:** `uv` is a fast Python package manager used by our setup script.
> Install it from https://docs.astral.sh/uv/ before proceeding.

---

## 1. Clone the Repository

```bash
git clone https://github.com/aditya0si/pipeline_ocr.git
cd pipeline_ocr
```

---

## 2. Python Environment (Automated — Recommended)

The `setup_env.ps1` script automates the entire Python environment setup using
`uv`. It creates a Python 3.12 virtual environment and installs the exact
PaddlePaddle CUDA 12.9 wheel before any other dependencies.

```powershell
.\setup_env.ps1
```

**What the script does:**
1. Verifies `uv` is installed and available.
2. Creates a fresh `.venv` using **Python 3.12** (`uv venv --python 3.12`).
3. Installs the PaddlePaddle GPU 3.3.1 wheel (CUDA 12.9) from the Baidu CDN.
4. Installs all remaining project dependencies from `backend/requirements.txt`.

**After the script completes, activate the environment:**

```powershell
.\.venv\Scripts\Activate.ps1
```

**Verify PaddlePaddle GPU is working:**

```powershell
python -c "import paddle; print(paddle.__version__); print(paddle.device.is_compiled_with_cuda())"
```

You should see `3.3.1` and `True`.

---

## 2b. Python Environment (Manual — Advanced)

If you prefer to set up the environment manually, follow these steps:

```powershell
# Install Python 3.12 via uv (if not already available)
uv python install 3.12

# Create the virtual environment
uv venv --python 3.12 .venv

# Activate it
.\.venv\Scripts\Activate.ps1

# Install the PaddlePaddle GPU wheel FIRST (CUDA 12.9, RTX 5060 / Blackwell)
pip install https://paddle-whl.bj.bcebos.com/stable/cu129/paddlepaddle-gpu/paddlepaddle_gpu-3.3.1-cp312-cp312-win_amd64.whl

# Install the remaining project dependencies
pip install -r backend/requirements.txt
```

> **Order matters:** The PaddlePaddle wheel must be installed *before*
> `requirements.txt` so that its pinned `numpy<2.0` constraint is respected.

### Granite Vision GPU Acceleration (Optional)

For **Granite Vision 4.1-4b tabular OCR** with 4-bit NF4 quantization on GPU:

```powershell
pip install bitsandbytes>=0.46.1
```

This enables `BitsAndBytesConfig(load_in_4bit=True)` in the Granite Vision provider.

---

## 3. Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

---

## 4. Boot the Pipeline

There are two ways to run the pipeline: the **unified CLI** (for batch/scripted
processing) and the **FastAPI server** (for the web UI and REST API).

### Option A: Unified CLI (`pipeline.py`)

The root-level `pipeline.py` script runs the full pipeline DAG on a single image
or a directory of images, without starting the server.

```powershell
# Single image
python pipeline.py --input path/to/image.png --output result.json

# Batch mode (process an entire directory)
python pipeline.py --input-dir ./images --output-dir ./results

# Include the doctor-facing summary and evaluation stages
python pipeline.py --input img.png --output out.json --with-summary --with-evaluation
```

**CLI arguments:**

| Argument | Description |
|---|---|
| `--input PATH` | Path to a single input image |
| `--input-dir DIR` | Directory of images for batch processing |
| `--output FILE` | Output JSON file (single-image mode) |
| `--output-dir DIR` | Output directory (batch mode) |
| `--with-summary` | Include the doctor-facing summary stage |
| `--with-evaluation` | Include the evaluation stage (uses sample ground truth) |
| `--compact` | Disable pretty-printing of JSON output |

### Option B: FastAPI Server

**Terminal 1 — Backend:**

```powershell
.\.venv\Scripts\uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 — Frontend (for the web UI):**

```powershell
cd frontend
npm run dev
```

### Option C: Use the start script (Windows)

```powershell
.\start.ps1
```

---

## 5. Verify It Works

1. Open **http://localhost:5173** in your browser (frontend dev server).
2. You should see the MedVault landing page with **Patient Portal** and **Doctor Portal** cards.
3. Click **Patient Portal** — you should be auto-logged in and see the upload area.
4. Upload a medical document image — it will be classified and OCR'd.

To verify the CLI independently:

```powershell
python pipeline.py --input tests\sample_images\sample.png --output test_result.json
type test_result.json
```

---

## Environment Variables

Copy `.env.example` to `.env` and adjust as needed:

```powershell
Copy-Item .env.example .env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | `dev-secret-change-me` | JWT signing key. **Change in production!** |
| `ALGORITHM` | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_HOURS` | `72` | Access token lifetime in hours |
| `DB_PATH` | `medapp.db` | SQLite database file path |
| `UPLOAD_DIR` | `uploads` | Directory for uploaded images |
| `MEDVAULT_STATIC_DIR` | `frontend/dist` | Path to built frontend (for Docker) |
| `MEDVAULT_PRELOAD_GPU` | `1` | Set to `0` to disable GPU model preloading |
| `PADDLE_LANG` | `en` | PaddleOCR inference language |
| `PADDLE_USE_GPU` | `1` | Set to `0` to force PaddleOCR CPU mode |
| `LLM_API_KEY` | — | API key for the LLM extraction formatter |
| `GEMINI_API_KEY` | — | Google Gemini API key (legacy agent path) |

---

## GPU Preloading

On startup, the backend preloads models onto the GPU (if available):

- **PaddleOCR** — GPU-enabled PaddlePaddle (CUDA 12.9)
- **Granite Vision 4.1-4b** — 4-bit NF4 quantized vision-language model (tabular OCR)

This happens in a background thread and takes ~10–30 seconds. You can monitor
status at:
```
GET http://localhost:8000/api/gpu/status
```

To disable GPU preloading (CPU-only mode):
```powershell
$env:MEDVAULT_PRELOAD_GPU = "0"
```

---

## Troubleshooting

### "ModuleNotFoundError: No module named 'paddle'"
PaddlePaddle is not installed, or you are not using Python 3.12. Run:

```powershell
.\setup_env.ps1
```

### "Wheel is not compatible with this Python version"
You are not using Python 3.12. The PaddlePaddle GPU wheel is only built for
`cp312`. Recreate the environment with:

```powershell
uv python install 3.12
.\setup_env.ps1
```

### "Using bitsandbytes 4-bit quantization requires bitsandbytes"
Install bitsandbytes for Granite Vision 4-bit NF4 GPU inference:

```powershell
pip install bitsandbytes>=0.46.1
```

### "PaddleOCR fails with WinError 127 (missing DLL)"
The Windows DLL search path is configured automatically in
`paddle_provider.py`. If the issue persists, ensure no stale CUDA DLLs are in
your system `PATH` and that the Paddle wheel was installed into the active
`.venv`.

### "Granite Vision fails to load"
- Ensure `bitsandbytes` is installed (for 4-bit NF4 quantization).
- Ensure `torch` with CUDA is installed.
- Granite Vision loads in-process (no microservice); it is lazy-loaded on
  first tabular OCR request to avoid OOM alongside PaddleOCR.

### "Port 8000 already in use"
Change the port:
```powershell
.\.venv\Scripts\uvicorn backend.main:app --host 0.0.0.0 --port 8001 --reload
```
Then update the frontend API base URL in `frontend/src/api.ts`.

### "uv is not installed"
Install `uv` from https://docs.astral.sh/uv/ and retry `setup_env.ps1`.

### "npm install fails"
- Ensure Node.js 20+ is installed
- Delete `node_modules/` and `frontend/node_modules/` and retry
- On Windows, try running PowerShell as Administrator

---

## Running Tests

```powershell
# Activate venv
.\.venv\Scripts\Activate.ps1

# Run all tests
pytest tests/ -v

# Run specific test file
pytest tests/test_smoke.py -v

# Run with coverage
pytest tests/ --cov=backend --cov-report=html

# Run the benchmark (generates eval_reports/metrics_latest.json)
python -m evaluation.benchmark
```

---

## Project Structure

```
pipeline_v1/
├── pipeline.py                     # Unified CLI entry point (single + batch)
├── setup_env.ps1                   # Python 3.12 + PaddlePaddle CUDA 12.9 setup
├── .env.example                    # Environment variable template
├── IMPLEMENTATION_STATUS.md        # Executive summary of all sessions
├── backend/
│   ├── main.py                     # FastAPI app entry point
│   ├── pipeline.py                 # Full DAG orchestration (run_pipeline)
│   ├── config.py                   # Centralised pydantic-settings config
│   ├── gpu_manager.py              # GPU preload manager (Paddle + Granite)
│   ├── ocr/                        # Modular OCR routing layer
│   │   ├── router.py               # Unified run_ocr() dispatcher
│   │   ├── ocr1_table.py           # PaddleOCR PP-Structure
│   │   ├── ocr3_printed.py         # PaddleOCR (GPU)
│   │   └── providers/
│   │       ├── paddle_provider.py
│   │       └── granite_provider.py  # Granite Vision 4.1-4b (tabular, 4-bit NF4)
│   ├── extraction/                 # Structured extraction + validation
│   │   ├── schema.py               # Pydantic LabReport / LabResult models
│   │   ├── formatter.py            # LLM-based formatting (placeholder)
│   │   ├── unit_normaliser.py
│   │   └── reference_ranges.py
│   ├── preprocessing/              # Deskew, crop, CLAHE, DPI normalisation
│   │   └── pipeline.py
│   ├── agents/                     # Pipeline agents (classification, OCR, etc.)
│   ├── routes/                     # FastAPI route modules
│   ├── services/                   # Business logic services
│   ├── weights/                    # Trained CNN weights (not in git)
│   └── requirements.txt            # Python 3.12 constraint documented
├── evaluation/
│   ├── metrics.py                  # CER, WER, accuracy (jiwer)
│   └── benchmark.py               # Generates eval_reports/metrics_latest.json
├── notebooks/                      # Exploratory Jupyter notebooks
│   ├── 01_preprocessing_exploration.ipynb
│   ├── 02_classifier_training.ipynb
│   └── 03_extraction_evaluation.ipynb
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api.ts
│   │   ├── pages/
│   │   └── components/
│   └── package.json
├── scripts/                        # Training, evaluation, tuning
│   ├── train_classifier.py
│   ├── eval_classifier.py
│   └── tune_weights.py
├── tests/                          # pytest test suite
├── PLAN/                           # Implementation plans
├── Dockerfile
├── start.ps1
└── README.md
```

---

## Key Files for Development

| File | Purpose |
|------|---------|
| `pipeline.py` | Unified CLI — single image or batch processing |
| `backend/pipeline.py` | Full DAG orchestration (`run_pipeline`, `run_pipeline_batch`) |
| `backend/main.py` | FastAPI app, all routes, DB setup |
| `backend/ocr/router.py` | Unified `run_ocr()` dispatcher |
| `backend/ocr/providers/` | Local OCR provider wrappers (Paddle, Granite Vision) |
| `backend/extraction/schema.py` | Pydantic models (LabReport, LabResult) |
| `backend/extraction/formatter.py` | LLM-based structured extraction (placeholder) |
| `backend/preprocessing/pipeline.py` | Deskew, crop, CLAHE, DPI normalisation |
| `backend/gpu_manager.py` | GPU model preloading (Paddle + Granite Vision) |
| `backend/config.py` | Centralised pydantic-settings configuration |
| `evaluation/metrics.py` | CER, WER, accuracy metrics (jiwer) |
| `evaluation/benchmark.py` | Benchmark script → `eval_reports/metrics_latest.json` |