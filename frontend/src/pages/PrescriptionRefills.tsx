import { useState } from "react";

interface Props {
  onBack: () => void;
  notify: (msg: string, type?: "success" | "error") => void;
}

interface RefillRequest {
  id: string;
  patient: string;
  medication: string;
  dose: string;
  pharmacy: string;
  dateRequested: string;
  urgency: "routine" | "urgent" | "stat";
  status: "pending" | "approved" | "denied";
}

interface AutoRefillRule {
  id: string;
  medication: string;
  patient: string;
  maxRefills: number;
  intervalDays: number;
  expiry: string;
  enabled: boolean;
}

interface Pharmacy {
  id: string;
  name: string;
  address: string;
  phone: string;
  fax: string;
  hours: string;
}

interface RefillHistoryEntry {
  id: string;
  medication: string;
  date: string;
  status: "approved" | "denied" | "pending" | "expired";
  pharmacy: string;
  prescriber: string;
}

interface ControlledSubstance {
  id: string;
  medication: string;
  schedule: "II" | "III" | "IV" | "V";
  lastFillDate: string;
  remainingRefills: number;
  patient: string;
}

interface PriorAuth {
  id: string;
  medication: string;
  patient: string;
  status: "needed" | "submitted" | "approved" | "denied";
  insurance: string;
  policyNumber: string;
  submittedDate: string | null;
  notes: string;
}

const MOCK_REQUESTS: RefillRequest[] = [
  { id: "RR1", patient: "James Wilson", medication: "Lisinopril", dose: "10mg", pharmacy: "CVS Pharmacy #4521", dateRequested: "2026-07-07", urgency: "routine", status: "pending" },
  { id: "RR2", patient: "Maria Santos", medication: "Metformin", dose: "500mg", pharmacy: "Walgreens #1892", dateRequested: "2026-07-07", urgency: "urgent", status: "pending" },
  { id: "RR3", patient: "David Chen", medication: "Atorvastatin", dose: "20mg", pharmacy: "Rite Aid #0332", dateRequested: "2026-07-06", urgency: "routine", status: "pending" },
  { id: "RR4", patient: "Sarah Johnson", medication: "Omeprazole", dose: "40mg", pharmacy: "Costco Pharmacy", dateRequested: "2026-07-06", urgency: "stat", status: "pending" },
  { id: "RR5", patient: "Robert Kim", medication: "Amlodipine", dose: "5mg", pharmacy: "Walmart Pharmacy #7201", dateRequested: "2026-07-05", urgency: "routine", status: "pending" },
];

const MOCK_PHARMACIES: Pharmacy[] = [
  { id: "P1", name: "CVS Pharmacy #4521", address: "1234 Main St, Springfield, IL 62701", phone: "(217) 555-0142", fax: "(217) 555-0143", hours: "Mon-Fri 8am-9pm, Sat 9am-6pm, Sun 10am-5pm" },
  { id: "P2", name: "Walgreens #1892", address: "567 Oak Ave, Springfield, IL 62704", phone: "(217) 555-0287", fax: "(217) 555-0288", hours: "Mon-Sat 7am-10pm, Sun 8am-8pm" },
  { id: "P3", name: "Rite Aid #0332", address: "890 Elm Blvd, Springfield, IL 62702", phone: "(217) 555-0391", fax: "(217) 555-0392", hours: "Mon-Fri 8am-8pm, Sat 9am-5pm, Sun Closed" },
  { id: "P4", name: "Costco Pharmacy", address: "2100 Veterans Pkwy, Springfield, IL 62704", phone: "(217) 555-0456", fax: "(217) 555-0457", hours: "Mon-Fri 10am-7pm, Sat 9:30am-6pm, Sun Closed" },
  { id: "P5", name: "Walmart Pharmacy #7201", address: "3401 Freedom Dr, Springfield, IL 62711", phone: "(217) 555-0519", fax: "(217) 555-0520", hours: "Mon-Sat 9am-9pm, Sun 10am-6pm" },
];

