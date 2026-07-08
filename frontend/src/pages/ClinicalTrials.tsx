import { useState } from "react";

interface Props {
  onBack: () => void;
  notify: (msg: string, type?: "success" | "error") => void;
}

const PHASES = ["Phase I", "Phase II", "Phase III", "Phase IV"] as const;
const STATUSES = ["Recruiting", "Active", "Completed"] as const;
const ENROLLMENT_STEPS = ["Screening", "Consent", "Randomization", "Active", "Follow-up", "Completed"] as const;
const SEVERITIES = ["Mild", "Moderate", "Severe", "Life-threatening"] as const;
const RELATIONSHIPS = ["Unrelated", "Unlikely", "Possible", "Probable", "Definite"] as const;
const OUTCOMES = ["Recovered", "Recovering", "Not recovered", "Fatal", "Unknown"] as const;

const MOCK_TRIALS = [
  { id: "NCT04012345", title: "Efficacy of Drug A in Type 2 Diabetes", phase: "Phase III", sponsor: "PharmaCorp", status: "Recruiting", pi: "Dr. Elena Vasquez", distance: "3.2 mi", ageLow: 30, ageHigh: 70, inclusion: ["Diagnosed T2D for >1 year", "HbA1c between 7.0-10.0%", "BMI 25-40 kg/m2"], exclusion: ["Insulin-dependent", "eGFR <45 mL/min", "Active liver disease"] },
  { id: "NCT04023456", title: "Monoclonal Antibody B for Rheumatoid Arthritis", phase: "Phase II", sponsor: "BioGenix", status: "Recruiting", pi: "Dr. James Okafor", distance: "8.5 mi", ageLow: 18, ageHigh: 65, inclusion: ["Active RA per ACR criteria", "Inadequate response to MTX", "DAS28 score >3.2"], exclusion: ["Prior biologic use >2", "Active infection", "Pregnancy"] },
  { id: "NCT04034567", title: "CAR-T Cell Therapy in Refractory DLBCL", phase: "Phase I", sponsor: "OncoVax Labs", status: "Active", pi: "Dr. Sarah Chen", distance: "12.1 mi", ageLow: 18, ageHigh: 75, inclusion: ["Confirmed DLBCL diagnosis", "Failed >=2 prior therapies", "ECOG 0-1"], exclusion: ["Active CNS involvement", "Prior CAR-T therapy", "Uncontrolled cardiac disease"] },
  { id: "NCT04045678", title: "Novel SSRI for Treatment-Resistant Depression", phase: "Phase II", sponsor: "NeuroPharm Inc", status: "Recruiting", pi: "Dr. Michael Torres", distance: "5.7 mi", ageLow: 21, ageHigh: 60, inclusion: ["MDD per DSM-5", "Failed >=2 antidepressants", "MADRS score >=20"], exclusion: ["Bipolar disorder", "Active substance abuse", "Suicidal ideation with intent"] },
  { id: "NCT04056789", title: "Gene Therapy for Sickle Cell Disease", phase: "Phase I", sponsor: "GeneHeal Therapeutics", status: "Active", pi: "Dr. Aisha Patel", distance: "22.0 mi", ageLow: 12, ageHigh: 35, inclusion: ["HbSS genotype confirmed", ">=2 VOC in past year", "Adequate organ function"], exclusion: ["Prior stem cell transplant", "HIV positive", "Active hepatitis"] },
  { id: "NCT04067890", title: "Immunotherapy Combo in Advanced NSCLC", phase: "Phase III", sponsor: "ImmunoTech", status: "Completed", pi: "Dr. Robert Kim", distance: "15.3 mi", ageLow: 18, ageHigh: 80, inclusion: ["Stage IIIB/IV NSCLC", "PD-L1 >=1%", "No prior immunotherapy"], exclusion: ["Autoimmune disease", "Organ transplant recipient", "Active brain metastases"] },
];

