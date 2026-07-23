"""
engine.py — Orchestrator for the 4-Stage Hepatology Diagnosis Pipeline.

Chains Stage A (Pattern Analyser & Scores) -> Stage B (Rule Engine Differentials) ->
Stage C (AI Clinical Brief Reasoner) -> Stage D (Report & Summary Generator).
"""
from typing import Any, Dict, Optional

try:
    from backend.diagnosis.pattern_analyser import analyse_patterns
    from backend.diagnosis.scoring import calculate_child_pugh, calculate_fib4, calculate_meld
    from backend.diagnosis.rule_engine import apply_rules
    from backend.diagnosis.model_reasoner import model_reason
    from backend.diagnosis.report_generator import generate_report, generate_text_summary
except ImportError:
    from diagnosis.pattern_analyser import analyse_patterns
    from diagnosis.scoring import calculate_child_pugh, calculate_fib4, calculate_meld
    from diagnosis.rule_engine import apply_rules
    from diagnosis.model_reasoner import model_reason
    from diagnosis.report_generator import generate_report, generate_text_summary


def run_diagnosis(
    lab_json: Any,
    llm_client: Optional[Any] = None,
    raw_ocr_text: str = "",
) -> Dict[str, Any]:
    """
    Run 4-stage hepatology diagnosis pipeline on extracted lab report JSON.

    :param lab_json: Extracted lab report dictionary, list of LabResults, or Pydantic object.
    :param llm_client: Optional LLM client instance for Stage C BioMistral execution.
    :param raw_ocr_text: Optional raw text output from OCR engine for universal brief extraction.
    :return: Dictionary containing complete structured report, text summary, and metadata.
    """
    # Stage A: Pattern Analysis
    findings = analyse_patterns(lab_json)
    extracted = findings.get("extracted_values", {})

    # Stage A: Clinical Scores
    meld_score = calculate_meld(
        tbil=extracted.get("TBil"),
        inr=extracted.get("INR"),
        creatinine=extracted.get("Creatinine"),
    )
    child_pugh_score = calculate_child_pugh(
        tbil=extracted.get("TBil"),
        albumin=extracted.get("Albumin"),
        inr=extracted.get("INR"),
    )

    # Estimate age as 50.0 default if not present in lab_json metadata
    age_val = 50.0
    if isinstance(lab_json, dict) and "document_metadata" in lab_json:
        meta = lab_json["document_metadata"] or {}
        if isinstance(meta, dict) and "patient_age" in meta:
            try:
                age_val = float(meta["patient_age"])
            except (ValueError, TypeError):
                pass

    fib4_score = calculate_fib4(
        age=age_val,
        ast=extracted.get("AST"),
        alt=extracted.get("ALT"),
        platelets=extracted.get("Platelets"),
    )

    scores = {
        "meld": meld_score,
        "child_pugh": child_pugh_score,
        "fib4": fib4_score,
    }

    # Stage B: Rule Engine Differentials
    differentials = apply_rules(findings)

    # Stage C: AI Clinical Brief Reasoner
    reasoning = model_reason(findings, differentials, llm_client=llm_client, raw_ocr_text=raw_ocr_text)


    # Stage D: Report Generation
    report = generate_report(findings, scores, differentials, reasoning)
    text_summary = generate_text_summary(report)

    top_diff = differentials[0] if differentials else None

    return {
        "report": report,
        "summary_text": text_summary,
        "top_differential": top_diff,
        "urgent_flag_count": len(findings.get("urgent_flags", [])),
    }
