"""
test_diagnosis_stageC.py — Unit tests for Stage C AI Clinical Brief Reasoner (Mocked LLM).
"""
import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

# Add backend root to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from diagnosis.model_reasoner import MANDATORY_DISCLAIMER, model_reason


def test_stage_c_structured_json_with_mock_llm():
    """Verify Stage C parses structured 5-section JSON output from mock LLM and attaches disclaimer."""
    mock_llm = MagicMock()
    mock_llm.complete.return_value = json.dumps({
        "patient_info": {"name": "MANOJ KUMAR GUPTA", "age": "58 Years", "gender": "Male", "reg_date": "09/Apr/2026"},
        "document_type": "Serology Report",
        "flagged_findings": [{"item": "HCV Screening", "status": "REACTIVE 🚨", "detail": "Advise confirmation by ELISA", "is_critical": True}],
        "actionable_recommendations": ["Order HCV RNA Quantitative PCR for viral load confirmation"],
        "physician_quick_bullets": ["HCV Serology screening is REACTIVE — order confirmatory PCR test."],
        "disclaimer": "old disclaimer"
    })

    findings = {"primary_pattern": "Serology"}
    diffs = [{"condition": "Hepatitis C Serology Positive", "probability": 0.95}]

    res = model_reason(findings, diffs, llm_client=mock_llm, raw_ocr_text="HCV Screening Reactive MANOJ KUMAR GUPTA 58 Years/M")
    assert res["ai_reasoning_available"] is True
    assert res["patient_info"]["name"] == "MANOJ KUMAR GUPTA"
    assert res["document_type"] == "Serology Report"
    assert len(res["flagged_findings"]) == 1
    assert res["flagged_findings"][0]["status"] == "REACTIVE 🚨"
    assert res["disclaimer"] == MANDATORY_DISCLAIMER


def test_stage_c_serology_fallback_regex():
    """Verify fallback parser handles Serology HCV Reactive report without LLM."""
    ocr_text = """
    Patient Name : Mr. MANOJ KUMAR GUPTA
    Age/Gender : 58 Years/M
    Reported On : 09/Apr/2026 15:56
    HBsAg Screening Non-Reactive
    HCV Screening Reactive Advise: - Confirmation by ELISA.
    HIV Non-Reactive
    """
    res = model_reason(findings={}, differentials=[], llm_client=None, raw_ocr_text=ocr_text)
    assert res["ai_reasoning_available"] is False
    assert res["patient_info"]["name"] == "Mr. MANOJ KUMAR GUPTA"
    assert res["patient_info"]["age"] == "58 Years"
    assert res["patient_info"]["gender"] == "M"
    assert res["document_type"] == "Serology Report"
    assert any(f["item"] == "HCV Screening" and "REACTIVE" in f["status"] for f in res["flagged_findings"])
    assert any("HCV RNA" in r for r in res["actionable_recommendations"])


def test_stage_c_fallback_when_llm_client_is_none():
    """Verify fallback structured brief is generated when llm_client is None."""
    findings = {
        "extracted_values": {"ALT": 1250.0, "AST": 980.0},
        "fold_over_uln": {"ALT": 22.3, "AST": 24.5},
        "urgent_flags": ["ALT > 560 U/L"],
        "primary_pattern": "Hepatocellular",
        "de_ritis": 0.78,
        "r_factor": 29.8,
    }
    diffs = [
        {
            "condition": "Acute Viral Hepatitis",
            "probability": 0.85,
            "recommended_tests": ["HBsAg", "Anti-HCV"],
            "reference": "Sherlock Ch 18",
        }
    ]

    res = model_reason(findings, diffs, llm_client=None)
    assert res["ai_reasoning_available"] is False
    assert len(res["flagged_findings"]) > 0
    assert res["disclaimer"] == MANDATORY_DISCLAIMER


def test_stage_c_disabled_via_env_var(monkeypatch):
    """Verify DIAGNOSIS_STAGE_C_ENABLED=0 skips LLM and uses fallback."""
    monkeypatch.setenv("DIAGNOSIS_STAGE_C_ENABLED", "0")
    mock_llm = MagicMock()

    findings = {"primary_pattern": "Hepatocellular"}
    diffs = [{"condition": "Acute Viral Hepatitis", "probability": 0.85}]

    res = model_reason(findings, diffs, llm_client=mock_llm)
    assert mock_llm.complete.called is False
    assert res["ai_reasoning_available"] is False
    assert res["disclaimer"] == MANDATORY_DISCLAIMER


def test_stage_c_vram_eviction_invoked():
    """Verify evict_chandra and evict_ollama are called prior to LLM completion."""
    mock_llm = MagicMock()
    mock_llm.complete.return_value = json.dumps({
        "patient_info": {"name": "Test Patient", "age": "45", "gender": "M", "reg_date": "2026-04-09"},
        "document_type": "Liver Function Panel",
        "flagged_findings": [{"item": "ALT", "status": "ELEVATED", "detail": "120 U/L", "is_critical": False}],
        "actionable_recommendations": ["Repeat LFT in 2 weeks"],
        "physician_quick_bullets": ["ALT elevated, repeat LFT"],
    })

    with patch("diagnosis.model_reasoner.evict_chandra") as mock_evict_c, \
         patch("diagnosis.model_reasoner.evict_ollama") as mock_evict_o:
        findings = {"primary_pattern": "Hepatocellular"}
        diffs = [{"condition": "Acute Viral Hepatitis"}]
        model_reason(findings, diffs, llm_client=mock_llm)

        assert mock_evict_c.called
        assert mock_evict_o.called

