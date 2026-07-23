"""
rule_engine.py — Stage B Rule-Based Differential Engine.

Applies deterministic clinical diagnostic rules against pattern findings and lab
markers, calculating weighted probabilities, confidence labels, supporting/against
evidence, and recommended confirmatory investigations.
"""
from typing import Any, Dict, List

try:
    from backend.diagnosis.hepatology_kb import HEPATOLOGY_REFERENCE_RANGES
except ImportError:
    from diagnosis.hepatology_kb import HEPATOLOGY_REFERENCE_RANGES


RULE_DEFINITIONS = [
    {
        "condition": "Acute Liver Failure",
        "primary_patterns": ["Hepatocellular"],
        "key_markers": ["INR", "TBil"],
        "base_weight": 0.90,
        "de_ritis_check": lambda dr: True,
        "r_factor_check": lambda rf: True,
        "reference": "AASLD 2022 ALF Guidelines",
        "recommended_tests": ["INR trend", "Factor V level", "Ammonia", "Liver Ultrasound", "Toxicology screen"],
    },
    {
        "condition": "Acute Viral Hepatitis",
        "primary_patterns": ["Hepatocellular"],
        "key_markers": ["ALT", "AST", "TBil"],
        "base_weight": 0.70,
        "de_ritis_check": lambda dr: dr is not None and dr <= 1.0,
        "r_factor_check": lambda rf: rf is not None and rf > 5.0,
        "reference": "Sherlock Ch 18 / AASLD Viral Hepatitis Guidelines (2018)",
        "recommended_tests": ["HBsAg", "Anti-HCV", "Anti-HAV IgM", "HBV DNA / HCV RNA"],
    },
    {
        "condition": "Alcoholic Liver Disease",
        "primary_patterns": ["Hepatocellular", "Mixed"],
        "key_markers": ["AST", "ALT", "GGT", "TBil"],
        "base_weight": 0.65,
        "de_ritis_check": lambda dr: dr is not None and dr > 2.0,
        "r_factor_check": lambda rf: True,
        "reference": "Sherlock Ch 21 / AASLD Alcoholic Liver Disease (2019)",
        "recommended_tests": ["AST", "ALT", "GGT", "CBC (MCV)", "Abdominal Ultrasound"],
    },
    {
        "condition": "Cholestatic Liver Disease (PBC/PSC/Biliary Obstruction)",
        "primary_patterns": ["Cholestatic"],
        "key_markers": ["ALP", "GGT", "DBil", "TBil"],
        "base_weight": 0.75,
        "de_ritis_check": lambda dr: True,
        "r_factor_check": lambda rf: rf is not None and rf < 2.0,
        "reference": "Sherlock Ch 13 / AASLD Cholestatic Guidelines (2020)",
        "recommended_tests": ["AMA (Antimitochondrial Ab)", "Abdominal Ultrasound / MRCP", "IgG4"],
    },
    {
        "condition": "Cirrhosis / End-Stage Liver Disease",
        "primary_patterns": ["Synthetic Dysfunction"],
        "key_markers": ["Albumin", "INR", "TBil", "Platelets"],
        "base_weight": 0.80,
        "de_ritis_check": lambda dr: True,
        "r_factor_check": lambda rf: True,
        "reference": "Sherlock Ch 9 / AASLD Cirrhosis Guidance (2021)",
        "recommended_tests": ["Liver Ultrasound with Doppler", "EGD (Varices Screening)", "MELD Score"],
    },
    {
        "condition": "NAFLD/NASH",
        "primary_patterns": ["Hepatocellular"],
        "key_markers": ["ALT", "AST", "GGT"],
        "base_weight": 0.60,
        "de_ritis_check": lambda dr: dr is not None and dr < 1.0,
        "r_factor_check": lambda rf: True,
        "reference": "Sherlock Ch 22 / AASLD NAFLD Guidance (2023)",
        "recommended_tests": ["Fasting Lipid Profile", "HbA1c", "Abdominal Ultrasound", "FIB-4 Score"],
    },
    {
        "condition": "Drug-Induced Liver Injury (DILI)",
        "primary_patterns": ["Hepatocellular", "Cholestatic", "Mixed"],
        "key_markers": ["ALT", "ALP", "TBil"],
        "base_weight": 0.55,
        "de_ritis_check": lambda dr: True,
        "r_factor_check": lambda rf: True,
        "reference": "Sherlock Ch 20 / AASLD DILI Guidance (2021)",
        "recommended_tests": ["Medication & Supplement Reconciliation", "RUCAM Score", "Eosinophil Count"],
    },
    {
        "condition": "Chronic Hepatitis B/C",
        "primary_patterns": ["Hepatocellular", "Mixed"],
        "key_markers": ["ALT", "AST"],
        "base_weight": 0.50,
        "de_ritis_check": lambda dr: True,
        "r_factor_check": lambda rf: True,
        "reference": "Sherlock Ch 19 / AASLD Chronic Hep B/C (2020)",
        "recommended_tests": ["HBV DNA Quantitative", "HCV RNA Quantitative", "Transient Elastography"],
    },
    {
        "condition": "Autoimmune Hepatitis",
        "primary_patterns": ["Hepatocellular"],
        "key_markers": ["ALT", "AST", "TP"],
        "base_weight": 0.45,
        "de_ritis_check": lambda dr: True,
        "r_factor_check": lambda rf: True,
        "reference": "Sherlock Ch 17 / AASLD AIH Guidelines (2020)",
        "recommended_tests": ["ANA", "SMA", "Serum IgG Level", "Liver Biopsy"],
    },
]


