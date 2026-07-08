import { useState } from "react";

interface Props {
  onBack: () => void;
  notify: (msg: string, type?: "success" | "error") => void;
}

type Phenotype = "poor" | "intermediate" | "normal" | "ultra-rapid";
type RiskLevel = "use" | "caution" | "avoid";
type Significance = "pathogenic" | "benign" | "VUS";
type Zygosity = "homozygous" | "heterozygous" | "wild-type";

interface GeneVariant {
  gene: string;
  alleles: string;
  phenotype: Phenotype;
  rsId: string;
  zygosity: Zygosity;
  significance: Significance;
  clinvar: string;
}

interface DrugRec {
  drug: string;
  category: string;
  risk: RiskLevel;
  gene: string;
  reasoning: string;
}

interface RiskFactor {
  condition: string;
  relativeRisk: number;
  confidence: "high" | "moderate" | "low";
  gene: string;
}

const GENE_VARIANTS: GeneVariant[] = [
  { gene: "CYP2D6", alleles: "*4/*4", phenotype: "poor", rsId: "rs3892097", zygosity: "homozygous", significance: "pathogenic", clinvar: "ClinVar: VCV000018390" },
  { gene: "CYP2C19", alleles: "*1/*17", phenotype: "ultra-rapid", rsId: "rs12248560", zygosity: "heterozygous", significance: "benign", clinvar: "ClinVar: VCV000016897" },
  { gene: "CYP3A4", alleles: "*1/*1", phenotype: "normal", rsId: "rs2740574", zygosity: "wild-type", significance: "benign", clinvar: "ClinVar: VCV000030168" },
  { gene: "BRCA1", alleles: "c.5266dupC", phenotype: "normal", rsId: "rs80357906", zygosity: "heterozygous", significance: "pathogenic", clinvar: "ClinVar: VCV000017661" },
  { gene: "BRCA2", alleles: "wild-type", phenotype: "normal", rsId: "rs11571833", zygosity: "wild-type", significance: "benign", clinvar: "ClinVar: VCV000009346" },
  { gene: "HLA-B", alleles: "*57:01+", phenotype: "intermediate", rsId: "rs2395029", zygosity: "heterozygous", significance: "VUS", clinvar: "ClinVar: VCV000033781" },
];

const DRUG_RECS: DrugRec[] = [
  { drug: "Codeine", category: "Analgesic", risk: "avoid", gene: "CYP2D6", reasoning: "Poor metabolizer: no conversion to morphine, ineffective" },
  { drug: "Tramadol", category: "Analgesic", risk: "avoid", gene: "CYP2D6", reasoning: "Poor metabolizer: reduced analgesic effect" },
  { drug: "Clopidogrel", category: "Antiplatelet", risk: "caution", gene: "CYP2C19", reasoning: "Ultra-rapid metabolizer: increased active metabolite, bleeding risk" },
  { drug: "Omeprazole", category: "PPI", risk: "caution", gene: "CYP2C19", reasoning: "Ultra-rapid metabolizer: reduced efficacy, consider higher dose" },
  { drug: "Abacavir", category: "Antiretroviral", risk: "avoid", gene: "HLA-B", reasoning: "HLA-B*57:01 positive: hypersensitivity reaction risk" },
  { drug: "Atorvastatin", category: "Statin", risk: "use", gene: "CYP3A4", reasoning: "Normal metabolizer: standard dosing appropriate" },
  { drug: "Simvastatin", category: "Statin", risk: "use", gene: "CYP3A4", reasoning: "Normal metabolizer: standard dosing appropriate" },
  { drug: "Tamoxifen", category: "Oncology", risk: "avoid", gene: "CYP2D6", reasoning: "Poor metabolizer: reduced conversion to endoxifen" },
];

const ANCESTRY = [
  { label: "South Asian", pct: 62 },
  { label: "European", pct: 18 },
  { label: "Central Asian", pct: 11 },
  { label: "East Asian", pct: 5 },
  { label: "Middle Eastern", pct: 3 },
  { label: "Unassigned", pct: 1 },
];

