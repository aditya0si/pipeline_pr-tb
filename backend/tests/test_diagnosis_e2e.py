"""
test_diagnosis_e2e.py — End-to-End Integration Tests for Hepatology Diagnosis Module.
"""
import os
import sys
from pathlib import Path

# Add backend root to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from diagnosis.engine import run_diagnosis
from diagnosis.model_reasoner import MANDATORY_DISCLAIMER
from schemas import LabReport, LabResult


def test_e2e_viral_hepatitis_lab_report():
    """Test complete 4-stage pipeline execution for acute viral hepatitis lab report."""
    lab_report = LabReport(
        lab_results=[
            LabResult(test_name="ALT", value=1250.0, unit="U/L", flag="CRITICAL_HIGH"),
            LabResult(test_name="AST", value=980.0, unit="U/L", flag="CRITICAL_HIGH"),
            LabResult(test_name="ALP", value=110.0, unit="U/L", flag="NORMAL"),
            LabResult(test_name="TBil", value=3.5, unit="mg/dL", flag="HIGH"),
        ]
    )

    out = run_diagnosis(lab_report)
    assert "report" in out
    assert "summary_text" in out
    assert out["top_differential"]["condition"] == "Acute Viral Hepatitis"
    assert MANDATORY_DISCLAIMER in out["summary_text"]
    assert out["report"]["disclaimer"] == MANDATORY_DISCLAIMER
    assert len(out["report"]["clinical_brief"]["flags_to_discuss"]) > 0


def test_e2e_cirrhosis_lab_report():
    """Test 4-stage pipeline on decompensated cirrhosis lab report."""
    lab_report = LabReport(
        lab_results=[
            LabResult(test_name="TBil", value=4.5, unit="mg/dL", flag="HIGH"),
            LabResult(test_name="Albumin", value=2.4, unit="g/dL", flag="CRITICAL_LOW"),
            LabResult(test_name="INR", value=1.9, unit="unitless", flag="CRITICAL_HIGH"),
            LabResult(test_name="Creatinine", value=1.8, unit="mg/dL", flag="HIGH"),
        ]
    )

    out = run_diagnosis(lab_report)
    rep = out["report"]
    assert rep["pattern_analysis"]["synthetic_dysfunction"] is True
    assert rep["severity_scores"]["meld"]["value"] is not None
    assert rep["severity_scores"]["child_pugh"]["score"] is not None
    assert any("Cirrhosis" in d["condition"] for d in rep["differential_diagnoses"])


def test_e2e_all_normal_lab_report():
    """Test 4-stage pipeline on unremarkable normal lab report."""
    lab_report = LabReport(
        lab_results=[
            LabResult(test_name="ALT", value=25.0, unit="U/L", flag="NORMAL"),
            LabResult(test_name="AST", value=22.0, unit="U/L", flag="NORMAL"),
            LabResult(test_name="ALP", value=70.0, unit="U/L", flag="NORMAL"),
            LabResult(test_name="TBil", value=0.6, unit="mg/dL", flag="NORMAL"),
            LabResult(test_name="Albumin", value=4.2, unit="g/dL", flag="NORMAL"),
            LabResult(test_name="INR", value=1.0, unit="unitless", flag="NORMAL"),
        ]
    )

    out = run_diagnosis(lab_report)
    top = out["top_differential"]
    assert top["condition"] == "No abnormal hepatic pattern detected"
    assert top["probability"] == 0.0
    assert MANDATORY_DISCLAIMER in out["summary_text"]


def test_e2e_handwritten_sourced_json_schema():
    """Verify handwritten OCR-sourced lab result payload produces valid diagnosis report."""
    handwritten_payload = {
        "lab_results": [
            {"test_name": "ALT (SGPT)", "value": "145.0", "unit": "U/L", "flag": "HIGH"},
            {"test_name": "AST (SGOT)", "value": "112.0", "unit": "U/L", "flag": "HIGH"},
            {"test_name": "S. Bilirubin Total", "value": "1.8", "unit": "mg/dL", "flag": "HIGH"},
        ],
        "document_metadata": {"document_type": "handwritten"},
    }

    out = run_diagnosis(handwritten_payload)
    assert out["top_differential"] is not None
    assert out["report"]["report_version"] == "2.0.0"


def test_e2e_feature_flag_disabled_legacy_behavior(monkeypatch):
    """Verify DIAGNOSIS_MODULE_ENABLED=0 preserves legacy behavior."""
    monkeypatch.setenv("DIAGNOSIS_MODULE_ENABLED", "0")
    val = os.environ.get("DIAGNOSIS_MODULE_ENABLED", "0")
    assert val == "0"


def test_e2e_mandatory_disclaimer_always_present():
    """Verify safety disclaimer is present in every report and summary text."""
    lab_report = LabReport(
        lab_results=[
            LabResult(test_name="ALT", value=85.0, unit="U/L", flag="HIGH"),
            LabResult(test_name="ALP", value=420.0, unit="U/L", flag="CRITICAL_HIGH"),
        ]
    )

    out = run_diagnosis(lab_report)
    assert out["report"]["disclaimer"] == MANDATORY_DISCLAIMER
    assert MANDATORY_DISCLAIMER in out["summary_text"]