const MOCK_HISTORY: RefillHistoryEntry[] = [
  { id: "H1", medication: "Lisinopril 10mg", date: "2026-07-01", status: "approved", pharmacy: "CVS Pharmacy #4521", prescriber: "Dr. Adams" },
  { id: "H2", medication: "Lisinopril 10mg", date: "2026-06-01", status: "approved", pharmacy: "CVS Pharmacy #4521", prescriber: "Dr. Adams" },
  { id: "H3", medication: "Metformin 500mg", date: "2026-06-15", status: "denied", pharmacy: "Walgreens #1892", prescriber: "Dr. Patel" },
  { id: "H4", medication: "Atorvastatin 20mg", date: "2026-05-20", status: "expired", pharmacy: "Rite Aid #0332", prescriber: "Dr. Adams" },
  { id: "H5", medication: "Omeprazole 40mg", date: "2026-07-05", status: "pending", pharmacy: "Costco Pharmacy", prescriber: "Dr. Lee" },
  { id: "H6", medication: "Metformin 500mg", date: "2026-05-15", status: "approved", pharmacy: "Walgreens #1892", prescriber: "Dr. Patel" },
];

const MOCK_CONTROLLED: ControlledSubstance[] = [
  { id: "CS1", medication: "Adderall XR 20mg", schedule: "II", lastFillDate: "2026-06-28", remainingRefills: 0, patient: "James Wilson" },
  { id: "CS2", medication: "Xanax 0.5mg", schedule: "IV", lastFillDate: "2026-07-01", remainingRefills: 2, patient: "Maria Santos" },
  { id: "CS3", medication: "Tylenol #3", schedule: "III", lastFillDate: "2026-06-15", remainingRefills: 1, patient: "David Chen" },
  { id: "CS4", medication: "Lyrica 75mg", schedule: "V", lastFillDate: "2026-07-03", remainingRefills: 3, patient: "Sarah Johnson" },
];

const MOCK_PRIOR_AUTH: PriorAuth[] = [
  { id: "PA1", medication: "Humira 40mg", patient: "James Wilson", status: "needed", insurance: "Blue Cross Blue Shield", policyNumber: "BCB-8834721", submittedDate: null, notes: "Step therapy required" },
  { id: "PA2", medication: "Ozempic 1mg", patient: "Maria Santos", status: "submitted", insurance: "Aetna", policyNumber: "AET-2291045", submittedDate: "2026-07-04", notes: "Awaiting clinical review" },
  { id: "PA3", medication: "Xeljanz 5mg", patient: "David Chen", status: "approved", insurance: "UnitedHealthcare", policyNumber: "UHC-5567832", submittedDate: "2026-06-28", notes: "Approved for 12 months" },
  { id: "PA4", medication: "Entresto 49/51mg", patient: "Robert Kim", status: "denied", insurance: "Cigna", policyNumber: "CIG-3340198", submittedDate: "2026-07-01", notes: "Alternative therapy available" },
];

type Tab = "queue" | "eprescribe" | "autorefill" | "pharmacies" | "history" | "controlled" | "priorauth";

const MEDICATIONS = [
  "Lisinopril", "Metformin", "Atorvastatin", "Omeprazole", "Amlodipine",
  "Losartan", "Levothyroxine", "Gabapentin", "Hydrochlorothiazide", "Sertraline",
  "Pantoprazole", "Montelukast", "Escitalopram", "Rosuvastatin", "Bupropion",
];

const urgencyColor = (u: string) =>
  u === "stat" ? "#ef4444" : u === "urgent" ? "#f59e0b" : "#3b82f6";
const urgencyBg = (u: string) =>
  u === "stat" ? "rgba(239,68,68,0.15)" : u === "urgent" ? "rgba(245,158,11,0.15)" : "rgba(59,130,246,0.15)";

