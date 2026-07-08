import { useState, useEffect, useRef } from "react";

interface Props {
  onBack: () => void;
  notify: (msg: string, type?: "success" | "error") => void;
}

type CallPhase = "pre" | "active" | "post" | "history";

interface ChatMsg {
  id: number;
  from: "doctor" | "patient";
  text: string;
  time: string;
}

interface PastCall {
  id: number;
  patient: string;
  date: string;
  duration: string;
  type: string;
  status: "completed" | "missed" | "cancelled" | "in-progress" | "scheduled";
  diagnosis: string;
}

const MOCK_PATIENTS = [
  { id: "P-1001", name: "Aarav Sharma", mrn: "MRN-78234", allergies: ["Penicillin", "Sulfa"], meds: ["Metformin 500mg", "Lisinopril 10mg"], vitals: { bp: "128/82", hr: "74 bpm", temp: "98.4F", spo2: "97%" } },
  { id: "P-1002", name: "Priya Patel", mrn: "MRN-45891", allergies: ["Aspirin"], meds: ["Levothyroxine 50mcg"], vitals: { bp: "118/76", hr: "68 bpm", temp: "98.6F", spo2: "99%" } },
  { id: "P-1003", name: "Rahul Gupta", mrn: "MRN-33120", allergies: [], meds: ["Atorvastatin 20mg", "Amlodipine 5mg", "Metoprolol 25mg"], vitals: { bp: "142/90", hr: "82 bpm", temp: "98.2F", spo2: "96%" } },
];

const MOCK_HISTORY: PastCall[] = [
  { id: 1, patient: "Aarav Sharma", date: "2026-07-07 10:30", duration: "18:42", type: "Follow-up", status: "completed", diagnosis: "Type 2 Diabetes - stable" },
  { id: 2, patient: "Priya Patel", date: "2026-07-06 14:00", duration: "12:15", type: "Consultation", status: "completed", diagnosis: "Hypothyroidism review" },
  { id: 3, patient: "Rahul Gupta", date: "2026-07-05 09:15", duration: "—", type: "Urgent", status: "missed", diagnosis: "—" },
  { id: 4, patient: "Aarav Sharma", date: "2026-07-03 11:00", duration: "25:03", type: "Consultation", status: "completed", diagnosis: "HbA1c review, medication adjustment" },
  { id: 5, patient: "Priya Patel", date: "2026-07-08 16:00", duration: "—", type: "Follow-up", status: "scheduled", diagnosis: "—" },
];

const MOCK_FILES = [
  { name: "Blood_Report_Jul2026.pdf", size: "245 KB", date: "Jul 5" },
  { name: "ECG_Scan.png", size: "1.2 MB", date: "Jul 3" },
];

const fmtTime = (s: number): string => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

const fmtDate = (d: string) => {
  const dt = new Date(d);
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) + " " +
    dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};

const statusColor = (s: string) =>
  s === "completed" ? "#10b981" :
  s === "missed" ? "var(--danger, #ef4444)" :
  s === "cancelled" ? "var(--text-muted, #888)" :
  s === "scheduled" ? "#4f6ef7" : "#f59e0b";

/* ─── SVG Icons (inline) ──────────────────────────── */

const IconPhone = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
  </svg>
);

const IconVideo = ({ off }: { off?: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {off ? (
      <>
        <path d="M16 16v1a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2m5.66 0H14a2 2 0 012 2v3.34l1 1L23 7v10"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </>
    ) : (
      <>
        <polygon points="23 7 16 12 23 17 23 7"/>
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
      </>
    )}
  </svg>
);

const IconMic = ({ off }: { off?: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {off ? (
      <>
        <line x1="1" y1="1" x2="23" y2="23"/>
        <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/>
        <path d="M17 16.95A7 7 0 015 12m14 0a7 7 0 01-.11 1.23"/>
        <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
      </>
    ) : (
      <>
        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
        <path d="M19 10v2a7 7 0 01-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
      </>
    )}
  </svg>
);

const IconScreen = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
  </svg>
);

const IconChat = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
  </svg>
);

