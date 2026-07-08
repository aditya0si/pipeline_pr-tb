import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import * as api from "../api";
import { MiniChart } from "../components/MiniChart";
import { HeartIcon, PulseIcon, ThermometerIcon, DropletIcon, AlertTriangleIcon, ClipboardIcon, CalendarIcon, LungsIcon, ScaleIcon } from "../components/MedIcons";

interface Props {
  patientId: string;
  onBack: () => void;
  notify: (msg: string, type?: "success" | "error") => void;
}

type Tab = "overview" | "vitals" | "meds" | "rx" | "notes" | "labs" | "appointments" | "diagnoses" | "referrals" | "billing" | "insurance";

export function PatientChart({ patientId, onBack, notify }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [patient, setPatient] = useState<any>(null);
  const [allergies, setAllergies] = useState<any[]>([]);
  const [conditions, setConditions] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [vitals, setVitals] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [labs, setLabs] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [diagnoses, setDiagnoses] = useState<any[]>([]);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [insuranceList, setInsuranceList] = useState<any[]>([]);
  const [icdSearch, setIcdSearch] = useState("");
  const [icdResults, setIcdResults] = useState<any[]>([]);
  const [modal, setModal] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [p, al, co, med, vi, rx, no, lb, ap, dg, rf, inv, ins] = await Promise.all([
        api.getPatientDetail(patientId),
        api.listAllergies(patientId),
        api.listConditions(patientId),
        api.listMedications(patientId),
        api.listVitals(patientId),
        api.listPrescriptions(patientId),
        api.listClinicalNotes(patientId),
        api.listLabResults(patientId),
        api.listAppointments({ patient_id: patientId }),
        api.listDiagnoses(patientId),
        api.listReferrals(patientId),
        api.listInvoices(patientId),
        api.listInsurance(patientId),
      ]);
      setPatient(p);
      setAllergies(al);
      setConditions(co);
      setMedications(med);
      setVitals(vi);
      setPrescriptions(rx);
      setNotes(no);
      setLabs(lb);
      setAppointments(ap);
      setDiagnoses(dg);
      setReferrals(rf);
      setInvoices(inv);
      setInsuranceList(ins);
    } catch (e: any) {
      notify(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [patientId]);

  if (loading || !patient) return (
    <div className="page-enter">
      {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton skeleton-card" />)}
    </div>
  );

  const latestVital = vitals[0];
  const activeConditions = conditions.filter(c => c.status === "active");
  const activeMeds = medications.filter(m => m.status === "active");
  const bpData = vitals.filter(v => v.systolic).slice(0, 20).reverse().map(v => v.systolic);
  const hrData = vitals.filter(v => v.heart_rate).slice(0, 20).reverse().map(v => v.heart_rate);
  const tempData = vitals.filter(v => v.temperature).slice(0, 20).reverse().map(v => v.temperature);
  const weightData = vitals.filter(v => v.weight).slice(0, 20).reverse().map(v => v.weight);

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "vitals", label: "Vitals", count: vitals.length },
    { key: "meds", label: "Medications", count: activeMeds.length },
    { key: "rx", label: "Prescriptions", count: prescriptions.length },
    { key: "notes", label: "SOAP Notes", count: notes.length },
    { key: "labs", label: "Lab Results", count: labs.length },
    { key: "appointments", label: "Appointments", count: appointments.length },
    { key: "diagnoses", label: "ICD-10", count: diagnoses.length },
    { key: "referrals", label: "Referrals", count: referrals.length },
    { key: "billing", label: "Billing", count: invoices.length },
    { key: "insurance", label: "Insurance", count: insuranceList.length },
  ];

  const age = patient.date_of_birth ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / 31557600000) : null;

  return (
    <div className="page-enter">
      <div className="breadcrumb">
        <button onClick={onBack}>Patients</button>
        <span className="sep">/</span>
        <span>{patient.name || patient.phone}</span>
      </div>

      {/* Patient Header */}
      <div className="chart-header neu">
        <div className="chart-header-left">
          <div className="chart-avatar" style={{ background: `hsl(${[...patient.name || patient.phone].reduce((a: number, c: string) => a + c.charCodeAt(0), 0) % 360}, 65%, 55%)` }}>
            {(patient.name || patient.phone).split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="chart-name">{patient.name || "Unnamed"}</h1>
            <div className="chart-meta">
              {age !== null && <span>{age}y</span>}
              {patient.gender && <span>{patient.gender}</span>}
              {patient.blood_group && <span className="chart-blood">{patient.blood_group}</span>}
              <span>📞 {patient.phone}</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {allergies.length > 0 && (
            <div className="chart-alert">
              <AlertTriangleIcon size={16} color="var(--danger)" />
              <span>{allergies.length} Allerg{allergies.length > 1 ? "ies" : "y"}: {allergies.map(a => a.allergen).join(", ")}</span>
            </div>
          )}
          <button className="neu-btn sm ghost" onClick={async () => {
            try {
              const data = await api.exportPatientData(patientId);
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `patient_${patient.name || patientId}_export.json`;
              a.click();
              URL.revokeObjectURL(url);
              notify("Patient data exported");
            } catch (e: any) { notify(e.message, "error"); }
          }} title="Export patient data">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="chart-tabs">
        {TABS.map(t => (
          <button key={t.key} className={`chart-tab${tab === t.key ? " active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
            {t.count !== undefined && t.count > 0 && <span className="chart-tab-badge">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "overview" && (
        <div className="chart-overview">
          {/* Vital Signs Summary */}
          {latestVital && (
            <div className="chart-section">
              <h3>Latest Vitals</h3>
              <div className="vitals-grid">
                {latestVital.systolic && (
                  <div className="vital-card neu">
                    <div className="vital-card-head">
                      <HeartIcon size={18} color="var(--danger)" />
                      <span>Blood Pressure</span>
                    </div>
                    <div className="vital-card-value">{latestVital.systolic}/{latestVital.diastolic}</div>
                    <div className="vital-card-unit">mmHg</div>
                    {bpData.length > 2 && <MiniChart data={bpData} color="var(--danger)" width={160} height={40} />}
                  </div>
                )}
                {latestVital.heart_rate && (
                  <div className="vital-card neu">
                    <div className="vital-card-head">
                      <PulseIcon size={18} color="var(--accent)" />
                      <span>Heart Rate</span>
                    </div>
                    <div className="vital-card-value">{latestVital.heart_rate}</div>
                    <div className="vital-card-unit">bpm</div>
                    {hrData.length > 2 && <MiniChart data={hrData} color="var(--accent)" width={160} height={40} />}
                  </div>
                )}
                {latestVital.temperature && (
                  <div className="vital-card neu">
                    <div className="vital-card-head">
                      <ThermometerIcon size={18} color="var(--warning)" />
                      <span>Temperature</span>
                    </div>
                    <div className="vital-card-value">{latestVital.temperature}</div>
                    <div className="vital-card-unit">°F</div>
                    {tempData.length > 2 && <MiniChart data={tempData} color="var(--warning)" width={160} height={40} />}
                  </div>
                )}
                {latestVital.spo2 && (
                  <div className="vital-card neu">
                    <div className="vital-card-head">
                      <LungsIcon size={18} color="var(--success)" />
                      <span>SpO2</span>
                    </div>
                    <div className="vital-card-value">{latestVital.spo2}%</div>
                    <div className="vital-card-unit">oxygen</div>
                  </div>
                )}
                {latestVital.weight && (
                  <div className="vital-card neu">
                    <div className="vital-card-head">
                      <ScaleIcon size={18} color="#7c3aed" />
                      <span>Weight</span>
                    </div>
                    <div className="vital-card-value">{latestVital.weight}</div>
                    <div className="vital-card-unit">kg</div>
                    {weightData.length > 2 && <MiniChart data={weightData} color="#7c3aed" width={160} height={40} />}
                  </div>
                )}
                {latestVital.blood_sugar && (
                  <div className="vital-card neu">
                    <div className="vital-card-head">
                      <DropletIcon size={18} color="#db2777" />
                      <span>Blood Sugar</span>
                    </div>
                    <div className="vital-card-value">{latestVital.blood_sugar}</div>
                    <div className="vital-card-unit">mg/dL</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Active Conditions */}
          <div className="chart-section">
            <div className="chart-section-header">
              <h3>Active Conditions</h3>
              <button className="neu-btn sm primary" onClick={() => setModal("condition")}>+ Add</button>
            </div>
            {activeConditions.length === 0 ? (
              <div className="chart-empty">No active conditions recorded</div>
            ) : (
              <div className="tag-list">
                {activeConditions.map(c => (
                  <div key={c.id} className="med-tag neu">
                    <span className="med-tag-dot" style={{ background: "var(--warning)" }} />
                    <span>{c.name}</span>
                    <button className="med-tag-x" onClick={async () => { await api.deleteCondition(c.id); load(); }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Allergies */}
          <div className="chart-section">
            <div className="chart-section-header">
              <h3>Allergies</h3>
              <button className="neu-btn sm primary" onClick={() => setModal("allergy")}>+ Add</button>
            </div>
            {allergies.length === 0 ? (
              <div className="chart-empty">No known allergies</div>
            ) : (
              <div className="tag-list">
                {allergies.map(a => (
                  <div key={a.id} className={`med-tag neu severity-${a.severity}`}>
                    <AlertTriangleIcon size={14} color={a.severity === "severe" ? "var(--danger)" : "var(--warning)"} />
                    <span>{a.allergen}</span>
                    <span className="med-tag-severity">{a.severity}</span>
                    <button className="med-tag-x" onClick={async () => { await api.deleteAllergy(a.id); load(); }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Medications */}
          <div className="chart-section">
            <div className="chart-section-header">
              <h3>Current Medications</h3>
              <button className="neu-btn sm primary" onClick={() => setModal("medication")}>+ Add</button>
            </div>
            {activeMeds.length === 0 ? (
              <div className="chart-empty">No active medications</div>
            ) : (
              <div className="med-list">
                {activeMeds.map(m => (
                  <div key={m.id} className="med-row neu">
                    <div className="med-row-name">{m.name}</div>
                    <div className="med-row-detail">{m.dosage} · {m.frequency}</div>
                    <button className="med-tag-x" onClick={async () => { await api.deleteMedication(m.id); load(); }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "vitals" && <VitalsTab patientId={patientId} vitals={vitals} onRefresh={load} notify={notify} />}
      {tab === "meds" && <MedsTab patientId={patientId} medications={medications} onRefresh={load} notify={notify} />}
      {tab === "rx" && <PrescriptionsTab patientId={patientId} prescriptions={prescriptions} onRefresh={load} notify={notify} />}
      {tab === "notes" && <NotesTab patientId={patientId} notes={notes} onRefresh={load} notify={notify} />}
      {tab === "labs" && <LabsTab patientId={patientId} labs={labs} onRefresh={load} notify={notify} />}
      {tab === "appointments" && <AppointmentsTab patientId={patientId} appointments={appointments} patientName={patient.name} onRefresh={load} notify={notify} />}
      {tab === "diagnoses" && <DiagnosesTab patientId={patientId} diagnoses={diagnoses} icdSearch={icdSearch} setIcdSearch={setIcdSearch} icdResults={icdResults} setIcdResults={setIcdResults} onRefresh={load} notify={notify} />}
      {tab === "referrals" && <ReferralsTab patientId={patientId} referrals={referrals} onRefresh={load} notify={notify} />}
      {tab === "billing" && <BillingTab patientId={patientId} invoices={invoices} onRefresh={load} notify={notify} />}
      {tab === "insurance" && <InsuranceTab patientId={patientId} insuranceList={insuranceList} onRefresh={load} notify={notify} />}

      {/* Quick-add modals */}
      {modal && <QuickAddModal type={modal} patientId={patientId} onClose={() => setModal(null)} onSave={() => { setModal(null); load(); }} notify={notify} />}
    </div>
  );
}

// ── Vitals Tab ──────────────────────────────────────────────

function VitalsTab({ patientId, vitals, onRefresh, notify }: { patientId: string; vitals: any[]; onRefresh: () => void; notify: any }) {
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.recordVital({ patient_id: patientId, ...form });
      setForm({});
      notify("Vitals recorded!");
      onRefresh();
    } catch (e: any) { notify(e.message, "error"); }
    finally { setSaving(false); }
  };

  const fields = [
    { key: "systolic", label: "Systolic", unit: "mmHg", icon: <HeartIcon size={16} color="var(--danger)" /> },
    { key: "diastolic", label: "Diastolic", unit: "mmHg", icon: <HeartIcon size={16} color="var(--danger)" /> },
    { key: "heart_rate", label: "Heart Rate", unit: "bpm", icon: <PulseIcon size={16} color="var(--accent)" /> },
    { key: "temperature", label: "Temp", unit: "°F", icon: <ThermometerIcon size={16} color="var(--warning)" /> },
    { key: "spo2", label: "SpO2", unit: "%", icon: <LungsIcon size={16} color="var(--success)" /> },
    { key: "respiratory_rate", label: "Resp Rate", unit: "/min", icon: <LungsIcon size={16} color="var(--success)" /> },
    { key: "weight", label: "Weight", unit: "kg", icon: <ScaleIcon size={16} color="#7c3aed" /> },
    { key: "blood_sugar", label: "Blood Sugar", unit: "mg/dL", icon: <DropletIcon size={16} color="#db2777" /> },
  ];

  return (
    <div>
      <div className="vitals-form neu">
        <h3>Record Vitals</h3>
        <div className="vitals-form-grid">
          {fields.map(f => (
            <div key={f.key} className="vitals-form-field">
              <label>{f.icon} {f.label} <span className="vitals-unit">({f.unit})</span></label>
              <input className="neu-input sm" type="number" placeholder={f.unit} value={form[f.key] || ""} onChange={e => setForm((p: any) => ({ ...p, [f.key]: e.target.value ? Number(e.target.value) : undefined }))} />
            </div>
          ))}
        </div>
        <button className="neu-btn primary" onClick={save} disabled={saving} style={{ marginTop: 12 }}>
          {saving ? <span className="spinner white" /> : "Save Vitals"}
        </button>
      </div>

      {vitals.length > 0 && (
        <div className="vitals-history">
          <h3>History</h3>
          <div className="vitals-table-wrap">
            <table className="vitals-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>BP</th>
                  <th>HR</th>
                  <th>Temp</th>
                  <th>SpO2</th>
                  <th>RR</th>
                  <th>Wt</th>
                  <th>Sugar</th>
                </tr>
              </thead>
              <tbody>
                {vitals.slice(0, 20).map(v => (
                  <tr key={v.id}>
                    <td>{new Date(v.recorded_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    <td>{v.systolic ? `${v.systolic}/${v.diastolic}` : "—"}</td>
                    <td>{v.heart_rate || "—"}</td>
                    <td>{v.temperature || "—"}</td>
                    <td>{v.spo2 ? `${v.spo2}%` : "—"}</td>
                    <td>{v.respiratory_rate || "—"}</td>
                    <td>{v.weight || "—"}</td>
                    <td>{v.blood_sugar || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Medications Tab ─────────────────────────────────────────

function MedsTab({ patientId, medications, onRefresh, notify }: { patientId: string; medications: any[]; onRefresh: () => void; notify: any }) {
  const [form, setForm] = useState({ name: "", dosage: "", frequency: "", start_date: "" });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name) return notify("Medication name required", "error");
    setSaving(true);
    try {
      await api.addMedication(patientId, form);
      setForm({ name: "", dosage: "", frequency: "", start_date: "" });
      notify("Medication added!");
      onRefresh();
    } catch (e: any) { notify(e.message, "error"); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="form-inline neu">
        <input className="neu-input sm" placeholder="Medication name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        <input className="neu-input sm" placeholder="Dosage (e.g. 500mg)" value={form.dosage} onChange={e => setForm(p => ({ ...p, dosage: e.target.value }))} />
        <input className="neu-input sm" placeholder="Frequency (e.g. twice daily)" value={form.frequency} onChange={e => setForm(p => ({ ...p, frequency: e.target.value }))} />
        <button className="neu-btn sm primary" onClick={save} disabled={saving}>Add</button>
      </div>
      <div className="med-list" style={{ marginTop: 16 }}>
        {medications.map(m => (
          <div key={m.id} className="med-row neu">
            <div style={{ flex: 1 }}>
              <div className="med-row-name">{m.name}</div>
              <div className="med-row-detail">{m.dosage} · {m.frequency} · <span className={`tag ${m.status === "active" ? "analyzed" : "pending"}`}>{m.status}</span></div>
            </div>
            <button className="neu-btn sm danger" onClick={async () => { await api.deleteMedication(m.id); onRefresh(); }}>Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Prescriptions Tab ───────────────────────────────────────

function PrescriptionsTab({ patientId, prescriptions, onRefresh, notify }: { patientId: string; prescriptions: any[]; onRefresh: () => void; notify: any }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ doctor_name: "", diagnosis: "", notes: "", items: [{ drug: "", dosage: "", frequency: "", duration: "" }] });
  const [saving, setSaving] = useState(false);

  const addItem = () => setForm(p => ({ ...p, items: [...p.items, { drug: "", dosage: "", frequency: "", duration: "" }] }));
  const updateItem = (i: number, field: string, val: string) =>
    setForm(p => ({ ...p, items: p.items.map((it, j) => j === i ? { ...it, [field]: val } : it) }));

  const save = async () => {
    setSaving(true);
    try {
      await api.createPrescription({ patient_id: patientId, ...form });
      setShowForm(false);
      setForm({ doctor_name: "", diagnosis: "", notes: "", items: [{ drug: "", dosage: "", frequency: "", duration: "" }] });
      notify("Prescription created!");
      onRefresh();
    } catch (e: any) { notify(e.message, "error"); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <button className="neu-btn primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Prescription"}
        </button>
      </div>

      {showForm && (
        <div className="rx-form neu">
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Doctor Name</label>
              <input className="neu-input sm" value={form.doctor_name} onChange={e => setForm(p => ({ ...p, doctor_name: e.target.value }))} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Diagnosis</label>
              <input className="neu-input sm" value={form.diagnosis} onChange={e => setForm(p => ({ ...p, diagnosis: e.target.value }))} />
            </div>
          </div>
          <h4 style={{ margin: "12px 0 8px", fontSize: 13, fontWeight: 600 }}>Medications</h4>
          {form.items.map((item, i) => (
            <div key={i} className="form-row">
              <input className="neu-input sm" placeholder="Drug" value={item.drug} onChange={e => updateItem(i, "drug", e.target.value)} />
              <input className="neu-input sm" placeholder="Dosage" value={item.dosage} onChange={e => updateItem(i, "dosage", e.target.value)} />
              <input className="neu-input sm" placeholder="Frequency" value={item.frequency} onChange={e => updateItem(i, "frequency", e.target.value)} />
              <input className="neu-input sm" placeholder="Duration" value={item.duration} onChange={e => updateItem(i, "duration", e.target.value)} />
            </div>
          ))}
          <button className="neu-btn sm ghost" onClick={addItem}>+ Add medication</button>
          <div className="form-group" style={{ marginTop: 12 }}>
            <label>Notes</label>
            <textarea className="neu-input sm" rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
          <button className="neu-btn primary" onClick={save} disabled={saving} style={{ marginTop: 8 }}>
            {saving ? <span className="spinner white" /> : "Create Prescription"}
          </button>
        </div>
      )}

      {prescriptions.map(rx => (
        <div key={rx.id} className="rx-card neu" style={{ marginTop: 12 }}>
          <div className="rx-card-header">
            <div>
              <strong>Rx</strong> · {rx.doctor_name || "Unknown Doctor"}
              <span style={{ color: "var(--text-muted)", fontSize: 12, marginLeft: 8 }}>
                {new Date(rx.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
            {rx.diagnosis && <span className="tag image">{rx.diagnosis}</span>}
          </div>
          <table className="rx-table">
            <thead><tr><th>Drug</th><th>Dosage</th><th>Frequency</th><th>Duration</th></tr></thead>
            <tbody>
              {(rx.items || []).map((item: any, i: number) => (
                <tr key={i}><td>{item.drug}</td><td>{item.dosage}</td><td>{item.frequency}</td><td>{item.duration}</td></tr>
              ))}
            </tbody>
          </table>
          {rx.notes && <div className="rx-notes">{rx.notes}</div>}
        </div>
      ))}
    </div>
  );
}

// ── SOAP Notes Tab ──────────────────────────────────────────

function NotesTab({ patientId, notes, onRefresh, notify }: { patientId: string; notes: any[]; onRefresh: () => void; notify: any }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ doctor_name: "", visit_type: "follow-up", subjective: "", objective: "", assessment: "", plan: "" });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.createClinicalNote({ patient_id: patientId, ...form });
      setShowForm(false);
      setForm({ doctor_name: "", visit_type: "follow-up", subjective: "", objective: "", assessment: "", plan: "" });
      notify("Note saved!");
      onRefresh();
    } catch (e: any) { notify(e.message, "error"); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <button className="neu-btn primary" onClick={() => setShowForm(!showForm)} style={{ marginBottom: 16 }}>
        {showForm ? "Cancel" : "+ New SOAP Note"}
      </button>

      {showForm && (
        <div className="soap-form neu">
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Doctor</label>
              <input className="neu-input sm" value={form.doctor_name} onChange={e => setForm(p => ({ ...p, doctor_name: e.target.value }))} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Visit Type</label>
              <select className="neu-input sm" value={form.visit_type} onChange={e => setForm(p => ({ ...p, visit_type: e.target.value }))}>
                <option value="initial">Initial Visit</option>
                <option value="follow-up">Follow-up</option>
                <option value="urgent">Urgent</option>
                <option value="telehealth">Telehealth</option>
              </select>
            </div>
          </div>
          {(["subjective", "objective", "assessment", "plan"] as const).map(field => (
            <div className="form-group" key={field}>
              <label className="soap-label">{field[0].toUpperCase()} — {field.charAt(0).toUpperCase() + field.slice(1)}</label>
              <textarea className="neu-input sm" rows={3} value={form[field]} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))} placeholder={field === "subjective" ? "Patient's complaints and history..." : field === "objective" ? "Examination findings, vitals..." : field === "assessment" ? "Diagnosis and clinical impression..." : "Treatment plan, follow-up..."} />
            </div>
          ))}
          <button className="neu-btn primary" onClick={save} disabled={saving}>
            {saving ? <span className="spinner white" /> : "Save Note"}
          </button>
        </div>
      )}

      {notes.map(n => (
        <div key={n.id} className="soap-card neu" style={{ marginTop: 12 }}>
          <div className="soap-card-header">
            <span>{n.doctor_name || "Doctor"} · <span className="tag image">{n.visit_type}</span></span>
            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
              {new Date(n.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
          <div className="soap-sections">
            {n.subjective && <div className="soap-section"><span className="soap-letter">S</span><p>{n.subjective}</p></div>}
            {n.objective && <div className="soap-section"><span className="soap-letter">O</span><p>{n.objective}</p></div>}
            {n.assessment && <div className="soap-section"><span className="soap-letter">A</span><p>{n.assessment}</p></div>}
            {n.plan && <div className="soap-section"><span className="soap-letter">P</span><p>{n.plan}</p></div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Lab Results Tab ─────────────────────────────────────────

function LabsTab({ patientId, labs, onRefresh, notify }: { patientId: string; labs: any[]; onRefresh: () => void; notify: any }) {
  const [form, setForm] = useState({ test_name: "", value: "", unit: "", reference_low: "", reference_high: "", status: "normal", tested_at: "" });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.test_name || !form.value) return notify("Test name and value required", "error");
    setSaving(true);
    try {
      await api.addLabResult({
        patient_id: patientId,
        test_name: form.test_name,
        value: Number(form.value),
        unit: form.unit,
        reference_low: form.reference_low ? Number(form.reference_low) : null,
        reference_high: form.reference_high ? Number(form.reference_high) : null,
        status: form.status,
        tested_at: form.tested_at,
      });
      setForm({ test_name: "", value: "", unit: "", reference_low: "", reference_high: "", status: "normal", tested_at: "" });
      notify("Lab result added!");
      onRefresh();
    } catch (e: any) { notify(e.message, "error"); }
    finally { setSaving(false); }
  };

  const grouped = labs.reduce((acc: Record<string, any[]>, l) => {
    (acc[l.test_name] = acc[l.test_name] || []).push(l);
    return acc;
  }, {});

  return (
    <div>
      <div className="form-inline neu">
        <input className="neu-input sm" placeholder="Test Name (e.g. Hemoglobin)" value={form.test_name} onChange={e => setForm(p => ({ ...p, test_name: e.target.value }))} />
        <input className="neu-input sm" placeholder="Value" type="number" value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))} />
        <input className="neu-input sm" placeholder="Unit" value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} style={{ maxWidth: 80 }} />
        <select className="neu-input sm" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} style={{ maxWidth: 100 }}>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <button className="neu-btn sm primary" onClick={save} disabled={saving}>Add</button>
      </div>

      {Object.entries(grouped).map(([name, results]) => (
        <div key={name} className="lab-group" style={{ marginTop: 16 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{name}</h4>
          <div className="lab-trend">
            {results.length > 1 && (
              <MiniChart
                data={results.slice(0, 10).reverse().map((r: any) => r.value)}
                color={results[0].status === "critical" ? "var(--danger)" : results[0].status === "high" ? "var(--warning)" : "var(--success)"}
                width={280}
                height={50}
              />
            )}
          </div>
          {results.map((r: any) => (
            <div key={r.id} className="lab-row">
              <span className="lab-value">{r.value} {r.unit}</span>
              {r.reference_low != null && r.reference_high != null && (
                <span className="lab-ref">Ref: {r.reference_low}–{r.reference_high}</span>
              )}
              <span className={`tag ${r.status === "normal" ? "analyzed" : r.status === "critical" ? "pdf" : "pending"}`}>{r.status}</span>
              <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                {new Date(r.tested_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Appointments Tab ────────────────────────────────────────

function AppointmentsTab({ patientId, appointments, patientName, onRefresh, notify }: { patientId: string; appointments: any[]; patientName: string; onRefresh: () => void; notify: any }) {
  const [form, setForm] = useState({ doctor_name: "", scheduled_at: "", visit_type: "consultation", notes: "" });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.scheduled_at) return notify("Date/time required", "error");
    setSaving(true);
    try {
      await api.createAppointment({ patient_id: patientId, ...form });
      setForm({ doctor_name: "", scheduled_at: "", visit_type: "consultation", notes: "" });
      notify("Appointment scheduled!");
      onRefresh();
    } catch (e: any) { notify(e.message, "error"); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="appt-form neu">
        <h3>Schedule Appointment</h3>
        <div className="form-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label>Doctor</label>
            <input className="neu-input sm" value={form.doctor_name} onChange={e => setForm(p => ({ ...p, doctor_name: e.target.value }))} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Date & Time</label>
            <input className="neu-input sm" type="datetime-local" value={form.scheduled_at} onChange={e => setForm(p => ({ ...p, scheduled_at: e.target.value }))} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Type</label>
            <select className="neu-input sm" value={form.visit_type} onChange={e => setForm(p => ({ ...p, visit_type: e.target.value }))}>
              <option value="consultation">Consultation</option>
              <option value="follow-up">Follow-up</option>
              <option value="procedure">Procedure</option>
              <option value="lab-work">Lab Work</option>
            </select>
          </div>
        </div>
        <button className="neu-btn primary sm" onClick={save} disabled={saving} style={{ marginTop: 8 }}>Schedule</button>
      </div>

      {appointments.map(a => (
        <div key={a.id} className="appt-card neu" style={{ marginTop: 12 }}>
          <div className="appt-card-left">
            <div className="appt-date">
              <div className="appt-date-day">{new Date(a.scheduled_at).getDate()}</div>
              <div className="appt-date-month">{new Date(a.scheduled_at).toLocaleDateString("en-IN", { month: "short" })}</div>
            </div>
          </div>
          <div className="appt-card-body">
            <div className="appt-card-title">{a.visit_type} · {a.doctor_name || "Doctor"}</div>
            <div className="appt-card-time">
              {new Date(a.scheduled_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · {a.duration_min}min
            </div>
          </div>
          <span className={`tag ${a.status === "completed" ? "analyzed" : a.status === "cancelled" ? "pdf" : "pending"}`}>
            {a.status}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Quick Add Modal ─────────────────────────────────────────

// ── ICD-10 Diagnoses Tab ──────────────────────────────────────
function DiagnosesTab({ patientId, diagnoses, icdSearch, setIcdSearch, icdResults, setIcdResults, onRefresh, notify }: any) {
  const searchICD = async (q: string) => {
    setIcdSearch(q);
    if (q.length >= 2) {
      const results = await api.searchICD10(q).catch(() => []);
      setIcdResults(results);
    } else {
      setIcdResults([]);
    }
  };
  const addDiag = async (code: string, description: string) => {
    await api.addDiagnosis(patientId, { patient_id: patientId, code, description });
    notify("Diagnosis added");
    setIcdSearch("");
    setIcdResults([]);
    onRefresh();
  };
  const removeDiag = async (id: string) => {
    await api.deleteDiagnosis(id);
    onRefresh();
  };
  return (
    <div>
      <div className="neu" style={{ padding: 20, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Search ICD-10 Codes</h3>
        <input className="neu-input" placeholder="Search by code or description (e.g., diabetes, E11)..." value={icdSearch} onChange={e => searchICD(e.target.value)} />
        {icdResults.length > 0 && (
          <div style={{ marginTop: 8, maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
            {icdResults.map((r: any) => (
              <div key={r.code} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: "var(--bg-alt)", cursor: "pointer" }} onClick={() => addDiag(r.code, r.description)}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "var(--accent)" }}>{r.code}</span>
                  <span style={{ fontSize: 13, marginLeft: 8 }}>{r.description}</span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 8 }}>{r.category}</span>
                </div>
                <span style={{ fontSize: 11, color: "var(--accent)" }}>+ Add</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="chart-section">
        <h3>Active Diagnoses ({diagnoses.length})</h3>
        {diagnoses.length === 0 ? <div className="chart-empty">No diagnoses recorded</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {diagnoses.map((d: any) => (
              <div key={d.id} className="neu" style={{ padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "var(--accent)" }}>{d.code}</span>
                  <span style={{ fontSize: 13, marginLeft: 8 }}>{d.description}</span>
                  {d.notes && <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{d.notes}</p>}
                </div>
                <button className="med-tag-x" onClick={() => removeDiag(d.id)}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Referrals Tab ─────────────────────────────────────────────
function ReferralsTab({ patientId, referrals, onRefresh, notify }: any) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ to_specialty: "", to_doctor_name: "", reason: "", urgency: "routine", notes: "" });
  const handleSubmit = async () => {
    if (!form.to_specialty || !form.reason) return notify("Specialty and reason required", "error");
    await api.createReferral({ patient_id: patientId, ...form });
    notify("Referral created");
    setShowForm(false);
    setForm({ to_specialty: "", to_doctor_name: "", reason: "", urgency: "routine", notes: "" });
    onRefresh();
  };
  const urgencyColor = (u: string) => u === "urgent" ? "#ef4444" : u === "soon" ? "#f59e0b" : "#10b981";
  const statusColor = (s: string) => s === "completed" ? "#10b981" : s === "accepted" ? "#3b82f6" : "#f59e0b";
  return (
    <div>
      {!showForm && <button className="neu-btn primary" onClick={() => setShowForm(true)} style={{ marginBottom: 16 }}>+ New Referral</button>}
      {showForm && (
        <div className="neu" style={{ padding: 20, marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>New Referral</h3>
          <div className="form-row">
            <input className="neu-input" placeholder="Specialty (e.g., Cardiology)" value={form.to_specialty} onChange={e => setForm({ ...form, to_specialty: e.target.value })} />
            <input className="neu-input" placeholder="Doctor name (optional)" value={form.to_doctor_name} onChange={e => setForm({ ...form, to_doctor_name: e.target.value })} />
          </div>
          <textarea className="neu-input" placeholder="Reason for referral" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} style={{ resize: "vertical", minHeight: 60, marginBottom: 10 }} />
          <div className="form-row">
            <select className="neu-input" value={form.urgency} onChange={e => setForm({ ...form, urgency: e.target.value })}>
              <option value="routine">Routine</option>
              <option value="soon">Soon</option>
              <option value="urgent">Urgent</option>
            </select>
            <textarea className="neu-input" placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ resize: "vertical", minHeight: 40 }} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="neu-btn ghost" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="neu-btn primary" onClick={handleSubmit}>Create Referral</button>
          </div>
        </div>
      )}
      {referrals.length === 0 ? <div className="chart-empty">No referrals</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {referrals.map((r: any) => (
            <div key={r.id} className="neu" style={{ padding: 16, borderLeft: `4px solid ${urgencyColor(r.urgency)}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <strong style={{ fontSize: 14 }}>{r.to_specialty}</strong>
                {r.to_doctor_name && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>— Dr. {r.to_doctor_name}</span>}
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", padding: "2px 6px", borderRadius: 4, background: `${statusColor(r.status)}22`, color: statusColor(r.status) }}>{r.status}</span>
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", padding: "2px 6px", borderRadius: 4, background: `${urgencyColor(r.urgency)}22`, color: urgencyColor(r.urgency) }}>{r.urgency}</span>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{r.reason}</p>
              {r.notes && <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{r.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Billing Tab ───────────────────────────────────────────────
function BillingTab({ patientId, invoices, onRefresh, notify }: any) {
  const [showForm, setShowForm] = useState(false);
  const [items, setItems] = useState([{ description: "", amount: 0 }]);
  const [notes, setNotes] = useState("");
  const addItem = () => setItems([...items, { description: "", amount: 0 }]);
  const updateItem = (i: number, field: string, val: any) => setItems(items.map((it, j) => j === i ? { ...it, [field]: val } : it));
  const subtotal = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const tax = Math.round(subtotal * 0.18 * 100) / 100;
  const total = subtotal + tax;
  const handleSubmit = async () => {
    if (!items.some(it => it.description && it.amount)) return notify("Add at least one item", "error");
    await api.createInvoice({ patient_id: patientId, items: items.filter(it => it.description), subtotal, tax, total, notes });
    notify("Invoice created");
    setShowForm(false);
    setItems([{ description: "", amount: 0 }]);
    setNotes("");
    onRefresh();
  };
  const statusColor = (s: string) => s === "paid" ? "#10b981" : s === "sent" ? "#3b82f6" : "#f59e0b";
  return (
    <div>
      {!showForm && <button className="neu-btn primary" onClick={() => setShowForm(true)} style={{ marginBottom: 16 }}>+ New Invoice</button>}
      {showForm && (
        <div className="neu" style={{ padding: 20, marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>New Invoice</h3>
          {items.map((item, i) => (
            <div key={i} className="form-row">
              <input className="neu-input" placeholder="Description" value={item.description} onChange={e => updateItem(i, "description", e.target.value)} />
              <input className="neu-input" type="number" placeholder="Amount" value={item.amount || ""} onChange={e => updateItem(i, "amount", parseFloat(e.target.value) || 0)} style={{ maxWidth: 120 }} />
            </div>
          ))}
          <button className="neu-btn sm ghost" onClick={addItem} style={{ marginBottom: 10 }}>+ Add Line Item</button>
          <textarea className="neu-input" placeholder="Notes" value={notes} onChange={e => setNotes(e.target.value)} style={{ resize: "vertical", minHeight: 40, marginBottom: 10 }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--bg-alt)", fontSize: 13 }}>
            <div>Subtotal: <strong>{subtotal.toFixed(2)}</strong> · Tax (18%): <strong>{tax.toFixed(2)}</strong> · <strong style={{ fontSize: 15 }}>Total: {total.toFixed(2)}</strong></div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="neu-btn ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="neu-btn primary" onClick={handleSubmit}>Create Invoice</button>
            </div>
          </div>
        </div>
      )}
      {invoices.length === 0 ? <div className="chart-empty">No invoices</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {invoices.map((inv: any) => (
            <div key={inv.id} className="neu" style={{ padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Invoice #{inv.id.slice(0, 8)}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  {inv.items?.length || 0} items · {new Date(inv.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>${inv.total?.toFixed(2)}</div>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", padding: "2px 8px", borderRadius: 4, background: `${statusColor(inv.status)}22`, color: statusColor(inv.status) }}>{inv.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Insurance Tab ─────────────────────────────────────────────
function InsuranceTab({ patientId, insuranceList, onRefresh, notify }: any) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ provider_name: "", policy_number: "", group_number: "", subscriber_name: "", relationship: "self", effective_date: "", expiry_date: "" });
  const handleSubmit = async () => {
    if (!form.provider_name || !form.policy_number) return notify("Provider and policy number required", "error");
    await api.addInsurance(patientId, { patient_id: patientId, ...form });
    notify("Insurance added");
    setShowForm(false);
    setForm({ provider_name: "", policy_number: "", group_number: "", subscriber_name: "", relationship: "self", effective_date: "", expiry_date: "" });
    onRefresh();
  };
  const removeIns = async (id: string) => { await api.deleteInsurance(id); onRefresh(); };
  return (
    <div>
      {!showForm && <button className="neu-btn primary" onClick={() => setShowForm(true)} style={{ marginBottom: 16 }}>+ Add Insurance</button>}
      {showForm && (
        <div className="neu" style={{ padding: 20, marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Add Insurance</h3>
          <div className="form-row">
            <input className="neu-input" placeholder="Insurance provider" value={form.provider_name} onChange={e => setForm({ ...form, provider_name: e.target.value })} />
            <input className="neu-input" placeholder="Policy number" value={form.policy_number} onChange={e => setForm({ ...form, policy_number: e.target.value })} />
          </div>
          <div className="form-row">
            <input className="neu-input" placeholder="Group number" value={form.group_number} onChange={e => setForm({ ...form, group_number: e.target.value })} />
            <input className="neu-input" placeholder="Subscriber name" value={form.subscriber_name} onChange={e => setForm({ ...form, subscriber_name: e.target.value })} />
          </div>
          <div className="form-row">
            <select className="neu-input" value={form.relationship} onChange={e => setForm({ ...form, relationship: e.target.value })}>
              <option value="self">Self</option>
              <option value="spouse">Spouse</option>
              <option value="child">Child</option>
              <option value="other">Other</option>
            </select>
            <input className="neu-input" type="date" placeholder="Effective date" value={form.effective_date} onChange={e => setForm({ ...form, effective_date: e.target.value })} />
            <input className="neu-input" type="date" placeholder="Expiry date" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="neu-btn ghost" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="neu-btn primary" onClick={handleSubmit}>Save</button>
          </div>
        </div>
      )}
      {insuranceList.length === 0 ? <div className="chart-empty">No insurance on file</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {insuranceList.map((ins: any) => (
            <div key={ins.id} className="neu" style={{ padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{ins.provider_name}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  Policy: {ins.policy_number} {ins.group_number && `· Group: ${ins.group_number}`}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {ins.subscriber_name && `Subscriber: ${ins.subscriber_name} (${ins.relationship})`}
                  {ins.effective_date && ` · ${ins.effective_date}`}
                  {ins.expiry_date && ` → ${ins.expiry_date}`}
                </div>
              </div>
              <button className="med-tag-x" onClick={() => removeIns(ins.id)}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QuickAddModal({ type, patientId, onClose, onSave, notify }: { type: string; patientId: string; onClose: () => void; onSave: () => void; notify: any }) {
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      if (type === "allergy") await api.addAllergy(patientId, form);
      else if (type === "condition") await api.addCondition(patientId, form);
      else if (type === "medication") await api.addMedication(patientId, form);
      onSave();
    } catch (e: any) { notify(e.message, "error"); }
    finally { setSaving(false); }
  };

  const title = type === "allergy" ? "Add Allergy" : type === "condition" ? "Add Condition" : "Add Medication";

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card neu" onClick={e => e.stopPropagation()}>
        <h3>{title}</h3>
        {type === "allergy" && (
          <>
            <div className="form-group"><label>Allergen</label><input className="neu-input" placeholder="e.g. Penicillin" value={form.allergen || ""} onChange={e => setForm((p: any) => ({ ...p, allergen: e.target.value }))} /></div>
            <div className="form-group"><label>Severity</label>
              <select className="neu-input" value={form.severity || "mild"} onChange={e => setForm((p: any) => ({ ...p, severity: e.target.value }))}>
                <option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option>
              </select>
            </div>
            <div className="form-group"><label>Reaction</label><input className="neu-input" placeholder="e.g. Rash, Anaphylaxis" value={form.reaction || ""} onChange={e => setForm((p: any) => ({ ...p, reaction: e.target.value }))} /></div>
          </>
        )}
        {type === "condition" && (
          <>
            <div className="form-group"><label>Condition</label><input className="neu-input" placeholder="e.g. Type 2 Diabetes" value={form.name || ""} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} /></div>
            <div className="form-group"><label>Status</label>
              <select className="neu-input" value={form.status || "active"} onChange={e => setForm((p: any) => ({ ...p, status: e.target.value }))}>
                <option value="active">Active</option><option value="resolved">Resolved</option><option value="chronic">Chronic</option>
              </select>
            </div>
            <div className="form-group"><label>Notes</label><input className="neu-input" value={form.notes || ""} onChange={e => setForm((p: any) => ({ ...p, notes: e.target.value }))} /></div>
          </>
        )}
        {type === "medication" && (
          <>
            <div className="form-group"><label>Medication</label><input className="neu-input" placeholder="e.g. Metformin" value={form.name || ""} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} /></div>
            <div className="form-group"><label>Dosage</label><input className="neu-input" placeholder="e.g. 500mg" value={form.dosage || ""} onChange={e => setForm((p: any) => ({ ...p, dosage: e.target.value }))} /></div>
            <div className="form-group"><label>Frequency</label><input className="neu-input" placeholder="e.g. Twice daily" value={form.frequency || ""} onChange={e => setForm((p: any) => ({ ...p, frequency: e.target.value }))} /></div>
          </>
        )}
        <div className="form-actions">
          <button className="neu-btn ghost" onClick={onClose}>Cancel</button>
          <button className="neu-btn primary" onClick={save} disabled={saving}>
            {saving ? <span className="spinner white" /> : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