const statusColor = (s: string) =>
  s === "approved" ? "#22c55e" : s === "denied" ? "#ef4444" : s === "expired" ? "#6b7280" : "#f59e0b";
const statusBg = (s: string) =>
  s === "approved" ? "rgba(34,197,94,0.15)" : s === "denied" ? "rgba(239,68,68,0.15)" : s === "expired" ? "rgba(107,114,128,0.15)" : "rgba(245,158,11,0.15)";

const paStatusColor = (s: string) =>
  s === "approved" ? "#22c55e" : s === "denied" ? "#ef4444" : s === "submitted" ? "#3b82f6" : "#f59e0b";

const scheduleColor = (s: string) =>
  s === "II" ? "#ef4444" : s === "III" ? "#f59e0b" : s === "IV" ? "#3b82f6" : "#22c55e";

/* ── Inline SVG Icons ── */
const IconBack = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
);
const IconRx = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2v20"/><path d="M6 6h8a4 4 0 0 1 0 8H6"/><path d="M14 14l6 8"/><path d="M16 18l4-4"/></svg>
);
const IconQueue = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H2v7l6.29 6.29a1 1 0 0 0 1.42 0l4.58-4.58a1 1 0 0 0 0-1.42L9 5z"/><circle cx="5.5" cy="8.5" r="1"/></svg>
);
const IconPrescribe = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="M9 15h6"/></svg>
);
const IconAuto = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.22-8.56"/><path d="M22 3l-8.5 8.5"/><circle cx="12" cy="12" r="1"/></svg>
);
const IconPharmacy = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M12 11v4"/><path d="M10 13h4"/></svg>
);
const IconHistory = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
);
const IconControlled = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
);
const IconAuth = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
);
const IconCheck = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
);
const IconX = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
);
const IconEdit = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
);
const IconPhone = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.81.36 1.6.65 2.36a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.72-1.21a2 2 0 0 1 2.11-.45c.76.29 1.55.52 2.36.65a2 2 0 0 1 1.72 2.01z"/></svg>
);
const IconSearch = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
);

