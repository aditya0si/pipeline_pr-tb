import { useState, useEffect, useCallback, useRef } from "react";

/* ── types ── */
type Severity = "normal" | "warning" | "critical";
type AlertSeverity = "warning" | "critical";
type DeviceStatus = "online" | "offline" | "low-battery";
type NursePriority = "routine" | "urgent" | "stat";

interface Vitals {
  hr: number;
  spo2: number;
  bpSys: number;
  bpDia: number;
  temp: number;
  rr: number;
}

interface Patient {
  id: string;
  name: string;
  room: string;
  vitals: Vitals;
  history: { ts: number; vitals: Vitals }[];
}

interface Alert {
  id: string;
  patientId: string;
  patientName: string;
  vital: string;
  value: number;
  threshold: string;
  severity: AlertSeverity;
  time: Date;
}

interface Device {
  id: string;
  serial: string;
  type: string;
  status: DeviceStatus;
  battery: number;
  lastSync: Date;
  patientId: string;
}

interface ThresholdCfg {
  min: number;
  max: number;
  enabled: boolean;
}

type Thresholds = Record<keyof Vitals, ThresholdCfg>;

/* ── helpers ── */
const VITAL_LABELS: Record<keyof Vitals, string> = {
  hr: "Heart Rate",
  spo2: "SpO₂",
  bpSys: "BP Systolic",
  bpDia: "BP Diastolic",
  temp: "Temp",
  rr: "Resp Rate",
};

const VITAL_UNITS: Record<keyof Vitals, string> = {
  hr: "bpm",
  spo2: "%",
  bpSys: "mmHg",
  bpDia: "mmHg",
  temp: "°F",
  rr: "/min",
};

const DEFAULT_THRESHOLDS: Thresholds = {
  hr: { min: 60, max: 100, enabled: true },
  spo2: { min: 92, max: 100, enabled: true },
  bpSys: { min: 90, max: 140, enabled: true },
  bpDia: { min: 60, max: 90, enabled: true },
  temp: { min: 97.0, max: 99.5, enabled: true },
  rr: { min: 12, max: 20, enabled: true },
};

const BASELINES: Vitals[] = [
  { hr: 72, spo2: 98, bpSys: 120, bpDia: 78, temp: 98.4, rr: 16 },
  { hr: 88, spo2: 95, bpSys: 135, bpDia: 85, temp: 99.1, rr: 18 },
  { hr: 65, spo2: 99, bpSys: 115, bpDia: 72, temp: 98.2, rr: 14 },
  { hr: 105, spo2: 91, bpSys: 145, bpDia: 92, temp: 100.2, rr: 22 },
  { hr: 78, spo2: 97, bpSys: 118, bpDia: 76, temp: 98.6, rr: 15 },
  { hr: 92, spo2: 94, bpSys: 130, bpDia: 88, temp: 99.8, rr: 20 },
];

const NAMES = ["Adams, J.", "Baker, M.", "Chen, L.", "Davis, R.", "Evans, S.", "Foster, K."];
const ROOMS = ["201A", "201B", "202A", "203A", "204A", "204B"];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const uid = () => Math.random().toString(36).slice(2, 10);

const severity = (v: number, cfg: ThresholdCfg): Severity => {
  if (!cfg.enabled) return "normal";
  if (v < cfg.min - 5 || v > cfg.max + 5) return "critical";
  if (v < cfg.min || v > cfg.max) return "warning";
  return "normal";
};

const worstSeverity = (vitals: Vitals, th: Thresholds): Severity => {
  const keys = Object.keys(vitals) as (keyof Vitals)[];
  let worst: Severity = "normal";
  for (const k of keys) {
    const s = severity(vitals[k], th[k]);
    if (s === "critical") return "critical";
    if (s === "warning") worst = "warning";
  }
  return worst;
};

