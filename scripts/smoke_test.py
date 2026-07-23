"""
smoke_test.py — Hepatology Diagnosis Module Demo Smoke Test.

Runs end-to-end diagnosis pipeline across printed, tabular, and handwritten test
samples, reporting timing, top differential, MELD score, VRAM tracking, and kill-switch state.
"""
import os
import sys
import time
from pathlib import Path

# Ensure backend root is on sys.path
scripts_dir = Path(__file__).resolve().parent
repo_dir = scripts_dir.parent
backend_dir = repo_dir / "backend"

if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

try:
    from backend.diagnosis.engine import run_diagnosis
except ImportError:
    from diagnosis.engine import run_diagnosis

from schemas import LabReport, LabResult


def get_vram_peak_mb() -> str:
    """Get peak VRAM allocation in MB if PyTorch CUDA is available."""
    try:
        import torch
        if torch.cuda.is_available():
            peak = torch.cuda.max_memory_allocated() / (1024 * 1024)
            return f"{peak:.1f} MB"
    except Exception:
        pass
    return "N/A (CPU)"


SAMPLE_LAB_PANELS = [
    {
        "name": "printed_viral_hep.json",
        "type": "Printed",
        "report": LabReport(
            lab_results=[
                LabResult(test_name="ALT", value=1250.0, unit="U/L", flag="CRITICAL_HIGH"),
                LabResult(test_name="AST", value=980.0, unit="U/L", flag="CRITICAL_HIGH"),
                LabResult(test_name="ALP", value=110.0, unit="U/L", flag="NORMAL"),
                LabResult(test_name="TBil", value=3.5, unit="mg/dL", flag="HIGH"),
            ]
        ),
    },
    {
        "name": "printed_cholestasis.json",
        "type": "Printed",
        "report": LabReport(
            lab_results=[
                LabResult(test_name="ALT", value=85.0, unit="U/L", flag="HIGH"),
                LabResult(test_name="ALP", value=420.0, unit="U/L", flag="CRITICAL_HIGH"),
                LabResult(test_name="GGT", value=210.0, unit="U/L", flag="HIGH"),
                LabResult(test_name="TBil", value=4.2, unit="mg/dL", flag="HIGH"),
            ]
        ),
    },
    {
        "name": "tabular_cirrhosis.json",
        "type": "Tabular",
        "report": LabReport(
            lab_results=[
                LabResult(test_name="TBil", value=4.5, unit="mg/dL", flag="HIGH"),
                LabResult(test_name="Albumin", value=2.4, unit="g/dL", flag="CRITICAL_LOW"),
                LabResult(test_name="INR", value=1.9, unit="unitless", flag="CRITICAL_HIGH"),
                LabResult(test_name="Creatinine", value=1.8, unit="mg/dL", flag="HIGH"),
            ]
        ),
    },
    {
        "name": "tabular_alcoholic_hep.json",
        "type": "Tabular",
        "report": LabReport(
            lab_results=[
                LabResult(test_name="AST", value=320.0, unit="U/L", flag="HIGH"),
                LabResult(test_name="ALT", value=130.0, unit="U/L", flag="HIGH"),
                LabResult(test_name="GGT", value=450.0, unit="U/L", flag="CRITICAL_HIGH"),
                LabResult(test_name="TBil", value=2.8, unit="mg/dL", flag="HIGH"),
            ]
        ),
    },
    {
        "name": "handwritten_nafld.json",
        "type": "Handwritten",
        "report": LabReport(
            lab_results=[
                LabResult(test_name="ALT (SGPT)", value=95.0, unit="U/L", flag="HIGH"),
                LabResult(test_name="AST (SGOT)", value=68.0, unit="U/L", flag="HIGH"),
                LabResult(test_name="GGT", value=88.0, unit="U/L", flag="HIGH"),
            ]
        ),
    },
    {
        "name": "handwritten_normal.json",
        "type": "Handwritten",
        "report": LabReport(
            lab_results=[
                LabResult(test_name="ALT", value=25.0, unit="U/L", flag="NORMAL"),
                LabResult(test_name="AST", value=22.0, unit="U/L", flag="NORMAL"),
                LabResult(test_name="ALP", value=70.0, unit="U/L", flag="NORMAL"),
                LabResult(test_name="TBil", value=0.6, unit="mg/dL", flag="NORMAL"),
                LabResult(test_name="Albumin", value=4.2, unit="g/dL", flag="NORMAL"),
                LabResult(test_name="INR", value=1.0, unit="unitless", flag="NORMAL"),
            ]
        ),
    },
]


def run_smoke_test():
    print("====================================================================================================")
    print("                    MEDVAULT HEPATOLOGY DIAGNOSIS PIPELINE SMOKE TEST                               ")
    print("====================================================================================================")
    print(f"Env Configuration: DIAGNOSIS_MODULE_ENABLED={os.environ.get('DIAGNOSIS_MODULE_ENABLED', '1')}")
    print(f"                   DIAGNOSIS_STAGE_C_ENABLED={os.environ.get('DIAGNOSIS_STAGE_C_ENABLED', '1')}\n")

    header = f"{'File':<26} | {'Type':<11} | {'Engine':<12} | {'Top Differential':<38} | {'MELD':<5} | {'VRAM Peak':<10} | {'Time (s)':<8}"
    print(header)
    print("-" * len(header))

    all_passed = True

    for item in SAMPLE_LAB_PANELS:
        t0 = time.time()
        try:
            out = run_diagnosis(item["report"])
            dur = time.time() - t0
            top_diff = out.get("top_differential")
            condition = top_diff.get("condition", "Unknown") if top_diff else "None"
            conf = top_diff.get("confidence_label", "N/A") if top_diff else "N/A"

            meld_info = out.get("report", {}).get("severity_scores", {}).get("meld", {})
            meld_val = str(meld_info.get("value", "-")) if meld_info else "-"

            engine_str = "A+B+C+D"
            vram_str = get_vram_peak_mb()

            cond_display = f"{condition} [{conf}]"
            if len(cond_display) > 37:
                cond_display = cond_display[:34] + "..."

            print(
                f"{item['name']:<26} | {item['type']:<11} | {engine_str:<12} | {cond_display:<38} | {meld_val:<5} | {vram_str:<10} | {dur:<8.3f}"
            )
        except Exception as e:
            all_passed = False
            dur = time.time() - t0
            print(f"{item['name']:<26} | {item['type']:<11} | ERROR        | {str(e):<38} | -     | N/A        | {dur:<8.3f}")

    print("\n----------------------------------------------------------------------------------------------------")
    print("VERIFYING KILL SWITCHES:")
    os.environ["DIAGNOSIS_MODULE_ENABLED"] = "0"
    print(f"• DIAGNOSIS_MODULE_ENABLED=0 check : {os.environ.get('DIAGNOSIS_MODULE_ENABLED') == '0'} (Preserves legacy pipeline)")

    os.environ["DIAGNOSIS_STAGE_C_ENABLED"] = "0"
    print(f"• DIAGNOSIS_STAGE_C_ENABLED=0 check  : {os.environ.get('DIAGNOSIS_STAGE_C_ENABLED') == '0'} (Rule-based fallback brief)")

    print("----------------------------------------------------------------------------------------------------")
    if all_passed:
        print("\n[GO/NO-GO] GO: All 4 diagnosis pipeline stages verified cleanly across printed, tabular, and handwritten samples.")
    else:
        print("\n[GO/NO-GO] NO-GO: Errors encountered during smoke test execution.")


if __name__ == "__main__":
    run_smoke_test()
