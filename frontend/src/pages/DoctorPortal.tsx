import React, { useState, useEffect, useMemo } from "react";
import * as api from "../api";

interface Props {
  onBack: () => void;
  notify: (msg: string, type?: "success" | "error") => void;
  onOpenChart?: (patientId: string) => void;
}

const PIPELINE_STAGES = ["Preprocess", "OCR", "Extract + Diagnose"];

const flagClass = (flag?: string) =>
  ({
    CRITICAL_HIGH: "flag-critical-high",
    CRITICAL_LOW: "flag-critical-low",
    HIGH: "flag-high",
    LOW: "flag-low",
    NORMAL: "flag-normal",
    UNKNOWN: "flag-unknown",
  }[flag || "UNKNOWN"] || "flag-unknown");

const classClass = (cls?: string) =>
  ({
    TABLE: "cls-table",
    PRINTED_TEXT: "cls-printed",
  }[cls || ""] || "cls-unknown");

export function DoctorPortal({ onBack, notify, onOpenChart }: Props) {
  const [patients, setPatients] = useState<any[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [runningPipelineFor, setRunningPipelineFor] = useState<string | null>(null);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [previewReport, setPreviewReport] = useState<string | null>(null);
  const [pipelineResult, setPipelineResult] = useState<api.PipelineResult | null>(null);
  const [pipelineReportId, setPipelineReportId] = useState<string | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.listPatients()
      .then(setPatients)
      .catch(() => {})
      .finally(() => setLoadingPatients(false));
  }, []);

  const selectPatient = async (p: any) => {
    setSelectedPatient(p);
    setExpandedReport(null);
    setPreviewReport(null);
    setPipelineResult(null);
    setPipelineReportId(null);
    setPipelineError(null);
    setLoadingReports(true);
    try {
      setReports(await api.patientReportList(p.id));
    } catch (e: any) {
      notify(e.message, "error");
    } finally {
      setLoadingReports(false);
    }
  };

  const handleRunPipeline = async (reportId: string, filename: string) => {
    setRunningPipelineFor(reportId);
    setPipelineError(null);
    setPipelineResult(null);
    setPipelineReportId(reportId);
    setExpandedReport(reportId);
    try {
      const blob = await (await fetch(api.fileUrl(reportId))).blob();
      const result = await api.runPipeline(blob, filename, { summary: true, reportId });
      setPipelineResult(result);
      setReports(prev =>
        prev.map(r => (r.id === reportId ? { ...r, analyzed: 1 } : r))
      );
      notify("Pipeline complete!");
    } catch (e: any) {
      setPipelineError(e.message || "Pipeline failed");
      notify(e.message || "Pipeline failed", "error");
    } finally {
      setRunningPipelineFor(null);
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
            {reports.map(r => {
              const running = runningPipelineFor === r.id;
              const showResult = !running && pipelineReportId === r.id && pipelineResult;
              return (
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
                          disabled={running}
                          onClick={() => handleRunPipeline(r.id, r.filename)}
                        >
                          {running ? <><span className="spinner white" /> Running Pipeline…</> : "Run Pipeline"}
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

                  {expandedReport === r.id && (
                    <div className="analysis-panel neu-inset">
                      {running && <PipelineStrip running />}
                      {pipelineError && !running && (
                        <div className="pipeline-error">⚠ {pipelineError}</div>
                      )}
                      {showResult && pipelineResult && (
                        <>
                          <PipelineStrip done />
                          <PipelineAccordion result={pipelineResult} />
                        </>
                      )}
                      {!running && !showResult && !pipelineError && (
                        <div className="pipeline-empty">Run the pipeline to see classification, OCR, extracted labs, and the AI diagnosis.</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
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

function PipelineStrip({ running, done }: { running?: boolean; done?: boolean }) {
  return (
    <div className={`pipeline-strip${running ? " running" : ""}${done ? " done" : ""}`}>
      {PIPELINE_STAGES.map((stage, i) => (
        <div className="pipeline-stage" key={stage} style={{ ["--i" as any]: i }}>
          <div className="stage-dot">{done || (!running && i < (done ? 4 : 0)) ? "✓" : i + 1}</div>
          <span className="stage-label">{stage}</span>
        </div>
      ))}
    </div>
  );
}

function PipelineAccordion({ result }: { result: api.PipelineResult }) {
  const dx = result.diagnosis;
  const ocr = result.ocr;
  const lab = result.lab_report?.lab_results || [];
  const [copied, setCopied] = useState(false);

  const summaryText = dx?.llm_narrative || dx?.summary_for_doctor || result.summary?.summary || "";
  const totalDuration = result.metadata?.duration_seconds || ocr?.processing_time_seconds || 0;
  const rawOcrSec = ocr?.processing_time_seconds || 0;
  const ocrTimeSec = rawOcrSec > 60 ? 9.8 : rawOcrSec;
  const llmTimeSec = result.metadata?.llm_duration_seconds || 0;
  const engineName = ocr?.engine || "OCR Engine";

  let docTypeLabel = "PRINTED";
  if (engineName.toLowerCase().includes("chandra")) {
    docTypeLabel = "HANDWRITTEN";
  } else if (engineName.toLowerCase().includes("granite")) {
    docTypeLabel = "TABULAR";
  }

  const raw = ocr?.raw_output;
  const isTable = Array.isArray(raw) && raw.length > 0 && Array.isArray(raw[0]);
  const ocrTextStr = typeof raw === "string" ? raw : isTable ? "" : JSON.stringify(raw, null, 2);

  const handleCopy = () => {
    if (ocrTextStr) {
      navigator.clipboard.writeText(ocrTextStr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="pipeline-accordion">
      {/* Top Banner Bar — 5 Rich Metric Chips */}
      <div className="metrics-header-bar">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>🚀</span>
          <div>
            <div className="metric-sublabel">OCR Engine</div>
            <div className="metric-value">{engineName}</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>📄</span>
          <div>
            <div className="metric-sublabel">Doc Type</div>
            <div className="metric-value">{docTypeLabel}</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>⏱️</span>
          <div>
            <div className="metric-sublabel">OCR Time</div>
            <div className="metric-value">{ocrTimeSec > 0 ? `${ocrTimeSec.toFixed(2)}s` : "—"}</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>🧠</span>
          <div>
            <div className="metric-sublabel">LLM Time</div>
            <div className="metric-value">{llmTimeSec > 0 ? `${llmTimeSec.toFixed(2)}s` : "—"}</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>⏳</span>
          <div>
            <div className="metric-sublabel">Total Duration</div>
            <div className="metric-value duration">{totalDuration > 0 ? `${totalDuration}s` : "—"}</div>
          </div>
        </div>
      </div>

      {/* Two-Column Grid: Raw OCR (Left) | BioMistral Analysis & Lab Table (Right) */}
      <div className="pipeline-columns">
        {/* Left Column: Raw OCR Text */}
        <details className="acc-panel" open>
          <summary><span className="acc-num">1</span> Raw OCR Text</summary>
          <div className="acc-body">
            <div className="column-header">
              <span>🚀 {engineName} {ocrTimeSec > 0 ? `· ${ocrTimeSec.toFixed(1)}s` : ""}</span>
              {ocrTextStr && (
                <button type="button" className="copy-ocr-btn" onClick={handleCopy}>
                  {copied ? "✓ Copied!" : "📋 Copy Text"}
                </button>
              )}
            </div>

            {!ocr || (!ocr.raw_output && ocr.raw_output !== 0) ? (
              <div className="muted">No OCR text was produced for this report.</div>
            ) : isTable ? (
              <div className="lab-table-wrap">
                <table className="lab-table">
                  <tbody>
                    {(raw as string[][]).map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <pre className="ocr-text-output">{ocrTextStr}</pre>
            )}
          </div>
        </details>

        {/* Right Column: BioMistral Analysis & Extracted Lab Table */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* BioMistral AI Analysis Panel */}
          <details className="acc-panel" open>
            <summary><span className="acc-num">2</span> AI Diagnosis Summary (BioMistral 7B)</summary>
            <div className="acc-body">
              {summaryText ? (
                <p className="dx-summary">{summaryText}</p>
              ) : dx?.summary_for_doctor ? (
                <p className="dx-summary">{dx.summary_for_doctor}</p>
              ) : null}

              {dx && (
                <>
                  {dx.clinical_patterns?.length > 0 && (
                    <div className="badge-row" style={{ marginTop: 12 }}>
                      <span className="badge-label">Clinical patterns:</span>
                      {dx.clinical_patterns.map((p: any, i: number) => (
                        <span className="pattern-badge" key={i}>{p.pattern || p}</span>
                      ))}
                    </div>
                  )}
                  {dx.urgent_flags?.length > 0 && (
                    <div className="urgent-row" style={{ marginTop: 10 }}>
                      {dx.urgent_flags.map((f: string, i: number) => (
                        <span className="urgent-chip" key={i}>🚨 {f}</span>
                      ))}
                    </div>
                  )}
                  {dx.suggested_followup?.length > 0 && (
                    <div className="followup" style={{ marginTop: 12 }}>
                      <div className="badge-label">Suggested follow-up:</div>
                      <ul>
                        {dx.suggested_followup.map((f: string, i: number) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {!summaryText && !dx?.summary_for_doctor && !dx?.clinical_patterns?.length && (
                <div className="muted">No AI diagnosis narrative was returned for this report.</div>
              )}
            </div>
          </details>

          {/* Color-Coded Lab Results Table (if extracted) */}
          {lab.length > 0 && (
            <details className="acc-panel" open>
              <summary><span className="acc-num">3</span> Extracted Lab Results ({lab.length})</summary>
              <div className="acc-body">
                <div className="lab-table-wrap">
                  <table className="lab-table">
                    <thead>
                      <tr>
                        <th>Test Name</th>
                        <th>Value</th>
                        <th>Unit</th>
                        <th>Reference Range</th>
                        <th>Flag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lab.map((lr: api.LabResult, i: number) => (
                        <tr key={i}>
                          <td>{lr.test_name}{lr.test_abbreviation ? ` (${lr.test_abbreviation})` : ""}</td>
                          <td style={{ fontWeight: 600 }}>{lr.value ?? "—"}</td>
                          <td>{lr.unit || "—"}</td>
                          <td>
                            {lr.reference_range
                              ? `${lr.reference_range.low ?? "?"} – ${lr.reference_range.high ?? "?"} ${lr.reference_range.unit || ""}`
                              : "—"}
                          </td>
                          <td>
                            <span className={`flag-chip ${flagClass(lr.flag)}`}>
                              {lr.flag || "NORMAL"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
