# MedVault — Open-Source Medical Intelligence Ecosystem

A modular, pluggable medical platform for clinicians, researchers, pharma teams, and AI/OCR explorers. Built with FastAPI + React + TypeScript.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.9%2B-blue.svg)
![React](https://img.shields.io/badge/react-19-61dafb.svg)

## Quick Start

```bash
git clone https://github.com/YOUR_USERNAME/medvault.git
cd medvault
chmod +x start.sh
./start.sh
```

Or run manually:

```bash
# Backend
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
.venv/bin/uvicorn backend.main:app --port 8000 --reload

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

Open **http://localhost:5173**

## Docker

```bash
docker build -t medvault .
docker run -p 8000:8000 medvault
```

Open **http://localhost:8000**

## Architecture

```
medvault/
├── backend/
│   ├── main.py          # FastAPI app — 55+ endpoints, SQLite, pluggable providers
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.tsx       # Router + theme + navigation
│       ├── api.ts        # API client (all endpoints)
│       ├── styles.css    # Neumorphic design system
│       ├── pages/        # 21 feature modules
│       └── components/   # Shared components (icons, charts)
├── Dockerfile
├── start.sh
└── README.md
```

## Modules (21)

### Clinical (fully wired — backend + frontend)
| Module | Description |
|--------|-------------|
| **Patient Portal** | Registration, login, report upload, medical profile |
| **Doctor Portal** | Patient list, OCR analysis pipeline, report viewer |
| **Patient Chart** | 11-tab chart: vitals, meds, Rx, SOAP notes, labs, appointments, ICD-10, referrals, billing, insurance |
| **Dashboard** | Analytics overview, stats grid, recent patients/appointments |
| **Drug Interactions** | Multi-drug interaction checker with severity levels, seeded database |
| **Messages** | Secure doctor-patient messaging with read/unread tracking |
| **Audit Log** | Complete system activity trail for compliance |
| **Settings** | OCR & AI provider configuration (pluggable engine system) |

### Research & Specialty (frontend — mock data)
| Module | Description |
|--------|-------------|
| **Medical Imaging** | DICOM-style viewer, annotations, window/level presets, comparison mode |
| **Telemedicine** | Video consultation flow, in-call chat, post-visit summaries |
| **Rx Refills** | Refill queue, e-prescribe, pharmacy directory, controlled substance tracking |
| **Genomics** | Pharmacogenomics, genetic risk factors, ancestry, family pedigree |
| **Clinical Trials** | Trial matching, eligibility checking, enrollment workflow, adverse events |
| **Vitals Monitor** | Real-time multi-patient monitoring with animated ECG waveforms |
| **Lab Interpretation** | AI-powered lab result interpretation with 8 panel types |
| **Research Pipeline** | Experiment manager, dataset browser, AI analysis workbench |
| **OCR Workbench** | Multi-engine OCR comparison, pipeline builder, template library |
| **Advanced Analytics** | Population health, trends, quality metrics |
| **Consent Forms** | 8 digital consent templates with electronic signature |
| **Patient Education** | Evidence-based health articles across 5 categories |

## Pluggable Provider System

MedVault supports swappable OCR and AI engines:

**OCR Engines:** PyMuPDF (built-in), Tesseract, Custom HTTP endpoint
**AI Engines:** Google Gemini, OpenAI, Ollama (local), Custom OpenAI-compatible

Configure via Settings page or API:

```bash
# List available engines
curl http://localhost:8000/api/providers/engines

# Add a provider
curl -X POST http://localhost:8000/api/providers \
  -H "Content-Type: application/json" \
  -d '{"kind":"ai","name":"My GPT","engine":"openai","config":{"api_key":"sk-..."}}'
```

## API Overview (55+ endpoints)

```
POST   /api/patient/register        # Patient registration
POST   /api/patient/login           # Patient login
POST   /api/patient/upload          # Upload medical report
GET    /api/doctor/patients          # List all patients
POST   /api/doctor/analyze           # Run OCR + AI analysis
GET    /api/patient/{id}/vitals      # Vitals history
POST   /api/vitals                   # Record vital signs
GET    /api/patient/{id}/prescriptions
POST   /api/prescriptions            # Create prescription
GET    /api/patient/{id}/notes       # SOAP clinical notes
POST   /api/notes                    # Create clinical note
GET    /api/appointments             # List appointments
GET    /api/drug-interactions/check?drugs=Warfarin,Aspirin
GET    /api/icd10?q=hyper            # ICD-10 code search
GET    /api/patient/{id}/fhir        # FHIR R4 Bundle export
GET    /api/patient/{id}/export      # Full data export
GET    /api/analytics                # Dashboard analytics
GET    /api/audit-log                # Audit trail
...and 35+ more
```

## Tech Stack

- **Backend:** Python, FastAPI, SQLite (WAL mode), PyMuPDF, python-jose (JWT)
- **Frontend:** React 19, TypeScript, Vite 6
- **Design:** Custom neumorphic CSS (dark/light mode, responsive)
- **Auth:** PBKDF2 password hashing, JWT tokens
- **Standards:** FHIR R4 export, ICD-10 codes, SOAP notes format

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | `dev-secret-change-me` | JWT signing key (change in production!) |
| `GEMINI_API_KEY` | — | Google Gemini API key for AI analysis |
| `MEDVAULT_STATIC_DIR` | `frontend/dist` | Path to built frontend (for Docker) |

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit (`git commit -m "feat: add my feature"`)
4. Push (`git push origin feat/my-feature`)
5. Open a Pull Request

## License

MIT — see [LICENSE](LICENSE)
