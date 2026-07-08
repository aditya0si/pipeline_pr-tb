from __future__ import annotations

import base64
import hashlib
import io
import json
import os
import secrets
import sqlite3
import uuid
from abc import ABC, abstractmethod
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import fitz  # PyMuPDF
from fastapi import FastAPI, File, HTTPException, UploadFile, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from jose import jwt
from pydantic import BaseModel

DB_PATH = Path(__file__).parent.parent / "medapp.db"
UPLOAD_DIR = Path(__file__).parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

SECRET_KEY = os.getenv("JWT_SECRET", "dev-secret-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 72


def _hash_pw(password: str) -> str:
    salt = secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
    return f"{salt}${h.hex()}"

def _verify_pw(password: str, stored: str) -> bool:
    salt, hx = stored.split("$", 1)
    h = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
    return h.hex() == hx


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS patients (
            id TEXT PRIMARY KEY,
            phone TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT DEFAULT '',
            date_of_birth TEXT DEFAULT '',
            gender TEXT DEFAULT '',
            blood_group TEXT DEFAULT '',
            email TEXT DEFAULT '',
            address TEXT DEFAULT '',
            emergency_contact TEXT DEFAULT '',
            emergency_phone TEXT DEFAULT '',
            photo_url TEXT DEFAULT '',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS doctors (
            id TEXT PRIMARY KEY,
            phone TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            specialization TEXT DEFAULT '',
            license_number TEXT DEFAULT '',
            email TEXT DEFAULT '',
            photo_url TEXT DEFAULT '',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS reports (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patients(id),
            filename TEXT NOT NULL,
            filepath TEXT NOT NULL,
            filetype TEXT NOT NULL,
            ocr_text TEXT DEFAULT '',
            analysis TEXT DEFAULT '',
            shared_at TEXT NOT NULL,
            analyzed INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS providers (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL,
            name TEXT NOT NULL,
            engine TEXT NOT NULL,
            config TEXT NOT NULL DEFAULT '{}',
            is_default INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS allergies (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patients(id),
            allergen TEXT NOT NULL,
            severity TEXT DEFAULT 'mild',
            reaction TEXT DEFAULT '',
            noted_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS conditions (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patients(id),
            name TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            diagnosed_at TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS medications (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patients(id),
            name TEXT NOT NULL,
            dosage TEXT DEFAULT '',
            frequency TEXT DEFAULT '',
            status TEXT DEFAULT 'active',
            prescribed_by TEXT DEFAULT '',
            start_date TEXT DEFAULT '',
            end_date TEXT DEFAULT '',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS vitals (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patients(id),
            recorded_by TEXT DEFAULT '',
            systolic INTEGER,
            diastolic INTEGER,
            heart_rate INTEGER,
            temperature REAL,
            spo2 INTEGER,
            respiratory_rate INTEGER,
            weight REAL,
            height REAL,
            blood_sugar REAL,
            notes TEXT DEFAULT '',
            recorded_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS prescriptions (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patients(id),
            doctor_id TEXT DEFAULT '',
            doctor_name TEXT DEFAULT '',
            diagnosis TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            items TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS clinical_notes (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patients(id),
            doctor_id TEXT DEFAULT '',
            doctor_name TEXT DEFAULT '',
            visit_type TEXT DEFAULT 'follow-up',
            subjective TEXT DEFAULT '',
            objective TEXT DEFAULT '',
            assessment TEXT DEFAULT '',
            plan TEXT DEFAULT '',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS appointments (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patients(id),
            doctor_id TEXT DEFAULT '',
            doctor_name TEXT DEFAULT '',
            scheduled_at TEXT NOT NULL,
            duration_min INTEGER DEFAULT 30,
            visit_type TEXT DEFAULT 'consultation',
            status TEXT DEFAULT 'scheduled',
            notes TEXT DEFAULT '',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS lab_results (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patients(id),
            test_name TEXT NOT NULL,
            value REAL,
            unit TEXT DEFAULT '',
            reference_low REAL,
            reference_high REAL,
            status TEXT DEFAULT 'normal',
            report_id TEXT DEFAULT '',
            tested_at TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            sender_type TEXT NOT NULL,
            sender_id TEXT NOT NULL,
            receiver_type TEXT NOT NULL,
            receiver_id TEXT NOT NULL,
            subject TEXT DEFAULT '',
            body TEXT NOT NULL,
            is_read INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS audit_log (
            id TEXT PRIMARY KEY,
            actor_type TEXT NOT NULL,
            actor_id TEXT NOT NULL,
            action TEXT NOT NULL,
            resource_type TEXT DEFAULT '',
            resource_id TEXT DEFAULT '',
            details TEXT DEFAULT '',
            ip_address TEXT DEFAULT '',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            user_type TEXT NOT NULL,
            user_id TEXT NOT NULL,
            title TEXT NOT NULL,
            body TEXT DEFAULT '',
            category TEXT DEFAULT 'info',
            is_read INTEGER DEFAULT 0,
            link TEXT DEFAULT '',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS icd10_codes (
            code TEXT PRIMARY KEY,
            description TEXT NOT NULL,
            category TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS diagnosis_codes (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patients(id),
            code TEXT NOT NULL,
            description TEXT NOT NULL,
            diagnosed_at TEXT NOT NULL,
            notes TEXT DEFAULT '',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS drug_interactions (
            id TEXT PRIMARY KEY,
            drug_a TEXT NOT NULL,
            drug_b TEXT NOT NULL,
            severity TEXT NOT NULL,
            description TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS referrals (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patients(id),
            from_doctor_id TEXT DEFAULT '',
            from_doctor_name TEXT DEFAULT '',
            to_specialty TEXT NOT NULL,
            to_doctor_name TEXT DEFAULT '',
            reason TEXT NOT NULL,
            urgency TEXT DEFAULT 'routine',
            status TEXT DEFAULT 'pending',
            notes TEXT DEFAULT '',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS templates (
            id TEXT PRIMARY KEY,
            doctor_id TEXT DEFAULT '',
            template_type TEXT NOT NULL,
            name TEXT NOT NULL,
            content TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS invoices (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patients(id),
            doctor_id TEXT DEFAULT '',
            items TEXT NOT NULL DEFAULT '[]',
            subtotal REAL DEFAULT 0,
            tax REAL DEFAULT 0,
            total REAL DEFAULT 0,
            status TEXT DEFAULT 'draft',
            notes TEXT DEFAULT '',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS insurance (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patients(id),
            provider_name TEXT NOT NULL,
            policy_number TEXT NOT NULL,
            group_number TEXT DEFAULT '',
            subscriber_name TEXT DEFAULT '',
            relationship TEXT DEFAULT 'self',
            effective_date TEXT DEFAULT '',
            expiry_date TEXT DEFAULT '',
            created_at TEXT NOT NULL
        );
    """)

    # Seed common drug interactions
    interactions = [
        ("Warfarin", "Aspirin", "major", "Increased risk of bleeding"),
        ("Warfarin", "Ibuprofen", "major", "Increased risk of GI bleeding and anticoagulant effect"),
        ("Metformin", "Alcohol", "major", "Risk of lactic acidosis"),
        ("ACE Inhibitors", "Potassium", "major", "Risk of hyperkalemia"),
        ("SSRIs", "MAOIs", "contraindicated", "Risk of serotonin syndrome — potentially fatal"),
        ("Statins", "Grapefruit", "moderate", "Increased statin levels, risk of rhabdomyolysis"),
        ("Methotrexate", "NSAIDs", "major", "Decreased renal clearance of methotrexate"),
        ("Digoxin", "Amiodarone", "major", "Increased digoxin levels, risk of toxicity"),
        ("Ciprofloxacin", "Theophylline", "major", "Increased theophylline levels, risk of seizures"),
        ("Lithium", "NSAIDs", "major", "Increased lithium levels, risk of toxicity"),
        ("Clopidogrel", "Omeprazole", "moderate", "Reduced antiplatelet effect of clopidogrel"),
        ("Sildenafil", "Nitrates", "contraindicated", "Severe hypotension"),
        ("Fluconazole", "Warfarin", "major", "Increased warfarin effect, risk of bleeding"),
        ("Erythromycin", "Statins", "major", "Increased statin levels, risk of rhabdomyolysis"),
        ("Insulin", "Beta Blockers", "moderate", "Masked hypoglycemia symptoms"),
        ("Metronidazole", "Alcohol", "major", "Disulfiram-like reaction — nausea, vomiting, flushing"),
        ("Tetracycline", "Antacids", "moderate", "Reduced tetracycline absorption"),
        ("Phenytoin", "Valproic Acid", "major", "Altered levels of both drugs"),
        ("Tramadol", "SSRIs", "major", "Risk of serotonin syndrome and seizures"),
        ("Benzodiazepines", "Opioids", "major", "Risk of respiratory depression and death"),
    ]
    for a, b, sev, desc in interactions:
        conn.execute(
            "INSERT OR IGNORE INTO drug_interactions (id, drug_a, drug_b, severity, description) VALUES (?,?,?,?,?)",
            (f"di_{a.lower().replace(' ','_')}_{b.lower().replace(' ','_')}", a, b, sev, desc),
        )

    # Seed common ICD-10 codes
    icd_codes = [
        ("E11", "Type 2 diabetes mellitus", "Endocrine"),
        ("I10", "Essential hypertension", "Circulatory"),
        ("J06.9", "Acute upper respiratory infection, unspecified", "Respiratory"),
        ("M54.5", "Low back pain", "Musculoskeletal"),
        ("K21.0", "Gastro-esophageal reflux with esophagitis", "Digestive"),
        ("F32.9", "Major depressive disorder, single episode, unspecified", "Mental"),
        ("J45.909", "Unspecified asthma, uncomplicated", "Respiratory"),
        ("E78.5", "Hyperlipidemia, unspecified", "Endocrine"),
        ("N39.0", "Urinary tract infection, site not specified", "Genitourinary"),
        ("R51", "Headache", "Symptoms"),
        ("J20.9", "Acute bronchitis, unspecified", "Respiratory"),
        ("R10.9", "Unspecified abdominal pain", "Symptoms"),
        ("E03.9", "Hypothyroidism, unspecified", "Endocrine"),
        ("G43.909", "Migraine, unspecified, not intractable", "Nervous"),
        ("L30.9", "Dermatitis, unspecified", "Skin"),
        ("R05", "Cough", "Symptoms"),
        ("K58.9", "Irritable bowel syndrome without diarrhea", "Digestive"),
        ("M79.3", "Panniculitis, unspecified", "Musculoskeletal"),
        ("R11.2", "Nausea with vomiting, unspecified", "Symptoms"),
        ("D64.9", "Anemia, unspecified", "Blood"),
        ("I25.10", "Atherosclerotic heart disease", "Circulatory"),
        ("J18.9", "Pneumonia, unspecified organism", "Respiratory"),
        ("E55.9", "Vitamin D deficiency, unspecified", "Endocrine"),
        ("B34.9", "Viral infection, unspecified", "Infectious"),
        ("R50.9", "Fever, unspecified", "Symptoms"),
    ]
    for code, desc, cat in icd_codes:
        conn.execute(
            "INSERT OR IGNORE INTO icd10_codes (code, description, category) VALUES (?,?,?)",
            (code, desc, cat),
        )

    conn.commit()
    conn.close()


# ═══════════════════════════════════════════════════════════════
#  PLUGGABLE PROVIDER SYSTEM
# ═══════════════════════════════════════════════════════════════

class OCRProvider(ABC):
    @abstractmethod
    def extract_text(self, filepath: str, filetype: str) -> str: ...

class PyMuPDFOCR(OCRProvider):
    def extract_text(self, filepath: str, filetype: str) -> str:
        if filetype == "image":
            return "(image — text extracted via AI model)"
        doc = fitz.open(filepath)
        text = "\n".join(page.get_text() for page in doc)
        doc.close()
        return text.strip()

class TesseractOCR(OCRProvider):
    def __init__(self, lang: str = "eng"):
        self.lang = lang
    def extract_text(self, filepath: str, filetype: str) -> str:
        try:
            import pytesseract
            from PIL import Image
        except ImportError:
            raise HTTPException(500, "pytesseract or Pillow not installed")
        if filetype == "image":
            img = Image.open(filepath)
            return pytesseract.image_to_string(img, lang=self.lang)
        doc = fitz.open(filepath)
        texts = []
        for page in doc:
            pix = page.get_pixmap(dpi=200)
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            texts.append(pytesseract.image_to_string(img, lang=self.lang))
        doc.close()
        return "\n".join(texts).strip()

class CustomHTTPOCR(OCRProvider):
    def __init__(self, endpoint: str, api_key: str = "", headers: Optional[dict] = None):
        self.endpoint = endpoint
        self.api_key = api_key
        self.headers = headers or {}
    def extract_text(self, filepath: str, filetype: str) -> str:
        import httpx
        file_bytes = Path(filepath).read_bytes()
        h = {**self.headers}
        if self.api_key:
            h["Authorization"] = f"Bearer {self.api_key}"
        resp = httpx.post(self.endpoint, files={"file": ("document", file_bytes)}, headers=h, timeout=60)
        if resp.status_code != 200:
            raise HTTPException(502, f"OCR endpoint returned {resp.status_code}")
        data = resp.json()
        return data.get("text", data.get("result", str(data)))

class AIProvider(ABC):
    @abstractmethod
    def analyze(self, prompt: str, text: str, images: list[bytes]) -> str: ...

class GeminiProvider(AIProvider):
    def __init__(self, api_key: str, model: str = "gemini-2.0-flash"):
        self.api_key = api_key
        self.model_name = model
    def analyze(self, prompt: str, text: str, images: list[bytes]) -> str:
        import google.generativeai as genai
        genai.configure(api_key=self.api_key)
        model = genai.GenerativeModel(self.model_name)
        parts: list = [prompt]
        if text:
            parts.append(f"\n\nExtracted text:\n{text}")
        for img in images[:5]:
            parts.append({"mime_type": "image/png", "data": img})
        return model.generate_content(parts).text

class OpenAIProvider(AIProvider):
    def __init__(self, api_key: str, model: str = "gpt-4o", base_url: str = "https://api.openai.com/v1"):
        self.api_key = api_key
        self.model_name = model
        self.base_url = base_url
    def analyze(self, prompt: str, text: str, images: list[bytes]) -> str:
        import httpx
        content: list[dict] = [{"type": "text", "text": prompt}]
        if text:
            content.append({"type": "text", "text": f"\nExtracted text:\n{text}"})
        for img in images[:5]:
            b64 = base64.b64encode(img).decode()
            content.append({"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}})
        resp = httpx.post(
            f"{self.base_url}/chat/completions",
            headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
            json={"model": self.model_name, "messages": [{"role": "user", "content": content}], "max_tokens": 4096},
            timeout=120,
        )
        if resp.status_code != 200:
            raise HTTPException(502, f"OpenAI API error {resp.status_code}")
        return resp.json()["choices"][0]["message"]["content"]

class OllamaProvider(AIProvider):
    def __init__(self, model: str = "llava", base_url: str = "http://localhost:11434"):
        self.model_name = model
        self.base_url = base_url
    def analyze(self, prompt: str, text: str, images: list[bytes]) -> str:
        import httpx
        full_prompt = prompt + (f"\n\nExtracted text:\n{text}" if text else "")
        payload: dict = {"model": self.model_name, "prompt": full_prompt, "stream": False}
        if images:
            payload["images"] = [base64.b64encode(img).decode() for img in images[:3]]
        resp = httpx.post(f"{self.base_url}/api/generate", json=payload, timeout=180)
        if resp.status_code != 200:
            raise HTTPException(502, f"Ollama error {resp.status_code}")
        return resp.json()["response"]

class CustomAIProvider(AIProvider):
    def __init__(self, endpoint: str, api_key: str = "", model: str = "", headers: Optional[dict] = None):
        self.endpoint = endpoint
        self.api_key = api_key
        self.model_name = model
        self.headers = headers or {}
    def analyze(self, prompt: str, text: str, images: list[bytes]) -> str:
        import httpx
        content: list[dict] = [{"type": "text", "text": prompt}]
        if text:
            content.append({"type": "text", "text": f"\nExtracted text:\n{text}"})
        for img in images[:5]:
            b64 = base64.b64encode(img).decode()
            content.append({"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}})
        h = {**self.headers, "Content-Type": "application/json"}
        if self.api_key:
            h["Authorization"] = f"Bearer {self.api_key}"
        body: dict = {"messages": [{"role": "user", "content": content}], "max_tokens": 4096}
        if self.model_name:
            body["model"] = self.model_name
        resp = httpx.post(self.endpoint, headers=h, json=body, timeout=120)
        if resp.status_code != 200:
            raise HTTPException(502, f"Custom AI error {resp.status_code}")
        data = resp.json()
        if "choices" in data:
            return data["choices"][0]["message"]["content"]
        return data.get("response", data.get("text", str(data)))

OCR_ENGINES = {
    "pymupdf": lambda cfg: PyMuPDFOCR(),
    "tesseract": lambda cfg: TesseractOCR(lang=cfg.get("lang", "eng")),
    "custom_http": lambda cfg: CustomHTTPOCR(endpoint=cfg["endpoint"], api_key=cfg.get("api_key", ""), headers=cfg.get("headers")),
}
AI_ENGINES = {
    "gemini": lambda cfg: GeminiProvider(api_key=cfg["api_key"], model=cfg.get("model", "gemini-2.0-flash")),
    "openai": lambda cfg: OpenAIProvider(api_key=cfg["api_key"], model=cfg.get("model", "gpt-4o"), base_url=cfg.get("base_url", "https://api.openai.com/v1")),
    "ollama": lambda cfg: OllamaProvider(model=cfg.get("model", "llava"), base_url=cfg.get("base_url", "http://localhost:11434")),
    "custom_openai": lambda cfg: CustomAIProvider(endpoint=cfg["endpoint"], api_key=cfg.get("api_key", ""), model=cfg.get("model", ""), headers=cfg.get("headers")),
}

def build_ocr(engine: str, config: dict) -> OCRProvider:
    factory = OCR_ENGINES.get(engine)
    if not factory:
        raise HTTPException(400, f"Unknown OCR engine: {engine}")
    return factory(config)

def build_ai(engine: str, config: dict) -> AIProvider:
    factory = AI_ENGINES.get(engine)
    if not factory:
        raise HTTPException(400, f"Unknown AI engine: {engine}")
    return factory(config)


# ═══════════════════════════════════════════════════════════════
#  APP
# ═══════════════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield

app = FastAPI(title="MedVault", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


def create_token(user_id: str, role: str = "patient") -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": user_id, "role": role, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except Exception:
        raise HTTPException(401, "Invalid token")


# ── Models ────────────────────────────────────────────────────

class RegisterReq(BaseModel):
    phone: str
    password: str
    name: str = ""

class LoginReq(BaseModel):
    phone: str
    password: str

class DoctorRegisterReq(BaseModel):
    phone: str
    password: str
    name: str
    specialization: str = ""
    license_number: str = ""
    email: str = ""

class AnalyzeReq(BaseModel):
    report_id: str
    ocr_provider_id: str = ""
    ai_provider_id: str = ""
    api_key: str = ""

class ProviderReq(BaseModel):
    kind: str
    name: str
    engine: str
    config: dict = {}
    is_default: bool = False

class PatientProfileReq(BaseModel):
    name: str = ""
    date_of_birth: str = ""
    gender: str = ""
    blood_group: str = ""
    email: str = ""
    address: str = ""
    emergency_contact: str = ""
    emergency_phone: str = ""

class AllergyReq(BaseModel):
    allergen: str
    severity: str = "mild"
    reaction: str = ""

class ConditionReq(BaseModel):
    name: str
    status: str = "active"
    diagnosed_at: str = ""
    notes: str = ""

class MedicationReq(BaseModel):
    name: str
    dosage: str = ""
    frequency: str = ""
    status: str = "active"
    prescribed_by: str = ""
    start_date: str = ""
    end_date: str = ""

class VitalReq(BaseModel):
    patient_id: str
    systolic: Optional[int] = None
    diastolic: Optional[int] = None
    heart_rate: Optional[int] = None
    temperature: Optional[float] = None
    spo2: Optional[int] = None
    respiratory_rate: Optional[int] = None
    weight: Optional[float] = None
    height: Optional[float] = None
    blood_sugar: Optional[float] = None
    notes: str = ""

class PrescriptionReq(BaseModel):
    patient_id: str
    doctor_name: str = ""
    diagnosis: str = ""
    notes: str = ""
    items: list[dict] = []

class ClinicalNoteReq(BaseModel):
    patient_id: str
    doctor_name: str = ""
    visit_type: str = "follow-up"
    subjective: str = ""
    objective: str = ""
    assessment: str = ""
    plan: str = ""

class AppointmentReq(BaseModel):
    patient_id: str
    doctor_name: str = ""
    scheduled_at: str
    duration_min: int = 30
    visit_type: str = "consultation"
    status: str = "scheduled"
    notes: str = ""

class LabResultReq(BaseModel):
    patient_id: str
    test_name: str
    value: float
    unit: str = ""
    reference_low: Optional[float] = None
    reference_high: Optional[float] = None
    status: str = "normal"
    report_id: str = ""
    tested_at: str = ""

class MessageReq(BaseModel):
    receiver_type: str
    receiver_id: str
    subject: str = ""
    body: str

class NotificationReq(BaseModel):
    user_type: str
    user_id: str
    title: str
    body: str = ""
    category: str = "info"
    link: str = ""

class DiagnosisCodeReq(BaseModel):
    patient_id: str
    code: str
    description: str
    notes: str = ""

class ReferralReq(BaseModel):
    patient_id: str
    from_doctor_name: str = ""
    to_specialty: str
    to_doctor_name: str = ""
    reason: str
    urgency: str = "routine"
    notes: str = ""

class TemplateReq(BaseModel):
    template_type: str
    name: str
    content: dict = {}

class InvoiceReq(BaseModel):
    patient_id: str
    items: list = []
    subtotal: float = 0
    tax: float = 0
    total: float = 0
    notes: str = ""

class InsuranceReq(BaseModel):
    patient_id: str
    provider_name: str
    policy_number: str
    group_number: str = ""
    subscriber_name: str = ""
    relationship: str = "self"
    effective_date: str = ""
    expiry_date: str = ""

class DoctorProfileReq(BaseModel):
    name: str = ""
    specialization: str = ""
    license_number: str = ""
    email: str = ""
    bio: str = ""
    experience_years: int = 0
    education: str = ""
    languages: str = ""
    consultation_fee: float = 0


# ── Patient Auth ──────────────────────────────────────────────

@app.post("/api/patient/register")
def register(req: RegisterReq):
    conn = get_db()
    if conn.execute("SELECT id FROM patients WHERE phone=?", (req.phone,)).fetchone():
        conn.close()
        raise HTTPException(409, "Phone already registered")
    pid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        "INSERT INTO patients (id, phone, password_hash, name, created_at) VALUES (?,?,?,?,?)",
        (pid, req.phone, _hash_pw(req.password), req.name, now),
    )
    conn.commit()
    conn.close()
    return {"token": create_token(pid), "patient_id": pid}

@app.post("/api/patient/login")
def login(req: LoginReq):
    conn = get_db()
    row = conn.execute("SELECT id, password_hash FROM patients WHERE phone=?", (req.phone,)).fetchone()
    conn.close()
    if not row or not _verify_pw(req.password, row["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    return {"token": create_token(row["id"]), "patient_id": row["id"]}

@app.post("/api/patient/upload")
async def upload_report(token: str = Form(...), file: UploadFile = File(...)):
    payload = decode_token(token)
    patient_id = payload["sub"]
    ext = Path(file.filename or "file").suffix.lower()
    if ext not in (".pdf", ".png", ".jpg", ".jpeg", ".webp"):
        raise HTTPException(400, "Only PDF and image files accepted")
    rid = str(uuid.uuid4())
    dest = UPLOAD_DIR / f"{rid}{ext}"
    content = await file.read()
    dest.write_bytes(content)
    filetype = "pdf" if ext == ".pdf" else "image"
    now = datetime.now(timezone.utc).isoformat()
    conn = get_db()
    conn.execute(
        "INSERT INTO reports (id, patient_id, filename, filepath, filetype, shared_at) VALUES (?,?,?,?,?,?)",
        (rid, patient_id, file.filename, str(dest), filetype, now),
    )
    conn.commit()
    conn.close()
    return {"report_id": rid, "filename": file.filename}

@app.get("/api/patient/reports")
def patient_reports(token: str):
    payload = decode_token(token)
    conn = get_db()
    rows = conn.execute(
        "SELECT id, filename, filetype, shared_at, analyzed FROM reports WHERE patient_id=? ORDER BY shared_at DESC",
        (payload["sub"],),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/patient/profile")
def get_patient_profile(token: str):
    payload = decode_token(token)
    conn = get_db()
    row = conn.execute("SELECT * FROM patients WHERE id=?", (payload["sub"],)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, "Patient not found")
    d = dict(row)
    d.pop("password_hash", None)
    return d

@app.put("/api/patient/profile")
def update_patient_profile(token: str, req: PatientProfileReq):
    payload = decode_token(token)
    conn = get_db()
    conn.execute(
        "UPDATE patients SET name=?, date_of_birth=?, gender=?, blood_group=?, email=?, address=?, emergency_contact=?, emergency_phone=? WHERE id=?",
        (req.name, req.date_of_birth, req.gender, req.blood_group, req.email, req.address, req.emergency_contact, req.emergency_phone, payload["sub"]),
    )
    conn.commit()
    conn.close()
    return {"ok": True}


# ── Doctor Auth ───────────────────────────────────────────────

@app.post("/api/doctor/register")
def doctor_register(req: DoctorRegisterReq):
    conn = get_db()
    if conn.execute("SELECT id FROM doctors WHERE phone=?", (req.phone,)).fetchone():
        conn.close()
        raise HTTPException(409, "Phone already registered")
    did = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        "INSERT INTO doctors (id, phone, password_hash, name, specialization, license_number, email, created_at) VALUES (?,?,?,?,?,?,?,?)",
        (did, req.phone, _hash_pw(req.password), req.name, req.specialization, req.license_number, req.email, now),
    )
    conn.commit()
    conn.close()
    return {"token": create_token(did, "doctor"), "doctor_id": did}

@app.post("/api/doctor/login")
def doctor_login(req: LoginReq):
    conn = get_db()
    row = conn.execute("SELECT id, password_hash FROM doctors WHERE phone=?", (req.phone,)).fetchone()
    conn.close()
    if not row or not _verify_pw(req.password, row["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    return {"token": create_token(row["id"], "doctor"), "doctor_id": row["id"]}


# ── Doctor Endpoints ──────────────────────────────────────────

@app.get("/api/doctor/patients")
def list_patients():
    conn = get_db()
    rows = conn.execute(
        "SELECT p.id, p.phone, p.name, p.date_of_birth, p.gender, p.blood_group, p.created_at, COUNT(r.id) as report_count "
        "FROM patients p LEFT JOIN reports r ON p.id = r.patient_id "
        "GROUP BY p.id ORDER BY p.created_at DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/doctor/patient/{patient_id}")
def get_patient_detail(patient_id: str):
    conn = get_db()
    row = conn.execute("SELECT * FROM patients WHERE id=?", (patient_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Patient not found")
    d = dict(row)
    d.pop("password_hash", None)
    conn.close()
    return d

@app.get("/api/doctor/patient/{patient_id}/reports")
def patient_report_list(patient_id: str):
    conn = get_db()
    rows = conn.execute(
        "SELECT id, filename, filetype, shared_at, analyzed, ocr_text, analysis FROM reports WHERE patient_id=? ORDER BY shared_at DESC",
        (patient_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/file/{report_id}")
def serve_file(report_id: str):
    conn = get_db()
    row = conn.execute("SELECT filepath, filename FROM reports WHERE id=?", (report_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, "File not found")
    return FileResponse(row["filepath"], filename=row["filename"])


# ── Allergies ─────────────────────────────────────────────────

@app.get("/api/patient/{patient_id}/allergies")
def list_allergies(patient_id: str):
    conn = get_db()
    rows = conn.execute("SELECT * FROM allergies WHERE patient_id=? ORDER BY noted_at DESC", (patient_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/patient/{patient_id}/allergies")
def add_allergy(patient_id: str, req: AllergyReq):
    aid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    conn = get_db()
    conn.execute("INSERT INTO allergies (id, patient_id, allergen, severity, reaction, noted_at) VALUES (?,?,?,?,?,?)",
                 (aid, patient_id, req.allergen, req.severity, req.reaction, now))
    conn.commit()
    conn.close()
    return {"id": aid}

@app.delete("/api/allergies/{allergy_id}")
def delete_allergy(allergy_id: str):
    conn = get_db()
    conn.execute("DELETE FROM allergies WHERE id=?", (allergy_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


# ── Conditions ────────────────────────────────────────────────

@app.get("/api/patient/{patient_id}/conditions")
def list_conditions(patient_id: str):
    conn = get_db()
    rows = conn.execute("SELECT * FROM conditions WHERE patient_id=? ORDER BY created_at DESC", (patient_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/patient/{patient_id}/conditions")
def add_condition(patient_id: str, req: ConditionReq):
    cid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    conn = get_db()
    conn.execute("INSERT INTO conditions (id, patient_id, name, status, diagnosed_at, notes, created_at) VALUES (?,?,?,?,?,?,?)",
                 (cid, patient_id, req.name, req.status, req.diagnosed_at, req.notes, now))
    conn.commit()
    conn.close()
    return {"id": cid}

@app.delete("/api/conditions/{condition_id}")
def delete_condition(condition_id: str):
    conn = get_db()
    conn.execute("DELETE FROM conditions WHERE id=?", (condition_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


# ── Medications ───────────────────────────────────────────────

@app.get("/api/patient/{patient_id}/medications")
def list_medications(patient_id: str):
    conn = get_db()
    rows = conn.execute("SELECT * FROM medications WHERE patient_id=? ORDER BY created_at DESC", (patient_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/patient/{patient_id}/medications")
def add_medication(patient_id: str, req: MedicationReq):
    mid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    conn = get_db()
    conn.execute(
        "INSERT INTO medications (id, patient_id, name, dosage, frequency, status, prescribed_by, start_date, end_date, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        (mid, patient_id, req.name, req.dosage, req.frequency, req.status, req.prescribed_by, req.start_date, req.end_date, now),
    )
    conn.commit()
    conn.close()
    return {"id": mid}

@app.delete("/api/medications/{medication_id}")
def delete_medication(medication_id: str):
    conn = get_db()
    conn.execute("DELETE FROM medications WHERE id=?", (medication_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


# ── Vitals ────────────────────────────────────────────────────

@app.get("/api/patient/{patient_id}/vitals")
def list_vitals(patient_id: str, limit: int = Query(50)):
    conn = get_db()
    rows = conn.execute("SELECT * FROM vitals WHERE patient_id=? ORDER BY recorded_at DESC LIMIT ?", (patient_id, limit)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/vitals")
def record_vital(req: VitalReq):
    vid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    conn = get_db()
    conn.execute(
        "INSERT INTO vitals (id, patient_id, systolic, diastolic, heart_rate, temperature, spo2, respiratory_rate, weight, height, blood_sugar, notes, recorded_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (vid, req.patient_id, req.systolic, req.diastolic, req.heart_rate, req.temperature, req.spo2, req.respiratory_rate, req.weight, req.height, req.blood_sugar, req.notes, now),
    )
    conn.commit()
    conn.close()
    return {"id": vid}


# ── Prescriptions ─────────────────────────────────────────────

@app.get("/api/patient/{patient_id}/prescriptions")
def list_prescriptions(patient_id: str):
    conn = get_db()
    rows = conn.execute("SELECT * FROM prescriptions WHERE patient_id=? ORDER BY created_at DESC", (patient_id,)).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["items"] = json.loads(d["items"]) if isinstance(d["items"], str) else d["items"]
        result.append(d)
    return result

@app.post("/api/prescriptions")
def create_prescription(req: PrescriptionReq):
    pid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    conn = get_db()
    conn.execute(
        "INSERT INTO prescriptions (id, patient_id, doctor_name, diagnosis, notes, items, created_at) VALUES (?,?,?,?,?,?,?)",
        (pid, req.patient_id, req.doctor_name, req.diagnosis, req.notes, json.dumps(req.items), now),
    )
    conn.commit()
    conn.close()
    return {"id": pid}


# ── Clinical Notes (SOAP) ────────────────────────────────────

@app.get("/api/patient/{patient_id}/notes")
def list_clinical_notes(patient_id: str):
    conn = get_db()
    rows = conn.execute("SELECT * FROM clinical_notes WHERE patient_id=? ORDER BY created_at DESC", (patient_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/notes")
def create_clinical_note(req: ClinicalNoteReq):
    nid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    conn = get_db()
    conn.execute(
        "INSERT INTO clinical_notes (id, patient_id, doctor_name, visit_type, subjective, objective, assessment, plan, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        (nid, req.patient_id, req.doctor_name, req.visit_type, req.subjective, req.objective, req.assessment, req.plan, now),
    )
    conn.commit()
    conn.close()
    return {"id": nid}


# ── Appointments ──────────────────────────────────────────────

@app.get("/api/appointments")
def list_appointments(patient_id: str = Query(None), status: str = Query(None)):
    conn = get_db()
    query = "SELECT a.*, p.name as patient_name, p.phone as patient_phone FROM appointments a JOIN patients p ON a.patient_id = p.id WHERE 1=1"
    params: list = []
    if patient_id:
        query += " AND a.patient_id=?"
        params.append(patient_id)
    if status:
        query += " AND a.status=?"
        params.append(status)
    query += " ORDER BY a.scheduled_at DESC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/appointments")
def create_appointment(req: AppointmentReq):
    aid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    conn = get_db()
    conn.execute(
        "INSERT INTO appointments (id, patient_id, doctor_name, scheduled_at, duration_min, visit_type, status, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        (aid, req.patient_id, req.doctor_name, req.scheduled_at, req.duration_min, req.visit_type, req.status, req.notes, now),
    )
    conn.commit()
    conn.close()
    return {"id": aid}

@app.put("/api/appointments/{appointment_id}")
def update_appointment(appointment_id: str, req: AppointmentReq):
    conn = get_db()
    conn.execute(
        "UPDATE appointments SET doctor_name=?, scheduled_at=?, duration_min=?, visit_type=?, status=?, notes=? WHERE id=?",
        (req.doctor_name, req.scheduled_at, req.duration_min, req.visit_type, req.status, req.notes, appointment_id),
    )
    conn.commit()
    conn.close()
    return {"ok": True}


# ── Lab Results ───────────────────────────────────────────────

@app.get("/api/patient/{patient_id}/labs")
def list_lab_results(patient_id: str):
    conn = get_db()
    rows = conn.execute("SELECT * FROM lab_results WHERE patient_id=? ORDER BY tested_at DESC", (patient_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/labs")
def add_lab_result(req: LabResultReq):
    lid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    tested = req.tested_at or now
    conn = get_db()
    conn.execute(
        "INSERT INTO lab_results (id, patient_id, test_name, value, unit, reference_low, reference_high, status, report_id, tested_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (lid, req.patient_id, req.test_name, req.value, req.unit, req.reference_low, req.reference_high, req.status, req.report_id, tested, now),
    )
    conn.commit()
    conn.close()
    return {"id": lid}


# ── Messages ─────────────────────────────────────────────────

@app.get("/api/messages")
def list_messages(user_type: str = Query("doctor"), user_id: str = Query("")):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM messages WHERE (sender_type=? AND sender_id=?) OR (receiver_type=? AND receiver_id=?) ORDER BY created_at DESC LIMIT 100",
        (user_type, user_id, user_type, user_id),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/messages")
def send_message(req: MessageReq, sender_type: str = Query("doctor"), sender_id: str = Query("")):
    mid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    conn = get_db()
    conn.execute(
        "INSERT INTO messages (id, sender_type, sender_id, receiver_type, receiver_id, subject, body, created_at) VALUES (?,?,?,?,?,?,?,?)",
        (mid, sender_type, sender_id, req.receiver_type, req.receiver_id, req.subject, req.body, now),
    )
    _notify(conn, req.receiver_type, req.receiver_id, f"New message: {req.subject or 'No subject'}", req.body[:100], "message")
    conn.commit()
    conn.close()
    return {"id": mid}

@app.put("/api/messages/{message_id}/read")
def mark_message_read(message_id: str):
    conn = get_db()
    conn.execute("UPDATE messages SET is_read=1 WHERE id=?", (message_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


# ── Notifications ────────────────────────────────────────────

def _notify(conn, user_type: str, user_id: str, title: str, body: str = "", category: str = "info", link: str = ""):
    nid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        "INSERT INTO notifications (id, user_type, user_id, title, body, category, link, created_at) VALUES (?,?,?,?,?,?,?,?)",
        (nid, user_type, user_id, title, body, category, link, now),
    )

@app.get("/api/notifications")
def list_notifications(user_type: str = Query("doctor"), user_id: str = Query(""), unread_only: bool = Query(False)):
    conn = get_db()
    query = "SELECT * FROM notifications WHERE user_type=? AND user_id=?"
    params = [user_type, user_id]
    if unread_only:
        query += " AND is_read=0"
    query += " ORDER BY created_at DESC LIMIT 50"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.put("/api/notifications/{notification_id}/read")
def mark_notification_read(notification_id: str):
    conn = get_db()
    conn.execute("UPDATE notifications SET is_read=1 WHERE id=?", (notification_id,))
    conn.commit()
    conn.close()
    return {"ok": True}

@app.put("/api/notifications/read-all")
def mark_all_notifications_read(user_type: str = Query("doctor"), user_id: str = Query("")):
    conn = get_db()
    conn.execute("UPDATE notifications SET is_read=1 WHERE user_type=? AND user_id=?", (user_type, user_id))
    conn.commit()
    conn.close()
    return {"ok": True}


# ── Drug Interactions ────────────────────────────────────────

@app.get("/api/drug-interactions")
def list_drug_interactions():
    conn = get_db()
    rows = conn.execute("SELECT * FROM drug_interactions ORDER BY severity DESC, drug_a").fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/drug-interactions/check")
def check_drug_interactions(drugs: str = Query("")):
    drug_list = [d.strip().lower() for d in drugs.split(",") if d.strip()]
    if len(drug_list) < 2:
        return {"interactions": [], "checked": drug_list}
    conn = get_db()
    rows = conn.execute("SELECT * FROM drug_interactions").fetchall()
    conn.close()
    found = []
    for r in rows:
        d = dict(r)
        a_lower = d["drug_a"].lower()
        b_lower = d["drug_b"].lower()
        for i, da in enumerate(drug_list):
            for db in drug_list[i+1:]:
                if (da in a_lower and db in b_lower) or (db in a_lower and da in b_lower) or \
                   (a_lower in da and b_lower in db) or (b_lower in da and a_lower in db):
                    found.append(d)
    return {"interactions": found, "checked": drug_list}


# ── ICD-10 Codes ─────────────────────────────────────────────

@app.get("/api/icd10")
def search_icd10(q: str = Query("")):
    conn = get_db()
    if q:
        rows = conn.execute(
            "SELECT * FROM icd10_codes WHERE code LIKE ? OR description LIKE ? ORDER BY code LIMIT 30",
            (f"%{q}%", f"%{q}%"),
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM icd10_codes ORDER BY code LIMIT 50").fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/patient/{patient_id}/diagnoses")
def list_diagnoses(patient_id: str):
    conn = get_db()
    rows = conn.execute("SELECT * FROM diagnosis_codes WHERE patient_id=? ORDER BY diagnosed_at DESC", (patient_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/patient/{patient_id}/diagnoses")
def add_diagnosis(patient_id: str, req: DiagnosisCodeReq):
    did = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    conn = get_db()
    conn.execute(
        "INSERT INTO diagnosis_codes (id, patient_id, code, description, diagnosed_at, notes, created_at) VALUES (?,?,?,?,?,?,?)",
        (did, patient_id, req.code, req.description, now, req.notes, now),
    )
    conn.commit()
    conn.close()
    return {"id": did}

@app.delete("/api/diagnoses/{diagnosis_id}")
def delete_diagnosis(diagnosis_id: str):
    conn = get_db()
    conn.execute("DELETE FROM diagnosis_codes WHERE id=?", (diagnosis_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


# ── Referrals ────────────────────────────────────────────────

@app.get("/api/patient/{patient_id}/referrals")
def list_referrals(patient_id: str):
    conn = get_db()
    rows = conn.execute("SELECT * FROM referrals WHERE patient_id=? ORDER BY created_at DESC", (patient_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/referrals")
def create_referral(req: ReferralReq):
    rid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    conn = get_db()
    conn.execute(
        "INSERT INTO referrals (id, patient_id, from_doctor_name, to_specialty, to_doctor_name, reason, urgency, status, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        (rid, req.patient_id, req.from_doctor_name, req.to_specialty, req.to_doctor_name, req.reason, req.urgency, "pending", req.notes, now),
    )
    conn.commit()
    conn.close()
    return {"id": rid}

@app.put("/api/referrals/{referral_id}/status")
def update_referral_status(referral_id: str, status: str = Query(...)):
    conn = get_db()
    conn.execute("UPDATE referrals SET status=? WHERE id=?", (status, referral_id))
    conn.commit()
    conn.close()
    return {"ok": True}


# ── Templates ────────────────────────────────────────────────

@app.get("/api/templates")
def list_templates(template_type: str = Query(None)):
    conn = get_db()
    if template_type:
        rows = conn.execute("SELECT * FROM templates WHERE template_type=? ORDER BY name", (template_type,)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM templates ORDER BY template_type, name").fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["content"] = json.loads(d["content"]) if isinstance(d["content"], str) else d["content"]
        result.append(d)
    return result

@app.post("/api/templates")
def create_template(req: TemplateReq):
    tid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    conn = get_db()
    conn.execute(
        "INSERT INTO templates (id, template_type, name, content, created_at) VALUES (?,?,?,?,?)",
        (tid, req.template_type, req.name, json.dumps(req.content), now),
    )
    conn.commit()
    conn.close()
    return {"id": tid}

@app.delete("/api/templates/{template_id}")
def delete_template(template_id: str):
    conn = get_db()
    conn.execute("DELETE FROM templates WHERE id=?", (template_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


# ── Invoices / Billing ───────────────────────────────────────

@app.get("/api/patient/{patient_id}/invoices")
def list_invoices(patient_id: str):
    conn = get_db()
    rows = conn.execute("SELECT * FROM invoices WHERE patient_id=? ORDER BY created_at DESC", (patient_id,)).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["items"] = json.loads(d["items"]) if isinstance(d["items"], str) else d["items"]
        result.append(d)
    return result

@app.post("/api/invoices")
def create_invoice(req: InvoiceReq):
    iid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    conn = get_db()
    conn.execute(
        "INSERT INTO invoices (id, patient_id, items, subtotal, tax, total, notes, created_at) VALUES (?,?,?,?,?,?,?,?)",
        (iid, req.patient_id, json.dumps(req.items), req.subtotal, req.tax, req.total, req.notes, now),
    )
    conn.commit()
    conn.close()
    return {"id": iid}

@app.put("/api/invoices/{invoice_id}/status")
def update_invoice_status(invoice_id: str, status: str = Query(...)):
    conn = get_db()
    conn.execute("UPDATE invoices SET status=? WHERE id=?", (status, invoice_id))
    conn.commit()
    conn.close()
    return {"ok": True}


# ── Insurance ────────────────────────────────────────────────

@app.get("/api/patient/{patient_id}/insurance")
def list_insurance(patient_id: str):
    conn = get_db()
    rows = conn.execute("SELECT * FROM insurance WHERE patient_id=? ORDER BY created_at DESC", (patient_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/patient/{patient_id}/insurance")
def add_insurance(patient_id: str, req: InsuranceReq):
    iid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    conn = get_db()
    conn.execute(
        "INSERT INTO insurance (id, patient_id, provider_name, policy_number, group_number, subscriber_name, relationship, effective_date, expiry_date, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        (iid, patient_id, req.provider_name, req.policy_number, req.group_number, req.subscriber_name, req.relationship, req.effective_date, req.expiry_date, now),
    )
    conn.commit()
    conn.close()
    return {"id": iid}

@app.delete("/api/insurance/{insurance_id}")
def delete_insurance(insurance_id: str):
    conn = get_db()
    conn.execute("DELETE FROM insurance WHERE id=?", (insurance_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


# ── Doctor Profile ───────────────────────────────────────────

@app.get("/api/doctor/profile")
def get_doctor_profile(doctor_id: str = Query("")):
    conn = get_db()
    row = conn.execute("SELECT * FROM doctors WHERE id=?", (doctor_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, "Doctor not found")
    d = dict(row)
    d.pop("password_hash", None)
    return d

@app.put("/api/doctor/profile")
def update_doctor_profile(req: DoctorProfileReq, doctor_id: str = Query("")):
    conn = get_db()
    conn.execute(
        "UPDATE doctors SET name=?, specialization=?, license_number=?, email=? WHERE id=?",
        (req.name, req.specialization, req.license_number, req.email, doctor_id),
    )
    conn.commit()
    conn.close()
    return {"ok": True}


# ── Audit Log ────────────────────────────────────────────────

def _audit(conn, actor_type: str, actor_id: str, action: str, resource_type: str = "", resource_id: str = "", details: str = ""):
    aid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        "INSERT INTO audit_log (id, actor_type, actor_id, action, resource_type, resource_id, details, created_at) VALUES (?,?,?,?,?,?,?,?)",
        (aid, actor_type, actor_id, action, resource_type, resource_id, details, now),
    )

@app.get("/api/audit-log")
def get_audit_log(limit: int = Query(100)):
    conn = get_db()
    rows = conn.execute("SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── Export / Print ───────────────────────────────────────────

@app.get("/api/patient/{patient_id}/export")
def export_patient_data(patient_id: str):
    conn = get_db()
    patient = conn.execute("SELECT * FROM patients WHERE id=?", (patient_id,)).fetchone()
    if not patient:
        conn.close()
        raise HTTPException(404, "Patient not found")
    p = dict(patient)
    p.pop("password_hash", None)

    allergies = [dict(r) for r in conn.execute("SELECT * FROM allergies WHERE patient_id=?", (patient_id,)).fetchall()]
    conditions = [dict(r) for r in conn.execute("SELECT * FROM conditions WHERE patient_id=?", (patient_id,)).fetchall()]
    medications = [dict(r) for r in conn.execute("SELECT * FROM medications WHERE patient_id=?", (patient_id,)).fetchall()]
    vitals = [dict(r) for r in conn.execute("SELECT * FROM vitals WHERE patient_id=? ORDER BY recorded_at DESC LIMIT 20", (patient_id,)).fetchall()]
    prescriptions = [dict(r) for r in conn.execute("SELECT * FROM prescriptions WHERE patient_id=?", (patient_id,)).fetchall()]
    for rx in prescriptions:
        rx["items"] = json.loads(rx["items"]) if isinstance(rx["items"], str) else rx["items"]
    notes = [dict(r) for r in conn.execute("SELECT * FROM clinical_notes WHERE patient_id=?", (patient_id,)).fetchall()]
    labs = [dict(r) for r in conn.execute("SELECT * FROM lab_results WHERE patient_id=?", (patient_id,)).fetchall()]
    appointments = [dict(r) for r in conn.execute("SELECT * FROM appointments WHERE patient_id=?", (patient_id,)).fetchall()]
    diagnoses = [dict(r) for r in conn.execute("SELECT * FROM diagnosis_codes WHERE patient_id=?", (patient_id,)).fetchall()]
    referrals_list = [dict(r) for r in conn.execute("SELECT * FROM referrals WHERE patient_id=?", (patient_id,)).fetchall()]
    invoices_list = [dict(r) for r in conn.execute("SELECT * FROM invoices WHERE patient_id=?", (patient_id,)).fetchall()]
    for inv in invoices_list:
        inv["items"] = json.loads(inv["items"]) if isinstance(inv["items"], str) else inv["items"]
    insurance_list = [dict(r) for r in conn.execute("SELECT * FROM insurance WHERE patient_id=?", (patient_id,)).fetchall()]
    conn.close()

    return {
        "patient": p,
        "allergies": allergies,
        "conditions": conditions,
        "medications": medications,
        "vitals": vitals,
        "prescriptions": prescriptions,
        "clinical_notes": notes,
        "lab_results": labs,
        "appointments": appointments,
        "diagnoses": diagnoses,
        "referrals": referrals_list,
        "invoices": invoices_list,
        "insurance": insurance_list,
        "exported_at": datetime.now(timezone.utc).isoformat(),
    }


# ── FHIR-Compatible Export ────────────────────────────────────

@app.get("/api/patient/{patient_id}/fhir")
def export_fhir(patient_id: str):
    conn = get_db()
    patient = conn.execute("SELECT * FROM patients WHERE id=?", (patient_id,)).fetchone()
    if not patient:
        conn.close()
        raise HTTPException(404, "Patient not found")
    p = dict(patient)
    allergies = [dict(r) for r in conn.execute("SELECT * FROM allergies WHERE patient_id=?", (patient_id,)).fetchall()]
    conditions = [dict(r) for r in conn.execute("SELECT * FROM conditions WHERE patient_id=?", (patient_id,)).fetchall()]
    medications = [dict(r) for r in conn.execute("SELECT * FROM medications WHERE patient_id=?", (patient_id,)).fetchall()]
    vitals = [dict(r) for r in conn.execute("SELECT * FROM vitals WHERE patient_id=? ORDER BY recorded_at DESC LIMIT 5", (patient_id,)).fetchall()]
    conn.close()

    gender_map = {"male": "male", "female": "female", "m": "male", "f": "female"}
    fhir_bundle = {
        "resourceType": "Bundle",
        "type": "document",
        "entry": [
            {
                "resource": {
                    "resourceType": "Patient",
                    "id": p["id"],
                    "name": [{"use": "official", "text": p.get("name", "")}],
                    "telecom": [{"system": "phone", "value": p["phone"]}],
                    "gender": gender_map.get((p.get("gender") or "").lower(), "unknown"),
                    "birthDate": p.get("date_of_birth", ""),
                }
            }
        ] + [
            {
                "resource": {
                    "resourceType": "AllergyIntolerance",
                    "id": a["id"],
                    "patient": {"reference": f"Patient/{patient_id}"},
                    "code": {"text": a["allergen"]},
                    "criticality": "high" if a.get("severity") == "severe" else "low",
                    "recordedDate": a.get("noted_at", ""),
                }
            } for a in allergies
        ] + [
            {
                "resource": {
                    "resourceType": "Condition",
                    "id": c["id"],
                    "subject": {"reference": f"Patient/{patient_id}"},
                    "code": {"text": c["name"]},
                    "clinicalStatus": {"coding": [{"code": c.get("status", "active")}]},
                }
            } for c in conditions
        ] + [
            {
                "resource": {
                    "resourceType": "MedicationStatement",
                    "id": m["id"],
                    "subject": {"reference": f"Patient/{patient_id}"},
                    "medicationCodeableConcept": {"text": m["name"]},
                    "dosage": [{"text": f"{m.get('dosage', '')} {m.get('frequency', '')}".strip()}],
                    "status": "active" if m.get("status") == "active" else "stopped",
                }
            } for m in medications
        ] + [
            {
                "resource": {
                    "resourceType": "Observation",
                    "id": v["id"],
                    "subject": {"reference": f"Patient/{patient_id}"},
                    "effectiveDateTime": v.get("recorded_at", ""),
                    "component": [
                        comp for comp in [
                            {"code": {"text": "Systolic Blood Pressure"}, "valueQuantity": {"value": v["systolic"], "unit": "mmHg"}} if v.get("systolic") else None,
                            {"code": {"text": "Diastolic Blood Pressure"}, "valueQuantity": {"value": v["diastolic"], "unit": "mmHg"}} if v.get("diastolic") else None,
                            {"code": {"text": "Heart Rate"}, "valueQuantity": {"value": v["heart_rate"], "unit": "bpm"}} if v.get("heart_rate") else None,
                            {"code": {"text": "Body Temperature"}, "valueQuantity": {"value": v["temperature"], "unit": "°F"}} if v.get("temperature") else None,
                            {"code": {"text": "SpO2"}, "valueQuantity": {"value": v["spo2"], "unit": "%"}} if v.get("spo2") else None,
                        ] if comp is not None
                    ],
                }
            } for v in vitals
        ],
    }
    return fhir_bundle


# ── Analytics Dashboard ───────────────────────────────────────

@app.get("/api/analytics")
def get_analytics():
    conn = get_db()
    patients_count = conn.execute("SELECT COUNT(*) as c FROM patients").fetchone()["c"]
    reports_count = conn.execute("SELECT COUNT(*) as c FROM reports").fetchone()["c"]
    analyzed_count = conn.execute("SELECT COUNT(*) as c FROM reports WHERE analyzed=1").fetchone()["c"]
    appointments_today = conn.execute(
        "SELECT COUNT(*) as c FROM appointments WHERE date(scheduled_at) = date('now') AND status='scheduled'"
    ).fetchone()["c"]
    appointments_upcoming = conn.execute(
        "SELECT COUNT(*) as c FROM appointments WHERE scheduled_at > datetime('now') AND status='scheduled'"
    ).fetchone()["c"]
    prescriptions_count = conn.execute("SELECT COUNT(*) as c FROM prescriptions").fetchone()["c"]
    vitals_count = conn.execute("SELECT COUNT(*) as c FROM vitals").fetchone()["c"]
    lab_count = conn.execute("SELECT COUNT(*) as c FROM lab_results").fetchone()["c"]

    recent_patients = conn.execute(
        "SELECT id, name, phone, created_at FROM patients ORDER BY created_at DESC LIMIT 5"
    ).fetchall()
    recent_appointments = conn.execute(
        "SELECT a.*, p.name as patient_name FROM appointments a JOIN patients p ON a.patient_id = p.id ORDER BY a.scheduled_at DESC LIMIT 5"
    ).fetchall()

    conn.close()
    return {
        "patients": patients_count,
        "reports": reports_count,
        "analyzed": analyzed_count,
        "pending_reports": reports_count - analyzed_count,
        "appointments_today": appointments_today,
        "appointments_upcoming": appointments_upcoming,
        "prescriptions": prescriptions_count,
        "vitals_recorded": vitals_count,
        "lab_results": lab_count,
        "recent_patients": [dict(r) for r in recent_patients],
        "recent_appointments": [dict(r) for r in recent_appointments],
    }


# ── Provider CRUD ─────────────────────────────────────────────

@app.get("/api/providers")
def list_providers():
    conn = get_db()
    rows = conn.execute("SELECT * FROM providers ORDER BY kind, name").fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["config"] = json.loads(d["config"])
        cfg = d["config"]
        if "api_key" in cfg and cfg["api_key"]:
            cfg["api_key"] = cfg["api_key"][:6] + "..." + cfg["api_key"][-4:] if len(cfg["api_key"]) > 10 else "***"
        result.append(d)
    return result

@app.post("/api/providers")
def create_provider(req: ProviderReq):
    if req.kind not in ("ocr", "ai"):
        raise HTTPException(400, "kind must be 'ocr' or 'ai'")
    pid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    conn = get_db()
    if req.is_default:
        conn.execute("UPDATE providers SET is_default=0 WHERE kind=?", (req.kind,))
    conn.execute(
        "INSERT INTO providers (id, kind, name, engine, config, is_default, created_at) VALUES (?,?,?,?,?,?,?)",
        (pid, req.kind, req.name, req.engine, json.dumps(req.config), 1 if req.is_default else 0, now),
    )
    conn.commit()
    conn.close()
    return {"id": pid}

@app.put("/api/providers/{provider_id}")
def update_provider(provider_id: str, req: ProviderReq):
    conn = get_db()
    if req.is_default:
        conn.execute("UPDATE providers SET is_default=0 WHERE kind=?", (req.kind,))
    conn.execute(
        "UPDATE providers SET name=?, engine=?, config=?, is_default=? WHERE id=?",
        (req.name, req.engine, json.dumps(req.config), 1 if req.is_default else 0, provider_id),
    )
    conn.commit()
    conn.close()
    return {"ok": True}

@app.delete("/api/providers/{provider_id}")
def delete_provider(provider_id: str):
    conn = get_db()
    conn.execute("DELETE FROM providers WHERE id=?", (provider_id,))
    conn.commit()
    conn.close()
    return {"ok": True}

@app.get("/api/providers/engines")
def list_engines():
    return {
        "ocr": [
            {"id": "pymupdf", "name": "PyMuPDF (Built-in)", "fields": []},
            {"id": "tesseract", "name": "Tesseract OCR", "fields": [{"key": "lang", "label": "Language", "placeholder": "eng", "required": False}]},
            {"id": "custom_http", "name": "Custom HTTP Endpoint", "fields": [
                {"key": "endpoint", "label": "Endpoint URL", "placeholder": "https://your-ocr.com/extract", "required": True},
                {"key": "api_key", "label": "API Key", "placeholder": "optional", "required": False, "secret": True},
            ]},
        ],
        "ai": [
            {"id": "gemini", "name": "Google Gemini", "fields": [
                {"key": "api_key", "label": "API Key", "placeholder": "AIza...", "required": True, "secret": True},
                {"key": "model", "label": "Model", "placeholder": "gemini-2.0-flash", "required": False},
            ]},
            {"id": "openai", "name": "OpenAI / Compatible", "fields": [
                {"key": "api_key", "label": "API Key", "placeholder": "sk-...", "required": True, "secret": True},
                {"key": "model", "label": "Model", "placeholder": "gpt-4o", "required": False},
                {"key": "base_url", "label": "Base URL", "placeholder": "https://api.openai.com/v1", "required": False},
            ]},
            {"id": "ollama", "name": "Ollama (Local)", "fields": [
                {"key": "model", "label": "Model", "placeholder": "llava", "required": False},
                {"key": "base_url", "label": "Base URL", "placeholder": "http://localhost:11434", "required": False},
            ]},
            {"id": "custom_openai", "name": "Custom Endpoint (OpenAI-compatible)", "fields": [
                {"key": "endpoint", "label": "Endpoint URL", "placeholder": "https://your-api.com/v1/chat/completions", "required": True},
                {"key": "api_key", "label": "API Key", "placeholder": "optional", "required": False, "secret": True},
                {"key": "model", "label": "Model", "placeholder": "optional", "required": False},
            ]},
        ],
    }


# ── OCR + Analysis (pluggable) ───────────────────────────────

def _get_provider_row(conn: sqlite3.Connection, provider_id: str, kind: str) -> dict:
    if provider_id:
        row = conn.execute("SELECT * FROM providers WHERE id=? AND kind=?", (provider_id, kind)).fetchone()
        if row:
            return dict(row)
    row = conn.execute("SELECT * FROM providers WHERE kind=? AND is_default=1", (kind,)).fetchone()
    if row:
        return dict(row)
    return {}

def _extract_images(filepath: str, filetype: str) -> list[bytes]:
    if filetype == "image":
        return [Path(filepath).read_bytes()]
    doc = fitz.open(filepath)
    images = [page.get_pixmap(dpi=200).tobytes("png") for page in doc]
    doc.close()
    return images

MEDICAL_PROMPT = (
    "You are a medical document analyst. Analyze this medical report thoroughly.\n"
    "1. Extract ALL text (OCR if needed).\n"
    "2. Identify the type of report (blood test, X-ray, MRI, prescription, etc.).\n"
    "3. List all findings, values, and observations.\n"
    "4. Flag any abnormal values or concerning findings.\n"
    "5. Provide a brief summary for the doctor.\n\n"
    "Format your response as:\n"
    "## Extracted Text\n<full text>\n\n"
    "## Report Type\n<type>\n\n"
    "## Key Findings\n<findings>\n\n"
    "## Abnormal Values\n<abnormals>\n\n"
    "## Summary\n<summary>"
)

@app.post("/api/doctor/analyze")
def analyze_report(req: AnalyzeReq):
    conn = get_db()
    row = conn.execute("SELECT * FROM reports WHERE id=?", (req.report_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Report not found")
    filepath = row["filepath"]
    filetype = row["filetype"]

    ocr_row = _get_provider_row(conn, req.ocr_provider_id, "ocr")
    if ocr_row:
        ocr_config = json.loads(ocr_row["config"]) if isinstance(ocr_row["config"], str) else ocr_row["config"]
        ocr = build_ocr(ocr_row["engine"], ocr_config)
    else:
        ocr = PyMuPDFOCR()

    ai_row = _get_provider_row(conn, req.ai_provider_id, "ai")
    if ai_row:
        ai_config = json.loads(ai_row["config"]) if isinstance(ai_row["config"], str) else ai_row["config"]
        ai = build_ai(ai_row["engine"], ai_config)
    elif req.api_key:
        ai = GeminiProvider(api_key=req.api_key)
    else:
        conn.close()
        raise HTTPException(400, "No AI provider configured. Add one in Settings or pass an api_key.")

    try:
        ocr_text = ocr.extract_text(filepath, filetype)
        images = _extract_images(filepath, filetype)
        analysis = ai.analyze(MEDICAL_PROMPT, ocr_text, images)
        conn.execute("UPDATE reports SET ocr_text=?, analysis=?, analyzed=1 WHERE id=?", (ocr_text, analysis, req.report_id))
        conn.commit()
        conn.close()
        return {"analysis": analysis, "ocr_text": ocr_text}
    except HTTPException:
        conn.close()
        raise
    except Exception as e:
        conn.close()
        raise HTTPException(500, f"Analysis failed: {e}")


# ── Serve frontend ───────────────────────────────────────────
FRONTEND_DIST = Path(os.getenv("MEDVAULT_STATIC_DIR", str(Path(__file__).parent.parent / "frontend" / "dist")))
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="spa")