const MOCK_PATIENTS = [
  { name: "John Martinez", age: 55, conditions: ["Type 2 Diabetes", "Hypertension"] },
  { name: "Sarah Johnson", age: 42, conditions: ["Rheumatoid Arthritis"] },
  { name: "David Lee", age: 28, conditions: ["Sickle Cell Disease"] },
];

const MOCK_ENROLLMENTS = [
  { patient: "John Martinez", trial: "NCT04012345", trialTitle: "Efficacy of Drug A in Type 2 Diabetes", step: 3, nextVisit: "2026-07-15", adherence: 94, visits: ["2026-06-01", "2026-06-15", "2026-07-01", "2026-07-15", "2026-08-01"] },
  { patient: "Sarah Johnson", trial: "NCT04023456", trialTitle: "Monoclonal Antibody B for RA", step: 2, nextVisit: "2026-07-12", adherence: 88, visits: ["2026-06-10", "2026-06-24", "2026-07-12", "2026-07-26"] },
];

const ICONS = {
  back: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M13 4l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  search: <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2"/><path d="M14 14l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  trial: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M7 6h6M7 10h6M7 14h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  check: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  cross: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  person: <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M4 17c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  report: <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M10 3v7M7 7l3-4 3 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="3" y="12" width="14" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/></svg>,
  chart: <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><rect x="3" y="10" width="3" height="7" rx="1" fill="currentColor" opacity="0.5"/><rect x="8.5" y="6" width="3" height="11" rx="1" fill="currentColor" opacity="0.7"/><rect x="14" y="3" width="3" height="14" rx="1" fill="currentColor"/></svg>,
};

type Tab = "search" | "eligibility" | "enrollments" | "adverse" | "results";