const severityColor = (s: Severity) =>
  s === "critical" ? "var(--clr-critical)" : s === "warning" ? "var(--clr-warning)" : "var(--clr-normal)";

const fmtTime = (d: Date) =>
  d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/* ── seed data ── */
const seedPatients = (): Patient[] =>
  BASELINES.map((b, i) => ({
    id: `p${i}`,
    name: NAMES[i],
    room: ROOMS[i],
    vitals: { ...b },
    history: Array.from({ length: 48 }, (_, j) => ({
      ts: Date.now() - (48 - j) * 30 * 60_000,
      vitals: {
        hr: clamp(b.hr + rand(-8, 8), 40, 180),
        spo2: clamp(b.spo2 + rand(-3, 1), 70, 100),
        bpSys: clamp(b.bpSys + rand(-10, 10), 70, 200),
        bpDia: clamp(b.bpDia + rand(-6, 6), 40, 130),
        temp: +(clamp(b.temp + rand(-0.5, 0.5), 95, 105)).toFixed(1),
        rr: clamp(b.rr + rand(-3, 3), 6, 40),
      },
    })),
  }));

const seedDevices = (): Device[] =>
  BASELINES.map((_, i) => ({
    id: `d${i}`,
    serial: `MON-${2000 + i}`,
    type: i % 2 === 0 ? "Bedside Monitor" : "Wireless Patch",
    status: (["online", "online", "online", "online", "low-battery", "offline"] as DeviceStatus[])[i],
    battery: [95, 88, 72, 100, 15, 0][i],
    lastSync: new Date(Date.now() - i * 60_000),
    patientId: `p${i}`,
  }));

/* ── mini waveform SVG ── */
const Waveform = ({ color }: { color: string }) => (
  <svg viewBox="0 0 120 30" style={{ width: "100%", height: 28 }}>
    <style>{`
      @keyframes wave { from { transform: translateX(0); } to { transform: translateX(-60px); } }
      .wv { animation: wave 1.2s linear infinite; }
    `}</style>
    <g className="wv">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        points="0,15 8,15 12,15 14,5 16,25 18,10 20,20 22,15 30,15 38,15 42,15 44,5 46,25 48,10 50,20 52,15 60,15 68,15 72,15 74,5 76,25 78,10 80,20 82,15 90,15 98,15 102,15 104,5 106,25 108,10 110,20 112,15 120,15 128,15 132,15 134,5 136,25 138,10 140,20 142,15 150,15 158,15 162,15 164,5 166,25 168,10 170,20 172,15 180,15"
      />
    </g>
  </svg>
);

/* ── SVG line chart ── */
const LineChart = ({ data, label, unit, color }: { data: { ts: number; v: number }[]; label: string; unit: string; color: string }) => {
  if (data.length < 2) return null;
  const minV = Math.min(...data.map((d) => d.v));
  const maxV = Math.max(...data.map((d) => d.v));
  const pad = Math.max((maxV - minV) * 0.1, 1);
  const lo = minV - pad;
  const hi = maxV + pad;
  const w = 480;
  const h = 120;
  const pts = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((d.v - lo) / (hi - lo)) * h;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="section-header" style={{ fontSize: 13, marginBottom: 4 }}>
        {label} ({unit})
      </div>
      <svg viewBox={`0 0 ${w} ${h + 20}`} style={{ width: "100%", maxWidth: 520, height: "auto" }}>
        <text x="0" y={12} fontSize="10" fill="var(--text-secondary)">{hi.toFixed(1)}</text>
        <text x="0" y={h + 12} fontSize="10" fill="var(--text-secondary)">{lo.toFixed(1)}</text>
        <polyline fill="none" stroke={color} strokeWidth="2" points={pts} />
      </svg>
    </div>
  );
};

/* ── icons ── */
const BackIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

const BellIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const DeviceIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

