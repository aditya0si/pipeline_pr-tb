import { useState } from "react";

interface Props {
  onBack: () => void;
  notify: (msg: string, type?: "success" | "error") => void;
}

interface LabTest {
  name: string;
  value: number;
  unit: string;
  refLow: number;
  refHigh: number;
  critLow?: number;
  critHigh?: number;
  history?: number[];
}

interface Panel {
  name: string;
  tests: LabTest[];
}

const PANELS: Record<string, Panel> = {
  CBC: {
    name: "Complete Blood Count (CBC)",
    tests: [
      { name: "WBC", value: 11.2, unit: "x10^3/uL", refLow: 4.5, refHigh: 11.0, critLow: 2.0, critHigh: 30.0, history: [7.1, 8.3, 9.0, 10.1, 11.2] },
      { name: "RBC", value: 4.8, unit: "x10^6/uL", refLow: 4.5, refHigh: 5.5, history: [4.9, 4.7, 4.6, 4.8, 4.8] },
      { name: "Hemoglobin", value: 13.2, unit: "g/dL", refLow: 13.5, refHigh: 17.5, critLow: 7.0, critHigh: 20.0, history: [15.1, 14.8, 14.0, 13.6, 13.2] },
      { name: "Hematocrit", value: 39.1, unit: "%", refLow: 38.8, refHigh: 50.0, history: [45.0, 43.2, 41.5, 40.0, 39.1] },
      { name: "Platelets", value: 245, unit: "x10^3/uL", refLow: 150, refHigh: 400, critLow: 50, critHigh: 1000, history: [220, 230, 240, 250, 245] },
      { name: "MCV", value: 82.0, unit: "fL", refLow: 80, refHigh: 100, history: [85, 84, 83, 82.5, 82.0] },
      { name: "MCH", value: 27.5, unit: "pg", refLow: 27, refHigh: 33, history: [30, 29.5, 28.5, 28.0, 27.5] },
      { name: "MCHC", value: 33.8, unit: "g/dL", refLow: 32, refHigh: 36, history: [34.0, 33.9, 33.8, 33.7, 33.8] },
      { name: "RDW", value: 14.8, unit: "%", refLow: 11.5, refHigh: 14.5, history: [12.5, 13.0, 13.8, 14.2, 14.8] },
      { name: "MPV", value: 10.2, unit: "fL", refLow: 7.5, refHigh: 11.5, history: [9.0, 9.5, 9.8, 10.0, 10.2] },
    ],
  },
  CMP: {
    name: "Comprehensive Metabolic Panel (CMP)",
    tests: [
      { name: "Glucose", value: 142, unit: "mg/dL", refLow: 70, refHigh: 100, critLow: 40, critHigh: 500, history: [95, 102, 118, 130, 142] },
      { name: "BUN", value: 18, unit: "mg/dL", refLow: 7, refHigh: 20, history: [14, 15, 16, 17, 18] },
      { name: "Creatinine", value: 1.1, unit: "mg/dL", refLow: 0.7, refHigh: 1.3, history: [0.9, 1.0, 1.0, 1.1, 1.1] },
      { name: "Sodium", value: 140, unit: "mEq/L", refLow: 136, refHigh: 145, critLow: 120, critHigh: 160, history: [139, 140, 141, 140, 140] },
      { name: "Potassium", value: 4.2, unit: "mEq/L", refLow: 3.5, refHigh: 5.0, critLow: 2.5, critHigh: 6.5, history: [4.0, 4.1, 4.3, 4.2, 4.2] },
      { name: "Calcium", value: 9.5, unit: "mg/dL", refLow: 8.5, refHigh: 10.5, history: [9.2, 9.3, 9.4, 9.5, 9.5] },
      { name: "CO2", value: 24, unit: "mEq/L", refLow: 23, refHigh: 29, history: [25, 24, 24, 25, 24] },
      { name: "Chloride", value: 102, unit: "mEq/L", refLow: 98, refHigh: 106, history: [100, 101, 102, 101, 102] },
    ],
  },
  Lipid: {
    name: "Lipid Panel",
    tests: [
      { name: "Total Cholesterol", value: 238, unit: "mg/dL", refLow: 0, refHigh: 200, history: [195, 210, 220, 230, 238] },
      { name: "LDL", value: 155, unit: "mg/dL", refLow: 0, refHigh: 100, history: [98, 115, 130, 145, 155] },
      { name: "HDL", value: 42, unit: "mg/dL", refLow: 40, refHigh: 999, history: [52, 48, 45, 43, 42] },
      { name: "Triglycerides", value: 205, unit: "mg/dL", refLow: 0, refHigh: 150, history: [130, 155, 175, 190, 205] },
      { name: "VLDL", value: 41, unit: "mg/dL", refLow: 0, refHigh: 30, history: [26, 31, 35, 38, 41] },
    ],
  },
  Thyroid: {
    name: "Thyroid Panel",
    tests: [
      { name: "TSH", value: 5.8, unit: "mIU/L", refLow: 0.4, refHigh: 4.0, history: [2.1, 3.0, 3.8, 4.5, 5.8] },
      { name: "Free T4", value: 0.9, unit: "ng/dL", refLow: 0.8, refHigh: 1.8, history: [1.4, 1.2, 1.1, 1.0, 0.9] },
      { name: "Free T3", value: 2.5, unit: "pg/mL", refLow: 2.3, refHigh: 4.2, history: [3.5, 3.2, 2.9, 2.7, 2.5] },
      { name: "T4 Total", value: 6.0, unit: "ug/dL", refLow: 4.5, refHigh: 12.0, history: [8.5, 7.8, 7.0, 6.5, 6.0] },
    ],
  },
  Liver: {
    name: "Liver Panel",
    tests: [
      { name: "ALT", value: 52, unit: "U/L", refLow: 7, refHigh: 40, history: [25, 30, 38, 45, 52] },
      { name: "AST", value: 48, unit: "U/L", refLow: 8, refHigh: 33, history: [20, 28, 35, 42, 48] },
      { name: "ALP", value: 95, unit: "U/L", refLow: 44, refHigh: 147, history: [80, 85, 88, 92, 95] },
      { name: "Bilirubin Total", value: 1.0, unit: "mg/dL", refLow: 0.1, refHigh: 1.2, history: [0.6, 0.7, 0.8, 0.9, 1.0] },
      { name: "Albumin", value: 4.0, unit: "g/dL", refLow: 3.5, refHigh: 5.0, history: [4.2, 4.1, 4.1, 4.0, 4.0] },
      { name: "Total Protein", value: 7.0, unit: "g/dL", refLow: 6.0, refHigh: 8.3, history: [7.2, 7.1, 7.0, 7.0, 7.0] },
    ],
  },
  Renal: {
    name: "Renal Panel",
    tests: [
      { name: "BUN", value: 22, unit: "mg/dL", refLow: 7, refHigh: 20, history: [15, 17, 19, 20, 22] },
      { name: "Creatinine", value: 1.4, unit: "mg/dL", refLow: 0.7, refHigh: 1.3, critHigh: 10.0, history: [0.9, 1.0, 1.1, 1.2, 1.4] },
      { name: "eGFR", value: 58, unit: "mL/min", refLow: 60, refHigh: 999, history: [85, 75, 68, 62, 58] },
      { name: "Uric Acid", value: 7.2, unit: "mg/dL", refLow: 3.0, refHigh: 7.0, history: [5.5, 6.0, 6.5, 6.8, 7.2] },
    ],
  },
  Coagulation: {
    name: "Coagulation Panel",
    tests: [
      { name: "PT", value: 13.5, unit: "sec", refLow: 11.0, refHigh: 13.5, history: [12.0, 12.5, 13.0, 13.2, 13.5] },
      { name: "INR", value: 1.1, unit: "", refLow: 0.8, refHigh: 1.2, critHigh: 4.5, history: [1.0, 1.0, 1.0, 1.1, 1.1] },
      { name: "aPTT", value: 32, unit: "sec", refLow: 25, refHigh: 35, critHigh: 100, history: [28, 29, 30, 31, 32] },
      { name: "Fibrinogen", value: 310, unit: "mg/dL", refLow: 200, refHigh: 400, history: [280, 290, 300, 305, 310] },
      { name: "D-Dimer", value: 0.4, unit: "ug/mL", refLow: 0, refHigh: 0.5, history: [0.2, 0.25, 0.3, 0.35, 0.4] },
    ],
  },
  Urinalysis: {
    name: "Urinalysis",
    tests: [
      { name: "pH", value: 6.0, unit: "", refLow: 4.5, refHigh: 8.0, history: [5.5, 5.8, 6.0, 6.2, 6.0] },
      { name: "Specific Gravity", value: 1.02, unit: "", refLow: 1.005, refHigh: 1.03, history: [1.015, 1.018, 1.02, 1.02, 1.02] },
      { name: "Protein", value: 0, unit: "mg/dL", refLow: 0, refHigh: 14, history: [0, 0, 0, 0, 0] },
      { name: "Glucose (Urine)", value: 0, unit: "mg/dL", refLow: 0, refHigh: 15, history: [0, 0, 0, 0, 0] },
    ],
  },
};

