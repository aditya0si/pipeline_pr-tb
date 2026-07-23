# Post-Extraction Hepatology Diagnosis Module

> **Intern Guide** | Domain: Hepatology (Liver Disease) | Focus: Structured JSON → Clinical Diagnosis → Evidence-Based Report

---

## 📋 Table of Contents

1. [Module Overview](#1-module-overview)
2. [What is Post-Extraction Processing?](#2-what-is-post-extraction-processing)
3. [Architecture of the Diagnosis Engine](#3-architecture-of-the-diagnosis-engine)
4. [Stage A — Abnormality Detection & Pattern Recognition](#4-stage-a--abnormality-detection--pattern-recognition)
5. [Stage B — Differential Diagnosis Generation](#5-stage-b--differential-diagnosis-generation)
6. [Stage C — Open-Source Model Clinical Reasoning](#6-stage-c--open-source-model-clinical-reasoning)
7. [Stage D — Diagnosis Report Generation](#7-stage-d--diagnosis-report-generation)
8. [Hepatology Knowledge Base](#8-hepatology-knowledge-base)
9. [Diagnostic Patterns Reference Table](#9-diagnostic-patterns-reference-table)
10. [MELD Score & Child-Pugh Calculator](#10-meld-score--child-pugh-calculator)
11. [Project Structure for This Module](#11-project-structure-for-this-module)
12. [Code Implementation Tasks](#12-code-implementation-tasks)
13. [Testing Guidelines](#13-testing-guidelines)
14. [Ethical & Safety Guardrails](#14-ethical--safety-guardrails)
15. [Resources & References](#15-resources--references)

---

## 1. Module Overview

This module sits **after** the OCR extraction pipeline. It receives the structured JSON produced by the extraction stage and performs clinical analysis focused on the **Hepatology** department.

### Input

The validated JSON object from Stage 4 of the pipeline:

```json
{
  "lab_results": [
    { "test_name": "ALT", "value": 245, "unit": "U/L", "flag": "HIGH", ... },
    { "test_name": "AST", "value": 310, "unit": "U/L", "flag": "HIGH", ... },
    { "test_name": "Total Bilirubin", "value": 4.1, "unit": "mg/dL", "flag": "HIGH", ... },
    { "test_name": "Albumin", "value": 2.8, "unit": "g/dL", "flag": "LOW", ... },
    { "test_name": "INR", "value": 1.9, "unit": "", "flag": "HIGH", ... }
  ]
}
```

### Output

A structured clinical diagnosis report:

```json
{
  "abnormal_findings": [...],
  "pattern_analysis": {
    "hepatocellular_pattern": true,
    "cholestatic_pattern": false,
    "mixed_pattern": false
  },
  "differential_diagnoses": [
    {
      "condition": "Acute Hepatitis B",
      "probability": "HIGH",
      "supporting_evidence": [...],
      "recommended_tests": [...]
    }
  ],
  "severity_scores": {
    "meld_score": 18,
    "child_pugh_class": "B",
    "child_pugh_score": 8
  },
  "clinical_recommendations": [...],
  "references": [...]
}
```

---

## 2. What is Post-Extraction Processing?

Once the OCR pipeline extracts raw lab values from the image, the **diagnosis module** performs the following clinical reasoning steps:

```
┌────────────────────────────────────────────────────────────────┐
│               EXTRACTED JSON (from OCR Pipeline)               │
└──────────────────────────┬─────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────┐
│  STAGE A — Abnormality Detection & Pattern Analysis            │
│  • Flag HIGH / LOW / CRITICAL values                           │
│  • Identify hepatocellular vs cholestatic pattern              │
│  • Compute AST/ALT ratio (De Ritis ratio)                      │
└──────────────────────────┬─────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────┐
│  STAGE B — Rule-Based Differential Diagnosis                   │
│  • Match patterns against Hepatology knowledge base            │
│  • Prioritise most likely conditions                           │
│  • Flag urgent / critical findings                             │
└──────────────────────────┬─────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────┐
│  STAGE C — Open-Source Model Clinical Reasoning                │
│  • Load local open-source model (no API key needed)            │
│  • Send findings + knowledge base context as prompt            │
│  • Generate differential narrative with citations              │
└──────────────────────────┬─────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────┐
│  STAGE D — Final Report Generation                             │
│  • Structured JSON diagnosis report                            │
│  • Human-readable clinical summary                             │
│  • Recommended next investigations                             │
└────────────────────────────────────────────────────────────────┘
```

---

## 3. Architecture of the Diagnosis Engine

### 3.1 Module Diagram

```
diagnosis/
├── engine.py               ← Orchestrates all stages A→D
├── hepatology_kb.py        ← Knowledge base (patterns + conditions)
├── pattern_analyser.py     ← Stage A: flag + pattern detection
├── rule_engine.py          ← Stage B: rule-based differential
├── model_reasoner.py       ← Stage C: open-source model reasoning + citations
└── report_generator.py     ← Stage D: JSON + narrative report
```

### 3.2 Entry Point

```python
# diagnosis/engine.py

def run_diagnosis(lab_json: dict) -> dict:
    """
    Master function.
    Input : validated lab JSON from extraction stage
    Output: full diagnosis report JSON
    """
    findings      = analyse_patterns(lab_json)
    differentials = apply_rules(findings)
    reasoned      = model_reason(findings, differentials)
    report        = generate_report(reasoned)
    return report
```

---

## 4. Stage A — Abnormality Detection & Pattern Recognition

### 4.1 Your Task

Write a `pattern_analyser.py` module that:

1. Reads every `lab_result` from the input JSON.
2. Compares each value against the Hepatology reference ranges.
3. Classifies the overall **injury pattern** (see table below).
4. Computes derived ratios that are clinically important.

### 4.2 Injury Patterns in Hepatology

| Pattern | Key Markers | Interpretation |
|---|---|---|
| **Hepatocellular** | ALT/AST markedly elevated (> 3× ULN), ALP mildly elevated | Hepatocyte destruction — virus, alcohol, toxin, ischaemia |
| **Cholestatic** | ALP/GGT markedly elevated, bilirubin elevated, ALT/AST mildly elevated | Bile flow obstruction — stones, stricture, PBC, PSC |
| **Mixed** | Both ALT/AST and ALP elevated > 3× ULN | Drug-induced liver injury (DILI), sepsis-related |
| **Isolated Hyperbilirubinaemia** | Bilirubin elevated, LFTs normal | Gilbert's syndrome, haemolysis |
| **Synthetic Dysfunction** | Low albumin, elevated INR/PT | Chronic liver disease, fulminant hepatic failure |

**R-Factor calculation (DILI Network standard):**

```
R = (ALT / ALT_ULN) / (ALP / ALP_ULN)

R > 5    → Hepatocellular pattern
R < 2    → Cholestatic pattern
2 ≤ R ≤ 5 → Mixed pattern
```

### 4.3 Derived Ratios to Compute

| Ratio | Formula | Clinical Use |
|---|---|---|
| **De Ritis Ratio** | AST / ALT | > 2 suggests alcoholic hepatitis or cirrhosis |
| **R-Factor** | (ALT/ALT_ULN) / (ALP/ALP_ULN) | Pattern classification (DILI, cholestasis) |
| **Bilirubin/Albumin** | T.Bil / Albumin | Severity in chronic disease |
| **INR × Bilirubin** | INR × Bilirubin | Component of MELD score |

### 4.4 Implementation Skeleton

```python
# diagnosis/pattern_analyser.py

from extraction.reference_ranges import HEPATOLOGY_REFERENCE_RANGES

def analyse_patterns(lab_json: dict) -> dict:
    """
    Returns:
    {
      "abnormal_results": [
          {"test": "ALT", "value": 245, "flag": "HIGH", "fold_over_ulN": 4.4}
      ],
      "hepatocellular_pattern": True,
      "cholestatic_pattern": False,
      "mixed_pattern": False,
      "synthetic_dysfunction": True,
      "de_ritis_ratio": 1.26,
      "r_factor": 8.2,
      "urgent_flags": ["INR > 1.5 — evaluate acute liver failure"]
    }
    """
```

---

## 5. Stage B — Differential Diagnosis Generation

### 5.1 Your Task

Write a `rule_engine.py` that maps identified patterns to a ranked list of differential diagnoses using the knowledge base in `hepatology_kb.py`.

### 5.2 Rule Examples (to implement as code)

```python
# diagnosis/rule_engine.py

RULES = [
    {
        "condition": "Acute Viral Hepatitis (A, B, E)",
        "required_pattern": "hepatocellular",
        "supporting_markers": ["ALT > 10× ULN", "AST elevated"],
        "De_Ritis_threshold": "< 1.0",
        "probability_weight": 0.85,
        "reference": "Sherlock 13th Ed., Ch. 14 — Viral Hepatitis",
        "urgent": False
    },
    {
        "condition": "Alcoholic Hepatitis",
        "required_pattern": "hepatocellular",
        "supporting_markers": ["AST elevated", "GGT elevated"],
        "De_Ritis_threshold": "> 2.0",
        "probability_weight": 0.80,
        "reference": "Sherlock 13th Ed., Ch. 24 — Alcohol and the Liver",
        "urgent": False
    },
    {
        "condition": "Acute Liver Failure",
        "required_pattern": "hepatocellular",
        "supporting_markers": ["INR > 1.5", "Bilirubin > 5 mg/dL", "Encephalopathy markers"],
        "De_Ritis_threshold": "any",
        "probability_weight": 0.90,
        "reference": "AASLD 2022 ALF Guidelines",
        "urgent": True
    },
    {
        "condition": "Primary Biliary Cholangitis (PBC)",
        "required_pattern": "cholestatic",
        "supporting_markers": ["ALP > 3× ULN", "GGT elevated", "AMA positive"],
        "De_Ritis_threshold": "< 1.0",
        "probability_weight": 0.75,
        "reference": "Sherlock 13th Ed., Ch. 13 — Bile Duct Diseases",
        "urgent": False
    },
    {
        "condition": "Obstructive Jaundice (Choledocholithiasis)",
        "required_pattern": "cholestatic",
        "supporting_markers": ["Direct Bilirubin > 60% of Total", "ALP > 3× ULN"],
        "De_Ritis_threshold": "any",
        "probability_weight": 0.80,
        "reference": "Sherlock 13th Ed., Ch. 30 — Biliary Obstruction",
        "urgent": False
    },
    {
        "condition": "Non-Alcoholic Fatty Liver Disease (NAFLD/NASH)",
        "required_pattern": "hepatocellular",
        "supporting_markers": ["ALT mildly elevated (1–3× ULN)", "De Ritis ratio < 1"],
        "De_Ritis_threshold": "0.8 – 1.0",
        "probability_weight": 0.65,
        "reference": "AASLD 2023 NAFLD Practice Guidance",
        "urgent": False
    },
    {
        "condition": "Wilson's Disease",
        "required_pattern": "mixed",
        "supporting_markers": ["Low ceruloplasmin", "Elevated copper", "Kayser-Fleischer rings"],
        "De_Ritis_threshold": "any",
        "probability_weight": 0.55,
        "reference": "Sherlock 13th Ed., Ch. 22 — Wilson's Disease",
        "urgent": False
    },
    {
        "condition": "Decompensated Liver Cirrhosis",
        "required_pattern": "synthetic_dysfunction",
        "supporting_markers": ["Albumin < 3.0 g/dL", "INR > 1.5", "Bilirubin elevated"],
        "De_Ritis_threshold": "> 2.0",
        "probability_weight": 0.85,
        "reference": "AASLD 2022 Cirrhosis Practice Guidance; Child-Pugh & MELD",
        "urgent": True
    }
]
```

### 5.3 Output Format

```python
def apply_rules(findings: dict) -> list[dict]:
    """
    Returns list of differentials sorted by probability (descending):
    [
      {
        "rank": 1,
        "condition": "Acute Viral Hepatitis",
        "probability": "HIGH",
        "supporting_evidence": ["ALT 4.4× ULN", "De Ritis ratio 0.79"],
        "against_evidence": [],
        "recommended_tests": ["HBsAg", "Anti-HBc IgM", "Anti-HAV IgM", "Anti-HEV IgM"],
        "reference": "Sherlock 13th Ed., Ch. 14",
        "urgent": False
      },
      ...
    ]
    """
```

---

## 6. Stage C — Open-Source Model Clinical Reasoning

### 6.1 Your Task

Write a `model_reasoner.py` that loads an **open-source model locally** (no API key, no external service), passes the pattern findings and rule-based differentials as a structured prompt, and gets back a detailed, referenced clinical reasoning narrative.

All models below run entirely on-device via **HuggingFace Transformers** or **llama-cpp-python** — nothing is sent to any external server.

### 6.2 Recommended Open-Source Models

Choose **one** of the following based on your available hardware. All are free, no API key required:

| Model | HuggingFace ID | RAM needed | Runs on CPU? | Best for |
|---|---|---|---|---|
| **BioMistral-7B** (recommended) | `BioMistral/BioMistral-7B` | ~14 GB | Yes (slow) | Medical domain pre-trained, strong clinical reasoning |
| **Meditron-7B** | `epfl-llm/meditron-7b` | ~14 GB | Yes (slow) | Fine-tuned on medical guidelines (AASLD/WHO) |
| **Mistral-7B-Instruct-v0.3** | `mistralai/Mistral-7B-Instruct-v0.3` | ~14 GB | Yes (slow) | Strong general reasoning, good instruction follow |
| **Llama-3.2-3B-Instruct** | `meta-llama/Llama-3.2-3B-Instruct` | ~7 GB | Yes (fast) | Lightweight fallback, CPU-friendly |
| **BioMistral-7B GGUF (4-bit)** | `bartowski/BioMistral-7B-GGUF` | ~5 GB | Yes (fast) | Quantised, ideal for CPU-only machines |

> **Recommendation for interns:** Start with `BioMistral-7B-GGUF` (4-bit quantised) via `llama-cpp-python` — it runs on a laptop CPU in under 60 seconds per inference.

### 6.3 Prompt Template

```python
# diagnosis/model_reasoner.py

SYSTEM_PROMPT = (
    "You are a clinical decision support assistant specialised in hepatology (liver diseases). "
    "You have knowledge of Sherlock's Diseases of the Liver and Biliary System (13th Ed.), "
    "AASLD Practice Guidelines 2022-2024, and EASL Clinical Practice Guidelines. "
    "You provide differential diagnoses with supporting evidence and textbook references. "
    "You do NOT prescribe treatments. You do NOT make definitive diagnoses. "
    "End every response with: 'This output is for clinical decision support only. "
    "A licensed physician must review before any clinical action.'"
)

USER_PROMPT_TEMPLATE = """
HEPATOLOGY LAB REPORT — PATTERN ANALYSIS:
{pattern_analysis}

RULE-BASED DIFFERENTIAL DIAGNOSES (pre-computed):
{rule_based_differentials}

ABNORMAL LAB VALUES:
{abnormal_results}

Task:
1. Interpret the abnormal pattern (hepatocellular / cholestatic / mixed / synthetic dysfunction).
2. Rank the differential diagnoses above and explain reasoning for each using the lab values.
3. Suggest minimum additional investigations to confirm the top 2 diagnoses.
4. Note any URGENT findings requiring immediate hepatology consultation.
5. Cite the specific Sherlock's chapter or AASLD guideline for each differential stated.

Respond in structured plain text. Do not add markdown headers.
"""
```

### 6.4 Implementation — HuggingFace Transformers (GPU / CPU)

```python
# diagnosis/model_reasoner.py

import json
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline

# Model is downloaded once to ~/.cache/huggingface/ automatically
MODEL_ID = "BioMistral/BioMistral-7B"   # change to Llama-3.2-3B for CPU-only

_pipeline = None   # lazy-loaded on first call

def _load_pipeline():
    global _pipeline
    if _pipeline is not None:
        return _pipeline
    device = 0 if torch.cuda.is_available() else -1   # GPU if available, else CPU
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        device_map="auto",
    )
    _pipeline = pipeline(
        "text-generation",
        model=model,
        tokenizer=tokenizer,
        device=device,
        max_new_tokens=512,
        temperature=0.2,       # low temperature = more deterministic, better for clinical
        do_sample=True,
        repetition_penalty=1.1,
    )
    return _pipeline

def model_reason(findings: dict, differentials: list) -> dict:
    """
    Runs local open-source model to generate clinical narrative.
    No API key or internet connection needed after first model download.
    Returns enriched diagnosis dict with clinical narrative.
    """
    user_prompt = USER_PROMPT_TEMPLATE.format(
        pattern_analysis=json.dumps(findings, indent=2),
        rule_based_differentials=json.dumps(differentials, indent=2),
        abnormal_results=json.dumps(findings.get("abnormal_results", []), indent=2),
    )

    # Format as instruct-style chat
    full_prompt = f"<s>[INST] {SYSTEM_PROMPT}\n\n{user_prompt} [/INST]"

    try:
        pipe = _load_pipeline()
        output = pipe(full_prompt)[0]["generated_text"]
        # Strip the prompt prefix from output
        narrative = output[len(full_prompt):].strip()
    except Exception as exc:
        # Graceful fallback — return rule-based differentials only, no crash
        narrative = (
            f"Model inference failed ({exc}). "
            "Showing rule-based differentials only. "
            "This output is for clinical decision support only. "
            "A licensed physician must review before any clinical action."
        )

    return {
        "differentials": differentials,
        "model_clinical_narrative": narrative,
        "model_used": MODEL_ID,
    }
```

### 6.5 Alternative — GGUF Quantised via llama-cpp-python (CPU-optimised)

For laptops or machines without a GPU, use the 4-bit quantised GGUF version:

```bash
pip install llama-cpp-python>=0.2.77
# Download GGUF file once:
huggingface-cli download bartowski/BioMistral-7B-GGUF \
    BioMistral-7B-Q4_K_M.gguf --local-dir ./models/
```

```python
# diagnosis/model_reasoner_cpu.py  (CPU-only alternative)

from llama_cpp import Llama

_llm = None

def _load_llm():
    global _llm
    if _llm is None:
        _llm = Llama(
            model_path="./models/BioMistral-7B-Q4_K_M.gguf",
            n_ctx=2048,       # context window
            n_threads=4,      # CPU threads
            verbose=False,
        )
    return _llm

def model_reason_cpu(findings: dict, differentials: list) -> dict:
    """CPU-only fallback using 4-bit quantised BioMistral GGUF."""
    user_prompt = USER_PROMPT_TEMPLATE.format(
        pattern_analysis=json.dumps(findings, indent=2),
        rule_based_differentials=json.dumps(differentials, indent=2),
        abnormal_results=json.dumps(findings.get("abnormal_results", []), indent=2),
    )
    full_prompt = f"[INST] {SYSTEM_PROMPT}\n\n{user_prompt} [/INST]"

    llm = _load_llm()
    output = llm(full_prompt, max_tokens=512, temperature=0.2, echo=False)
    narrative = output["choices"][0]["text"].strip()

    return {
        "differentials": differentials,
        "model_clinical_narrative": narrative,
        "model_used": "BioMistral-7B-Q4_K_M.gguf (llama-cpp)",
    }
```

### 6.6 Auto-Select GPU vs CPU

```python
# diagnosis/model_reasoner.py  — add this at the bottom

import torch

def model_reason(findings: dict, differentials: list) -> dict:
    """Auto-routes to GPU (HuggingFace) or CPU (GGUF) based on availability."""
    if torch.cuda.is_available():
        return _hf_reason(findings, differentials)     # GPU path above
    else:
        return model_reason_cpu(findings, differentials)  # CPU GGUF path
```

---

## 7. Stage D — Diagnosis Report Generation

### 7.1 Final Output Structure

```python
# diagnosis/report_generator.py

def generate_report(reasoned: dict) -> dict:
    """
    Assembles the final diagnosis report JSON.
    """
```

### 7.2 Full Report JSON Schema

```json
{
  "report_version": "1.0",
  "generated_at": "2024-11-14T10:32:00Z",
  "department": "Hepatology",
  "disclaimer": "This report is for clinical decision support only. A qualified physician must review before any clinical action.",

  "abnormal_findings": [
    {
      "test": "ALT",
      "value": 245.0,
      "unit": "U/L",
      "flag": "HIGH",
      "fold_over_uln": 4.4,
      "clinical_note": "Markedly elevated ALT — hepatocellular injury pattern"
    }
  ],

  "pattern_analysis": {
    "primary_pattern": "hepatocellular",
    "de_ritis_ratio": 1.26,
    "r_factor": 8.2,
    "synthetic_dysfunction_present": true,
    "urgent_flags": [
      "INR 1.9 — evaluate for acute liver failure or decompensated cirrhosis"
    ]
  },

  "severity_scores": {
    "meld_score": 18,
    "meld_interpretation": "Moderate liver disease — 90-day mortality ~6%",
    "child_pugh_score": 8,
    "child_pugh_class": "B",
    "child_pugh_interpretation": "Moderate hepatic impairment"
  },

  "differential_diagnoses": [
    {
      "rank": 1,
      "condition": "Acute Viral Hepatitis (B or E)",
      "probability": "HIGH",
      "supporting_evidence": [
        "ALT 4.4× ULN — hepatocellular pattern",
        "De Ritis ratio 1.26 (< 2 — favours viral over alcoholic)",
        "Markedly elevated bilirubin"
      ],
      "against_evidence": [],
      "recommended_tests": [
        "HBsAg",
        "Anti-HBc IgM",
        "Anti-HEV IgM",
        "Liver ultrasound"
      ],
      "reference": "Sherlock & Dooley, Diseases of the Liver and Biliary System, 13th Ed., Ch. 14 — Viral Hepatitis",
      "urgent": false
    },
    {
      "rank": 2,
      "condition": "Decompensated Liver Cirrhosis",
      "probability": "MODERATE",
      "supporting_evidence": [
        "Albumin 2.8 g/dL (low)",
        "INR 1.9 (elevated)",
        "Child-Pugh class B"
      ],
      "against_evidence": [
        "ALT very high — may suggest acute-on-chronic event rather than stable cirrhosis"
      ],
      "recommended_tests": [
        "Liver ultrasound with portal Doppler",
        "Upper GI endoscopy (varices screening)",
        "Serum sodium",
        "24-hour urine protein"
      ],
      "reference": "AASLD 2022 Practice Guidance for Hepatic Cirrhosis; Child-Pugh & MELD scores",
      "urgent": true
    }
  ],

  "clinical_narrative": "The biochemical profile demonstrates a predominantly hepatocellular injury pattern...",

  "recommendations": [
    "Urgent hepatology consultation given INR elevation",
    "Send HBsAg and anti-HBc IgM to rule out acute Hepatitis B",
    "Liver ultrasound within 24 hours to assess for cirrhosis, hepatomegaly, or biliary dilation"
  ]
}
```

---

## 8. Hepatology Knowledge Base

### 8.1 Your Task

Build the knowledge base in `diagnosis/hepatology_kb.py`. This is the reference database your rule engine queries. It must encode the standard patterns from Sherlock's 13th Edition and AASLD guidelines.

### 8.2 Structure

```python
# diagnosis/hepatology_kb.py

HEPATOLOGY_KB = {
    "conditions": {
        "Acute Viral Hepatitis": {
            "pattern": "hepatocellular",
            "alt_range": "> 10× ULN",
            "de_ritis": "< 1.0",
            "bilirubin": "elevated",
            "albumin": "normal (acute) / low (chronic)",
            "chapter_reference": "Sherlock 13th Ed., Ch. 14",
            "guideline_reference": "AASLD 2022 Viral Hepatitis Guidance",
            "key_tests": ["HBsAg", "Anti-HBc IgM", "Anti-HAV IgM", "Anti-HEV IgM", "HCV RNA"]
        },
        "Alcoholic Hepatitis": {
            "pattern": "hepatocellular",
            "alt_range": "2–5× ULN",
            "de_ritis": "> 2.0 (classic criterion)",
            "ggt": "elevated (> 3× ULN suggests alcohol)",
            "chapter_reference": "Sherlock 13th Ed., Ch. 24 — Alcohol and the Liver",
            "key_tests": ["GGT", "CDT (carbohydrate-deficient transferrin)", "Alcohol history"]
        },
        "NAFLD/NASH": {
            "pattern": "hepatocellular (mild)",
            "alt_range": "1–3× ULN",
            "de_ritis": "< 1.0",
            "associated": ["Obesity", "T2DM", "Dyslipidaemia", "Metabolic syndrome"],
            "chapter_reference": "AASLD 2023 NAFLD Practice Guidance",
            "key_tests": ["Liver biopsy", "FibroScan", "FIB-4 score", "Liver ultrasound"]
        },
        "Primary Biliary Cholangitis": {
            "pattern": "cholestatic",
            "alp_range": "> 3× ULN",
            "ggt": "elevated",
            "ima_positive": True,
            "chapter_reference": "Sherlock 13th Ed., Ch. 13 — Primary Biliary Cholangitis",
            "guideline_reference": "EASL 2017 PBC Clinical Practice Guidelines",
            "key_tests": ["AMA (anti-mitochondrial antibody)", "ANA", "Liver biopsy"]
        },
        "Wilson Disease": {
            "pattern": "mixed or hepatocellular",
            "ceruloplasmin": "< 20 mg/dL",
            "urine_copper": "> 100 μg/24h",
            "age_group": "< 40 years",
            "chapter_reference": "Sherlock 13th Ed., Ch. 22 — Wilson's Disease",
            "key_tests": ["Serum ceruloplasmin", "24h urine copper", "Slit-lamp KF rings", "Liver biopsy copper"]
        },
        "Haemochromatosis": {
            "pattern": "hepatocellular (mild to moderate)",
            "ferritin": "> 300 ng/mL (men) / > 200 ng/mL (women)",
            "transferrin_saturation": "> 45%",
            "chapter_reference": "Sherlock 13th Ed., Ch. 21 — Haemochromatosis",
            "guideline_reference": "EASL 2022 Haemochromatosis Guideline",
            "key_tests": ["Serum ferritin", "Transferrin saturation", "HFE gene mutation", "Liver MRI"]
        },
        "Autoimmune Hepatitis": {
            "pattern": "hepatocellular",
            "igG": "elevated (> 1.5× ULN)",
            "asma_or_ana": "positive",
            "chapter_reference": "Sherlock 13th Ed., Ch. 18 — Autoimmune Hepatitis",
            "guideline_reference": "EASL 2015 AIH Clinical Practice Guidelines",
            "key_tests": ["ANA", "ASMA (anti-smooth muscle)", "Anti-LKM1", "IgG", "Liver biopsy"]
        },
        "Hepatocellular Carcinoma": {
            "pattern": "hepatocellular (background cirrhosis)",
            "afp": "> 200 ng/mL (highly suggestive) / > 400 ng/mL (diagnostic in context)",
            "chapter_reference": "Sherlock 13th Ed., Ch. 28 — Hepatocellular Carcinoma",
            "guideline_reference": "AASLD 2023 HCC Practice Guidance",
            "key_tests": ["AFP", "Liver triphasic CT or MRI", "Liver ultrasound (surveillance)"]
        }
    }
}
```

---

## 9. Diagnostic Patterns Reference Table

This is the core clinical reference for writing rules. Source: **Sherlock's Diseases of the Liver and Biliary System, 13th Ed.** + **AASLD/EASL Guidelines**.

### 9.1 LFT Pattern Recognition Quick Reference

| Condition | ALT/AST | ALP | GGT | Bili | Albumin | INR | De Ritis |
|---|---|---|---|---|---|---|---|
| Acute viral hepatitis | ↑↑↑ (>10×) | N or ↑ | ↑ | ↑↑ | N | N or ↑ | < 1.0 |
| Alcoholic hepatitis | ↑↑ (2–5×) | N or ↑ | ↑↑↑ | ↑↑ | ↓ | ↑ | **> 2.0** |
| NAFLD/NASH | ↑ (1–3×) | N | ↑ | N or ↑ | N | N | < 1.0 |
| Drug-induced (DILI) | ↑↑↑ | ↑ or ↑↑ | ↑ | ↑ | N | N or ↑ | Variable |
| Primary biliary cholangitis | N or ↑ | ↑↑↑ | ↑↑ | ↑ (late) | ↓ (late) | N | < 1.0 |
| PSC | N or ↑ | ↑↑↑ | ↑↑ | ↑ | N | N | < 1.0 |
| Choledocholithiasis | ↑ (transient) | ↑↑ | ↑↑ | ↑↑ (Direct) | N | N | any |
| Wilson's disease | ↑↑ | **↓ or N** | ↑ | ↑ | ↓ (advanced) | ↑ | < 1.0 |
| Haemochromatosis | ↑ | N | N or ↑ | N | N | N | Variable |
| Autoimmune hepatitis | ↑↑ (2–10×) | N or ↑ | ↑ | ↑ | ↓ | ↑ | < 1.0 |
| Decompensated cirrhosis | N or ↑ | ↑ | ↑ | ↑↑ | **↓↓** | **↑↑** | > 1.0 |
| Acute liver failure | ↑↑↑ | ↑ | ↑ | ↑↑↑ | ↓ | **↑↑↑** | Variable |
| HCC | ↑ (background) | ↑ | ↑ | ↑ (late) | ↓ (late) | ↑ (late) | > 1.0 |

**Legend:** N = Normal, ↑ = Mildly elevated, ↑↑ = Moderately elevated, ↑↑↑ = Markedly elevated, ↓ = Low

---

## 10. MELD Score & Child-Pugh Calculator

### 10.1 MELD Score

MELD (Model for End-stage Liver Disease) predicts 90-day transplant-free survival.

**Formula:**

```
MELD = 3.78 × ln(Bilirubin mg/dL)
     + 11.2 × ln(INR)
     + 9.57 × ln(Creatinine mg/dL)
     + 6.43
```

**Interpretation:**

| MELD Score | 90-Day Mortality |
|---|---|
| < 9 | ~2% |
| 10 – 19 | ~6% |
| 20 – 29 | ~20% |
| 30 – 39 | ~53% |
| ≥ 40 | ~71% |

**Implementation:**

```python
# diagnosis/engine.py

import math

def calculate_meld(bilirubin: float, inr: float, creatinine: float) -> int:
    """
    Standard MELD score formula.
    All values in: bilirubin mg/dL, creatinine mg/dL, INR unitless.
    Returns integer MELD score.
    """
    # Minimum values to avoid log(0)
    bilirubin  = max(bilirubin, 1.0)
    inr        = max(inr, 1.0)
    creatinine = max(creatinine, 1.0)
    creatinine = min(creatinine, 4.0)   # Cap at 4.0 per UNOS rules

    meld = (3.78 * math.log(bilirubin) +
            11.2 * math.log(inr) +
            9.57 * math.log(creatinine) +
            6.43)
    return round(meld)
```

### 10.2 Child-Pugh Score

Assesses severity of chronic liver disease / cirrhosis.

| Parameter | 1 Point | 2 Points | 3 Points |
|---|---|---|---|
| Bilirubin (mg/dL) | < 2 | 2 – 3 | > 3 |
| Albumin (g/dL) | > 3.5 | 2.8 – 3.5 | < 2.8 |
| INR | < 1.7 | 1.7 – 2.3 | > 2.3 |
| Ascites | None | Mild (controlled) | Moderate–Severe |
| Encephalopathy | None | Grade I–II | Grade III–IV |

| Total Score | Class | 1-Year Survival | 2-Year Survival |
|---|---|---|---|
| 5 – 6 | A | 100% | 85% |
| 7 – 9 | B | 81% | 57% |
| 10 – 15 | C | 45% | 35% |

```python
def calculate_child_pugh(bilirubin: float, albumin: float, inr: float,
                          ascites: str, encephalopathy: str) -> dict:
    """
    ascites: 'none' | 'mild' | 'moderate_severe'
    encephalopathy: 'none' | 'grade1_2' | 'grade3_4'
    Returns: {"score": int, "class": "A"|"B"|"C"}
    """
```

---

## 11. Project Structure for This Module

```
diagnosis/
├── __init__.py
├── engine.py               ← run_diagnosis() orchestrator
├── pattern_analyser.py     ← Stage A — abnormality + pattern detection
├── rule_engine.py          ← Stage B — rule-based differentials
├── model_reasoner.py       ← Stage C — HuggingFace open-source model (GPU)
├── model_reasoner_cpu.py   ← Stage C — llama-cpp GGUF fallback (CPU)
├── report_generator.py     ← Stage D — final JSON + text report
├── hepatology_kb.py        ← Conditions, patterns, references (Sherlock + AASLD)
└── scoring.py              ← MELD, Child-Pugh, FIB-4 calculators

models/
└── BioMistral-7B-Q4_K_M.gguf   ← downloaded once, never committed to git
```

> Add `models/` to `.gitignore` — model weights must never be committed to the repo.

---

## 12. Code Implementation Tasks

This section is your step-by-step task list as an intern. Work through them in order.

### Task 1 — Build the Knowledge Base (`hepatology_kb.py`)

- [ ] Define `HEPATOLOGY_KB` dict with at least 10 liver conditions.
- [ ] Each entry must include: pattern, key markers, chapter reference, recommended tests.
- [ ] Add `HEPATOLOGY_REFERENCE_RANGES` dict (copy from Section 7.1 of pipeline README).
- [ ] Write unit test: `tests/test_hepatology_kb.py` — verify every condition has a reference.

### Task 2 — Pattern Analyser (`pattern_analyser.py`)

- [ ] Implement `analyse_patterns(lab_json) -> dict`.
- [ ] Detect: hepatocellular, cholestatic, mixed, synthetic dysfunction.
- [ ] Compute: De Ritis ratio, R-factor.
- [ ] Generate `urgent_flags` list for critical findings (INR > 1.5, ALT > 10× ULN, Bili > 10).
- [ ] Unit test with at least 5 different lab JSON cases.

### Task 3 — Rule Engine (`rule_engine.py`)

- [ ] Implement `apply_rules(findings) -> list[dict]`.
- [ ] Encode at least 8 rules (conditions) using the examples in Section 5.2.
- [ ] Sort output by probability weight (highest first).
- [ ] Each differential must include supporting_evidence, recommended_tests, reference.
- [ ] Unit test: verify correct differentials for 3 known test cases.

### Task 4 — MELD & Child-Pugh Scores (`scoring.py`)

- [ ] Implement `calculate_meld(bilirubin, inr, creatinine) -> int`.
- [ ] Implement `calculate_child_pugh(...) -> dict`.
- [ ] Implement `calculate_fib4(age, ast, alt, platelets) -> float` (FIB-4 index for fibrosis).
- [ ] Unit tests with known reference values from published case studies.

### Task 5 — Open-Source Model Reasoner (`model_reasoner.py`)

- [ ] Implement `model_reason(findings, differentials) -> dict` using **BioMistral-7B** (GPU) or **BioMistral-7B-GGUF** (CPU) — see Section 6.4 and 6.5.
- [ ] Use the system prompt and user prompt templates from Section 6.3 exactly as written.
- [ ] No API keys — model runs locally. Download handled automatically by `transformers` or `huggingface-cli`.
- [ ] Implement auto-select in Section 6.6: GPU path if `torch.cuda.is_available()`, else CPU GGUF path.
- [ ] Handle model inference errors gracefully — log the error and return rule-based differentials without crashing.
- [ ] Add `models/` and `*.gguf` to `.gitignore` — weights must not be committed.
- [ ] Integration test: run `model_reason()` on Case 1 lab JSON (Section 13.1), assert narrative is non-empty and ends with the safety disclaimer.

### Task 6 — Report Generator (`report_generator.py`)

- [ ] Implement `generate_report(reasoned) -> dict`.
- [ ] Output must conform to the JSON schema in Section 7.2.
- [ ] Validate output with Pydantic `DiagnosisReport` model.
- [ ] Also generate a `generate_text_summary(report) -> str` for human-readable output.

### Task 7 — End-to-End Integration Test

- [ ] Create `tests/test_diagnosis_e2e.py`.
- [ ] Load 3 sample lab JSONs (one hepatocellular, one cholestatic, one synthetic dysfunction).
- [ ] Run full `run_diagnosis()` on each.
- [ ] Assert: correct primary pattern, top differential in expected set, Pydantic schema passes.

---

## 13. Testing Guidelines

### 13.1 Test Case Reference Set

Create these test cases in `tests/sample_lab_reports/`:

**Case 1 — Acute Viral Hepatitis (Hepatocellular)**
```json
{
  "lab_results": [
    {"test_name": "ALT",   "value": 1240, "unit": "U/L",   "flag": "HIGH"},
    {"test_name": "AST",   "value": 980,  "unit": "U/L",   "flag": "HIGH"},
    {"test_name": "ALP",   "value": 165,  "unit": "U/L",   "flag": "HIGH"},
    {"test_name": "T.Bil", "value": 5.4,  "unit": "mg/dL", "flag": "HIGH"},
    {"test_name": "Albumin","value": 3.9, "unit": "g/dL",  "flag": "NORMAL"},
    {"test_name": "INR",   "value": 1.1,  "unit": "",      "flag": "NORMAL"}
  ]
}
```
**Expected:** hepatocellular pattern, top differential = Acute Viral Hepatitis

**Case 2 — Cholestatic (PBC / Obstruction)**
```json
{
  "lab_results": [
    {"test_name": "ALT",   "value": 68,   "unit": "U/L",   "flag": "HIGH"},
    {"test_name": "AST",   "value": 55,   "unit": "U/L",   "flag": "HIGH"},
    {"test_name": "ALP",   "value": 520,  "unit": "U/L",   "flag": "HIGH"},
    {"test_name": "GGT",   "value": 310,  "unit": "U/L",   "flag": "HIGH"},
    {"test_name": "T.Bil", "value": 3.8,  "unit": "mg/dL", "flag": "HIGH"},
    {"test_name": "D.Bil", "value": 2.9,  "unit": "mg/dL", "flag": "HIGH"},
    {"test_name": "Albumin","value": 3.6, "unit": "g/dL",  "flag": "NORMAL"},
    {"test_name": "INR",   "value": 1.0,  "unit": "",      "flag": "NORMAL"}
  ]
}
```
**Expected:** cholestatic pattern, top differential = PBC or Obstructive Jaundice

**Case 3 — Decompensated Cirrhosis (Synthetic Dysfunction)**
```json
{
  "lab_results": [
    {"test_name": "ALT",        "value": 62,  "unit": "U/L",   "flag": "HIGH"},
    {"test_name": "AST",        "value": 88,  "unit": "U/L",   "flag": "HIGH"},
    {"test_name": "T.Bil",      "value": 4.1, "unit": "mg/dL", "flag": "HIGH"},
    {"test_name": "Albumin",    "value": 2.4, "unit": "g/dL",  "flag": "LOW"},
    {"test_name": "INR",        "value": 2.1, "unit": "",      "flag": "HIGH"},
    {"test_name": "Creatinine", "value": 1.8, "unit": "mg/dL", "flag": "HIGH"}
  ]
}
```
**Expected:** synthetic dysfunction, MELD ≈ 22, Child-Pugh class C, top differential = Decompensated Cirrhosis

### 13.2 Running Tests

```bash
pytest tests/test_diagnosis_e2e.py -v
pytest tests/ -v --tb=short --cov=diagnosis
```

---

## 14. Ethical & Safety Guardrails

These rules are **non-negotiable** and must be implemented in code:

1. **Disclaimer on every output:** Every generated report JSON and text summary MUST include:
   > "This analysis is generated by an AI-assisted decision support system and is intended for use by qualified healthcare professionals only. It does not replace clinical judgment. A licensed physician must review and confirm all findings before any clinical action is taken."

2. **No treatment recommendations:** The system must not prescribe medications or treatment plans. `recommended_tests` lists diagnostic investigations only.

3. **No definitive diagnosis:** All outputs are labelled as "differential diagnoses" with probabilities. The system never says "the patient has X".

4. **Urgent flags escalate — they do not treat:** Urgent flags (e.g., MELD > 30, INR > 2.0 in acute setting) must trigger a clear alert in the report but the alert only recommends "Immediate hepatology consultation".

5. **Patient data anonymisation:** No real patient names, IDs, or dates of birth in code, tests, or version control. Use synthetic or anonymised data only.

6. **Audit log:** Every call to `run_diagnosis()` must write a structured log entry (without patient PII) to `logs/diagnosis_audit.jsonl`.

---

## 15. Resources & References

### Primary Textbook

- **Sherlock S, Dooley J.** *Diseases of the Liver and Biliary System*, 13th Edition. Wiley-Blackwell, 2018.
  - Ch. 13 — Bile Duct Diseases (PBC, PSC)
  - Ch. 14 — Viral Hepatitis (A, B, C, D, E)
  - Ch. 18 — Autoimmune Hepatitis
  - Ch. 21 — Haemochromatosis
  - Ch. 22 — Wilson's Disease
  - Ch. 24 — Alcohol and the Liver
  - Ch. 28 — Hepatocellular Carcinoma

### Clinical Guidelines

- AASLD 2022 Practice Guidance on Hepatic Cirrhosis: https://www.aasld.org
- AASLD 2023 NAFLD/NASH Practice Guidance: https://www.aasld.org
- EASL 2017 PBC Clinical Practice Guidelines: https://easl.eu
- EASL 2015 Autoimmune Hepatitis Clinical Practice Guidelines: https://easl.eu
- EASL 2022 Haemochromatosis Guideline: https://easl.eu

### Scoring Calculators (for verification)

- MELD Score Calculator: https://www.mdcalc.com/calc/78/meld-score-model-end-stage-liver-disease
- Child-Pugh Score: https://www.mdcalc.com/calc/340/child-pugh-score-cirrhosis-mortality
- FIB-4 Index: https://www.mdcalc.com/calc/2200/fibrosis-4-fib-4-index-liver-fibrosis

### Supporting Texts

- Harrison's Principles of Internal Medicine, 21st Edition — Part 10 (Disorders of the Liver)
- Bacon BR, O'Grady JG (Eds). *Comprehensive Clinical Hepatology*, 2nd Edition. Mosby, 2006.
- Lab Tests Online — Liver Panel: https://labtestsonline.org/tests/liver-panel

### Open-Source Models Used

- **BioMistral-7B** (HuggingFace): https://huggingface.co/BioMistral/BioMistral-7B
- **Meditron-7B** (EPFL): https://huggingface.co/epfl-llm/meditron-7b
- **Mistral-7B-Instruct-v0.3**: https://huggingface.co/mistralai/Mistral-7B-Instruct-v0.3
- **Llama-3.2-3B-Instruct**: https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct
- **BioMistral-7B GGUF (4-bit)**: https://huggingface.co/bartowski/BioMistral-7B-GGUF

### Python Libraries

- HuggingFace Transformers: https://huggingface.co/docs/transformers/
- llama-cpp-python (GGUF inference): https://github.com/abetlen/llama-cpp-python
- HuggingFace Hub CLI: https://huggingface.co/docs/huggingface_hub/guides/cli
- Pydantic v2 — Validators: https://docs.pydantic.dev/latest/concepts/validators/
- Loguru structured logging: https://loguru.readthedocs.io/

---

*Post-Extraction Hepatology Diagnosis README v1.0 — Medical OCR Intern Project*