const RISK_FACTORS: RiskFactor[] = [
  { condition: "Breast Cancer", relativeRisk: 4.2, confidence: "high", gene: "BRCA1" },
  { condition: "Ovarian Cancer", relativeRisk: 2.8, confidence: "high", gene: "BRCA1" },
  { condition: "Drug Hypersensitivity", relativeRisk: 3.5, confidence: "moderate", gene: "HLA-B" },
  { condition: "Adverse Drug Reaction", relativeRisk: 2.1, confidence: "high", gene: "CYP2D6" },
  { condition: "Coronary Artery Disease", relativeRisk: 1.3, confidence: "low", gene: "CYP2C19" },
  { condition: "Type 2 Diabetes", relativeRisk: 1.1, confidence: "low", gene: "CYP3A4" },
];

const phenotypeColor = (p: Phenotype) =>
  p === "poor" ? "#ef4444" : p === "ultra-rapid" ? "#f59e0b" : p === "intermediate" ? "#3b82f6" : "#10b981";

const riskColor = (r: RiskLevel) =>
  r === "avoid" ? "#ef4444" : r === "caution" ? "#f59e0b" : "#10b981";

const riskBg = (r: RiskLevel) =>
  r === "avoid" ? "rgba(239,68,68,0.15)" : r === "caution" ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.15)";

const confidenceColor = (c: string) =>
  c === "high" ? "#10b981" : c === "moderate" ? "#f59e0b" : "#94a3b8";

const sigColor = (s: Significance) =>
  s === "pathogenic" ? "#ef4444" : s === "benign" ? "#10b981" : "#f59e0b";

const DnaIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M2 15c6.667-6 13.333 0 20-6" /><path d="M9 22c1.8-4 6.2-4 8 0" />
    <path d="M2 9c6.667 6 13.333 0 20 6" /><path d="M7 2c1.8 4 6.2 4 8 0" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const ChartIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
  </svg>
);

const TreeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="5" r="3" /><line x1="12" y1="8" x2="12" y2="14" />
    <line x1="6" y1="18" x2="12" y2="14" /><line x1="18" y1="18" x2="12" y2="14" />
    <circle cx="6" cy="20" r="2" /><circle cx="18" cy="20" r="2" />
  </svg>
);

const FlaskIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 3h6v5l4 9H5l4-9V3z" /><line x1="9" y1="3" x2="15" y2="3" />
  </svg>
);

type Tab = "profile" | "drugs" | "ancestry" | "risks" | "pedigree" | "order";

