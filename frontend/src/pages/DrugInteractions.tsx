import { useState, useEffect } from "react";
import * as api from "../api";

interface Props {
  onBack: () => void;
  notify: (msg: string, type?: "success" | "error") => void;
}

export function DrugInteractions({ onBack, notify }: Props) {
  const [interactions, setInteractions] = useState<any[]>([]);
  const [checkDrugs, setCheckDrugs] = useState("");
  const [checkResult, setCheckResult] = useState<any>(null);
  const [checking, setChecking] = useState(false);
  const [tab, setTab] = useState<"check" | "database">("check");

  useEffect(() => {
    api.listDrugInteractions().then(setInteractions).catch(() => {});
  }, []);

  const handleCheck = async () => {
    const drugs = checkDrugs.split(",").map(d => d.trim()).filter(Boolean);
    if (drugs.length < 2) return notify("Enter at least 2 drugs separated by commas", "error");
    setChecking(true);
    try {
      const result = await api.checkDrugInteractions(drugs);
      setCheckResult(result);
    } catch (e: any) {
      notify(e.message, "error");
    } finally {
      setChecking(false);
    }
  };

  const severityColor = (s: string) =>
    s === "contraindicated" ? "#ef4444" : s === "major" ? "#f59e0b" : "#3b82f6";
  const severityBg = (s: string) =>
    s === "contraindicated" ? "rgba(239,68,68,0.15)" : s === "major" ? "rgba(245,158,11,0.15)" : "rgba(59,130,246,0.15)";

  return (
    <div className="page-enter">
      <div className="breadcrumb">
        <button onClick={onBack}>Home</button>
        <span className="sep">/</span>
        <span>Drug Interactions</span>
      </div>

      <div className="section-header">
        <div>
          <h1>Drug Interaction Checker</h1>
          <div className="subtitle">Check for potential drug-drug interactions</div>
        </div>
      </div>

      <div className="chart-tabs" style={{ maxWidth: 400, marginBottom: 20 }}>
        <button className={`chart-tab${tab === "check" ? " active" : ""}`} onClick={() => setTab("check")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Check Interactions
        </button>
        <button className={`chart-tab${tab === "database" ? " active" : ""}`} onClick={() => setTab("database")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
          Database ({interactions.length})
        </button>
      </div>

      {tab === "check" && (
        <div>
          <div className="neu" style={{ padding: 24, marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Enter medications to check</h3>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
              Separate multiple drug names with commas (e.g., Warfarin, Aspirin, Ibuprofen)
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                className="neu-input"
                placeholder="Warfarin, Aspirin, Metformin..."
                value={checkDrugs}
                onChange={e => setCheckDrugs(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleCheck()}
                style={{ flex: 1 }}
              />
              <button className="neu-btn primary" onClick={handleCheck} disabled={checking}>
                {checking ? "Checking..." : "Check"}
              </button>
            </div>
          </div>

          {checkResult && (
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                {checkResult.interactions.length
                  ? `⚠ ${checkResult.interactions.length} interaction${checkResult.interactions.length > 1 ? "s" : ""} found`
                  : "✓ No known interactions found"}
              </h3>
              {checkResult.interactions.length === 0 && (
                <div className="chart-empty">
                  No interactions detected between: {checkResult.checked.join(", ")}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {checkResult.interactions.map((inter: any, i: number) => (
                  <div key={i} className="neu" style={{ padding: 16, borderLeft: `4px solid ${severityColor(inter.severity)}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <strong style={{ fontSize: 14 }}>{inter.drug_a} + {inter.drug_b}</strong>
                      <span style={{
                        fontSize: 10, fontWeight: 700, textTransform: "uppercase", padding: "2px 8px",
                        borderRadius: 4, background: severityBg(inter.severity), color: severityColor(inter.severity),
                      }}>
                        {inter.severity}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{inter.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "database" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {interactions.map(inter => (
            <div key={inter.id} className="neu" style={{ padding: 14, borderLeft: `4px solid ${severityColor(inter.severity)}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <strong style={{ fontSize: 13 }}>{inter.drug_a} + {inter.drug_b}</strong>
                <span style={{
                  fontSize: 9, fontWeight: 700, textTransform: "uppercase", padding: "2px 6px",
                  borderRadius: 4, background: severityBg(inter.severity), color: severityColor(inter.severity),
                }}>
                  {inter.severity}
                </span>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{inter.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
