import { useState, useEffect, useMemo } from "react";
import * as api from "../api";

interface Props {
  onBack: () => void;
  notify: (msg: string, type?: "success" | "error") => void;
  onOpenChart?: (patientId: string) => void;
}

export function DoctorPortal({ onBack, notify, onOpenChart }: Props) {
  const [patients, setPatients] = useState<any[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [previewReport, setPreviewReport] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // provider state
  const [providers, setProviders] = useState<api.Provider[]>([]);
  const [selectedOCR, setSelectedOCR] = useState("");
  const [selectedAI, setSelectedAI] = useState("");
  const [fallbackKey, setFallbackKey] = useState(() => localStorage.getItem("medvault_api_key") || "");

  useEffect(() => {
    api.listPatients()
      .then(setPatients)
      .catch(() => {})
      .finally(() => setLoadingPatients(false));
    api.listProviders().then(p => {
      setProviders(p);
      const defaultOCR = p.find(x => x.kind === "ocr" && x.is_default);
      const defaultAI = p.find(x => x.kind === "ai" && x.is_default);
      if (defaultOCR) setSelectedOCR(defaultOCR.id);
      if (defaultAI) setSelectedAI(defaultAI.id);
    }).catch(() => {});
  }, []);

  const saveFallbackKey = (key: string) => {
    setFallbackKey(key);
    localStorage.setItem("medvault_api_key", key);
  };

  const selectPatient = async (p: any) => {
    setSelectedPatient(p);
    setExpandedReport(null);
    setPreviewReport(null);
    setLoadingReports(true);
    try {
      setReports(await api.patientReportList(p.id));
    } catch (e: any) {
      notify(e.message, "error");
    } finally {
      setLoadingReports(false);
    }
  };

  const handleAnalyze = async (reportId: string) => {
    const hasAI = providers.some(p => p.kind === "ai");
    if (!hasAI && !fallbackKey) return notify("Configure an AI provider in Settings, or enter an API key below", "error");
    setAnalyzing(reportId);
    try {
      const result = await api.analyzeReport(reportId, {
        ocrProviderId: selectedOCR,
        aiProviderId: selectedAI,
        apiKey: fallbackKey,
      });
      setReports(prev =>
        prev.map(r => r.id === reportId ? { ...r, analysis: result.analysis, ocr_text: result.ocr_text, analyzed: 1 } : r)
      );
      setExpandedReport(reportId);
      notify("Analysis complete!");
    } catch (e: any) {
      notify(e.message, "error");
    } finally {
      setAnalyzing(null);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return patients;
    const q = search.toLowerCase();
    return patients.filter(p =>
      (p.name || "").toLowerCase().includes(q) ||
      p.phone.includes(q)
    );
  }, [patients, search]);

  const totalReports = patients.reduce((s, p) => s + p.report_count, 0);
  const COLORS = ["#4f6ef7", "#a78bfa", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];
  const avatarColor = (name: string) => COLORS[Math.abs([...name].reduce((a, c) => a + c.charCodeAt(0), 0)) % COLORS.length];
  const initials = (name: string) => name ? name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "?";

  const ocrProviders = providers.filter(p => p.kind === "ocr");
  const aiProviders = providers.filter(p => p.kind === "ai");

  // ── Patient detail view ──────────────────────────────
  if (selectedPatient) {
    const analyzed = reports.filter(r => r.analyzed).length;
    return (
      <div className="page-enter">
        <div className="breadcrumb">
          <button onClick={onBack}>Home</button>
          <span className="sep">/</span>
          <button onClick={() => setSelectedPatient(null)}>Patients</button>
          <span className="sep">/</span>
          <span>{selectedPatient.name || selectedPatient.phone}</span>
        </div>

        <div className="section-header">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div className="patient-avatar" style={{ background: avatarColor(selectedPatient.name || selectedPatient.phone), width: 48, height: 48, fontSize: 18 }}>
              {initials(selectedPatient.name || selectedPatient.phone)}
            </div>
            <div>
              <h1>{selectedPatient.name || "Unnamed Patient"}</h1>
              <div className="subtitle">📞 {selectedPatient.phone}</div>
            </div>
            {onOpenChart && (
              <button className="neu-btn sm primary" onClick={() => onOpenChart(selectedPatient.id)} style={{ marginLeft: "auto" }}>
                Full Patient Chart →
              </button>
            )}
          </div>
        </div>

        {reports.length > 0 && (
          <div className="stat-row">
            <div className="stat-card neu">
              <div className="stat-icon blue">📄</div>
              <div className="stat-value">{reports.length}</div>
              <div className="stat-label">Reports</div>
            </div>
            <div className="stat-card neu">
              <div className="stat-icon green">✓</div>
              <div className="stat-value">{analyzed}</div>
              <div className="stat-label">Analyzed</div>
            </div>
            <div className="stat-card neu">
              <div className="stat-icon orange">⏳</div>
              <div className="stat-value">{reports.length - analyzed}</div>
              <div className="stat-label">Pending</div>
            </div>
          </div>
        )}

        {/* Pipeline config bar */}
        <div className="pipeline-bar neu">
          <div className="pipeline-bar-label">Pipeline</div>
          <div className="pipeline-selectors">
            <div className="pipeline-select">
              <label>OCR</label>
              <select className="neu-input sm" value={selectedOCR} onChange={e => setSelectedOCR(e.target.value)}>
                <option value="">Built-in (PyMuPDF)</option>
                {ocrProviders.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="pipeline-arrow">→</div>
            <div className="pipeline-select">
              <label>AI Model</label>
              <select className="neu-input sm" value={selectedAI} onChange={e => setSelectedAI(e.target.value)}>
                <option value="">None (use key below)</option>
                {aiProviders.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          {!aiProviders.length && (
            <div className="pipeline-fallback">
              <span className="lock-icon">🔑</span>
              <input
                className="neu-input"
                placeholder="Gemini API Key (fallback)"
                type="password"
                value={fallbackKey}
                onChange={e => saveFallbackKey(e.target.value)}
              />
            </div>
          )}
        </div>

        {loadingReports ? (
          <div>
            {[1, 2, 3].map(i => <div key={i} className="skeleton skeleton-card" />)}
          </div>
        ) : reports.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h4>No reports</h4>
            <p>This patient hasn't shared any reports yet.</p>
          </div>
        ) : (
          <div className="report-list">
            {reports.map(r => (
              <div key={r.id}>
                <div className="report-card neu">
                  <div className="file-thumb">
                    {r.filetype === "pdf" ? "📕" : "🖼️"}
                  </div>
                  <div className="report-body">
                    <div className="report-title">{r.filename}</div>
                    <div className="report-date">
                      Shared {new Date(r.shared_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      {" at "}
                      {new Date(r.shared_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div className="report-actions">
                      <a href={api.fileUrl(r.id)} target="_blank" rel="noopener">
                        <button className="neu-btn sm">Open File</button>
                      </a>
                      <button
                        className="neu-btn sm"
                        onClick={() => setPreviewReport(previewReport === r.id ? null : r.id)}
                      >
                        {previewReport === r.id ? "Hide Preview" : "Preview"}
                      </button>
                      <button
                        className="neu-btn sm primary"
                        disabled={analyzing === r.id}
                        onClick={() => handleAnalyze(r.id)}
                      >
                        {analyzing === r.id ? <><span className="spinner white" /> Analyzing...</> : r.analyzed ? "Re-Analyze" : "Analyze"}
                      </button>
                      {!!r.analyzed && (
                        <button
                          className="neu-btn sm ghost"
                          onClick={() => setExpandedReport(expandedReport === r.id ? null : r.id)}
                        >
                          {expandedReport === r.id ? "Hide Analysis" : "View Analysis"}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="report-right">
                    <span className={`tag ${r.filetype}`}>{r.filetype}</span>
                    {r.analyzed ? <span className="tag analyzed">Analyzed</span> : <span className="tag pending">Pending</span>}
                  </div>
                </div>

                {previewReport === r.id && (
                  <div className="file-preview">
                    {r.filetype === "image" ? (
                      <img src={api.fileUrl(r.id)} alt={r.filename} />
                    ) : (
                      <iframe src={api.fileUrl(r.id)} title={r.filename} />
                    )}
                  </div>
                )}

                {expandedReport === r.id && r.analysis && (
                  <div className="analysis-panel neu-inset">
                    <div className="analysis-content">
                      <AnalysisRenderer text={r.analysis} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Patient list view ────────────────────────────────
  return (
    <div className="page-enter">
      <div className="breadcrumb">
        <button onClick={onBack}>Home</button>
        <span className="sep">/</span>
        <span>Doctor Dashboard</span>
      </div>

      <div className="section-header">
        <div>
          <h1>Doctor Dashboard</h1>
          <div className="subtitle">All registered patients and their reports</div>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-card neu">
          <div className="stat-icon blue">👥</div>
          <div className="stat-value">{patients.length}</div>
          <div className="stat-label">Patients</div>
        </div>
        <div className="stat-card neu">
          <div className="stat-icon green">📄</div>
          <div className="stat-value">{totalReports}</div>
          <div className="stat-label">Total Reports</div>
        </div>
      </div>

      <div className="search-bar">
        <span className="search-icon">🔍</span>
        <input
          className="neu-input"
          placeholder="Search patients by name or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ paddingLeft: 42 }}
        />
      </div>

      {loadingPatients ? (
        <div>
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton skeleton-card" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <h4>{search ? "No matches" : "No patients yet"}</h4>
          <p>{search ? "Try a different search term." : "Patients will appear here once they register."}</p>
        </div>
      ) : (
        <div className="patient-grid">
          {filtered.map(p => (
            <div key={p.id} className="patient-row neu" onClick={() => selectPatient(p)}>
              <div className="patient-avatar" style={{ background: avatarColor(p.name || p.phone) }}>
                {initials(p.name || p.phone)}
              </div>
              <div className="patient-info">
                <h4>{p.name || "Unnamed Patient"}</h4>
                <p>📞 {p.phone} · Joined {new Date(p.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
              </div>
              <div className="patient-meta">
                <span className="report-badge">{p.report_count} report{p.report_count !== 1 ? "s" : ""}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AnalysisRenderer({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: JSX.Element[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      elements.push(<h2 key={i}>{line.slice(3)}</h2>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: string[] = [line.slice(2)];
      while (i + 1 < lines.length && (lines[i + 1].startsWith("- ") || lines[i + 1].startsWith("* "))) {
        i++;
        items.push(lines[i].slice(2));
      }
      elements.push(
        <ul key={i}>
          {items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
        </ul>
      );
    } else if (line.trim()) {
      elements.push(<p key={i}>{renderInline(line)}</p>);
    }
  }

  return <>{elements}</>;
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return <strong key={i}>{p.slice(2, -2)}</strong>;
    }
    return <span key={i}>{p}</span>;
  });
}