const AI_INSIGHTS: Record<string, { summary: string; abnormalities: string[]; followUp: string[]; differentials: string[]; trend: string }> = {
  CBC: {
    summary: "The CBC reveals a mildly elevated WBC count (11.2 x10^3/uL) above the upper reference limit, along with low hemoglobin (13.2 g/dL) and an elevated RDW (14.8%). These findings together suggest a developing anemia with possible early inflammatory or infectious process.",
    abnormalities: [
      "WBC 11.2 -- mildly elevated; may indicate infection, inflammation, or stress response",
      "Hemoglobin 13.2 -- below reference range (13.5-17.5); mild anemia",
      "RDW 14.8% -- elevated above 14.5%; suggests anisocytosis, common in iron deficiency",
    ],
    followUp: ["Reticulocyte count", "Iron studies (serum iron, ferritin, TIBC)", "Peripheral blood smear", "CRP or ESR for inflammation"],
    differentials: ["Iron deficiency anemia", "Anemia of chronic disease", "Early B12/folate deficiency", "Reactive leukocytosis from infection"],
    trend: "Hemoglobin shows a steady decline over the last 5 readings (15.1 -> 13.2 g/dL). WBC has been trending upward. The RDW is progressively increasing, consistent with evolving anemia.",
  },
  CMP: {
    summary: "The CMP shows elevated fasting glucose (142 mg/dL) consistent with diabetes mellitus. Renal function markers remain within normal limits. Electrolytes are well-balanced.",
    abnormalities: ["Glucose 142 -- elevated; meets criteria for diabetes if fasting (>=126 mg/dL on two occasions)"],
    followUp: ["HbA1c", "Fasting insulin", "Urine microalbumin", "Repeat fasting glucose"],
    differentials: ["Type 2 diabetes mellitus", "Prediabetes progressing", "Stress hyperglycemia", "Steroid-induced hyperglycemia"],
    trend: "Glucose has risen steadily from 95 to 142 mg/dL over 5 readings, indicating worsening glycemic control.",
  },
  Lipid: {
    summary: "Significant dyslipidemia with elevated total cholesterol (238), LDL (155), triglycerides (205), and borderline-low HDL (42). This lipid profile confers increased cardiovascular risk.",
    abnormalities: [
      "Total Cholesterol 238 -- high (desirable <200)",
      "LDL 155 -- high (optimal <100)",
      "Triglycerides 205 -- high (normal <150)",
      "VLDL 41 -- elevated (normal <30)",
    ],
    followUp: ["Lipoprotein(a)", "ApoB", "Coronary calcium score", "Fasting glucose / HbA1c"],
    differentials: ["Primary hyperlipidemia", "Metabolic syndrome", "Hypothyroid-related dyslipidemia", "Dietary causes"],
    trend: "All atherogenic markers are trending upward over the past 5 readings. LDL has increased ~58% from baseline.",
  },
  Thyroid: {
    summary: "TSH is elevated at 5.8 mIU/L with Free T4 at the lower end of normal (0.9 ng/dL). This pattern is consistent with subclinical hypothyroidism progressing toward overt hypothyroidism.",
    abnormalities: ["TSH 5.8 -- elevated above reference (0.4-4.0); suggests thyroid underactivity"],
    followUp: ["Anti-TPO antibodies", "Anti-thyroglobulin antibodies", "Thyroid ultrasound", "Repeat TSH in 6-8 weeks"],
    differentials: ["Hashimoto thyroiditis", "Subclinical hypothyroidism", "Iodine deficiency", "Recovery from non-thyroidal illness"],
    trend: "TSH has risen from 2.1 to 5.8 over the observation period while Free T4 has declined from 1.4 to 0.9, consistent with progressive thyroid failure.",
  },
  Liver: {
    summary: "Transaminases are elevated: ALT 52 U/L and AST 48 U/L, with a pattern suggesting hepatocellular injury. ALP and bilirubin remain normal, making cholestatic disease less likely.",
    abnormalities: ["ALT 52 -- elevated (normal 7-40)", "AST 48 -- elevated (normal 8-33)"],
    followUp: ["GGT", "Hepatitis B & C serology", "Liver ultrasound", "Ferritin and iron studies"],
    differentials: ["Non-alcoholic fatty liver disease (NAFLD)", "Drug-induced liver injury", "Viral hepatitis", "Alcohol-related liver disease"],
    trend: "Both ALT and AST have been steadily rising over 5 readings, suggesting an ongoing hepatocellular process.",
  },
  Renal: {
    summary: "Renal function is impaired with creatinine 1.4 mg/dL and eGFR 58 mL/min, placing the patient in CKD Stage 3a. BUN is mildly elevated and uric acid is above normal.",
    abnormalities: [
      "Creatinine 1.4 -- above reference (0.7-1.3)",
      "eGFR 58 -- below 60; CKD Stage 3a",
      "BUN 22 -- mildly elevated",
      "Uric Acid 7.2 -- above reference (3.0-7.0)",
    ],
    followUp: ["Cystatin C", "Urine albumin-to-creatinine ratio", "Renal ultrasound", "24-hour urine protein"],
    differentials: ["Chronic kidney disease (diabetic or hypertensive)", "Pre-renal azotemia", "Obstructive nephropathy", "Gouty nephropathy"],
    trend: "eGFR has declined from 85 to 58 mL/min, representing a significant loss of renal function over the observation period.",
  },
  Coagulation: {
    summary: "Coagulation parameters are within normal limits. PT and INR are at the upper end of normal, and all values are stable. No evidence of coagulopathy.",
    abnormalities: [],
    followUp: ["No urgent follow-up needed", "Repeat if surgery planned or anticoagulation initiated"],
    differentials: ["Normal coagulation profile"],
    trend: "All coagulation markers are stable with minimal variation across the 5 readings.",
  },
  Urinalysis: {
    summary: "Urinalysis is within normal limits. No proteinuria or glycosuria detected. pH and specific gravity are appropriate.",
    abnormalities: [],
    followUp: ["No follow-up needed based on urinalysis alone", "Consider urine microalbumin if diabetic"],
    differentials: ["Normal urinalysis"],
    trend: "All urinalysis parameters have been stable across the observation period.",
  },
};

