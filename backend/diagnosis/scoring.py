"""
scoring.py — Stage A Clinical Risk Calculators.

Implements MELD, Child-Pugh, and FIB-4 scoring algorithms with parameter clamping,
logarithmic domain validation, and input default notes.
"""
import math
from typing import Any, Dict, Optional


def calculate_meld(
    tbil: Optional[float],
    inr: Optional[float],
    creatinine: Optional[float],
    dialysis: bool = False,
) -> Dict[str, Any]:
    """
    Calculate Model for End-Stage Liver Disease (MELD) score.

    Formula: 9.57 * ln(Creatinine) + 3.57 * ln(TBil) + 11.2 * ln(INR) + 6.43
    """
    if tbil is None or inr is None or creatinine is None:
        return {
            "value": None,
            "interpretation": "MELD calculation skipped: missing required lab values",
            "note_if_inputs_defaulted": "Requires TBil, INR, and Creatinine",
        }

    # Parameter lower bounds (1.0 minimum per MELD spec)
    c_val = max(float(creatinine), 1.0)
    b_val = max(float(tbil), 1.0)
    i_val = max(float(inr), 1.0)

    # Dialysis or creatinine > 4.0 cap
    if dialysis or c_val > 4.0:
        c_val = 4.0

    meld_raw = (
        3.78 * math.log(b_val)
        + 11.2 * math.log(i_val)
        + 9.57 * math.log(c_val)
        + 6.43
    )

    # Round to integer and clamp to 40 max
    val = min(round(meld_raw), 40)

    if val >= 40:
        interp = "~71% 90-day mortality"
    elif val >= 30:
        interp = "~53% 90-day mortality"
    elif val >= 20:
        interp = "~20% 90-day mortality"
    elif val >= 10:
        interp = "~6% 90-day mortality"
    else:
        interp = "~2% 90-day mortality"

    note = "Dialysis setting applied (Creatinine set to 4.0)" if dialysis else "Calculated with exact lab values"

    return {
        "value": val,
        "interpretation": interp,
        "note_if_inputs_defaulted": note,
    }


def calculate_child_pugh(
    tbil: Optional[float],
    albumin: Optional[float],
    inr: Optional[float],
    ascites: str = "absent",
    encephalopathy: str = "none",
) -> Dict[str, Any]:
    """
    Calculate Child-Pugh score and class grade for liver disease severity.
    """
    if tbil is None or albumin is None or inr is None:
        return {
            "score": None,
            "class_grade": None,
            "interpretation": "Child-Pugh calculation skipped: missing lab values",
            "note_if_inputs_defaulted": "Requires TBil, Albumin, and INR",
        }

    # Points for TBil
    if tbil < 2.0:
        b_pts = 1
    elif tbil <= 3.0:
        b_pts = 2
    else:
        b_pts = 3

    # Points for Albumin
    if albumin > 3.5:
        a_pts = 1
    elif albumin >= 2.8:
        a_pts = 2
    else:
        a_pts = 3

    # Points for INR
    if inr < 1.7:
        i_pts = 1
    elif inr <= 2.2:
        i_pts = 2
    else:
        i_pts = 3

    # Points for Ascites
    asc_clean = str(ascites).lower()
    if any(k in asc_clean for k in ["absent", "none", "no"]):
        asc_pts = 1
    elif any(k in asc_clean for k in ["mild", "slight"]):
        asc_pts = 2
    else:
        asc_pts = 3

    # Points for Encephalopathy
    enc_clean = str(encephalopathy).lower()
    if any(k in enc_clean for k in ["none", "absent", "no"]):
        enc_pts = 1
    elif any(k in enc_clean for k in ["1", "2", "mild"]):
        enc_pts = 2
    else:
        enc_pts = 3

    total_score = b_pts + a_pts + i_pts + asc_pts + enc_pts

    if total_score <= 6:
        grade = "Class A"
        interp = "Well-compensated disease (1-yr survival 100%)"
    elif total_score <= 9:
        grade = "Class B"
        interp = "Significant functional compromise (1-yr survival 80%)"
    else:
        grade = "Class C"
        interp = "Decompensated disease (1-yr survival 45%)"

    return {
        "score": total_score,
        "class_grade": grade,
        "interpretation": interp,
        "note_if_inputs_defaulted": f"Clinical inputs: Ascites={ascites}, Encephalopathy={encephalopathy}",
    }


def calculate_fib4(
    age: Optional[float],
    ast: Optional[float],
    alt: Optional[float],
    platelets: Optional[float],
) -> Dict[str, Any]:
    """
    Calculate Fibrosis-4 (FIB-4) index for liver fibrosis.

    Formula: (Age * AST) / (Platelets * sqrt(ALT))
    """
    if age is None or ast is None or alt is None or platelets is None:
        return {
            "value": None,
            "interpretation": "FIB-4 calculation skipped: missing required values",
            "note_if_inputs_defaulted": "Requires Age, AST, ALT, and Platelets",
        }

    if alt <= 0 or platelets <= 0:
        return {
            "value": None,
            "interpretation": "FIB-4 calculation skipped: non-positive ALT or Platelets",
            "note_if_inputs_defaulted": "ALT and Platelets must be > 0",
        }

    fib4_raw = (float(age) * float(ast)) / (float(platelets) * math.sqrt(float(alt)))
    val = round(fib4_raw, 2)

    if val < 1.45:
        interp = "Low risk of advanced fibrosis (NPV >90%)"
    elif val <= 3.25:
        interp = "Indeterminate risk — further testing (elastography) recommended"
    else:
        interp = "High risk of advanced fibrosis/cirrhosis (PPV >80%)"

    return {
        "value": val,
        "interpretation": interp,
        "note_if_inputs_defaulted": "Calculated with exact lab parameters",
    }
