"""
hepatology_kb.py — Diagnosis module knowledge base.

Imports and re-exports reference ranges and normalization functions from the base
hepatology_kb module while exposing HEPATOLOGY_REFERENCE_RANGES and HEPATOLOGY_KB
for the 4-stage diagnosis engine.
"""
import sys
from pathlib import Path
from typing import Any, Dict, Optional

# Ensure backend root is on sys.path for robust relative/absolute imports
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

try:
    from hepatology_kb import (
        _RANGES,
        lookup_reference_range,
        normalise_test_key,
    )
except ImportError:
    from backend.hepatology_kb import (
        _RANGES,
        lookup_reference_range,
        normalise_test_key,
    )

# Re-export imported functions/objects for module consumer clarity
__all__ = [
    "_RANGES",
    "lookup_reference_range",
    "normalise_test_key",
    "HEPATOLOGY_REFERENCE_RANGES",
    "HEPATOLOGY_KB",
]

# Standard reference ranges defined per spec for Stage A pattern analysis
HEPATOLOGY_REFERENCE_RANGES: Dict[str, Dict[str, Any]] = {
    "ALT": {"low": 7.0, "high": 56.0, "unit": "U/L", "name": "Alanine Aminotransferase"},
    "AST": {"low": 10.0, "high": 40.0, "unit": "U/L", "name": "Aspartate Aminotransferase"},
    "ALP": {"low": 44.0, "high": 147.0, "unit": "U/L", "name": "Alkaline Phosphatase"},
    "GGT": {"low": 8.0, "high": 61.0, "unit": "U/L", "name": "Gamma-Glutamyl Transferase"},
    "TBil": {"low": 0.2, "high": 1.2, "unit": "mg/dL", "name": "Total Bilirubin"},
    "DBil": {"low": 0.0, "high": 0.3, "unit": "mg/dL", "name": "Direct Bilirubin"},
    "Albumin": {"low": 3.5, "high": 5.0, "unit": "g/dL", "name": "Albumin"},
    "INR": {"low": 0.8, "high": 1.1, "unit": "unitless", "name": "International Normalised Ratio"},
    "TP": {"low": 6.0, "high": 8.3, "unit": "g/dL", "name": "Total Protein"},
    "Platelets": {"low": 150.0, "high": 450.0, "unit": "10^9/L", "name": "Platelet Count"},
}

# 10 Hepatology condition definitions matching AASLD guidelines and Sherlock textbook
HEPATOLOGY_KB: Dict[str, Dict[str, Any]] = {
    "Acute Viral Hepatitis": {
        "pattern": "Hepatocellular",
        "key_markers": ["ALT", "AST", "TBil"],
        "chapter_reference": "Sherlock Chapter 18: Viral Hepatitis",
        "guideline_reference": "AASLD Practice Guidelines: Acute Viral Hepatitis (2018)",
        "key_tests": ["HBsAg", "Anti-HCV", "Anti-HAV IgM", "ALT", "AST"],
    },
    "Chronic Hepatitis B/C": {
        "pattern": "Hepatocellular / Mixed",
        "key_markers": ["ALT", "AST"],
        "chapter_reference": "Sherlock Chapter 19: Chronic Viral Hepatitis",
        "guideline_reference": "AASLD Guidelines: Chronic Hepatitis B/C Management (2020)",
        "key_tests": ["HBV DNA", "HCV RNA", "ALT", "AST", "Platelets"],
    },
    "Alcoholic Liver Disease": {
        "pattern": "Hepatocellular (De Ritis > 2.0)",
        "key_markers": ["AST", "ALT", "GGT", "TBil"],
        "chapter_reference": "Sherlock Chapter 21: Alcohol-Induced Liver Disease",
        "guideline_reference": "AASLD Practice Guidelines: Alcoholic Liver Disease (2019)",
        "key_tests": ["AST", "ALT", "GGT", "MCV", "TBil"],
    },
    "NAFLD/NASH": {
        "pattern": "Hepatocellular (De Ritis < 1.0)",
        "key_markers": ["ALT", "AST", "GGT"],
        "chapter_reference": "Sherlock Chapter 22: Non-Alcoholic Fatty Liver Disease",
        "guideline_reference": "AASLD Practice Guidance: NAFLD/NASH Evaluation (2023)",
        "key_tests": ["ALT", "AST", "Fasting Glucose", "Lipid Profile", "Ultrasound"],
    },
    "Cholestatic Liver Disease (PBC/PSC/Biliary Obstruction)": {
        "pattern": "Cholestatic",
        "key_markers": ["ALP", "GGT", "DBil", "TBil"],
        "chapter_reference": "Sherlock Chapter 13: Cholestasis & Biliary Tract Diseases",
        "guideline_reference": "AASLD Guidelines: Cholestatic Liver Diseases (2020)",
        "key_tests": ["ALP", "GGT", "AMA", "MRCP", "DBil"],
    },
    "Cirrhosis / End-Stage Liver Disease": {
        "pattern": "Synthetic Dysfunction",
        "key_markers": ["Albumin", "INR", "TBil", "Platelets"],
        "chapter_reference": "Sherlock Chapter 9: Cirrhosis and Portal Hypertension",
        "guideline_reference": "AASLD Guidance: Diagnosis and Evaluation of Cirrhosis (2021)",
        "key_tests": ["Albumin", "INR", "TBil", "Platelets", "Creatinine"],
    },
    "Drug-Induced Liver Injury (DILI)": {
        "pattern": "Hepatocellular or Cholestatic or Mixed",
        "key_markers": ["ALT", "ALP", "TBil"],
        "chapter_reference": "Sherlock Chapter 20: Drug-Induced Liver Injury",
        "guideline_reference": "AASLD Practice Guidelines: DILI Evaluation (2021)",
        "key_tests": ["ALT", "ALP", "TBil", "Eosinophils", "Medication History"],
    },
    "Hemochromatosis": {
        "pattern": "Hepatocellular / Metabolic",
        "key_markers": ["ALT", "AST", "Ferritin", "Transferrin Saturation"],
        "chapter_reference": "Sherlock Chapter 23: Iron Overload Disorders",
        "guideline_reference": "AASLD Practice Guidelines: Hemochromatosis (2011)",
        "key_tests": ["Serum Ferritin", "Transferrin Saturation", "HFE Gene Analysis"],
    },
    "Autoimmune Hepatitis": {
        "pattern": "Hepatocellular",
        "key_markers": ["ALT", "AST", "IgG", "ANA", "SMA"],
        "chapter_reference": "Sherlock Chapter 17: Autoimmune Hepatitis",
        "guideline_reference": "AASLD Practice Guidelines: Autoimmune Hepatitis (2020)",
        "key_tests": ["ANA", "SMA", "IgG", "ALT", "AST", "Liver Biopsy"],
    },
    "Normal / Unremarkable": {
        "pattern": "Normal",
        "key_markers": [],
        "chapter_reference": "Sherlock Chapter 1: Normal Liver Physiology",
        "guideline_reference": "AASLD Evaluation of Normal LFTs (2017)",
        "key_tests": ["Routine Health Check"],
    },
}
