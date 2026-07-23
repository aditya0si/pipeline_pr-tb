"""
test_diagnosis_stageA.py — Unit tests for Stage A KB, Pattern Analyser & Scoring.
"""
import sys
from pathlib import Path

# Add backend root to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from diagnosis.hepatology_kb import HEPATOLOGY_KB, HEPATOLOGY_REFERENCE_RANGES
from diagnosis.pattern_analyser import analyse_patterns
from diagnosis.scoring import calculate_child_pugh, calculate_fib4, calculate_meld


def test_viral_hepatitis_pattern_and_deritis():
    """Test acute viral pattern, De Ritis calculation (~0.78), and R-Factor (>5)."""
    lab_json = {
        "lab_results": [
            {"test_name": "ALT", "value": 1250.0, "unit": "U/L", "flag": "CRITICAL_HIGH"},
            {"test_name": "AST", "value": 980.0, "unit": "U/L", "flag": "CRITICAL_HIGH"},
            {"test_name": "ALP", "value": 110.0, "unit": "U/L", "flag": "NORMAL"},
            {"test_name": "TBil", "value": 3.5, "unit": "mg/dL", "flag": "HIGH"},
        ]
    }
    res = analyse_patterns(lab_json)
    assert res["de_ritis"] == 0.78
    assert res["r_factor"] is not None and res["r_factor"] > 5.0
    assert res["r_factor_pattern"] == "Hepatocellular"
    assert res["primary_pattern"] == "Hepatocellular"
    assert any("ALT > 560" in flag for flag in res["urgent_flags"])


def test_cholestatic_pattern_and_r_factor():
    """Test cholestatic pattern classification with R-factor (<2)."""
    lab_json = {
        "lab_results": [
            {"test_name": "ALT", "value": 85.0, "unit": "U/L", "flag": "HIGH"},
            {"test_name": "ALP", "value": 420.0, "unit": "U/L", "flag": "CRITICAL_HIGH"},
            {"test_name": "GGT", "value": 210.0, "unit": "U/L", "flag": "HIGH"},
            {"test_name": "TBil", "value": 4.2, "unit": "mg/dL", "flag": "HIGH"},
        ]
    }
    res = analyse_patterns(lab_json)
    assert res["r_factor"] is not None and res["r_factor"] < 2.0
    assert res["r_factor_pattern"] == "Cholestatic"
    assert res["primary_pattern"] == "Cholestatic"


def test_cirrhosis_synthetic_dysfunction_and_meld():
    """Test synthetic dysfunction flags, urgent lab alerts, and MELD score."""
    lab_json = {
        "lab_results": [
            {"test_name": "TBil", "value": 4.5, "unit": "mg/dL", "flag": "HIGH"},
            {"test_name": "Albumin", "value": 2.4, "unit": "g/dL", "flag": "CRITICAL_LOW"},
            {"test_name": "INR", "value": 1.9, "unit": "unitless", "flag": "CRITICAL_HIGH"},
            {"test_name": "Creatinine", "value": 1.8, "unit": "mg/dL", "flag": "HIGH"},
        ]
    }
    res = analyse_patterns(lab_json)
    assert res["synthetic_dysfunction"] is True
    assert any("INR > 1.5" in flag for flag in res["urgent_flags"])
    assert any("Albumin < 2.5" in flag for flag in res["urgent_flags"])

    meld = calculate_meld(tbil=4.1, inr=2.1, creatinine=1.8)
    assert meld["value"] == 26
    assert meld["interpretation"] == "~20% 90-day mortality"

    meld_norm = calculate_meld(tbil=1.0, inr=1.0, creatinine=1.0)
    assert meld_norm["value"] == 6
    assert meld_norm["interpretation"] == "~2% 90-day mortality"


def test_divide_by_zero_safeguards():
    """Verify missing/zero ALT/ALP and non-positive inputs return None safely."""
    res_zero = analyse_patterns({
        "lab_results": [
            {"test_name": "ALT", "value": 0.0, "unit": "U/L"},
            {"test_name": "AST", "value": 40.0, "unit": "U/L"},
        ]
    })
    assert res_zero["de_ritis"] is None

    fib4_res = calculate_fib4(age=45, ast=40, alt=0, platelets=200)
    assert fib4_res["value"] is None

    meld_res = calculate_meld(tbil=0.1, inr=0.5, creatinine=0.0)
    assert meld_res["value"] is not None  # Clamped to 1.0 internally


def test_missing_alp_fallback_pattern():
    """Verify fallback pattern classification when ALP is missing."""
    lab_json = {
        "lab_results": [
            {"test_name": "ALT", "value": 350.0, "unit": "U/L", "flag": "HIGH"},
            {"test_name": "AST", "value": 280.0, "unit": "U/L", "flag": "HIGH"},
        ]
    }
    res = analyse_patterns(lab_json)
    assert res["r_factor"] is None
    assert res["pattern_method"] == "marker_fallback"
    assert res["primary_pattern"] == "Hepatocellular"


def test_kb_completeness_and_ranges():
    """Verify reference ranges and 10 condition KB entries per specification."""
    required_ranges = ["ALT", "AST", "ALP", "GGT", "TBil", "DBil", "Albumin", "INR", "TP", "Platelets"]
    for r in required_ranges:
        assert r in HEPATOLOGY_REFERENCE_RANGES
        assert "low" in HEPATOLOGY_REFERENCE_RANGES[r]
        assert "high" in HEPATOLOGY_REFERENCE_RANGES[r]

    assert len(HEPATOLOGY_KB) == 10
    for key, item in HEPATOLOGY_KB.items():
        assert "pattern" in item
        assert "key_markers" in item
        assert "chapter_reference" in item
        assert "guideline_reference" in item
        assert "key_tests" in item