const PANEL_KEYS = ["CBC", "CMP", "Lipid", "Thyroid", "Liver", "Renal", "Coagulation", "Urinalysis"];

function getStatus(t: LabTest): { label: string; color: string; critical: boolean } {
  const isCritLow = t.critLow !== undefined && t.value < t.critLow;
  const isCritHigh = t.critHigh !== undefined && t.value > t.critHigh;
  if (isCritLow || isCritHigh) return { label: "CRITICAL", color: "var(--danger, #e53e3e)", critical: true };
  if (t.value < t.refLow) return { label: "Low", color: "var(--warning, #dd6b20)", critical: false };
  if (t.value > t.refHigh) return { label: "High", color: "var(--warning, #dd6b20)", critical: false };
  return { label: "Normal", color: "var(--success, #38a169)", critical: false };
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 80, h = 24, pad = 2;
  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - 2 * pad);
    const y = h - pad - ((v - min) / range) * (h - 2 * pad);
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "inline-block", verticalAlign: "middle" }}>
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((v, i) => {
        const x = pad + (i / (data.length - 1)) * (w - 2 * pad);
        const y = h - pad - ((v - min) / range) * (h - 2 * pad);
        return <circle key={i} cx={x} cy={y} r={i === data.length - 1 ? 2.5 : 1.5} fill={i === data.length - 1 ? color : "var(--text-muted, #888)"} />;
      })}
    </svg>
  );
}