export function PrescriptionRefills({ onBack, notify }: Props) {
  const [tab, setTab] = useState<Tab>("queue");
  const [requests, setRequests] = useState<RefillRequest[]>(MOCK_REQUESTS);
  const [autoRules, setAutoRules] = useState<AutoRefillRule[]>([
    { id: "AR1", medication: "Lisinopril 10mg", patient: "James Wilson", maxRefills: 6, intervalDays: 30, expiry: "2027-01-01", enabled: true },
    { id: "AR2", medication: "Metformin 500mg", patient: "Maria Santos", maxRefills: 12, intervalDays: 30, expiry: "2027-06-15", enabled: true },
  ]);
  const [history] = useState<RefillHistoryEntry[]>(MOCK_HISTORY);
  const [controlled] = useState<ControlledSubstance[]>(MOCK_CONTROLLED);
  const [priorAuths, setPriorAuths] = useState<PriorAuth[]>(MOCK_PRIOR_AUTH);

  // E-prescribe form state
  const [rxMedSearch, setRxMedSearch] = useState("");
  const [rxMedSelected, setRxMedSelected] = useState("");
  const [rxDosage, setRxDosage] = useState("");
  const [rxFrequency, setRxFrequency] = useState("Once daily");
  const [rxQuantity, setRxQuantity] = useState("30");
  const [rxRefills, setRxRefills] = useState("3");
  const [rxPharmacy, setRxPharmacy] = useState("");
  const [rxInstructions, setRxInstructions] = useState("");
  const [rxDaw, setRxDaw] = useState(false);

  // Auto-refill form state
  const [arMed, setArMed] = useState("");
  const [arPatient, setArPatient] = useState("");
  const [arMax, setArMax] = useState("6");
  const [arInterval, setArInterval] = useState("30");
  const [arExpiry, setArExpiry] = useState("");
  const [showArForm, setShowArForm] = useState(false);

  // Pharmacy search
  const [pharmSearch, setPharmSearch] = useState("");

  const pendingRequests = requests.filter(r => r.status === "pending");

  const handleRequestAction = (id: string, action: "approved" | "denied" | "modify" | "contact") => {
    if (action === "modify") {
      notify("Modification form opened for request " + id, "success");
      return;
    }
    if (action === "contact") {
      notify("Contacting patient for request " + id, "success");
      return;
    }
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: action } : r));
    notify(`Refill request ${id} ${action}`, "success");
  };

  const handleEprescribe = () => {
    if (!rxMedSelected) return notify("Select a medication", "error");
    if (!rxDosage) return notify("Enter dosage", "error");
    if (!rxPharmacy) return notify("Select a pharmacy", "error");
    notify(`E-prescription sent: ${rxMedSelected} ${rxDosage} to ${rxPharmacy}`, "success");
    setRxMedSearch(""); setRxMedSelected(""); setRxDosage("");
    setRxFrequency("Once daily"); setRxQuantity("30"); setRxRefills("3");
    setRxPharmacy(""); setRxInstructions(""); setRxDaw(false);
  };

  const handleAddAutoRule = () => {
    if (!arMed || !arPatient || !arExpiry) return notify("Fill all auto-refill fields", "error");
    const newRule: AutoRefillRule = {
      id: "AR" + Date.now(),
      medication: arMed,
      patient: arPatient,
      maxRefills: parseInt(arMax) || 6,
      intervalDays: parseInt(arInterval) || 30,
      expiry: arExpiry,
      enabled: true,
    };
    setAutoRules(prev => [...prev, newRule]);
    setArMed(""); setArPatient(""); setArMax("6"); setArInterval("30"); setArExpiry("");
    setShowArForm(false);
    notify("Auto-refill rule created", "success");
  };

  const toggleAutoRule = (id: string) => {
    setAutoRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const handlePaAction = (id: string, action: "submitted" | "approved" | "denied") => {
    setPriorAuths(prev => prev.map(p => p.id === id ? { ...p, status: action, submittedDate: action === "submitted" ? "2026-07-08" : p.submittedDate } : p));
    notify(`Prior auth ${id} updated to ${action}`, "success");
  };

  const filteredMeds = rxMedSearch ? MEDICATIONS.filter(m => m.toLowerCase().includes(rxMedSearch.toLowerCase())) : [];
  const filteredPharmacies = MOCK_PHARMACIES.filter(p => p.name.toLowerCase().includes(pharmSearch.toLowerCase()));

  const tabs: { key: Tab; label: string; icon: JSX.Element; badge?: number }[] = [
    { key: "queue", label: "Queue", icon: <IconQueue />, badge: pendingRequests.length },
    { key: "eprescribe", label: "E-Prescribe", icon: <IconPrescribe /> },
    { key: "autorefill", label: "Auto-Refill", icon: <IconAuto /> },
    { key: "pharmacies", label: "Pharmacies", icon: <IconPharmacy /> },
    { key: "history", label: "History", icon: <IconHistory /> },
    { key: "controlled", label: "Controlled", icon: <IconControlled /> },
    { key: "priorauth", label: "Prior Auth", icon: <IconAuth /> },
  ];

  return (
    <div className="page-enter">
      <div className="breadcrumb">
        <button onClick={onBack}><IconBack /> Home</button>
        <span className="sep">/</span>
        <span>Prescription Refills</span>
      </div>

      <div className="section-header">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 8 }}><IconRx /> Prescription Refills</h1>
          <div className="subtitle">Manage refill requests, e-prescribe, and pharmacy communications</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="chart-tabs" style={{ marginBottom: 20, flexWrap: "wrap" }}>
        {tabs.map(t => (
          <button key={t.key} className={`chart-tab${tab === t.key ? " active" : ""}`} onClick={() => setTab(t.key)} style={{ position: "relative" }}>
            {t.icon} {t.label}
            {t.badge ? (
              <span style={{ marginLeft: 6, background: "#ef4444", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 700 }}>{t.badge}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── Queue ── */}
      {tab === "queue" && (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Pending Refill Requests ({pendingRequests.length})</h2>
          {pendingRequests.length === 0 && <div className="neu" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>No pending requests</div>}
          {pendingRequests.map(r => (
            <div key={r.id} className="neu" style={{ padding: 16, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{r.patient}</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    {r.medication} <strong>{r.dose}</strong> &middot; {r.pharmacy}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                    Requested: {r.dateRequested}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 12, color: urgencyColor(r.urgency), background: urgencyBg(r.urgency), textTransform: "uppercase" }}>
                    {r.urgency}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button className="neu-btn" style={{ fontSize: 12, color: "#22c55e" }} onClick={() => handleRequestAction(r.id, "approved")}><IconCheck /> Approve</button>
                <button className="neu-btn" style={{ fontSize: 12, color: "#ef4444" }} onClick={() => handleRequestAction(r.id, "denied")}><IconX /> Deny</button>
                <button className="neu-btn" style={{ fontSize: 12 }} onClick={() => handleRequestAction(r.id, "modify")}><IconEdit /> Modify</button>
                <button className="neu-btn" style={{ fontSize: 12 }} onClick={() => handleRequestAction(r.id, "contact")}><IconPhone /> Contact</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── E-Prescribe ── */}
      {tab === "eprescribe" && (
        <div className="neu" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>E-Prescribe</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
            {/* Medication search */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Medication *</label>
              <div style={{ position: "relative" }}>
                <input
                  className="neu-input"
                  placeholder="Search medication..."
                  value={rxMedSelected || rxMedSearch}
                  onChange={e => { setRxMedSearch(e.target.value); setRxMedSelected(""); }}
                  style={{ width: "100%", paddingLeft: 32 }}
                />
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}><IconSearch /></span>
              </div>
              {filteredMeds.length > 0 && !rxMedSelected && (
                <div className="neu" style={{ marginTop: 4, maxHeight: 150, overflowY: "auto", padding: 4 }}>
                  {filteredMeds.map(m => (
                    <div key={m} style={{ padding: "6px 10px", cursor: "pointer", borderRadius: 6, fontSize: 13 }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      onClick={() => { setRxMedSelected(m); setRxMedSearch(""); }}>
                      {m}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Dosage */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Dosage *</label>
              <input className="neu-input" placeholder="e.g. 10mg" value={rxDosage} onChange={e => setRxDosage(e.target.value)} style={{ width: "100%" }} />
            </div>

            {/* Frequency */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Frequency</label>
              <select className="neu-input" value={rxFrequency} onChange={e => setRxFrequency(e.target.value)} style={{ width: "100%" }}>
                <option>Once daily</option><option>Twice daily</option><option>Three times daily</option>
                <option>Every 6 hours</option><option>Every 8 hours</option><option>Every 12 hours</option>
                <option>As needed (PRN)</option><option>At bedtime</option><option>Weekly</option>
              </select>
            </div>

            {/* Quantity */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Quantity</label>
              <input className="neu-input" type="number" min="1" value={rxQuantity} onChange={e => setRxQuantity(e.target.value)} style={{ width: "100%" }} />
            </div>

            {/* Refills */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Refills</label>
              <input className="neu-input" type="number" min="0" max="12" value={rxRefills} onChange={e => setRxRefills(e.target.value)} style={{ width: "100%" }} />
            </div>

            {/* Pharmacy */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Pharmacy *</label>
              <select className="neu-input" value={rxPharmacy} onChange={e => setRxPharmacy(e.target.value)} style={{ width: "100%" }}>
                <option value="">Select pharmacy...</option>
                {MOCK_PHARMACIES.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>

            {/* Special instructions */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Special Instructions</label>
              <textarea className="neu-input" rows={3} placeholder="Additional instructions for the pharmacist..." value={rxInstructions} onChange={e => setRxInstructions(e.target.value)} style={{ width: "100%", resize: "vertical" }} />
            </div>

            {/* DAW toggle */}
            <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 10 }}>
              <button
                className="neu-btn"
                style={{ width: 44, height: 24, borderRadius: 12, padding: 0, position: "relative", background: rxDaw ? "rgba(34,197,94,0.3)" : undefined, transition: "background 0.2s" }}
                onClick={() => setRxDaw(!rxDaw)}
              >
                <span style={{
                  display: "block", width: 18, height: 18, borderRadius: "50%", background: rxDaw ? "#22c55e" : "var(--text-muted)",
                  position: "absolute", top: 3, left: rxDaw ? 22 : 4, transition: "left 0.2s, background 0.2s"
                }} />
              </button>
              <span style={{ fontSize: 13, fontWeight: 600 }}>DAW (Dispense As Written)</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Prevents generic substitution</span>
            </div>
          </div>

          <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
            <button className="neu-btn" style={{ fontWeight: 700, color: "#22c55e" }} onClick={handleEprescribe}>
              <IconPrescribe /> Send E-Prescription
            </button>
          </div>
        </div>
      )}

      {/* ── Auto-Refill Rules ── */}
      {tab === "autorefill" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Auto-Refill Rules</h2>
            <button className="neu-btn" style={{ fontWeight: 600, fontSize: 12 }} onClick={() => setShowArForm(!showArForm)}>
              {showArForm ? "Cancel" : "+ New Rule"}
            </button>
          </div>

          {showArForm && (
            <div className="neu" style={{ padding: 20, marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Medication</label>
                  <input className="neu-input" value={arMed} onChange={e => setArMed(e.target.value)} placeholder="Medication name + dose" style={{ width: "100%" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Patient</label>
                  <input className="neu-input" value={arPatient} onChange={e => setArPatient(e.target.value)} placeholder="Patient name" style={{ width: "100%" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Max Refills</label>
                  <input className="neu-input" type="number" min="1" value={arMax} onChange={e => setArMax(e.target.value)} style={{ width: "100%" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Interval (days)</label>
                  <input className="neu-input" type="number" min="1" value={arInterval} onChange={e => setArInterval(e.target.value)} style={{ width: "100%" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Expiry Date</label>
                  <input className="neu-input" type="date" value={arExpiry} onChange={e => setArExpiry(e.target.value)} style={{ width: "100%" }} />
                </div>
              </div>
              <button className="neu-btn" style={{ marginTop: 12, fontWeight: 700, color: "#22c55e" }} onClick={handleAddAutoRule}>
                <IconCheck /> Create Rule
              </button>
            </div>
          )}

          {autoRules.map(rule => (
            <div key={rule.id} className="neu" style={{ padding: 16, marginBottom: 12, opacity: rule.enabled ? 1 : 0.5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{rule.medication}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {rule.patient} &middot; Every {rule.intervalDays} days &middot; Max {rule.maxRefills} refills &middot; Expires {rule.expiry}
                  </div>
                </div>
                <button
                  className="neu-btn"
                  style={{ fontSize: 11, color: rule.enabled ? "#22c55e" : "var(--text-muted)" }}
                  onClick={() => toggleAutoRule(rule.id)}
                >
                  {rule.enabled ? "Enabled" : "Disabled"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Pharmacy Directory ── */}
      {tab === "pharmacies" && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ position: "relative", maxWidth: 360 }}>
              <input className="neu-input" placeholder="Search pharmacies..." value={pharmSearch} onChange={e => setPharmSearch(e.target.value)} style={{ width: "100%", paddingLeft: 32 }} />
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}><IconSearch /></span>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
            {filteredPharmacies.map(p => (
              <div key={p.id} className="neu" style={{ padding: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><IconPharmacy /> {p.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.8 }}>
                  <div>{p.address}</div>
                  <div><strong>Phone:</strong> {p.phone}</div>
                  <div><strong>Fax:</strong> {p.fax}</div>
                  <div><strong>Hours:</strong> {p.hours}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Refill History ── */}
      {tab === "history" && (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Refill History</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={{ padding: "10px 12px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)" }}>Medication</th>
                  <th style={{ padding: "10px 12px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)" }}>Date</th>
                  <th style={{ padding: "10px 12px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)" }}>Status</th>
                  <th style={{ padding: "10px 12px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)" }}>Pharmacy</th>
                  <th style={{ padding: "10px 12px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)" }}>Prescriber</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id} className="neu" style={{ marginBottom: 4 }}>
                    <td style={{ padding: "10px 12px", fontWeight: 600 }}>{h.medication}</td>
                    <td style={{ padding: "10px 12px" }}>{h.date}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 10, color: statusColor(h.status), background: statusBg(h.status), textTransform: "uppercase" }}>
                        {h.status}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 12 }}>{h.pharmacy}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12 }}>{h.prescriber}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Controlled Substances ── */}
      {tab === "controlled" && (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Controlled Substance Tracking</h2>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>DEA Schedule II-V medications with fill tracking</p>
          {controlled.map(cs => (
            <div key={cs.id} className="neu" style={{ padding: 16, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    {cs.medication}
                    <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 8, color: scheduleColor(cs.schedule), background: `${scheduleColor(cs.schedule)}22`, border: `1px solid ${scheduleColor(cs.schedule)}44` }}>
                      Schedule {cs.schedule}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Patient: {cs.patient}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12 }}>Last Fill: <strong>{cs.lastFillDate}</strong></div>
                  <div style={{ fontSize: 12, marginTop: 2, color: cs.remainingRefills === 0 ? "#ef4444" : "inherit" }}>
                    Remaining Refills: <strong>{cs.remainingRefills}</strong>
                    {cs.remainingRefills === 0 && <span style={{ fontSize: 10, marginLeft: 6, color: "#ef4444", fontWeight: 700 }}>NEW RX REQUIRED</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Prior Authorization ── */}
      {tab === "priorauth" && (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Prior Authorization Workflow</h2>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>Track insurance prior authorization status for medications</p>
          {priorAuths.map(pa => (
            <div key={pa.id} className="neu" style={{ padding: 16, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{pa.medication}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    {pa.patient} &middot; {pa.insurance} &middot; Policy: {pa.policyNumber}
                  </div>
                  {pa.submittedDate && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Submitted: {pa.submittedDate}</div>}
                  <div style={{ fontSize: 12, marginTop: 6, fontStyle: "italic", color: "var(--text-muted)" }}>{pa.notes}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 12px", borderRadius: 12, color: paStatusColor(pa.status), background: `${paStatusColor(pa.status)}22`, textTransform: "uppercase" }}>
                    {pa.status}
                  </span>
                  <div style={{ display: "flex", gap: 6 }}>
                    {pa.status === "needed" && (
                      <button className="neu-btn" style={{ fontSize: 11, color: "#3b82f6" }} onClick={() => handlePaAction(pa.id, "submitted")}>Submit PA</button>
                    )}
                    {pa.status === "submitted" && (
                      <>
                        <button className="neu-btn" style={{ fontSize: 11, color: "#22c55e" }} onClick={() => handlePaAction(pa.id, "approved")}>Mark Approved</button>
                        <button className="neu-btn" style={{ fontSize: 11, color: "#ef4444" }} onClick={() => handlePaAction(pa.id, "denied")}>Mark Denied</button>
                      </>
                    )}
                    {pa.status === "denied" && (
                      <button className="neu-btn" style={{ fontSize: 11, color: "#3b82f6" }} onClick={() => handlePaAction(pa.id, "submitted")}>Resubmit</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