export function ClinicalTrials({ onBack, notify }: Props) {
  const [tab, setTab] = useState<Tab>("search");
  const [condition, setCondition] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [maxDist, setMaxDist] = useState("");
  const [ageFilter, setAgeFilter] = useState("");
  const [selPatient, setSelPatient] = useState(0);
  const [selTrial, setSelTrial] = useState(0);
  const [aeDesc, setAeDesc] = useState("");
  const [aeSeverity, setAeSeverity] = useState(SEVERITIES[0]);
  const [aeRelation, setAeRelation] = useState(RELATIONSHIPS[0]);
  const [aeOutcome, setAeOutcome] = useState(OUTCOMES[0]);
  const [aeDate, setAeDate] = useState("2026-07-08");

  const filtered = MOCK_TRIALS.filter(t => {
    if (condition && !t.title.toLowerCase().includes(condition.toLowerCase())) return false;
    if (phaseFilter && t.phase !== phaseFilter) return false;
    if (statusFilter && t.status !== statusFilter) return false;
    if (maxDist && parseFloat(t.distance) > parseFloat(maxDist)) return false;
    if (ageFilter) { const a = parseInt(ageFilter); if (a < t.ageLow || a > t.ageHigh) return false; }
    return true;
  });

  const phaseBg = (p: string) =>
    p === "Phase I" ? "#8b5cf6" : p === "Phase II" ? "#3b82f6" : p === "Phase III" ? "#10b981" : "#f59e0b";

  const statusColor = (s: string) =>
    s === "Recruiting" ? "#10b981" : s === "Active" ? "#3b82f6" : "#6b7280";

  const trial = MOCK_TRIALS[selTrial];
  const patient = MOCK_PATIENTS[selPatient];
  const eligResults = trial.inclusion.map((c, i) => ({ criteria: c, type: "inclusion" as const, pass: i < 2 }))
    .concat(trial.exclusion.map((c, i) => ({ criteria: c, type: "exclusion" as const, pass: i > 0 })));

  const tabs: { key: Tab; label: string }[] = [
    { key: "search", label: "Trial Search" },
    { key: "eligibility", label: "Eligibility" },
    { key: "enrollments", label: "Enrollments" },
    { key: "adverse", label: "Adverse Events" },
    { key: "results", label: "Results" },
  ];

  return (
    <div className="page-enter">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button className="neu-btn" onClick={onBack} style={{ padding: 8 }}>{ICONS.back}</button>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Clinical Trials</h1>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {tabs.map(t => (
          <button key={t.key} className={`chart-tab${tab === t.key ? " active" : ""}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === "search" && (
        <div>
          <div className="section-header">{ICONS.search} Search Filters</div>
          <div className="neu" style={{ padding: 16, marginBottom: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Condition</label>
                <input className="neu-input" placeholder="e.g. Diabetes" value={condition} onChange={e => setCondition(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Phase</label>
                <select className="neu-input" value={phaseFilter} onChange={e => setPhaseFilter(e.target.value)}>
                  <option value="">All</option>
                  {PHASES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Status</label>
                <select className="neu-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                  <option value="">All</option>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Max Distance (mi)</label>
                <input className="neu-input" type="number" placeholder="e.g. 20" value={maxDist} onChange={e => setMaxDist(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Patient Age</label>
                <input className="neu-input" type="number" placeholder="e.g. 45" value={ageFilter} onChange={e => setAgeFilter(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="section-header">{ICONS.trial} Matched Trials ({filtered.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filtered.map(t => (
              <div key={t.id} className="neu" style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{t.title}</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary, #6b7280)", marginBottom: 6 }}>{t.id}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                      <span style={{ background: phaseBg(t.phase), color: "#fff", padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{t.phase}</span>
                      <span style={{ color: statusColor(t.status), fontWeight: 600, fontSize: 13 }}>{t.status}</span>
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                      <div><strong>Sponsor:</strong> {t.sponsor}</div>
                      <div><strong>PI:</strong> {t.pi}</div>
                      <div><strong>Distance:</strong> {t.distance}</div>
                      <div><strong>Age Range:</strong> {t.ageLow}-{t.ageHigh} years</div>
                    </div>
                  </div>
                  <div style={{ minWidth: 200 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Key Eligibility</div>
                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.8, color: "var(--text-secondary, #6b7280)" }}>
                      {t.inclusion.slice(0, 2).map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div className="neu" style={{ padding: 24, textAlign: "center", color: "var(--text-secondary, #6b7280)" }}>No trials match your filters.</div>}
          </div>
        </div>
      )}

      {tab === "eligibility" && (
        <div>
          <div className="section-header">{ICONS.check} Patient Eligibility Checker</div>
          <div className="neu" style={{ padding: 16, marginBottom: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Select Patient</label>
                <select className="neu-input" value={selPatient} onChange={e => setSelPatient(+e.target.value)}>
                  {MOCK_PATIENTS.map((p, i) => <option key={i} value={i}>{p.name} (Age {p.age})</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Select Trial</label>
                <select className="neu-input" value={selTrial} onChange={e => setSelTrial(+e.target.value)}>
                  {MOCK_TRIALS.map((t, i) => <option key={i} value={i}>{t.id} - {t.title}</option>)}
                </select>
              </div>
            </div>
            <div className="neu" style={{ padding: 12, background: "rgba(59,130,246,0.06)" }}>
              <div style={{ fontSize: 13, marginBottom: 4 }}><strong>Patient:</strong> {patient.name}, Age {patient.age}</div>
              <div style={{ fontSize: 13 }}><strong>Conditions:</strong> {patient.conditions.join(", ")}</div>
            </div>
          </div>

          <div className="section-header">Criteria Assessment</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {eligResults.map((r, i) => (
              <div key={i} className="neu" style={{ padding: 12, display: "flex", alignItems: "center", gap: 12, borderLeft: `3px solid ${r.pass ? "#10b981" : "#ef4444"}` }}>
                <span style={{ color: r.pass ? "#10b981" : "#ef4444", flexShrink: 0 }}>{r.pass ? ICONS.check : ICONS.cross}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{r.criteria}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary, #6b7280)", textTransform: "uppercase" }}>{r.type}</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: r.pass ? "#10b981" : "#ef4444" }}>{r.pass ? "PASS" : "FAIL"}</span>
              </div>
            ))}
          </div>
          <div className="neu" style={{ padding: 16, marginTop: 16, textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Overall: {eligResults.filter(r => r.pass).length}/{eligResults.length} criteria met</div>
            <div style={{ fontSize: 13, color: eligResults.every(r => r.pass) ? "#10b981" : "#f59e0b" }}>
              {eligResults.every(r => r.pass) ? "Patient is eligible" : "Patient may not be eligible - review failed criteria"}
            </div>
          </div>

          <div className="section-header" style={{ marginTop: 24 }}>Enrollment Workflow</div>
          <div className="neu" style={{ padding: 16 }}>
            <div style={{ display: "flex", gap: 4, alignItems: "center", overflowX: "auto" }}>
              {ENROLLMENT_STEPS.map((s, i) => (
                <div key={s} style={{ display: "flex", alignItems: "center" }}>
                  <div style={{ textAlign: "center", minWidth: 80 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%", margin: "0 auto 4px",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700,
                      background: i <= 2 ? "#3b82f6" : "var(--bg-secondary, #e5e7eb)", color: i <= 2 ? "#fff" : "var(--text-secondary, #6b7280)"
                    }}>{i + 1}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: i <= 2 ? "#3b82f6" : "var(--text-secondary, #6b7280)" }}>{s}</div>
                  </div>
                  {i < ENROLLMENT_STEPS.length - 1 && (
                    <div style={{ width: 24, height: 2, background: i < 2 ? "#3b82f6" : "var(--bg-secondary, #e5e7eb)", flexShrink: 0 }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "enrollments" && (
        <div>
          <div className="section-header">{ICONS.person} Active Enrollments</div>
          {MOCK_ENROLLMENTS.map((e, i) => (
            <div key={i} className="neu" style={{ padding: 16, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{e.patient}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary, #6b7280)" }}>{e.trial} - {e.trialTitle}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13 }}><strong>Next Visit:</strong> {e.nextVisit}</div>
                  <div style={{ fontSize: 13, color: e.adherence >= 90 ? "#10b981" : "#f59e0b" }}><strong>Adherence:</strong> {e.adherence}%</div>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Protocol Progress</div>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  {ENROLLMENT_STEPS.map((s, si) => (
                    <div key={s} style={{ display: "flex", alignItems: "center" }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: "50%", fontSize: 10, fontWeight: 700,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: si <= e.step ? "#10b981" : "var(--bg-secondary, #e5e7eb)",
                        color: si <= e.step ? "#fff" : "var(--text-secondary, #6b7280)"
                      }}>{si + 1}</div>
                      {si < ENROLLMENT_STEPS.length - 1 && <div style={{ width: 12, height: 2, background: si < e.step ? "#10b981" : "var(--bg-secondary, #e5e7eb)" }} />}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Visit Schedule</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {e.visits.map((v, vi) => {
                    const past = v <= "2026-07-08";
                    return <span key={vi} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 8, background: past ? "rgba(16,185,129,0.12)" : "rgba(59,130,246,0.1)", color: past ? "#10b981" : "#3b82f6", fontWeight: 600 }}>{v}</span>;
                  })}
                </div>
              </div>

              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Adherence</div>
                <div style={{ height: 8, borderRadius: 4, background: "var(--bg-secondary, #e5e7eb)", overflow: "hidden" }}>
                  <div style={{ width: `${e.adherence}%`, height: "100%", borderRadius: 4, background: e.adherence >= 90 ? "#10b981" : "#f59e0b", transition: "width 0.3s" }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "adverse" && (
        <div>
          <div className="section-header">{ICONS.report} Report Adverse Event</div>
          <div className="neu" style={{ padding: 16 }}>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Event Description</label>
                <textarea className="neu-input" rows={3} placeholder="Describe the adverse event..." value={aeDesc} onChange={e => setAeDesc(e.target.value)} style={{ resize: "vertical" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Severity</label>
                  <select className="neu-input" value={aeSeverity} onChange={e => setAeSeverity(e.target.value as typeof aeSeverity)}>
                    {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Relationship to Study Drug</label>
                  <select className="neu-input" value={aeRelation} onChange={e => setAeRelation(e.target.value as typeof aeRelation)}>
                    {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Outcome</label>
                  <select className="neu-input" value={aeOutcome} onChange={e => setAeOutcome(e.target.value as typeof aeOutcome)}>
                    {OUTCOMES.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Date of Event</label>
                  <input className="neu-input" type="date" value={aeDate} onChange={e => setAeDate(e.target.value)} />
                </div>
              </div>
              <button className="neu-btn" style={{ padding: "10px 20px", fontWeight: 600 }} onClick={() => {
                if (!aeDesc.trim()) return notify("Please describe the event", "error");
                notify("Adverse event reported successfully", "success");
                setAeDesc("");
              }}>Submit Adverse Event Report</button>
            </div>
          </div>
        </div>
      )}

      {tab === "results" && (
        <div>
          <div className="section-header">{ICONS.chart} Trial Results Summary</div>
          <div className="neu" style={{ padding: 16, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>NCT04012345 - Efficacy of Drug A in Type 2 Diabetes</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary, #6b7280)", marginBottom: 16 }}>Phase III | Completed enrollment | N=1,240</div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 20 }}>
              {[
                { label: "Primary Endpoint Met", value: "Yes", color: "#10b981" },
                { label: "HbA1c Reduction", value: "-1.4%", color: "#3b82f6" },
                { label: "Statistical Significance", value: "p < 0.001", color: "#8b5cf6" },
                { label: "Serious AE Rate", value: "3.2%", color: "#f59e0b" },
              ].map(m => (
                <div key={m.label} className="neu" style={{ padding: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary, #6b7280)", marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: m.color }}>{m.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Efficacy Data</div>
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <thead><tr style={{ borderBottom: "2px solid var(--bg-secondary, #e5e7eb)" }}>
                    <th style={{ textAlign: "left", padding: "6px 8px" }}>Endpoint</th>
                    <th style={{ textAlign: "right", padding: "6px 8px" }}>Drug A</th>
                    <th style={{ textAlign: "right", padding: "6px 8px" }}>Placebo</th>
                  </tr></thead>
                  <tbody>
                    {[
                      ["HbA1c change", "-1.4%", "-0.3%"],
                      ["FPG change", "-38 mg/dL", "-8 mg/dL"],
                      ["Weight change", "-2.1 kg", "+0.4 kg"],
                      ["Responders (HbA1c<7%)", "62%", "18%"],
                    ].map(([e, d, p]) => (
                      <tr key={e} style={{ borderBottom: "1px solid var(--bg-secondary, #e5e7eb)" }}>
                        <td style={{ padding: "6px 8px" }}>{e}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, color: "#10b981" }}>{d}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", color: "var(--text-secondary, #6b7280)" }}>{p}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Safety Summary</div>
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <thead><tr style={{ borderBottom: "2px solid var(--bg-secondary, #e5e7eb)" }}>
                    <th style={{ textAlign: "left", padding: "6px 8px" }}>Event</th>
                    <th style={{ textAlign: "right", padding: "6px 8px" }}>Drug A</th>
                    <th style={{ textAlign: "right", padding: "6px 8px" }}>Placebo</th>
                  </tr></thead>
                  <tbody>
                    {[
                      ["Any AE", "45%", "38%"],
                      ["Serious AE", "3.2%", "2.8%"],
                      ["Hypoglycemia", "5.1%", "1.2%"],
                      ["GI events", "12%", "4%"],
                      ["Discontinuation", "4.5%", "3.1%"],
                    ].map(([e, d, p]) => (
                      <tr key={e} style={{ borderBottom: "1px solid var(--bg-secondary, #e5e7eb)" }}>
                        <td style={{ padding: "6px 8px" }}>{e}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600 }}>{d}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", color: "var(--text-secondary, #6b7280)" }}>{p}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