def apply_rules(findings: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Apply rule engine against pattern findings to generate ranked differential diagnoses.

    :param findings: Output dict from pattern_analyser.analyse_patterns()
    :return: List of differential diagnosis dictionaries sorted by probability.
    """
    extracted = findings.get("extracted_values", {})
    folds = findings.get("fold_over_uln", {})
    de_ritis = findings.get("de_ritis")
    r_factor = findings.get("r_factor")
    primary_pattern = findings.get("primary_pattern", "Normal")
    synthetic_dysfunction = findings.get("synthetic_dysfunction", False)
    urgent_flags = findings.get("urgent_flags", [])

    # Check if all labs are normal / unremarkable
    is_all_normal = True
    for key, val in extracted.items():
        ref = HEPATOLOGY_REFERENCE_RANGES.get(key)
        if ref:
            if ref.get("high") and val > ref["high"]:
                is_all_normal = False
                break
            if ref.get("low") and val < ref["low"]:
                is_all_normal = False
                break

    if is_all_normal or (primary_pattern == "Normal" and not urgent_flags and not synthetic_dysfunction):
        return [
            {
                "rank": 1,
                "condition": "No abnormal hepatic pattern detected",
                "probability": 0.0,
                "confidence_label": "LOW",
                "supporting_evidence": [
                    "All evaluated hepatic parameters (ALT, AST, ALP, GGT, Bilirubin, Albumin, INR) are within normal reference limits."
                ],
                "against_evidence": [],
                "recommended_tests": ["Routine clinical follow-up as indicated"],
                "reference": "Sherlock Chapter 1: Normal Liver Physiology",
                "urgent": False,
            }
        ]

    differentials: List[Dict[str, Any]] = []

    for rule in RULE_DEFINITIONS:
        condition = rule["condition"]
        prob = rule["base_weight"]
        supporting: List[str] = []
        against: List[str] = []

        # Specific trigger requirement for Acute Liver Failure (INR > 1.5 AND TBil > 5.0 per spec)
        if condition == "Acute Liver Failure":
            inr_val = extracted.get("INR")
            tbil_val = extracted.get("TBil")
            if not (inr_val is not None and inr_val > 1.5 and tbil_val is not None and tbil_val > 5.0):
                continue

        # Check pattern alignment
        pattern_matched = (primary_pattern in rule["primary_patterns"]) or (
            rule["condition"] in ("Cirrhosis / End-Stage Liver Disease", "Acute Liver Failure") and synthetic_dysfunction
        )
        if pattern_matched:
            prob += 0.10
            supporting.append(f"Primary pattern matches {primary_pattern}")

        # Check key markers
        marker_matches = 0
        for m in rule["key_markers"]:
            val = extracted.get(m)
            ref = HEPATOLOGY_REFERENCE_RANGES.get(m)
            if val is not None and ref:
                if ref.get("high") and val > ref["high"]:
                    marker_matches += 1
                    fold = folds.get(m, 1.0)
                    supporting.append(f"{m} elevated ({val} {ref['unit']}, {fold}x ULN)")
                elif ref.get("low") and val < ref["low"]:
                    if m in ("Albumin", "Platelets"):
                        marker_matches += 1
                        supporting.append(f"{m} low ({val} {ref['unit']})")
                else:
                    against.append(f"{m} normal ({val} {ref['unit']})")

        prob += marker_matches * 0.05

        # Check De Ritis ratio condition
        if rule["de_ritis_check"](de_ritis) and de_ritis is not None:
            prob += 0.10
            supporting.append(f"De Ritis ratio aligned ({de_ritis})")

        # Check R-Factor condition
        if rule["r_factor_check"](r_factor) and r_factor is not None:
            prob += 0.05
            supporting.append(f"R-Factor aligned ({r_factor})")

        # Only include if there is supporting evidence or pattern match
        if supporting or pattern_matched:
            clamped_prob = round(min(max(prob, 0.0), 1.0), 2)
            if clamped_prob >= 0.75:
                conf_label = "HIGH"
            elif clamped_prob >= 0.50:
                conf_label = "MODERATE"
            else:
                conf_label = "LOW"

            is_urgent = False
            if condition == "Acute Liver Failure":
                is_urgent = True
            elif condition == "Cirrhosis / End-Stage Liver Disease" and (synthetic_dysfunction or any("INR > 1.5" in f for f in urgent_flags)):
                is_urgent = True
            elif any("ALT > 560" in f or "TBil > 10" in f or "INR > 1.5" in f for f in urgent_flags):
                is_urgent = True

            differentials.append(
                {
                    "condition": condition,
                    "probability": clamped_prob,
                    "confidence_label": conf_label,
                    "supporting_evidence": supporting,
                    "against_evidence": against,
                    "recommended_tests": rule["recommended_tests"],
                    "reference": rule["reference"],
                    "urgent": is_urgent,
                }
            )

    # Sort by urgent (True first) then probability descending
    differentials.sort(key=lambda x: (not x["urgent"], -x["probability"]))

    # Assign 1-based ranks
    for idx, diff in enumerate(differentials, start=1):
        diff["rank"] = idx

    return differentials
