import { useState, useEffect } from "react";
import * as api from "../api";
import { MiniChart } from "../components/MiniChart";

interface Props {
  onBack: () => void;
  onNavigate: (v: string, data?: any) => void;
}

export function AdvancedAnalytics({ onBack, onNavigate }: Props) {
  const [data, setData] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [tab, setTab] = useState<"overview" | "trends" | "population" | "quality">("overview");

  useEffect(() => {
    Promise.all([
      api.getAnalytics(),
      api.listPatients(),
      api.listDrugInteractions(),
    ]).then(([a, p, di]) => { setData(a); setPatients(p); setInteractions(di); });
  }, []);

  if (!data) return <div className="page-enter">{[1,2,3].map(i => <div key={i} className="skeleton skeleton-card" />)}</div>;

  const genderDist = patients.reduce((acc: any, p: any) => {
    const g = p.gender || "Unknown";
    acc[g] = (acc[g] || 0) + 1;
    return acc;
  }, {});

  const ageDist = patients.reduce((acc: any, p: any) => {
    if (!p.date_of_birth) { acc["Unknown"] = (acc["Unknown"] || 0) + 1; return acc; }
    const age = Math.floor((Date.now() - new Date(p.date_of_birth).getTime()) / 31557600000);
    const bucket = age < 18 ? "0-17" : age < 30 ? "18-29" : age < 45 ? "30-44" : age < 60 ? "45-59" : "60+";
    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {});

  const bloodDist = patients.reduce((acc: any, p: any) => {
    const bg = p.blood_group || "Unknown";
    acc[bg] = (acc[bg] || 0) + 1;
    return acc;
  }, {});

  const severityDist = interactions.reduce((acc: any, i: any) => {
    acc[i.severity] = (acc[i.severity] || 0) + 1;
    return acc;
  }, {});

  const COLORS = ["#4f6ef7", "#a78bfa", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#84cc16"];

  const BarChart = ({ data, title }: { data: Record<string, number>; title: string }) => {
    const entries = Object.entries(data);
    const max = Math.max(...entries.map(([, v]) => v), 1);
    return (
      <div className="neu" style={{ padding: 20 }}>
        <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>{title}</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {entries.map(([label, value], i) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11, width: 60, textAlign: "right", color: "var(--text-muted)", flexShrink: 0 }}>{label}</span>
              <div style={{ flex: 1, height: 20, borderRadius: 6, background: "var(--bg-alt)", overflow: "hidden" }}>
                <div style={{ width: `${(value / max) * 100}%`, height: "100%", borderRadius: 6, background: COLORS[i % COLORS.length], transition: "width 0.5s ease" }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, width: 30, flexShrink: 0 }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const KPI = ({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) => (
    <div className="neu" style={{ padding: 18, textAlign: "center" }}>
      <div style={{ fontSize: 28, fontWeight: 800, color, letterSpacing: -1 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div className="page-enter">
      <div className="breadcrumb">
        <button onClick={onBack}>Home</button>
        <span className="sep">/</span>
        <span>Advanced Analytics</span>
      </div>
      <div className="section-header">
        <div>
          <h1>Advanced Analytics</h1>
          <div className="subtitle">Practice insights, population health, and quality metrics</div>
        </div>
      </div>

      <div className="chart-tabs" style={{ maxWidth: 600, marginBottom: 20 }}>
        {(["overview", "trends", "population", "quality"] as const).map(t => (
          <button key={t} className={`chart-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
            {t === "overview" ? "Overview" : t === "trends" ? "Trends" : t === "population" ? "Population" : "Quality"}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div>
          <div className="dash-grid" style={{ marginBottom: 20 }}>
            <KPI label="Total Patients" value={data.patients} color="#4f6ef7" />
            <KPI label="Reports" value={data.reports} sub={`${data.analyzed} analyzed`} color="#10b981" />
            <KPI label="Appointments" value={data.appointments_today} sub="today" color="#f59e0b" />
            <KPI label="Prescriptions" value={data.prescriptions} color="#a78bfa" />
          </div>
          <div className="dash-grid" style={{ marginBottom: 20 }}>
            <KPI label="Vitals Recorded" value={data.vitals_recorded} color="#06b6d4" />
            <KPI label="Lab Results" value={data.lab_results} color="#ec4899" />
            <KPI label="Analysis Rate" value={data.reports > 0 ? `${Math.round((data.analyzed / data.reports) * 100)}%` : "N/A"} color="#10b981" />
            <KPI label="Upcoming" value={data.appointments_upcoming} sub="appointments" color="#f59e0b" />
          </div>
          <div className="dash-panels">
            <BarChart data={genderDist} title="Gender Distribution" />
            <BarChart data={bloodDist} title="Blood Group Distribution" />
          </div>
        </div>
      )}

      {tab === "trends" && (
        <div>
          <div className="neu" style={{ padding: 24, marginBottom: 16 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Patient Registration Trend</h4>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>New patients over time</p>
            {patients.length > 0 ? (
              <MiniChart
                data={(() => {
                  const last30 = Array.from({ length: 30 }, (_, i) => {
                    const d = new Date();
                    d.setDate(d.getDate() - (29 - i));
                    const key = d.toISOString().slice(0, 10);
                    return patients.filter(p => p.created_at?.startsWith(key)).length;
                  });
                  return last30;
                })()}
                width={600}
                height={120}
                color="#4f6ef7"
                fill
              />
            ) : <div className="chart-empty">No data yet</div>}
          </div>
          <div className="dash-panels">
            <div className="neu" style={{ padding: 20 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Reports by Analysis Status</h4>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 32, fontWeight: 800, color: "#10b981" }}>{data.analyzed}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Analyzed</div>
                </div>
                <div style={{ width: 1, height: 40, background: "var(--bg-alt)" }} />
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 32, fontWeight: 800, color: "#f59e0b" }}>{data.pending_reports}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Pending</div>
                </div>
              </div>
            </div>
            <BarChart data={severityDist} title="Drug Interactions by Severity" />
          </div>
        </div>
      )}

      {tab === "population" && (
        <div>
          <div className="dash-panels" style={{ marginBottom: 16 }}>
            <BarChart data={ageDist} title="Age Distribution" />
            <BarChart data={genderDist} title="Gender Distribution" />
          </div>
          <div className="dash-panels">
            <BarChart data={bloodDist} title="Blood Group Distribution" />
            <div className="neu" style={{ padding: 20 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Patient List</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {patients.slice(0, 10).map(p => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", cursor: "pointer", fontSize: 13 }} onClick={() => onNavigate("patient-detail", { id: p.id })}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: `hsl(${[...(p.name || p.phone)].reduce((a: number, c: string) => a + c.charCodeAt(0), 0) % 360}, 65%, 55%)`, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 10, fontWeight: 700 }}>
                      {(p.name || p.phone).slice(0, 2).toUpperCase()}
                    </div>
                    <span style={{ fontWeight: 600 }}>{p.name || p.phone}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>{p.gender || "—"} · {p.blood_group || "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "quality" && (
        <div>
          <div className="dash-grid" style={{ marginBottom: 20 }}>
            <KPI label="Analysis Completion" value={data.reports > 0 ? `${Math.round((data.analyzed / data.reports) * 100)}%` : "—"} color={data.analyzed / (data.reports || 1) > 0.8 ? "#10b981" : "#f59e0b"} />
            <KPI label="Patients with Vitals" value={data.vitals_recorded > 0 ? "Active" : "None"} color={data.vitals_recorded > 0 ? "#10b981" : "#ef4444"} />
            <KPI label="Drug Interactions DB" value={interactions.length} sub="entries" color="#4f6ef7" />
            <KPI label="Pending Reports" value={data.pending_reports} color={data.pending_reports > 5 ? "#ef4444" : "#10b981"} />
          </div>
          <div className="neu" style={{ padding: 24 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Quality Checklist</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "All reports analyzed", met: data.pending_reports === 0 },
                { label: "Drug interaction database populated", met: interactions.length >= 10 },
                { label: "Patient vitals being recorded", met: data.vitals_recorded > 0 },
                { label: "Appointments scheduled", met: data.appointments_upcoming > 0 },
                { label: "Lab results on file", met: data.lab_results > 0 },
                { label: "Prescriptions documented", met: data.prescriptions > 0 },
                { label: "At least 5 patients registered", met: data.patients >= 5 },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: item.met ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)", color: item.met ? "#10b981" : "#ef4444", fontWeight: 700, fontSize: 12 }}>
                    {item.met ? "✓" : "✕"}
                  </div>
                  <span style={{ color: item.met ? "var(--text)" : "var(--text-muted)" }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
