# PLAN: Fix Diagnosis Module — MELD Formula, Thresholds, Missing ALF Rule

## SECTION A — GOAL DEFINITION

### 1. What is being built or changed?
Targeted fixes to the Hepatology Diagnosis Module in `backend/diagnosis/scoring.py` and `backend/diagnosis/rule_engine.py`:
- **Fix 1 (MELD Formula & Operand Order)**: Update `calculate_meld()` in `scoring.py` to use exact spec coefficients and operand order: `3.78 * ln(bilirubin) + 11.2 * ln(inr) + 9.57 * ln(creatinine) + 6.43`. Remove hardcoded floor clamp (`val = max(val, 6)`).
- **Fix 2 (MELD Mortality Interpretation Thresholds)**: Update `calculate_meld()` mortality interpretation buckets to match exact spec 90-day mortality percentages (<9: ~2%, 10-19: ~6%, 20-29: ~20%, 30-39: ~53%, >=40: ~71%).
- **Fix 3 (Acute Liver Failure Rule & Urgency Prioritization)**: Add `"Acute Liver Failure"` (ALF) to `RULE_DEFINITIONS` in `rule_engine.py` with `base_weight=0.90`, key markers `["INR", "TBil"]`, and `urgent=True`. Update `apply_rules()` sorting logic to prioritize urgent rules over non-urgent rules regardless of raw probability score.
- **Test Updates**: Update `test_diagnosis_stageA.py` MELD assertion to match updated formula output (~26 for cirrhosis fixture) and add a test in `test_diagnosis_stageB.py` for ALF prioritization.

### 2. What does "done" look like?
- `calculate_meld(1.0, 1.0, 1.0)` naturally evaluates to `6` without a floor clamp and reports `"~2% 90-day mortality"`.
- `calculate_meld(4.1, 2.1, 1.8)` evaluates to `26` and reports `"~20% 90-day mortality"`.
- `apply_rules()` prioritizes `"Acute Liver Failure"` as the top differential when INR > 1.5 and TBil > 5.0, marked `urgent=True`.
- All tests in `test_diagnosis_stageA.py`, `test_diagnosis_stageB.py`, `test_diagnosis_stageC.py`, and `test_diagnosis_e2e.py` pass 100%.

### 3. What is explicitly out of scope?
- Modifying OCR engines, preprocessing, or pipeline routing.
- Changing Stage C AI reasoner logic or prompt templates.
- Modifying existing 8 rules in `rule_engine.py` (ALF is added as the 9th rule).

---

## SECTION B — TECH STACK

- **Language**: Python 3.12
- **Frameworks & Libraries**: `pytest`, `math`
- **Files Touched**:
  - `backend/diagnosis/scoring.py`
  - `backend/diagnosis/rule_engine.py`
  - `backend/tests/test_diagnosis_stageA.py`
  - `backend/tests/test_diagnosis_stageB.py`

---

## SECTION C — SESSION MODULARIZATION

### Session 1: MELD Formula & Mortality Threshold Fixes
- **OBJECTIVE**: Update MELD calculation in `backend/diagnosis/scoring.py` and update Stage A unit test assertions in `backend/tests/test_diagnosis_stageA.py`.
- **SCOPE**:
  - `backend/diagnosis/scoring.py`
  - `backend/tests/test_diagnosis_stageA.py`
- **OUTPUT**:
  - `calculate_meld()` using formula `3.78 * ln(TBil) + 11.2 * ln(INR) + 9.57 * ln(Creatinine) + 6.43` without floor clamp.
  - Mortality interpretation string updated to 90-day mortality percentages.
  - Passing `test_diagnosis_stageA.py`.
- **CONNECTS TO**: Session 2 (Rule engine updates).
- **FAILURE SURFACE**: Logarithmic domain errors; incorrect rounding or clamping; test assertion mismatch.

### Session 2: Acute Liver Failure Rule & Differential Sorting Prioritization
- **OBJECTIVE**: Add Acute Liver Failure rule to `RULE_DEFINITIONS` in `backend/diagnosis/rule_engine.py`, update sorting in `apply_rules()`, and add Stage B test.
- **SCOPE**:
  - `backend/diagnosis/rule_engine.py`
  - `backend/tests/test_diagnosis_stageB.py`
  - `backend/tests/test_diagnosis_e2e.py`
- **OUTPUT**:
  - `rule_engine.py` containing Acute Liver Failure rule with `base_weight=0.90` and urgent sorting prioritization.
  - Passing `test_diagnosis_stageB.py` and `test_diagnosis_e2e.py`.
- **CONNECTS TO**: Completion & full test suite verification.
- **FAILURE SURFACE**: Incorrect sort key tuple; failure to match INR/TBil markers; rule weight regression.

---

## SECTION D — PROGRESS CHECKLIST

- [x] Session 1: MELD Formula & Mortality Threshold Fixes
  - [x] Update `calculate_meld()` in `backend/diagnosis/scoring.py` (coefficients, order, remove floor clamp, 90-day mortality buckets)
  - [x] Update MELD fixture assertion in `backend/tests/test_diagnosis_stageA.py`
  - [x] Run and pass `pytest backend/tests/test_diagnosis_stageA.py`
- [x] Session 2: Acute Liver Failure Rule & Sorting Prioritization
  - [x] Add Acute Liver Failure rule definition in `backend/diagnosis/rule_engine.py`
  - [x] Update `apply_rules()` sorting key to place `urgent=True` differentials first
  - [x] Add `test_acute_liver_failure_rule_prioritization` in `backend/tests/test_diagnosis_stageB.py`
  - [x] Run full test suite (`pytest -ra`) and verify smoke test (`python -u scripts/smoke_test.py`)