/* ── component ── */
export function VitalsMonitor({ onBack, notify }: { onBack: () => void; notify: (msg: string, type?: "success" | "error") => void }) {
  const [patients, setPatients] = useState<Patient[]>(seedPatients);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [devices] = useState<Device[]>(seedDevices);
  const [thresholds, setThresholds] = useState<Thresholds>({ ...DEFAULT_THRESHOLDS });
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [tab, setTab] = useState<"grid" | "alerts" | "thresholds" | "devices">("grid");
  const alertIdRef = useRef(0);

  /* simulate vital changes */
  useEffect(() => {
    const id = setInterval(() => {
      setPatients((prev) => {
        const next = prev.map((p) => {
          const base = BASELINES[parseInt(p.id.slice(1))];
          const vitals: Vitals = {
            hr: Math.round(clamp(p.vitals.hr + rand(-2, 2), base.hr - 15, base.hr + 15)),
            spo2: Math.round(clamp(p.vitals.spo2 + rand(-1, 0.5), base.spo2 - 6, 100)),
            bpSys: Math.round(clamp(p.vitals.bpSys + rand(-3, 3), base.bpSys - 15, base.bpSys + 15)),
            bpDia: Math.round(clamp(p.vitals.bpDia + rand(-2, 2), base.bpDia - 10, base.bpDia + 10)),
            temp: +(clamp(p.vitals.temp + rand(-0.1, 0.1), base.temp - 1, base.temp + 1)).toFixed(1),
            rr: Math.round(clamp(p.vitals.rr + rand(-1, 1), base.rr - 4, base.rr + 4)),
          };
          const history = [...p.history.slice(-47), { ts: Date.now(), vitals }];
          return { ...p, vitals, history };
        });

        /* generate alerts from threshold breaches */
        const newAlerts: Alert[] = [];
        for (const p of next) {
          for (const k of Object.keys(p.vitals) as (keyof Vitals)[]) {
            const cfg = thresholds[k];
            const s = severity(p.vitals[k], cfg);
            if (s !== "normal") {
              newAlerts.push({
                id: `a${++alertIdRef.current}`,
                patientId: p.id,
                patientName: p.name,
                vital: VITAL_LABELS[k],
                value: p.vitals[k],
                threshold: `${cfg.min}–${cfg.max}`,
                severity: s as AlertSeverity,
                time: new Date(),
              });
            }
          }
        }
        if (newAlerts.length > 0) {
          setAlerts((prev) => [...newAlerts, ...prev].slice(0, 50));
        }

        return next;
      });
    }, 2000);
    return () => clearInterval(id);
  }, [thresholds]);

  const handleNurseCall = useCallback(
    (priority: NursePriority, patientName: string) => {
      notify(`Nurse paged — ${priority.toUpperCase()} — ${patientName}`, "success");
    },
    [notify],
  );

  const updateThreshold = useCallback((key: keyof Vitals, field: "min" | "max" | "enabled", value: number | boolean) => {
    setThresholds((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  }, []);

  const detail = selectedPatient ? patients.find((p) => p.id === selectedPatient) : null;

  /* ── styles ── */
  const css = `
    .vm-root { --clr-normal: #22c55e; --clr-warning: #eab308; --clr-critical: #ef4444; }
    .vm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
    .vm-tile { padding: 14px; border-radius: 14px; cursor: pointer; transition: box-shadow .2s; }
    .vm-tile:hover { box-shadow: 4px 4px 10px rgba(0,0,0,.12), -2px -2px 8px rgba(255,255,255,.7); }
    .vm-status-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 6px; }
    .vm-vital-row { display: flex; justify-content: space-between; font-size: 13px; padding: 2px 0; }
    .vm-tabs { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
    .vm-alert-row { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 10px; margin-bottom: 6px; font-size: 13px; }
    .vm-badge { padding: 2px 8px; border-radius: 8px; font-size: 11px; font-weight: 600; text-transform: uppercase; color: #fff; }
    .vm-dev-row { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr 1fr; gap: 8px; padding: 8px 0; font-size: 13px; border-bottom: 1px solid rgba(0,0,0,.06); align-items: center; }
    .vm-chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 700px) { .vm-chart-grid { grid-template-columns: 1fr; } }
    .vm-th-row { display: grid; grid-template-columns: 140px 80px 80px 60px; gap: 10px; align-items: center; padding: 6px 0; font-size: 13px; }
  `;

  /* ── detail view ── */
  if (detail) {
    const chartKeys: (keyof Vitals)[] = ["hr", "spo2", "bpSys", "bpDia", "rr", "temp"];
    const colors = ["#ef4444", "#3b82f6", "#8b5cf6", "#a855f7", "#06b6d4", "#f97316"];
    return (
      <div className="vm-root">
        <style>{css}</style>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button className="neu neu-btn" onClick={() => setSelectedPatient(null)}><BackIcon /> Back</button>
          <h2 className="section-header" style={{ margin: 0 }}>{detail.name} — Room {detail.room}</h2>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {(["routine", "urgent", "stat"] as NursePriority[]).map((p) => (
              <button key={p} className="neu neu-btn" style={{ fontSize: 12 }} onClick={() => handleNurseCall(p, detail.name)}>
                <BellIcon /> {p}
              </button>
            ))}
          </div>
        </div>

        {/* current vitals */}
        <div className="neu" style={{ padding: 14, borderRadius: 14, marginBottom: 16 }}>
          <div className="section-header" style={{ marginBottom: 8 }}>Current Vitals</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {(Object.keys(detail.vitals) as (keyof Vitals)[]).map((k) => {
              const s = severity(detail.vitals[k], thresholds[k]);
              return (
                <div key={k} style={{ minWidth: 100 }}>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{VITAL_LABELS[k]}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: severityColor(s) }}>
                    {detail.vitals[k]} <span style={{ fontSize: 11, fontWeight: 400 }}>{VITAL_UNITS[k]}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* trend charts */}
        <div className="neu" style={{ padding: 14, borderRadius: 14 }}>
          <div className="section-header" style={{ marginBottom: 8 }}>24h Trends</div>
          <div className="vm-chart-grid">
            {chartKeys.map((k, i) => (
              <LineChart
                key={k}
                label={VITAL_LABELS[k]}
                unit={VITAL_UNITS[k]}
                color={colors[i]}
                data={detail.history.map((h) => ({ ts: h.ts, v: h.vitals[k] }))}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── main view ── */
  return (
    <div className="vm-root">
      <style>{css}</style>

      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button className="neu neu-btn" onClick={onBack}><BackIcon /> Back</button>
        <h2 className="section-header" style={{ margin: 0 }}>Vitals Monitor</h2>
      </div>

      {/* tabs */}
      <div className="vm-tabs">
        {(["grid", "alerts", "thresholds", "devices"] as const).map((t) => (
          <button
            key={t}
            className={`neu neu-btn${tab === t ? " active" : ""}`}
            style={{ fontWeight: tab === t ? 700 : 400 }}
            onClick={() => setTab(t)}
          >
            {t === "grid" ? "Patients" : t === "alerts" ? "Alerts" : t === "thresholds" ? "Thresholds" : "Devices"}
            {t === "alerts" && alerts.length > 0 && (
              <span className="vm-badge" style={{ background: "var(--clr-critical)", marginLeft: 6 }}>{alerts.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── tab: patient grid ── */}
      {tab === "grid" && (
        <div className="vm-grid">
          {patients.map((p) => {
            const ws = worstSeverity(p.vitals, thresholds);
            return (
              <div key={p.id} className="neu vm-tile" onClick={() => setSelectedPatient(p.id)}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
                  <span className="vm-status-dot" style={{ background: severityColor(ws) }} />
                  <strong style={{ fontSize: 14 }}>{p.name}</strong>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-secondary)" }}>Rm {p.room}</span>
                </div>
                <Waveform color={severityColor(ws)} />
                {(Object.keys(p.vitals) as (keyof Vitals)[]).map((k) => {
                  const s = severity(p.vitals[k], thresholds[k]);
                  return (
                    <div className="vm-vital-row" key={k}>
                      <span>{VITAL_LABELS[k]}</span>
                      <span style={{ fontWeight: 600, color: severityColor(s) }}>
                        {p.vitals[k]} {VITAL_UNITS[k]}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* ── tab: alerts ── */}
      {tab === "alerts" && (
        <div className="neu" style={{ padding: 14, borderRadius: 14 }}>
          <div className="section-header" style={{ marginBottom: 10 }}>Active Alerts ({alerts.length})</div>
          {alerts.length === 0 && <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>No active alerts.</div>}
          {alerts.slice(0, 30).map((a) => (
            <div className="vm-alert-row neu" key={a.id}>
              <span
                className="vm-badge"
                style={{ background: a.severity === "critical" ? "var(--clr-critical)" : "var(--clr-warning)" }}
              >
                {a.severity}
              </span>
              <span style={{ fontWeight: 600 }}>{a.patientName}</span>
              <span>{a.vital}: {a.value}</span>
              <span style={{ color: "var(--text-secondary)" }}>({a.threshold})</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-secondary)" }}>{fmtTime(a.time)}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── tab: thresholds ── */}
      {tab === "thresholds" && (
        <div className="neu" style={{ padding: 14, borderRadius: 14 }}>
          <div className="section-header" style={{ marginBottom: 10 }}>Alert Thresholds</div>
          <div className="vm-th-row" style={{ fontWeight: 600, borderBottom: "1px solid rgba(0,0,0,.1)" }}>
            <span>Vital</span><span>Min</span><span>Max</span><span>On</span>
          </div>
          {(Object.keys(thresholds) as (keyof Vitals)[]).map((k) => (
            <div className="vm-th-row" key={k}>
              <span>{VITAL_LABELS[k]} ({VITAL_UNITS[k]})</span>
              <input
                className="neu neu-input"
                type="number"
                style={{ width: 64, padding: "4px 6px", fontSize: 13 }}
                value={thresholds[k].min}
                onChange={(e) => updateThreshold(k, "min", +e.target.value)}
              />
              <input
                className="neu neu-input"
                type="number"
                style={{ width: 64, padding: "4px 6px", fontSize: 13 }}
                value={thresholds[k].max}
                onChange={(e) => updateThreshold(k, "max", +e.target.value)}
              />
              <input
                type="checkbox"
                checked={thresholds[k].enabled}
                onChange={(e) => updateThreshold(k, "enabled", e.target.checked)}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── tab: devices ── */}
      {tab === "devices" && (
        <div className="neu" style={{ padding: 14, borderRadius: 14 }}>
          <div className="section-header" style={{ marginBottom: 10 }}>
            <DeviceIcon /> Connected Devices
          </div>
          <div className="vm-dev-row" style={{ fontWeight: 600, borderBottom: "2px solid rgba(0,0,0,.1)" }}>
            <span>Serial</span><span>Type</span><span>Status</span><span>Battery</span><span>Last Sync</span>
          </div>
          {devices.map((d) => (
            <div className="vm-dev-row" key={d.id}>
              <span style={{ fontFamily: "monospace" }}>{d.serial}</span>
              <span>{d.type}</span>
              <span>
                <span
                  className="vm-status-dot"
                  style={{
                    background:
                      d.status === "online" ? "var(--clr-normal)" : d.status === "low-battery" ? "var(--clr-warning)" : "var(--clr-critical)",
                  }}
                />
                {d.status}
              </span>
              <span>{d.battery}%</span>
              <span style={{ fontSize: 11 }}>{fmtTime(d.lastSync)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