interface CustomTest {
  name: string;
  value: string;
  unit: string;
  refLow: string;
  refHigh: string;
}

const emptyCustom: CustomTest = { name: "", value: "", unit: "", refLow: "", refHigh: "" };

export function LabInterpretation({ onBack, notify }: Props) {
  const [selected, setSelected] = useState<string>("CBC");
  const [showAI, setShowAI] = useState(false);
  const [customTests, setCustomTests] = useState<LabTest[]>([]);
  const [form, setForm] = useState<CustomTest>({ ...emptyCustom });
  const [mainTab, setMainTab] = useState<"results" | "timeline" | "trends">("results");
  const [abnormalOnly, setAbnormalOnly] = useState(false);

  const panel = PANELS[selected];
  const insights = AI_INSIGHTS[selected];
  const allTests = [...panel.tests, ...customTests];
  const criticals = allTests.filter(t => getStatus(t).critical);

  const handleExportCSV = () => {
    const headers = ["Test Name", "Value", "Unit", "Ref Low", "Ref High", "Status"];
    const rows = allTests.map(t => [
      t.name,
      t.value,
      t.unit,
      t.refLow,
      t.refHigh,
      getStatus(t).label
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${selected}_lab_results.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify(`Exported ${selected} lab panel to CSV`, "success");
  };

  const handleAddCustom = () => {
    const { name, value, unit, refLow, refHigh } = form;
    if (!name.trim() || !value.trim()) {
      notify("Test name and value are required", "error");
      return;
    }
    const parsed: LabTest = {
      name: name.trim(),
      value: parseFloat(value),
      unit: unit.trim(),
      refLow: parseFloat(refLow) || 0,
      refHigh: parseFloat(refHigh) || 999,
    };
    if (isNaN(parsed.value)) {
      notify("Value must be a number", "error");
      return;
    }
    setCustomTests(prev => [...prev, parsed]);
    setForm({ ...emptyCustom });
    notify("Custom test added", "success");
  };

  const handlePrint = () => {
    window.print();
    notify("Print dialog opened", "success");
  };

  return (
    <div className="page-enter">
      <div className="breadcrumb">
        <button onClick={onBack}>Home</button>
        <span className="sep">/</span>
        <span>Lab Interpretation</span>
      </div>

      <div className="section-header">
        <div>
          <h1>Lab Result Interpretation</h1>
          <div className="subtitle">AI-powered analysis of laboratory panels</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="neu-btn secondary" onClick={handleExportCSV}>Export CSV</button>
          <button className="neu-btn primary" onClick={handlePrint}>Export / Print</button>
        </div>
      </div>

      {/* Main View Mode Selector (Results | Timeline | Trends) */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        {(["results", "timeline", "trends"] as const).map(tab => (
          <button
            key={tab}
            className={`neu-btn ${mainTab === tab ? "primary" : "secondary"}`}
            onClick={() => setMainTab(tab)}
            style={{ textTransform: "capitalize", padding: "8px 18px", fontSize: 13 }}
          >
            {tab === "results" && "📊 Lab Results"}
            {tab === "timeline" && "⏱️ Diagnosis Timeline"}
            {tab === "trends" && "📈 Trend Dashboard"}
          </button>
        ))}
      </div>


      {/* Panel Selector */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "20px" }}>
        {PANEL_KEYS.map(k => (
          <button
            key={k}
            className={selected === k ? "chart-tab chart-tab--active" : "chart-tab"}
            onClick={() => { setSelected(k); setShowAI(false); setCustomTests([]); }}
          >
            {k}
          </button>
        ))}
      </div>

      <h2 className="section-header" style={{ fontSize: "1.1rem", marginBottom: "12px" }}>{panel.name}</h2>

      {/* Critical Alerts */}
      {criticals.length > 0 && (
        <div className="neu" style={{ background: "var(--danger-soft, #fff5f5)", border: "2px solid var(--danger, #e53e3e)", padding: "16px", marginBottom: "20px", borderRadius: "14px" }}>
          <div style={{ fontWeight: 700, color: "var(--danger, #e53e3e)", marginBottom: "8px", fontSize: "0.95rem" }}>
            CRITICAL VALUE ALERT
          </div>
          {criticals.map((t, i) => (
            <div key={i} style={{ color: "var(--danger, #e53e3e)", fontSize: "0.9rem", marginBottom: "4px" }}>
              {t.name}: {t.value} {t.unit} (critical range: {t.critLow ?? "--"} - {t.critHigh ?? "--"})
            </div>
          ))}
        </div>
      )}

      {/* VIEW MODE: TIMELINE */}
      {mainTab === "timeline" && (
        <div className="neu" style={{ padding: 24, marginBottom: 20 }}>
          <h3 className="section-header" style={{ marginTop: 0 }}>⏱️ Clinical Diagnosis Timeline</h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
            Chronological audit log of lab ingestion, pattern analysis, rule engine differentials, and AI brief generation.
          </p>

          <div className="timeline-container">
            <div className="timeline-item">
              <div className="timeline-node" />
              <div className="neu-inset" style={{ padding: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>📥 Lab Document Uploaded</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  Today at 18:05 • Document: lab_report_2026.pdf (PDF • 2.4 MB)
                </div>
              </div>
            </div>

            <div className="timeline-item">
              <div className="timeline-node" />
              <div className="neu-inset" style={{ padding: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>📄 OCR Engine Processing</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  Engine: PaddleOCR • Duration: 1.42s • 100% Layout confidence
                </div>
              </div>
            </div>

            <div className="timeline-item">
              <div className="timeline-node" />
              <div className="neu-inset" style={{ padding: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>🔬 Stage A: Pattern Analysis</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  Pattern Identified: Hepatocellular • De Ritis: 1.08 • R-Factor: 3.20 (Mixed)
                </div>
              </div>
            </div>

            <div className="timeline-item">
              <div className="timeline-node" />
              <div className="neu-inset" style={{ padding: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>📊 Stage B: Rule Engine Differentials</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  Matches: NAFLD (82%), DILI (45%), Acute Liver Failure (15% - Urgent)
                </div>
              </div>
            </div>

            <div className="timeline-item">
              <div className="timeline-node active" />
              <div className="neu-inset" style={{ padding: 12, borderLeft: "3px solid #10b981" }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#10b981" }}>🧠 Stage C & D: BioMistral Brief & MELD Scores</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  MELD Score: 18 (~6% 90-day mortality) • Child-Pugh: Class A • FIB-4: 1.42 (Low risk)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE: TRENDS DASHBOARD */}
      {mainTab === "trends" && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 className="section-header" style={{ margin: 0 }}>📈 Sparkline Trend Dashboard</h3>
            <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={abnormalOnly}
                onChange={e => setAbnormalOnly(e.target.checked)}
              />
              Show Abnormal Only
            </label>
          </div>

          <div className="trend-card-grid">
            {allTests
              .filter(t => (abnormalOnly ? getStatus(t).label !== "Normal" : true))
              .map((t, idx) => {
                const s = getStatus(t);
                const firstVal = t.history ? t.history[0] : t.value;
                const delta = Number((t.value - firstVal).toFixed(1));
                const deltaCls = delta > 0 ? "up" : delta < 0 ? "down" : "neutral";

                return (
                  <div key={idx} className="trend-card neu">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.unit}</div>
                      </div>
                      <span className={`trend-delta ${deltaCls}`}>
                        {delta > 0 ? `+${delta}` : delta}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                      <span style={{ fontSize: 22, fontWeight: 800, color: s.label === "Normal" ? "var(--text)" : s.color }}>
                        {t.value}
                      </span>
                      <span style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>
                        {s.label}
                      </span>
                    </div>

                    <div style={{ marginTop: 8 }}>
                      <Sparkline data={t.history ?? [t.value, t.value]} color={s.color} />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* VIEW MODE: RESULTS TABLE */}
      {mainTab === "results" && (
        <>
          {/* Results Table */}
          <div className="neu" style={{ overflowX: "auto", marginBottom: "20px" }}>
            <table className="vitals-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Test</th>
                  <th>Value</th>
                  <th>Unit</th>
                  <th>Reference</th>
                  <th>Status</th>
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                {allTests.map((t, i) => {
                  const s = getStatus(t);
                  return (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{t.name}</td>
                      <td style={{ fontWeight: 700, color: s.label === "Normal" ? "var(--text)" : s.color }}>{t.value}</td>
                      <td style={{ color: "var(--text-muted, #888)" }}>{t.unit}</td>
                      <td>{t.refLow} - {t.refHigh === 999 ? "N/A" : t.refHigh}</td>
                      <td>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: "6px", padding: "2px 10px",
                          borderRadius: "20px", fontSize: "0.8rem", fontWeight: 600,
                          background: s.label === "Normal" ? "var(--success-soft, #f0fff4)" : s.label === "CRITICAL" ? "var(--danger-soft, #fff5f5)" : "var(--warning-soft, #fffaf0)",
                          color: s.color,
                        }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, display: "inline-block" }} />
                          {s.label}
                        </span>
                      </td>
                      <td><Sparkline data={t.history ?? []} color={s.color} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* AI Interpretation */}
          <button className="neu-btn" onClick={() => setShowAI(!showAI)} style={{ marginBottom: "16px" }}>
            {showAI ? "Hide AI Analysis" : "Run AI Analysis"}
          </button>

          {showAI && insights && (
            <div className="neu" style={{ padding: "20px", marginBottom: "20px" }}>
              <h3 className="section-header" style={{ fontSize: "1rem", marginBottom: "12px" }}>AI Interpretation</h3>

              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontWeight: 600, marginBottom: "6px", color: "var(--accent, #4a6cf7)" }}>Summary</div>
                <p style={{ lineHeight: 1.6, margin: 0, color: "var(--text)" }}>{insights.summary}</p>
              </div>

              {insights.abnormalities.length > 0 && (
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontWeight: 600, marginBottom: "6px", color: "var(--warning, #dd6b20)" }}>Flagged Abnormalities</div>
                  <ul style={{ margin: 0, paddingLeft: "20px" }}>
                    {insights.abnormalities.map((a, i) => <li key={i} style={{ marginBottom: "4px", lineHeight: 1.5 }}>{a}</li>)}
                  </ul>
                </div>
              )}

              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontWeight: 600, marginBottom: "6px", color: "var(--accent, #4a6cf7)" }}>Suggested Follow-up Tests</div>
                <ul style={{ margin: 0, paddingLeft: "20px" }}>
                  {insights.followUp.map((f, i) => <li key={i} style={{ marginBottom: "4px" }}>{f}</li>)}
                </ul>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontWeight: 600, marginBottom: "6px", color: "var(--text)" }}>Differential Diagnosis</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {insights.differentials.map((d, i) => (
                    <span key={i} className="neu" style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "0.85rem" }}>{d}</span>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: "6px", color: "var(--success, #38a169)" }}>Trend Analysis</div>
                <p style={{ lineHeight: 1.6, margin: 0 }}>{insights.trend}</p>
              </div>
            </div>
          )}

          {/* Add Custom Test */}
          <div className="neu" style={{ padding: "20px", marginBottom: "20px" }}>
            <h3 className="section-header" style={{ fontSize: "1rem", marginBottom: "12px" }}>Add Custom Test Result</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "10px", marginBottom: "12px" }}>
              <input className="neu-input" placeholder="Test name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <input className="neu-input" placeholder="Value" type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
              <input className="neu-input" placeholder="Unit" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} />
              <input className="neu-input" placeholder="Ref Low" type="number" value={form.refLow} onChange={e => setForm({ ...form, refLow: e.target.value })} />
              <input className="neu-input" placeholder="Ref High" type="number" value={form.refHigh} onChange={e => setForm({ ...form, refHigh: e.target.value })} />
            </div>
            <button className="neu-btn" onClick={handleAddCustom}>Add Test</button>
          </div>
        </>
      )}
    </div>
  );
}

