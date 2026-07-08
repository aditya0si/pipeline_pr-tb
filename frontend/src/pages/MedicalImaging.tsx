import { useState, useRef, useCallback } from "react";

interface Props {
  onBack: () => void;
  notify: (msg: string, type?: "success" | "error") => void;
}

interface Study {
  id: string;
  title: string;
  date: string;
  modality: string;
  bodyPart: string;
  status: "reported" | "pending";
}

interface Annotation {
  id: string;
  type: "label" | "arrow" | "circle";
  x: number;
  y: number;
  text?: string;
  x2?: number;
  y2?: number;
  r?: number;
}

type WindowPreset = "default" | "bone" | "lung" | "soft_tissue" | "brain";
type AnnotationTool = "none" | "label" | "arrow" | "circle";

const STUDIES: Study[] = [
  { id: "s1", title: "Chest X-Ray", date: "2026-07-05", modality: "CR", bodyPart: "Chest", status: "reported" },
  { id: "s2", title: "Brain MRI", date: "2026-07-03", modality: "MR", bodyPart: "Brain", status: "pending" },
  { id: "s3", title: "Knee MRI", date: "2026-06-28", modality: "MR", bodyPart: "Knee", status: "reported" },
  { id: "s4", title: "Abdominal CT", date: "2026-06-20", modality: "CT", bodyPart: "Abdomen", status: "pending" },
  { id: "s5", title: "Spine X-Ray", date: "2026-06-15", modality: "CR", bodyPart: "Spine", status: "reported" },
];

const WINDOW_PRESETS: Record<WindowPreset, { brightness: number; contrast: number; label: string }> = {
  default: { brightness: 100, contrast: 100, label: "Default" },
  bone: { brightness: 80, contrast: 160, label: "Bone" },
  lung: { brightness: 130, contrast: 140, label: "Lung" },
  soft_tissue: { brightness: 100, contrast: 120, label: "Soft Tissue" },
  brain: { brightness: 110, contrast: 130, label: "Brain" },
};

function anatomyPath(bodyPart: string): JSX.Element {
  switch (bodyPart) {
    case "Chest":
      return (
        <g>
          <ellipse cx="200" cy="180" rx="120" ry="150" fill="none" stroke="currentColor" strokeWidth="2" />
          <line x1="200" y1="40" x2="200" y2="330" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
          <ellipse cx="155" cy="160" rx="45" ry="60" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <ellipse cx="245" cy="160" rx="45" ry="60" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <path d="M160 90 Q200 50 240 90" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <ellipse cx="200" cy="200" rx="20" ry="25" fill="currentColor" opacity="0.15" />
          <line x1="140" y1="100" x2="120" y2="70" stroke="currentColor" strokeWidth="1" />
          <line x1="260" y1="100" x2="280" y2="70" stroke="currentColor" strokeWidth="1" />
          {[1, 2, 3, 4, 5, 6].map(i => (
            <g key={i}>
              <path d={`M${160 - i * 2} ${90 + i * 22} Q200 ${100 + i * 22} ${240 + i * 2} ${90 + i * 22}`} fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.6" />
            </g>
          ))}
        </g>
      );
    case "Brain":
      return (
        <g>
          <ellipse cx="200" cy="180" rx="110" ry="130" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M200 50 Q160 120 200 180 Q240 120 200 50" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.6" />
          <path d="M110 140 Q150 180 200 180 Q250 180 290 140" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5" />
          <path d="M130 200 Q165 230 200 220 Q235 230 270 200" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5" />
          <ellipse cx="200" cy="260" rx="40" ry="25" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <line x1="200" y1="285" x2="200" y2="320" stroke="currentColor" strokeWidth="2" />
        </g>
      );
    case "Knee":
      return (
        <g>
          <rect x="170" y="40" width="60" height="140" rx="20" fill="none" stroke="currentColor" strokeWidth="2" />
          <ellipse cx="200" cy="200" rx="50" ry="30" fill="none" stroke="currentColor" strokeWidth="2" />
          <rect x="170" y="220" width="60" height="140" rx="20" fill="none" stroke="currentColor" strokeWidth="2" />
          <ellipse cx="200" cy="200" rx="25" ry="18" fill="currentColor" opacity="0.1" />
          <line x1="175" y1="200" x2="225" y2="200" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
        </g>
      );
    case "Abdomen":
      return (
        <g>
          <ellipse cx="200" cy="190" rx="110" ry="140" fill="none" stroke="currentColor" strokeWidth="2" />
          <line x1="200" y1="60" x2="200" y2="330" stroke="currentColor" strokeWidth="1" opacity="0.3" />
          <ellipse cx="160" cy="150" rx="30" ry="20" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.6" />
          <ellipse cx="240" cy="150" rx="25" ry="18" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.6" />
          <path d="M150 200 Q170 230 200 220 Q230 230 250 200" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5" />
          <ellipse cx="200" cy="260" rx="50" ry="30" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4" />
        </g>
      );
    default: // Spine
      return (
        <g>
          <line x1="200" y1="40" x2="200" y2="350" stroke="currentColor" strokeWidth="3" />
          {Array.from({ length: 12 }, (_, i) => (
            <g key={i}>
              <rect x="185" y={55 + i * 24} width="30" height="18" rx="4" fill="none" stroke="currentColor" strokeWidth="1.2" />
              <line x1="170" y1={64 + i * 24} x2="185" y2={64 + i * 24} stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
              <line x1="215" y1={64 + i * 24} x2="230" y2={64 + i * 24} stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
            </g>
          ))}
        </g>
      );
  }
}

const ZoomInIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><line x1="16" y1="16" x2="22" y2="22" /><line x1="8" y1="11" x2="14" y2="11" /><line x1="11" y1="8" x2="11" y2="14" /></svg>
);
const ZoomOutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><line x1="16" y1="16" x2="22" y2="22" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
);
const RotateIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
);
const FlipIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="2" x2="12" y2="22" strokeDasharray="2 2" /><polygon points="5 8 1 12 5 16" /><polygon points="19 8 23 12 19 16" /></svg>
);
const RulerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 18L18 2l4 4L6 22z" /><line x1="8" y1="12" x2="10" y2="14" /><line x1="12" y1="8" x2="14" y2="10" /></svg>
);
const SplitIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="18" rx="2" /><line x1="12" y1="3" x2="12" y2="21" /></svg>
);
const LabelIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7V4h16v3" /><line x1="12" y1="4" x2="12" y2="20" /><line x1="8" y1="20" x2="16" y2="20" /></svg>
);
const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="19" x2="19" y2="5" /><polyline points="12 5 19 5 19 12" /></svg>
);
const CircleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /></svg>
);

export function MedicalImaging({ onBack, notify }: Props) {
  const [selectedStudy, setSelectedStudy] = useState<Study>(STUDIES[0]);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [windowPreset, setWindowPreset] = useState<WindowPreset>("default");
  const [comparisonMode, setComparisonMode] = useState(false);
  const [comparisonStudy, setComparisonStudy] = useState<Study>(STUDIES[1]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [activeTool, setActiveTool] = useState<AnnotationTool>("none");
  const [findings, setFindings] = useState("");
  const [measuring, setMeasuring] = useState(false);
  const [measureStart, setMeasureStart] = useState<{ x: number; y: number } | null>(null);
  const [measureEnd, setMeasureEnd] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const annotIdRef = useRef(0);

  const applyPreset = useCallback((preset: WindowPreset) => {
    setWindowPreset(preset);
    setBrightness(WINDOW_PRESETS[preset].brightness);
    setContrast(WINDOW_PRESETS[preset].contrast);
  }, []);

  const getSvgCoords = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 400,
      y: ((e.clientY - rect.top) / rect.height) * 400,
    };
  }, []);

  const handleSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const coords = getSvgCoords(e);

    if (measuring) {
      if (!measureStart) {
        setMeasureStart(coords);
      } else {
        setMeasureEnd(coords);
        setMeasuring(false);
        const dx = coords.x - measureStart.x;
        const dy = coords.y - measureStart.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        notify(`Measurement: ${(dist * 0.25).toFixed(1)} mm`, "success");
      }
      return;
    }

    if (activeTool === "none") return;

    const id = `a${++annotIdRef.current}`;
    if (activeTool === "label") {
      const text = prompt("Enter label text:");
      if (!text) return;
      setAnnotations(prev => [...prev, { id, type: "label", x: coords.x, y: coords.y, text }]);
    } else if (activeTool === "circle") {
      setAnnotations(prev => [...prev, { id, type: "circle", x: coords.x, y: coords.y, r: 30 }]);
    } else if (activeTool === "arrow") {
      setAnnotations(prev => [...prev, {
        id, type: "arrow", x: coords.x, y: coords.y,
        x2: coords.x + 50, y2: coords.y - 40,
      }]);
    }
    notify(`${activeTool} annotation added`, "success");
  }, [activeTool, measuring, measureStart, getSvgCoords, notify]);

  const clearAnnotations = () => {
    setAnnotations([]);
    setMeasureStart(null);
    setMeasureEnd(null);
    notify("Annotations cleared", "success");
  };

  const renderViewer = (study: Study) => (
    <svg
      ref={svgRef}
      viewBox="0 0 400 400"
      style={{
        width: "100%",
        maxHeight: comparisonMode ? "50vh" : "65vh",
        transform: `scale(${zoom}) rotate(${rotation}deg) scaleX(${flipped ? -1 : 1})`,
        filter: `brightness(${brightness}%) contrast(${contrast}%)`,
        transition: "transform 0.2s, filter 0.2s",
        cursor: activeTool !== "none" || measuring ? "crosshair" : "default",
        color: "var(--text)",
      }}
      onClick={handleSvgClick}
    >
      <rect width="400" height="400" fill="var(--bg-alt)" rx="4" />
      {anatomyPath(study.bodyPart)}
      <text x="10" y="20" fontSize="11" fill="var(--text-muted)" fontFamily="monospace">
        {study.modality} | {study.bodyPart}
      </text>
      <text x="10" y="390" fontSize="10" fill="var(--text-muted)" fontFamily="monospace">
        {study.date} | W:{WINDOW_PRESETS[windowPreset].label}
      </text>

      {annotations.map(a => {
        if (a.type === "label") return (
          <g key={a.id}>
            <rect x={a.x - 2} y={a.y - 12} width={(a.text?.length ?? 3) * 7 + 8} height="16" rx="3" fill="var(--accent)" opacity="0.85" />
            <text x={a.x + 2} y={a.y} fontSize="11" fill="#fff" fontFamily="sans-serif">{a.text}</text>
          </g>
        );
        if (a.type === "circle") return (
          <circle key={a.id} cx={a.x} cy={a.y} r={a.r} fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="4 2" />
        );
        if (a.type === "arrow") return (
          <g key={a.id}>
            <defs><marker id={`ah-${a.id}`} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="var(--accent)" /></marker></defs>
            <line x1={a.x} y1={a.y} x2={a.x2} y2={a.y2} stroke="var(--accent)" strokeWidth="2" markerEnd={`url(#ah-${a.id})`} />
          </g>
        );
        return null;
      })}

      {measureStart && measureEnd && (
        <g>
          <line x1={measureStart.x} y1={measureStart.y} x2={measureEnd.x} y2={measureEnd.y} stroke="var(--warning, #f59e0b)" strokeWidth="2" strokeDasharray="6 3" />
          <circle cx={measureStart.x} cy={measureStart.y} r="3" fill="var(--warning, #f59e0b)" />
          <circle cx={measureEnd.x} cy={measureEnd.y} r="3" fill="var(--warning, #f59e0b)" />
        </g>
      )}
      {measureStart && !measureEnd && (
        <circle cx={measureStart.x} cy={measureStart.y} r="4" fill="var(--warning, #f59e0b)" />
      )}
    </svg>
  );

  return (
    <div className="page-enter">
      <div className="breadcrumb">
        <button onClick={onBack}>Home</button>
        <span className="sep">/</span>
        <span>Medical Imaging</span>
      </div>

      <div className="section-header">
        <div>
          <h1>DICOM Viewer</h1>
          <div className="subtitle">Medical imaging studies and annotations</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr 280px", gap: 16 }}>
        {/* Study List Sidebar */}
        <div className="neu" style={{ padding: 16, borderRadius: 16, overflow: "auto", maxHeight: "75vh" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "var(--text-secondary)" }}>Studies</div>
          {STUDIES.map(s => (
            <div
              key={s.id}
              className={s.id === selectedStudy.id ? "neu-inset" : "neu-flat"}
              onClick={() => { setSelectedStudy(s); setAnnotations([]); setMeasureStart(null); setMeasureEnd(null); }}
              style={{
                padding: 12, borderRadius: 10, marginBottom: 8, cursor: "pointer",
                border: s.id === selectedStudy.id ? "1px solid var(--accent)" : "1px solid transparent",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{s.title}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                {s.date} &middot; {s.modality}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.bodyPart}</span>
                <span style={{
                  fontSize: 10, padding: "2px 8px", borderRadius: 8,
                  background: s.status === "reported" ? "var(--success-soft, #e6f9ed)" : "var(--warning-soft, #fff8e6)",
                  color: s.status === "reported" ? "var(--success, #22c55e)" : "var(--warning, #f59e0b)",
                  fontWeight: 600,
                }}>
                  {s.status === "reported" ? "Reported" : "Pending"}
                </span>
              </div>
            </div>
          ))}

          {comparisonMode && (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, marginTop: 16, marginBottom: 8, color: "var(--text-secondary)" }}>Compare With</div>
              {STUDIES.filter(s => s.id !== selectedStudy.id).map(s => (
                <div
                  key={s.id}
                  className={s.id === comparisonStudy.id ? "neu-inset" : "neu-flat"}
                  onClick={() => setComparisonStudy(s)}
                  style={{
                    padding: 10, borderRadius: 8, marginBottom: 6, cursor: "pointer", fontSize: 12,
                    border: s.id === comparisonStudy.id ? "1px solid var(--accent)" : "1px solid transparent",
                  }}
                >
                  {s.title} &middot; {s.modality}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Main Viewer */}
        <div>
          {/* Toolbar */}
          <div className="neu" style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: 10, borderRadius: 12, marginBottom: 12, alignItems: "center" }}>
            <button className="neu-btn sm" onClick={() => setZoom(z => Math.min(z + 0.2, 3))} title="Zoom In"><ZoomInIcon /></button>
            <button className="neu-btn sm" onClick={() => setZoom(z => Math.max(z - 0.2, 0.4))} title="Zoom Out"><ZoomOutIcon /></button>
            <button className="neu-btn sm" onClick={() => setZoom(1)} title="Reset Zoom" style={{ fontSize: 11 }}>1:1</button>
            <span style={{ width: 1, height: 20, background: "var(--text-muted)", opacity: 0.3 }} />
            <button className="neu-btn sm" onClick={() => setRotation(r => r + 90)} title="Rotate"><RotateIcon /></button>
            <button className="neu-btn sm" onClick={() => setFlipped(f => !f)} title="Flip"><FlipIcon /></button>
            <span style={{ width: 1, height: 20, background: "var(--text-muted)", opacity: 0.3 }} />
            <button className={`neu-btn sm${measuring ? " primary" : ""}`} onClick={() => { setMeasuring(!measuring); setMeasureStart(null); setMeasureEnd(null); setActiveTool("none"); }} title="Measure"><RulerIcon /></button>
            <button className={`neu-btn sm${comparisonMode ? " primary" : ""}`} onClick={() => setComparisonMode(c => !c)} title="Compare"><SplitIcon /></button>
            <span style={{ width: 1, height: 20, background: "var(--text-muted)", opacity: 0.3 }} />
            <button className={`neu-btn sm${activeTool === "label" ? " primary" : ""}`} onClick={() => { setActiveTool(activeTool === "label" ? "none" : "label"); setMeasuring(false); }} title="Text Label"><LabelIcon /></button>
            <button className={`neu-btn sm${activeTool === "arrow" ? " primary" : ""}`} onClick={() => { setActiveTool(activeTool === "arrow" ? "none" : "arrow"); setMeasuring(false); }} title="Arrow"><ArrowIcon /></button>
            <button className={`neu-btn sm${activeTool === "circle" ? " primary" : ""}`} onClick={() => { setActiveTool(activeTool === "circle" ? "none" : "circle"); setMeasuring(false); }} title="Circle"><CircleIcon /></button>
            {annotations.length > 0 && (
              <button className="neu-btn sm danger" onClick={clearAnnotations} style={{ marginLeft: "auto" }}>Clear All</button>
            )}
          </div>

          {/* Image Display */}
          <div className="neu-inset" style={{ borderRadius: 16, padding: 8, display: "flex", gap: 8, justifyContent: "center", overflow: "hidden" }}>
            <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center" }}>
              {renderViewer(selectedStudy)}
            </div>
            {comparisonMode && (
              <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center" }}>
                {renderViewer(comparisonStudy)}
              </div>
            )}
          </div>

          {/* Status bar */}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 4px", fontSize: 11, color: "var(--text-muted)" }}>
            <span>Zoom: {Math.round(zoom * 100)}% | Rotation: {rotation}deg{flipped ? " | Flipped" : ""}</span>
            <span>{activeTool !== "none" ? `Tool: ${activeTool}` : measuring ? "Measuring: click two points" : "Ready"}</span>
          </div>
        </div>

        {/* Right Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Window/Level Presets */}
          <div className="neu" style={{ padding: 14, borderRadius: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: "var(--text-secondary)" }}>Window Presets</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(Object.keys(WINDOW_PRESETS) as WindowPreset[]).map(key => (
                <button
                  key={key}
                  className={`neu-btn sm${windowPreset === key ? " primary" : ""}`}
                  onClick={() => applyPreset(key)}
                  style={{ fontSize: 11 }}
                >
                  {WINDOW_PRESETS[key].label}
                </button>
              ))}
            </div>
          </div>

          {/* Brightness/Contrast */}
          <div className="neu" style={{ padding: 14, borderRadius: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: "var(--text-secondary)" }}>Adjustments</div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
              Brightness: {brightness}%
            </label>
            <input
              type="range" min="20" max="200" value={brightness}
              onChange={e => { setBrightness(Number(e.target.value)); setWindowPreset("default"); }}
              style={{ width: "100%", accentColor: "var(--accent)" }}
            />
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4, marginTop: 8 }}>
              Contrast: {contrast}%
            </label>
            <input
              type="range" min="20" max="200" value={contrast}
              onChange={e => { setContrast(Number(e.target.value)); setWindowPreset("default"); }}
              style={{ width: "100%", accentColor: "var(--accent)" }}
            />
          </div>

          {/* Findings */}
          <div className="neu" style={{ padding: 14, borderRadius: 14, flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: "var(--text-secondary)" }}>Findings</div>
            <textarea
              className="neu-inset"
              placeholder="Document observations and findings here..."
              value={findings}
              onChange={e => setFindings(e.target.value)}
              style={{
                width: "100%", minHeight: 140, resize: "vertical", border: "none",
                borderRadius: 10, padding: 10, fontSize: 12, fontFamily: "inherit",
                color: "var(--text)", background: "transparent",
              }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button
                className="neu-btn sm primary"
                style={{ flex: 1 }}
                onClick={() => {
                  if (!findings.trim()) { notify("No findings to save", "error"); return; }
                  notify("Findings saved successfully", "success");
                }}
              >
                Save
              </button>
              <button className="neu-btn sm" style={{ flex: 1 }} onClick={() => setFindings("")}>Clear</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