const IconEndCall = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0122 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91"/>
    <line x1="23" y1="1" x2="1" y2="23"/>
  </svg>
);

const IconCamera = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
  </svg>
);

const IconUser = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

const IconFile = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
  </svg>
);

const IconClock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

const IconBack = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);

const IconSend = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
);

const IconAlert = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

export function Telemedicine({ onBack, notify }: Props) {
  const [phase, setPhase] = useState<CallPhase>("pre");

  /* ── Pre-call state ── */
  const [selectedPatient, setSelectedPatient] = useState("");
  const [appointmentType, setAppointmentType] = useState<"follow-up" | "consultation" | "urgent">("consultation");
  const [preNotes, setPreNotes] = useState("");

  /* ── Active call state ── */
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([
    { id: 1, from: "patient", text: "Hello doctor, I can see you clearly.", time: "00:05" },
  ]);
  const [chatInput, setChatInput] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  /* ── Post-call state ── */
  const [postForm, setPostForm] = useState({ diagnosis: "", followUp: "", prescriptions: "", nextAppt: "" });

  const patient = MOCK_PATIENTS.find(p => p.id === selectedPatient);

  /* Timer */
  useEffect(() => {
    if (phase === "active") {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  /* Auto-scroll chat */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const startCall = () => {
    if (!selectedPatient) return notify("Select a patient first", "error");
    setElapsed(0);
    setPhase("active");
    notify("Call connected");
  };

  const endCall = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase("post");
    notify("Call ended - " + fmtTime(elapsed));
  };

  const submitSummary = () => {
    if (!postForm.diagnosis.trim()) return notify("Diagnosis is required", "error");
    notify("Consultation summary saved", "success");
    setPhase("history");
  };

  const sendChat = () => {
    if (!chatInput.trim()) return;
    const msg: ChatMsg = { id: Date.now(), from: "doctor", text: chatInput.trim(), time: fmtTime(elapsed) };
    setChatMessages(prev => [...prev, msg]);
    setChatInput("");
    // Simulate patient reply
    setTimeout(() => {
      setChatMessages(prev => [...prev, {
        id: Date.now() + 1, from: "patient",
        text: ["Thank you, doctor.", "I understand.", "Yes, I have been taking the medication.", "Could you repeat that?"][Math.floor(Math.random() * 4)],
        time: fmtTime(elapsed + 3),
      }]);
    }, 2000);
  };

  /* ─────────────────────── PRE-CALL ─────────────────────── */
  if (phase === "pre") {
    return (
      <div className="page-enter">
        <div className="breadcrumb">
          <button onClick={onBack}>Home</button>
          <span className="sep">/</span>
          <button onClick={() => setPhase("history")}>Telemedicine</button>
          <span className="sep">/</span>
          <span>New Consultation</span>
        </div>

        <div className="section-header">
          <div>
            <h1>Start Video Consultation</h1>
            <div className="subtitle">Set up the call parameters before connecting</div>
          </div>
          <button className="neu-btn ghost" onClick={() => setPhase("history")}>
            <IconClock /> Call History
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 900 }}>
          <div className="neu" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Call Setup</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, display: "block" }}>Patient</label>
                <select className="neu-input" value={selectedPatient} onChange={e => setSelectedPatient(e.target.value)} style={{ width: "100%" }}>
                  <option value="">Select patient...</option>
                  {MOCK_PATIENTS.map(p => <option key={p.id} value={p.id}>{p.name} ({p.mrn})</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, display: "block" }}>Appointment Type</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["follow-up", "consultation", "urgent"] as const).map(t => (
                    <button
                      key={t}
                      className={`neu-btn${appointmentType === t ? " primary" : " ghost"}`}
                      onClick={() => setAppointmentType(t)}
                      style={{ flex: 1, fontSize: 12, textTransform: "capitalize" }}
                    >
                      {t === "urgent" && <IconAlert />} {t.replace("-", " ")}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, display: "block" }}>Pre-call Notes</label>
                <textarea
                  className="neu-input"
                  placeholder="Reason for consultation, symptoms to discuss..."
                  rows={4}
                  value={preNotes}
                  onChange={e => setPreNotes(e.target.value)}
                  style={{ width: "100%", resize: "vertical", minHeight: 80 }}
                />
              </div>
              <button className="neu-btn primary" onClick={startCall} style={{ marginTop: 8, padding: "12px 24px", fontSize: 14 }}>
                <IconVideo off={false} /> Start Call
              </button>
            </div>
          </div>

          {patient ? (
            <div className="neu" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Patient Preview</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg, #4f6ef7, #a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 16 }}>
                  {patient.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{patient.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{patient.mrn}</div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Allergies</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {patient.allergies.length > 0 ? patient.allergies.map(a => (
                      <span key={a} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 8, background: "rgba(239,68,68,0.1)", color: "#ef4444", fontWeight: 600 }}>{a}</span>
                    )) : <span style={{ fontSize: 12, color: "var(--text-muted)" }}>None known</span>}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Current Medications</div>
                  {patient.meds.map(m => <div key={m} style={{ fontSize: 12, marginBottom: 2 }}>{m}</div>)}
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Last Vitals</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {Object.entries(patient.vitals).map(([k, v]) => (
                      <div key={k} style={{ fontSize: 12 }}><span style={{ fontWeight: 600, textTransform: "uppercase", fontSize: 10, color: "var(--text-muted)" }}>{k}: </span>{v}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="neu" style={{ padding: 24, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>
              <div style={{ textAlign: "center" }}>
                <IconUser />
                <div style={{ marginTop: 8 }}>Select a patient to see their details</div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ─────────────────────── ACTIVE CALL ─────────────────────── */
  if (phase === "active") {
    return (
      <div className="page-enter" style={{ display: "flex", gap: 16, height: "calc(100vh - 120px)", minHeight: 500 }}>
        {/* Main video area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Video feed */}
          <div style={{
            flex: 1, borderRadius: 16, position: "relative", overflow: "hidden",
            background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
            display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300,
          }}>
            <IconCamera />

            {/* Participant info overlay */}
            <div style={{
              position: "absolute", top: 16, left: 16,
              background: "rgba(0,0,0,0.5)", borderRadius: 10, padding: "8px 14px",
              color: "#fff", backdropFilter: "blur(8px)",
            }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{patient?.name ?? "Patient"}</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>{patient?.mrn ?? ""}</div>
            </div>

            {/* Duration */}
            <div style={{
              position: "absolute", top: 16, right: 16,
              background: "rgba(239,68,68,0.8)", borderRadius: 8, padding: "4px 12px",
              color: "#fff", fontWeight: 700, fontSize: 13, fontVariantNumeric: "tabular-nums",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff", animation: "pulse 1.5s infinite" }} />
              {fmtTime(elapsed)}
            </div>

            {/* Self-view PIP */}
            <div style={{
              position: "absolute", bottom: 16, right: 16, width: 160, height: 120,
              borderRadius: 12, overflow: "hidden", border: "2px solid rgba(255,255,255,0.2)",
              background: videoOff ? "#2d2d3d" : "linear-gradient(135deg, #2d2d3d 0%, #3d3d5c 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {videoOff ? (
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, textAlign: "center" }}>
                  <IconVideo off />
                  <div style={{ marginTop: 4 }}>Camera Off</div>
                </div>
              ) : (
                <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>You</div>
              )}
            </div>

            {screenSharing && (
              <div style={{
                position: "absolute", bottom: 16, left: 16,
                background: "rgba(79,110,247,0.8)", borderRadius: 8, padding: "4px 10px",
                color: "#fff", fontSize: 11, fontWeight: 600,
              }}>
                <IconScreen /> Sharing Screen
              </div>
            )}
          </div>

          {/* Call controls */}
          <div style={{
            display: "flex", justifyContent: "center", gap: 12, padding: "12px 0",
          }}>
            <button
              className={`neu-btn${muted ? " danger" : " ghost"}`}
              onClick={() => { setMuted(!muted); notify(muted ? "Unmuted" : "Muted"); }}
              style={{ width: 48, height: 48, borderRadius: "50%", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              title={muted ? "Unmute" : "Mute"}
            >
              <IconMic off={muted} />
            </button>
            <button
              className={`neu-btn${videoOff ? " danger" : " ghost"}`}
              onClick={() => { setVideoOff(!videoOff); notify(videoOff ? "Camera on" : "Camera off"); }}
              style={{ width: 48, height: 48, borderRadius: "50%", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              title={videoOff ? "Turn camera on" : "Turn camera off"}
            >
              <IconVideo off={videoOff} />
            </button>
            <button
              className={`neu-btn${screenSharing ? " primary" : " ghost"}`}
              onClick={() => { setScreenSharing(!screenSharing); notify(screenSharing ? "Stopped sharing" : "Sharing screen"); }}
              style={{ width: 48, height: 48, borderRadius: "50%", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              title="Screen share"
            >
              <IconScreen />
            </button>
            <button
              className="neu-btn"
              onClick={endCall}
              style={{
                width: 64, height: 48, borderRadius: 24, padding: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "#ef4444", color: "#fff", border: "none",
              }}
              title="End call"
            >
              <IconEndCall />
            </button>
            <button
              className={`neu-btn${chatOpen ? " primary" : " ghost"}`}
              onClick={() => setChatOpen(!chatOpen)}
              style={{ width: 48, height: 48, borderRadius: "50%", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              title="Toggle chat"
            >
              <IconChat />
            </button>
          </div>
        </div>

        {/* Side panel */}
        <div style={{ width: 320, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", flexShrink: 0 }}>
          {/* Chat panel */}
          {chatOpen && (
            <div className="neu" style={{ padding: 16, display: "flex", flexDirection: "column", height: 280, flexShrink: 0 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Chat</h4>
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                {chatMessages.map(m => (
                  <div key={m.id} style={{
                    alignSelf: m.from === "doctor" ? "flex-end" : "flex-start",
                    maxWidth: "80%", padding: "6px 10px", borderRadius: 10,
                    background: m.from === "doctor" ? "#4f6ef7" : "var(--bg-alt, #f0f0f0)",
                    color: m.from === "doctor" ? "#fff" : "inherit",
                    fontSize: 12,
                  }}>
                    <div>{m.text}</div>
                    <div style={{ fontSize: 9, opacity: 0.6, marginTop: 2, textAlign: "right" }}>{m.time}</div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  className="neu-input"
                  placeholder="Type a message..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendChat()}
                  style={{ flex: 1, fontSize: 12 }}
                />
                <button className="neu-btn primary" onClick={sendChat} style={{ padding: "6px 10px" }}>
                  <IconSend />
                </button>
              </div>
            </div>
          )}

          {/* Patient quick-view */}
          {patient && (
            <div className="neu" style={{ padding: 16 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Patient Info</h4>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #4f6ef7, #a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13 }}>
                  {patient.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{patient.name}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{patient.mrn}</div>
                </div>
              </div>

              {patient.allergies.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>Allergies</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {patient.allergies.map(a => (
                      <span key={a} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 6, background: "rgba(239,68,68,0.1)", color: "#ef4444", fontWeight: 600 }}>{a}</span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>Medications</div>
                {patient.meds.map(m => <div key={m} style={{ fontSize: 11, marginBottom: 1 }}>{m}</div>)}
              </div>

              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>Vitals</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                  {Object.entries(patient.vitals).map(([k, v]) => (
                    <div key={k} style={{ fontSize: 11 }}>
                      <span style={{ fontWeight: 600, textTransform: "uppercase", fontSize: 9, color: "var(--text-muted)" }}>{k}: </span>{v}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Shared files */}
          <div className="neu" style={{ padding: 16 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Shared Files</h4>
            {MOCK_FILES.map(f => (
              <div key={f.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--border, #eee)" }}>
                <IconFile />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{f.name}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{f.size} - {f.date}</div>
                </div>
              </div>
            ))}
            <button className="neu-btn ghost" style={{ marginTop: 8, fontSize: 11, width: "100%" }}>
              <IconPlus /> Share File
            </button>
          </div>
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        `}</style>
      </div>
    );
  }

  /* ─────────────────────── POST-CALL ─────────────────────── */
  if (phase === "post") {
    return (
      <div className="page-enter">
        <div className="breadcrumb">
          <button onClick={onBack}>Home</button>
          <span className="sep">/</span>
          <span>Telemedicine</span>
          <span className="sep">/</span>
          <span>Consultation Summary</span>
        </div>

        <div className="section-header">
          <div>
            <h1>Consultation Summary</h1>
            <div className="subtitle">
              {patient?.name ?? "Patient"} - {appointmentType.replace("-", " ")} - Duration: {fmtTime(elapsed)}
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 700 }}>
          <div className="neu" style={{ padding: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, display: "block" }}>Diagnosis / Assessment *</label>
                <textarea
                  className="neu-input"
                  placeholder="Primary diagnosis and clinical assessment..."
                  rows={3}
                  value={postForm.diagnosis}
                  onChange={e => setPostForm({ ...postForm, diagnosis: e.target.value })}
                  style={{ width: "100%", resize: "vertical" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, display: "block" }}>Follow-up Instructions</label>
                <textarea
                  className="neu-input"
                  placeholder="Patient instructions, lifestyle changes, warning signs..."
                  rows={2}
                  value={postForm.followUp}
                  onChange={e => setPostForm({ ...postForm, followUp: e.target.value })}
                  style={{ width: "100%", resize: "vertical" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, display: "block" }}>Prescriptions Written</label>
                <textarea
                  className="neu-input"
                  placeholder="Medications prescribed during this consultation..."
                  rows={2}
                  value={postForm.prescriptions}
                  onChange={e => setPostForm({ ...postForm, prescriptions: e.target.value })}
                  style={{ width: "100%", resize: "vertical" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, display: "block" }}>Next Appointment</label>
                <input
                  className="neu-input"
                  type="date"
                  value={postForm.nextAppt}
                  onChange={e => setPostForm({ ...postForm, nextAppt: e.target.value })}
                  style={{ width: "100%" }}
                />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                <button className="neu-btn ghost" onClick={() => setPhase("history")}>Skip</button>
                <button className="neu-btn primary" onClick={submitSummary}>Save Summary</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────────── HISTORY ─────────────────────── */
  return (
    <div className="page-enter">
      <div className="breadcrumb">
        <button onClick={onBack}>Home</button>
        <span className="sep">/</span>
        <span>Telemedicine</span>
      </div>

      <div className="section-header">
        <div>
          <h1>Telemedicine</h1>
          <div className="subtitle">Video consultations and call history</div>
        </div>
        <button className="neu-btn primary" onClick={() => { setPhase("pre"); setSelectedPatient(""); setPreNotes(""); setPostForm({ diagnosis: "", followUp: "", prescriptions: "", nextAppt: "" }); }}>
          <IconVideo off={false} /> New Consultation
        </button>
      </div>

      <div className="vitals-table-wrap">
        <table className="vitals-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Date</th>
              <th>Type</th>
              <th>Duration</th>
              <th>Status</th>
              <th>Diagnosis</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_HISTORY.map(h => (
              <tr key={h.id}>
                <td style={{ fontWeight: 600 }}>{h.patient}</td>
                <td>{fmtDate(h.date)}</td>
                <td>
                  <span style={{
                    fontSize: 11, padding: "2px 8px", borderRadius: 8, fontWeight: 600,
                    background: h.type === "Urgent" ? "rgba(239,68,68,0.1)" : h.type === "Follow-up" ? "rgba(79,110,247,0.1)" : "rgba(16,185,129,0.1)",
                    color: h.type === "Urgent" ? "#ef4444" : h.type === "Follow-up" ? "#4f6ef7" : "#10b981",
                  }}>
                    {h.type}
                  </span>
                </td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>{h.duration}</td>
                <td>
                  <span style={{ fontSize: 11, fontWeight: 600, color: statusColor(h.status), textTransform: "capitalize" }}>
                    {h.status}
                  </span>
                </td>
                <td style={{ color: h.diagnosis === "—" ? "var(--text-muted)" : "inherit", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {h.diagnosis}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
