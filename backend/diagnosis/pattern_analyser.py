"""
pattern_analyser.py — Stage A Pattern Analyser.

Calculates fold-over-ULN, De Ritis ratio (AST/ALT), R-factor, synthetic dysfunction
flags, urgent lab alerts, and determines primary hepatic injury patterns from
extracted lab results.
"""
from typing import Any, Dict, List, Optional, Union

try:
    from backend.diagnosis.hepatology_kb import HEPATOLOGY_REFERENCE_RANGES, normalise_test_key
except ImportError:
    from diagnosis.hepatology_kb import HEPATOLOGY_REFERENCE_RANGES, normalise_test_key


# Mapping from raw/normalized test names to canonical key representation
KEY_ALIASES = {
    "alt": "ALT",
    "alanine aminotransferase": "ALT",
    "sgpt": "ALT",
    "ast": "AST",
    "aspartate aminotransferase": "AST",
    "sgot": "AST",
    "alp": "ALP",
    "alkaline phosphatase": "ALP",
    "ggt": "GGT",
    "gamma glutamyl transferase": "GGT",
    "total bilirubin": "TBil",
    "t bil": "TBil",
    "tbil": "TBil",
    "direct bilirubin": "DBil",
    "d bil": "DBil",
    "dbil": "DBil",
    "albumin": "Albumin",
    "alb": "Albumin",
    "inr": "INR",
    "total protein": "TP",
    "tp": "TP",
    "platelets": "Platelets",
    "plt": "Platelets",
    "platelet count": "Platelets",
    "creatinine": "Creatinine",
    "cr": "Creatinine",
    "serum creatinine": "Creatinine",
    "s creatinine": "Creatinine",
    "age": "Age",
}


def _extract_numeric(val: Any) -> Optional[float]:
    """Safely convert a lab value to float, handling strings with operators."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, str):
        # Clean operators like '>', '<', '~', whitespace
        cleaned = val.replace(">", "").replace("<", "").replace("~", "").strip()
        try:
            return float(cleaned)
        except ValueError:
            return None
    return None


def _get_lab_items(lab_json: Any) -> List[Dict[str, Any]]:
    """Unpack lab_json dict, Pydantic object, or list into a list of dict items."""
    if hasattr(lab_json, "model_dump"):
        lab_json = lab_json.model_dump()
    elif hasattr(lab_json, "dict"):
        lab_json = lab_json.dict()

    if isinstance(lab_json, dict):
        results = lab_json.get("lab_results") or lab_json.get("results") or []
    elif isinstance(lab_json, list):
        results = lab_json
    else:
        results = []

    clean_results = []
    for item in results:
        if hasattr(item, "model_dump"):
            clean_results.append(item.model_dump())
        elif hasattr(item, "dict"):
            clean_results.append(item.dict())
        elif isinstance(item, dict):
            clean_results.append(item)
    return clean_results


def analyse_patterns(lab_json: Any) -> Dict[str, Any]:
    """
    Analyse extracted lab results to compute hepatic patterns, ratios, and flags.

    :param lab_json: LabReport dict, list of LabResult dicts, or Pydantic model.
    :return: Structured pattern findings dictionary.
    """
    items = _get_lab_items(lab_json)
    extracted: Dict[str, float] = {}
    raw_flags: Dict[str, str] = {}

    for item in items:
        test_name = item.get("test_name", "")
        test_abbr = item.get("test_abbreviation", "")
        norm_key = normalise_test_key(test_name)
        norm_abbr = normalise_test_key(test_abbr) if test_abbr else ""

        canonical = KEY_ALIASES.get(norm_key) or KEY_ALIASES.get(norm_abbr)
        if canonical and canonical not in extracted:
            val = _extract_numeric(item.get("value"))
            if val is not None:
                extracted[canonical] = val
                raw_flags[canonical] = item.get("flag", "UNKNOWN")

    # Compute fold-over-ULN for known reference tests
    fold_over_uln: Dict[str, float] = {}
    for key, val in extracted.items():
        ref = HEPATOLOGY_REFERENCE_RANGES.get(key)
        if ref and ref.get("high"):
            fold_over_uln[key] = round(val / ref["high"], 2)

    # De Ritis Ratio (AST / ALT)
    ast_val = extracted.get("AST")
    alt_val = extracted.get("ALT")
    de_ritis: Optional[float] = None
    if ast_val is not None and alt_val is not None and alt_val > 0:
        de_ritis = round(ast_val / alt_val, 2)

    # R-Factor = (ALT / 56.0) / (ALP / 147.0)
    alp_val = extracted.get("ALP")
    r_factor: Optional[float] = None
    r_factor_pattern: Optional[str] = None
    if alt_val is not None and alp_val is not None and alp_val > 0:
        r_val = (alt_val / 56.0) / (alp_val / 147.0)
        r_factor = round(r_val, 2)
        if r_factor > 5.0:
            r_factor_pattern = "Hepatocellular"
        elif r_factor < 2.0:
            r_factor_pattern = "Cholestatic"
        else:
            r_factor_pattern = "Mixed"

    # Synthetic dysfunction (Albumin < 3.0 or INR > 1.5)
    alb_val = extracted.get("Albumin")
    inr_val = extracted.get("INR")
    synthetic_dysfunction = False
    if (alb_val is not None and alb_val < 3.0) or (inr_val is not None and inr_val > 1.5):
        synthetic_dysfunction = True

    # Urgent flags
    urgent_flags: List[str] = []
    tbil_val = extracted.get("TBil")
    if inr_val is not None and inr_val > 1.5:
        urgent_flags.append(f"INR > 1.5 (current: {inr_val})")
    if alt_val is not None and alt_val > 560.0:
        urgent_flags.append(f"ALT > 560 U/L (10x ULN severe injury, current: {alt_val})")
    if tbil_val is not None and tbil_val > 10.0:
        urgent_flags.append(f"TBil > 10.0 mg/dL (severe hyperbilirubinemia, current: {tbil_val})")
    if alb_val is not None and alb_val < 2.5:
        urgent_flags.append(f"Albumin < 2.5 g/dL (severe synthetic failure, current: {alb_val})")

    # Primary pattern determination method & classification
    pattern_method = "r_factor" if r_factor is not None else "marker_fallback"
    if r_factor_pattern:
        primary_pattern = r_factor_pattern
    elif synthetic_dysfunction:
        primary_pattern = "Synthetic Dysfunction"
    elif alt_val is not None and alt_val > HEPATOLOGY_REFERENCE_RANGES["ALT"]["high"]:
        primary_pattern = "Hepatocellular"
    elif alp_val is not None and alp_val > HEPATOLOGY_REFERENCE_RANGES["ALP"]["high"]:
        primary_pattern = "Cholestatic"
    else:
        primary_pattern = "Normal"

    return {
        "extracted_values": extracted,
        "fold_over_uln": fold_over_uln,
        "de_ritis": de_ritis,
        "r_factor": r_factor,
        "r_factor_pattern": r_factor_pattern,
        "synthetic_dysfunction": synthetic_dysfunction,
        "urgent_flags": urgent_flags,
        "pattern_method": pattern_method,
        "primary_pattern": primary_pattern,
        "raw_flags": raw_flags,
    }