export function Genomics({ onBack, notify }: Props) {
  const [tab, setTab] = useState<Tab>("profile");
  const [selectedVariant, setSelectedVariant] = useState<GeneVariant | null>(null);
  const [orderTest, setOrderTest] = useState({ type: "panel", urgency: "routine", lab: "labcorp" });
  const [ordering, setOrdering] = useState(false);

  const handleOrder = () => {
    setOrdering(true);
    setTimeout(() => {
      setOrdering(false);
      notify("Genetic test order submitted successfully", "success");
    }, 1200);
  };

  const tabs: { key: Tab; label: string; icon: JSX.Element }[] = [
    { key: "profile", label: "Gene Profile", icon: <DnaIcon /> },
    { key: "drugs", label: "Drug Recs", icon: <ShieldIcon /> },
    { key: "ancestry", label: "Ancestry", icon: <ChartIcon /> },
    { key: "risks", label: "Risk Factors", icon: <ShieldIcon /> },
    { key: "pedigree", label: "Pedigree", icon: <TreeIcon /> },
    { key: "order", label: "Order Test", icon: <FlaskIcon /> },
  ];

  return (
    <div className="page-enter">
      <div className="breadcrumb">
        <button onClick={onBack}>Home</button>
        <span className="sep">/</span>
        <span>Genomics</span>
      </div>

      <div className="section-header">
        <div>
          <h1>Genomics &amp; Pharmacogenomics</h1>
          <div className="subtitle">Genetic profile, drug interactions, and ancestry analysis</div>
        </div>
      </div>

      <div className="chart-tabs" style={{ flexWrap: "wrap", marginBottom: 20 }}>
        {tabs.map(t => (
          <button key={t.key} className={`chart-tab${tab === t.key ? " active" : ""}`} onClick={() => setTab(t.key)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Gene Profile */}
      {tab === "profile" && (
        <div className="neu" style={{ padding: 24 }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>Patient Genetic Variants</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid rgba(100,100,100,0.15)" }}>
                  {["Gene", "Alleles", "Phenotype", "rsID", "Significance", ""].map(h => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {GENE_VARIANTS.map(v => (
                  <tr key={v.gene} style={{ borderBottom: "1px solid rgba(100,100,100,0.08)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 600 }}>{v.gene}</td>
                    <td style={{ padding: "10px 12px", fontFamily: "monospace" }}>{v.alleles}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{
                        padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600,
                        color: phenotypeColor(v.phenotype),
                        background: `${phenotypeColor(v.phenotype)}22`,
                      }}>
                        {v.phenotype}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 13 }}>{v.rsId}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{
                        padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600,
                        color: sigColor(v.significance),
                        background: `${sigColor(v.significance)}22`,
                      }}>
                        {v.significance}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <button className="neu-btn" style={{ fontSize: 12, padding: "4px 12px" }} onClick={() => setSelectedVariant(v)}>
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Drug Recommendations */}
      {tab === "drugs" && (
        <div className="neu" style={{ padding: 24 }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>Pharmacogenomic Drug Recommendations</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid rgba(100,100,100,0.15)" }}>
                  {["Drug", "Category", "Gene", "Recommendation", "Reasoning"].map(h => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DRUG_RECS.map(d => (
                  <tr key={d.drug} style={{ borderBottom: "1px solid rgba(100,100,100,0.08)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 600 }}>{d.drug}</td>
                    <td style={{ padding: "10px 12px" }}>{d.category}</td>
                    <td style={{ padding: "10px 12px", fontFamily: "monospace" }}>{d.gene}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{
                        padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 700,
                        color: riskColor(d.risk), background: riskBg(d.risk),
                        textTransform: "uppercase",
                      }}>
                        {d.risk}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#64748b", maxWidth: 300 }}>{d.reasoning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ancestry */}
      {tab === "ancestry" && (
        <div className="neu" style={{ padding: 24 }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>Ancestry Composition</h2>
          <div style={{ maxWidth: 600 }}>
            {ANCESTRY.map(a => (
              <div key={a.label} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 14, fontWeight: 500 }}>
                  <span>{a.label}</span>
                  <span style={{ fontWeight: 700 }}>{a.pct}%</span>
                </div>
                <div style={{ height: 20, borderRadius: 10, background: "rgba(100,100,100,0.1)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 10, width: `${a.pct}%`,
                    background: `linear-gradient(90deg, #6366f1, #8b5cf6)`,
                    transition: "width 0.6s ease",
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk Factors */}
      {tab === "risks" && (
        <div className="neu" style={{ padding: 24 }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>Genetic Risk Factors</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {RISK_FACTORS.map(r => (
              <div key={r.condition} className="neu" style={{ padding: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{r.condition}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: "#64748b" }}>Relative Risk</span>
                  <span style={{
                    fontWeight: 700, fontSize: 20,
                    color: r.relativeRisk >= 3 ? "#ef4444" : r.relativeRisk >= 2 ? "#f59e0b" : "#10b981",
                  }}>
                    {r.relativeRisk}x
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: "#64748b" }}>Confidence</span>
                  <span style={{
                    padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600,
                    color: confidenceColor(r.confidence),
                    background: `${confidenceColor(r.confidence)}22`,
                  }}>
                    {r.confidence}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>Associated gene: <span style={{ fontFamily: "monospace" }}>{r.gene}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pedigree */}
      {tab === "pedigree" && (
        <div className="neu" style={{ padding: 24 }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>Family History Pedigree</h2>
          <div style={{ overflowX: "auto" }}>
            <svg viewBox="0 0 460 280" width="460" height="280" xmlns="http://www.w3.org/2000/svg" style={{ display: "block", margin: "0 auto" }}>
              {/* Generation I */}
              <text x="230" y="16" textAnchor="middle" fontSize="11" fill="#94a3b8">Generation I</text>
              {/* Grandfather - unaffected (square) */}
              <rect x="160" y="24" width="28" height="28" rx="3" fill="none" stroke="#64748b" strokeWidth="2" />
              {/* Grandmother - affected (circle filled) */}
              <circle cx="290" cy="38" r="14" fill="#ef4444" stroke="#ef4444" strokeWidth="2" />
              {/* Marriage line */}
              <line x1="188" y1="38" x2="276" y2="38" stroke="#64748b" strokeWidth="1.5" />
              {/* Vertical to gen II */}
              <line x1="230" y1="38" x2="230" y2="80" stroke="#64748b" strokeWidth="1.5" />

              {/* Generation II */}
              <text x="230" y="78" textAnchor="middle" fontSize="11" fill="#94a3b8">Generation II</text>
              {/* Horizontal line connecting siblings */}
              <line x1="110" y1="110" x2="360" y2="110" stroke="#64748b" strokeWidth="1.5" />
              <line x1="230" y1="80" x2="230" y2="110" stroke="#64748b" strokeWidth="1.5" />
              {/* Father - unaffected */}
              <rect x="96" y="96" width="28" height="28" rx="3" fill="none" stroke="#64748b" strokeWidth="2" />
              <line x1="110" y1="110" x2="110" y2="96" stroke="none" />
              {/* Mother - carrier (half-filled circle) */}
              <circle cx="230" cy="110" r="14" fill="none" stroke="#64748b" strokeWidth="2" />
              <path d="M230 96 A14 14 0 0 1 230 124 Z" fill="#f59e0b" />
              {/* Uncle - affected */}
              <rect x="336" y="96" width="28" height="28" rx="3" fill="#ef4444" stroke="#ef4444" strokeWidth="2" />
              {/* Verticals to gen III */}
              <line x1="110" y1="124" x2="110" y2="150" stroke="#64748b" strokeWidth="1.5" />
              <line x1="230" y1="124" x2="230" y2="150" stroke="#64748b" strokeWidth="1.5" />
              {/* Marriage line gen II */}
              <line x1="124" y1="110" x2="216" y2="110" stroke="#64748b" strokeWidth="1.5" strokeDasharray="4 3" />

              {/* Generation III */}
              <text x="230" y="158" textAnchor="middle" fontSize="11" fill="#94a3b8">Generation III</text>
              <line x1="80" y1="190" x2="380" y2="190" stroke="#64748b" strokeWidth="1.5" />
              <line x1="170" y1="150" x2="170" y2="190" stroke="#64748b" strokeWidth="1.5" />
              {/* Proband - affected (arrow) */}
              <rect x="66" y="176" width="28" height="28" rx="3" fill="#ef4444" stroke="#ef4444" strokeWidth="2" />
              <line x1="80" y1="190" x2="80" y2="176" stroke="none" />
              <text x="80" y="220" textAnchor="middle" fontSize="10" fill="#ef4444" fontWeight="700">Proband</text>
              <line x1="65" y1="222" x2="80" y2="210" stroke="#ef4444" strokeWidth="1.5" />
              {/* Sister - carrier */}
              <circle cx="170" cy="190" r="14" fill="none" stroke="#64748b" strokeWidth="2" />
              <path d="M170 176 A14 14 0 0 1 170 204 Z" fill="#f59e0b" />
              {/* Brother - unaffected */}
              <rect x="256" y="176" width="28" height="28" rx="3" fill="none" stroke="#64748b" strokeWidth="2" />
              <line x1="270" y1="190" x2="270" y2="176" stroke="none" />
              {/* Sister 2 - unaffected */}
              <circle cx="370" cy="190" r="14" fill="none" stroke="#64748b" strokeWidth="2" />

              {/* Legend */}
              <rect x="20" y="244" width="14" height="14" rx="2" fill="#ef4444" stroke="#ef4444" strokeWidth="1.5" />
              <text x="40" y="256" fontSize="11" fill="#64748b">Affected</text>
              <rect x="110" y="244" width="14" height="14" rx="2" fill="none" stroke="#64748b" strokeWidth="1.5" />
              <text x="130" y="256" fontSize="11" fill="#64748b">Unaffected</text>
              <circle cx="217" cy="251" r="7" fill="none" stroke="#64748b" strokeWidth="1.5" />
              <path d="M217 244 A7 7 0 0 1 217 258 Z" fill="#f59e0b" />
              <text x="230" y="256" fontSize="11" fill="#64748b">Carrier</text>
              <rect x="300" y="247" width="10" height="10" rx="1" fill="none" stroke="#64748b" strokeWidth="1.5" />
              <text x="316" y="256" fontSize="11" fill="#64748b">Male</text>
              <circle cx="377" cy="252" r="5" fill="none" stroke="#64748b" strokeWidth="1.5" />
              <text x="388" y="256" fontSize="11" fill="#64748b">Female</text>
            </svg>
          </div>
        </div>
      )}

      {/* Order Test */}
      {tab === "order" && (
        <div className="neu" style={{ padding: 24, maxWidth: 500 }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>Order Genetic Test</h2>

          <label style={{ display: "block", marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>Test Type</span>
            <select
              className="neu-input"
              value={orderTest.type}
              onChange={e => setOrderTest({ ...orderTest, type: e.target.value })}
              style={{ width: "100%" }}
            >
              <option value="panel">Gene Panel (targeted)</option>
              <option value="exome">Whole Exome Sequencing</option>
              <option value="genome">Whole Genome Sequencing</option>
            </select>
          </label>

          <label style={{ display: "block", marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>Urgency</span>
            <select
              className="neu-input"
              value={orderTest.urgency}
              onChange={e => setOrderTest({ ...orderTest, urgency: e.target.value })}
              style={{ width: "100%" }}
            >
              <option value="routine">Routine (4-6 weeks)</option>
              <option value="priority">Priority (2-3 weeks)</option>
              <option value="stat">STAT (5-7 days)</option>
            </select>
          </label>

          <label style={{ display: "block", marginBottom: 20 }}>
            <span style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>Laboratory</span>
            <select
              className="neu-input"
              value={orderTest.lab}
              onChange={e => setOrderTest({ ...orderTest, lab: e.target.value })}
              style={{ width: "100%" }}
            >
              <option value="labcorp">LabCorp Genetics</option>
              <option value="quest">Quest Diagnostics</option>
              <option value="invitae">Invitae</option>
              <option value="myriad">Myriad Genetics</option>
            </select>
          </label>

          <button className="neu-btn" onClick={handleOrder} disabled={ordering} style={{ width: "100%", padding: "10px 0", fontWeight: 700 }}>
            {ordering ? "Submitting..." : "Submit Test Order"}
          </button>
        </div>
      )}

      {/* Variant Details Modal */}
      {selectedVariant && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex",
            alignItems: "center", justifyContent: "center", zIndex: 1000,
          }}
          onClick={() => setSelectedVariant(null)}
        >
          <div
            className="neu"
            style={{ padding: 28, maxWidth: 420, width: "90%", position: "relative" }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedVariant(null)}
              style={{
                position: "absolute", top: 12, right: 12, background: "none", border: "none",
                fontSize: 20, cursor: "pointer", color: "#64748b", lineHeight: 1,
              }}
            >
              x
            </button>
            <h2 style={{ margin: "0 0 16px", fontSize: 20 }}>
              <DnaIcon /> {selectedVariant.gene} Variant Details
            </h2>

            {([
              ["Gene", selectedVariant.gene],
              ["rsID", selectedVariant.rsId],
              ["Alleles", selectedVariant.alleles],
              ["Zygosity", selectedVariant.zygosity],
              ["Phenotype", selectedVariant.phenotype],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(100,100,100,0.08)", fontSize: 14 }}>
                <span style={{ color: "#64748b" }}>{label}</span>
                <span style={{ fontWeight: 600, fontFamily: label === "rsID" || label === "Alleles" ? "monospace" : "inherit" }}>{value}</span>
              </div>
            ))}

            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(100,100,100,0.08)", fontSize: 14 }}>
              <span style={{ color: "#64748b" }}>Clinical Significance</span>
              <span style={{
                padding: "2px 10px", borderRadius: 10, fontSize: 12, fontWeight: 700,
                color: sigColor(selectedVariant.significance),
                background: `${sigColor(selectedVariant.significance)}22`,
              }}>
                {selectedVariant.significance}
              </span>
            </div>

            <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, background: "rgba(99,102,241,0.08)", fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>ClinVar Reference:</span>{" "}
              <span style={{ color: "#6366f1" }}>{selectedVariant.clinvar}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
