"""
test_diagnosis_stageB.py — Unit tests for Stage B Rule Engine.
"""
import sys
from pathlib import Path

# Add backend root to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from diagnosis.pattern_analyser import analyse_patterns
from diagnosis.rule_engine import apply_rules


def test_acute_viral_hepatitis_top_differential():
    """Verify acute viral hepatitis produces top HIGH confidence differential."""
    lab_json = {
        "lab_results": [
            {"test_name": "ALT", "value": 1250.0, "unit": "U/L"},
            {"test_name": "AST", "value": 980.0, "unit": "U/L"},
            {"test_name": "ALP", "value": 110.0, "unit": "U/L"},
            {"test_name": "TBil", "value": 3.5, "unit": "mg/dL"},
        ]
    }
    findings = analyse_patterns(lab_json)
    diffs = apply_rules(findings)

    assert len(diffs) > 0
    top = diffs[0]
    assert top["condition"] == "Acute Viral Hepatitis"
    assert top["confidence_label"] == "HIGH"
    assert top["probability"] >= 0.75
    assert any("ALT elevated" in ev for ev in top["supporting_evidence"])
    assert any("De Ritis" in ev for ev in top["supporting_evidence"])


def test_cholestatic_top_differential():
    """Verify cholestatic lab profile matches cholestatic disease as top differential."""
    lab_json = {
        "lab_results": [
            {"test_name": "ALT", "value": 85.0, "unit": "U/L"},
            {"test_name": "ALP", "value": 420.0, "unit": "U/L"},
            {"test_name": "GGT", "value": 210.0, "unit": "U/L"},
            {"test_name": "TBil", "value": 4.2, "unit": "mg/dL"},
        ]
    }
    findings = analyse_patterns(lab_json)
    diffs = apply_rules(findings)

    assert len(diffs) > 0
    top = diffs[0]
    assert top["condition"] == "Cholestatic Liver Disease (PBC/PSC/Biliary Obstruction)"
    assert top["confidence_label"] == "HIGH"
    assert top["probability"] >= 0.75


def test_cirrhosis_urgency_differential():
    """Verify synthetic dysfunction marks cirrhosis differential as urgent."""
    lab_json = {
        "lab_results": [
            {"test_name": "TBil", "value": 4.5, "unit": "mg/dL"},
            {"test_name": "Albumin", "value": 2.4, "unit": "g/dL"},
            {"test_name": "INR", "value": 1.9, "unit": "unitless"},
            {"test_name": "Creatinine", "value": 1.8, "unit": "mg/dL"},
        ]
    }
    findings = analyse_patterns(lab_json)
    diffs = apply_rules(findings)

    cirrhosis = next((d for d in diffs if "Cirrhosis" in d["condition"]), None)
    assert cirrhosis is not None
    assert cirrhosis["urgent"] is True
    assert cirrhosis["confidence_label"] in ("HIGH", "MODERATE")


def test_all_normal_labs_no_invented_disease():
    """Verify completely normal lab panel returns single 'No abnormal hepatic pattern' entry."""
    lab_json = {
        "lab_results": [
            {"test_name": "ALT", "value": 25.0, "unit": "U/L"},
            {"test_name": "AST", "value": 22.0, "unit": "U/L"},
            {"test_name": "ALP", "value": 70.0, "unit": "U/L"},
            {"test_name": "GGT", "value": 25.0, "unit": "U/L"},
            {"test_name": "TBil", "value": 0.6, "unit": "mg/dL"},
            {"test_name": "Albumin", "value": 4.2, "unit": "g/dL"},
            {"test_name": "INR", "value": 1.0, "unit": "unitless"},
        ]
    }
    findings = analyse_patterns(lab_json)
    diffs = apply_rules(findings)

    assert len(diffs) == 1
    top = diffs[0]
    assert top["condition"] == "No abnormal hepatic pattern detected"
    assert top["probability"] == 0.0
    assert top["confidence_label"] == "LOW"
    assert top["urgent"] is False


def test_reference_completeness_and_evidence_fields():
    """Verify all differential items contain all required contract fields."""
    lab_json = {
        "lab_results": [
            {"test_name": "ALT", "value": 350.0, "unit": "U/L"},
            {"test_name": "AST", "value": 280.0, "unit": "U/L"},
        ]
    }
    findings = analyse_patterns(lab_json)
    diffs = apply_rules(findings)

    required_keys = {
        "rank",
        "condition",
        "probability",
        "confidence_label",
        "supporting_evidence",
        "against_evidence",
        "recommended_tests",
        "reference",
        "urgent",
    }
    for item in diffs:
        assert required_keys.issubset(item.keys())
        assert isinstance(item["rank"], int)
        assert isinstance(item["supporting_evidence"], list)
        assert isinstance(item["against_evidence"], list)
        assert isinstance(item["recommended_tests"], list)


def test_acute_liver_failure_rule_prioritization():
    """Verify Acute Liver Failure is triggered on INR > 1.5 + TBil > 5 and sorted first as urgent."""
    lab_json = {
        "lab_results": [
            {"test_name": "ALT", "value": 1400.0, "unit": "U/L"},
            {"test_name": "AST", "value": 1150.0, "unit": "U/L"},
            {"test_name": "INR", "value": 2.1, "unit": "unitless"},
            {"test_name": "TBil", "value": 6.0, "unit": "mg/dL"},
        ]
    }
    findings = analyse_patterns(lab_json)
    diffs = apply_rules(findings)

    assert len(diffs) > 0
    top = diffs[0]
    assert top["condition"] == "Acute Liver Failure"
    assert top["urgent"] is True
    assert top["rank"] == 1
    assert "AASLD 2022 ALF Guidelines" in top["reference"]

