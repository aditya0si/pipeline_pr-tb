import { useState, useEffect } from "react";
import * as api from "../api";
import { HeartIcon, UserIcon, FileTextIcon, CalendarIcon, ClipboardIcon, ChartIcon, PulseIcon } from "../components/MedIcons";

interface Props {
  onBack: () => void;
  onNavigate: (view: string, data?: any) => void;
  notify: (msg: string, type?: "success" | "error") => void;
}

export function Dashboard({ onBack, onNavigate, notify }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAnalytics()
      .then(setData)
      .catch(e => notify(e.message, "error"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="page-enter">
      <div className="breadcrumb">
        <button onClick={onBack}>Home</button>
        <span className="sep">/</span>
        <span>Dashboard</span>
      </div>
      {[1, 2, 3, 4].map(i => <div key={i} className="skeleton skeleton-card" />)}
    </div>
  );

  if (!data) return null;

  return (
    <div className="page-enter">
      <div className="breadcrumb">
        <button onClick={onBack}>Home</button>
        <span className="sep">/</span>
        <span>Dashboard</span>
      </div>

      <div className="section-header">
        <div>
          <h1>Analytics Dashboard</h1>
          <div className="subtitle">Overview of your medical practice</div>
        </div>
      </div>

      {/* Main Stats */}
      <div className="dash-grid">
        <div className="dash-card neu" onClick={() => onNavigate("doctor")}>
          <div className="dash-card-icon" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            <UserIcon size={22} />
          </div>
          <div className="dash-card-value">{data.patients}</div>
          <div className="dash-card-label">Patients</div>
        </div>
        <div className="dash-card neu">
          <div className="dash-card-icon" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
            <FileTextIcon size={22} />
          </div>
          <div className="dash-card-value">{data.reports}</div>
          <div className="dash-card-label">Reports</div>
        </div>
        <div className="dash-card neu">
          <div className="dash-card-icon" style={{ background: "var(--warning-soft)", color: "var(--warning)" }}>
            <PulseIcon size={22} />
          </div>
          <div className="dash-card-value">{data.analyzed}</div>
          <div className="dash-card-label">Analyzed</div>
        </div>
        <div className="dash-card neu">
          <div className="dash-card-icon" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
            <HeartIcon size={22} />
          </div>
          <div className="dash-card-value">{data.pending_reports}</div>
          <div className="dash-card-label">Pending</div>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="dash-grid cols-3">
        <div className="dash-card neu" onClick={() => onNavigate("appointments")}>
          <div className="dash-card-icon" style={{ background: "#ede9fe", color: "#7c3aed" }}>
            <CalendarIcon size={22} />
          </div>
          <div className="dash-card-value">{data.appointments_today}</div>
          <div className="dash-card-label">Today's Appts</div>
          <div className="dash-card-sub">{data.appointments_upcoming} upcoming</div>
        </div>
        <div className="dash-card neu">
          <div className="dash-card-icon" style={{ background: "#fce7f3", color: "#db2777" }}>
            <ClipboardIcon size={22} />
          </div>
          <div className="dash-card-value">{data.prescriptions}</div>
          <div className="dash-card-label">Prescriptions</div>
        </div>
        <div className="dash-card neu">
          <div className="dash-card-icon" style={{ background: "#d1fae5", color: "#059669" }}>
            <ChartIcon size={22} />
          </div>
          <div className="dash-card-value">{data.vitals_recorded}</div>
          <div className="dash-card-label">Vitals Recorded</div>
          <div className="dash-card-sub">{data.lab_results} lab results</div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="dash-panels">
        <div className="dash-panel neu">
          <h3>Recent Patients</h3>
          {data.recent_patients.length === 0 ? (
            <div className="dash-panel-empty">No patients yet</div>
          ) : (
            <div className="dash-panel-list">
              {data.recent_patients.map((p: any) => (
                <div key={p.id} className="dash-panel-item" onClick={() => onNavigate("patient-detail", p)}>
                  <div className="dash-panel-item-dot" style={{ background: "var(--accent)" }} />
                  <div className="dash-panel-item-text">
                    <strong>{p.name || p.phone}</strong>
                    <span>{new Date(p.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dash-panel neu">
          <h3>Recent Appointments</h3>
          {data.recent_appointments.length === 0 ? (
            <div className="dash-panel-empty">No appointments yet</div>
          ) : (
            <div className="dash-panel-list">
              {data.recent_appointments.map((a: any) => (
                <div key={a.id} className="dash-panel-item">
                  <div className="dash-panel-item-dot" style={{
                    background: a.status === "completed" ? "var(--success)" : a.status === "cancelled" ? "var(--danger)" : "var(--warning)"
                  }} />
                  <div className="dash-panel-item-text">
                    <strong>{a.patient_name}</strong>
                    <span>{a.visit_type} · {new Date(a.scheduled_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <span className={`tag ${a.status === "completed" ? "analyzed" : a.status === "cancelled" ? "pdf" : "pending"}`}>
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
