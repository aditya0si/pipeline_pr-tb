import { useState, useRef, useCallback } from "react";
import * as api from "../api";

interface Props {
  onBack: () => void;
  notify: (msg: string, type?: "success" | "error") => void;
}

type Screen = "auth" | "dashboard";

export function PatientPortal({ onBack, notify }: Props) {
  const [screen, setScreen] = useState<Screen>("auth");
  const [isRegister, setIsRegister] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadReports = async (t: string) => {
    try {
      setReports(await api.patientReports(t));
    } catch {}
  };

  const handleAuth = async () => {
    if (!phone || !password) return notify("Please fill all fields", "error");
    setLoading(true);
    try {
      const res = isRegister
        ? await api.register(phone, password, name)
        : await api.login(phone, password);
      setToken(res.token);
      setScreen("dashboard");
      notify(isRegister ? "Account created!" : "Welcome back!");
      loadReports(res.token);
    } catch (e: any) {
      notify(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      await api.uploadReport(token, file);
      notify(`${file.name} uploaded`);
      loadReports(token);
    } catch (e: any) {
      notify(e.message, "error");
    } finally {
      setUploading(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }, [token]);

  if (screen === "auth") {
    return (
      <div className="page-enter">
        <div className="breadcrumb">
          <button onClick={onBack}>Home</button>
          <span className="sep">/</span>
          <span>Patient</span>
        </div>

        <div className="section-header" style={{ justifyContent: "center", textAlign: "center" }}>
          <div>
            <h1>{isRegister ? "Create Account" : "Welcome Back"}</h1>
            <div className="subtitle">{isRegister ? "Register with your phone number" : "Sign in to your account"}</div>
          </div>
        </div>

        <div className="form-card neu">
          {isRegister && (
            <div className="form-group">
              <label>Full Name</label>
              <input className="neu-input" placeholder="Your full name" value={name} onChange={e => setName(e.target.value)} />
            </div>
          )}
          <div className="form-group">
            <label>Phone Number</label>
            <input className="neu-input" placeholder="e.g. 9876543210" value={phone} onChange={e => setPhone(e.target.value)} type="tel" />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input className="neu-input" type="password" placeholder="Enter password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAuth()} />
          </div>
          <div className="form-actions">
            <button className="neu-btn primary lg" onClick={handleAuth} disabled={loading} style={{ flex: 1 }}>
              {loading ? <span className="spinner white" /> : isRegister ? "Create Account" : "Sign In"}
            </button>
          </div>
          <div className="form-toggle">
            {isRegister ? "Already have an account? " : "Don't have an account? "}
            <button onClick={() => setIsRegister(!isRegister)}>
              {isRegister ? "Sign In" : "Register"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const analyzed = reports.filter(r => r.analyzed).length;
  const pending = reports.length - analyzed;

  return (
    <div className="page-enter">
      <div className="breadcrumb">
        <button onClick={onBack}>Home</button>
        <span className="sep">/</span>
        <span>My Reports</span>
      </div>

      <div className="section-header">
        <div>
          <h1>My Reports</h1>
          <div className="subtitle">Upload and track your medical documents</div>
        </div>
      </div>

      {reports.length > 0 && (
        <div className="stat-row">
          <div className="stat-card neu">
            <div className="stat-icon blue">📄</div>
            <div className="stat-value">{reports.length}</div>
            <div className="stat-label">Total</div>
          </div>
          <div className="stat-card neu">
            <div className="stat-icon green">✓</div>
            <div className="stat-value">{analyzed}</div>
            <div className="stat-label">Analyzed</div>
          </div>
          <div className="stat-card neu">
            <div className="stat-icon orange">⏳</div>
            <div className="stat-value">{pending}</div>
            <div className="stat-label">Pending</div>
          </div>
        </div>
      )}

      <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" hidden onChange={e => {
        const f = e.target.files?.[0];
        if (f) handleUpload(f);
        e.target.value = "";
      }} />

      <div
        className={`upload-zone${dragging ? " dragging" : ""}`}
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {uploading ? (
          <>
            <div className="upload-icon"><span className="spinner" /></div>
            <h4>Uploading...</h4>
            <p>Processing your document</p>
            <div className="upload-progress"><div className="upload-progress-bar" style={{ width: "70%" }} /></div>
          </>
        ) : (
          <>
            <div className="upload-icon">📤</div>
            <h4>Upload a Report</h4>
            <p>Drag & drop or click to select — PDF, PNG, JPG, WebP</p>
          </>
        )}
      </div>

      {reports.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h4>No reports yet</h4>
          <p>Upload your first medical document above to get started.</p>
        </div>
      ) : (
        <div className="report-list">
          {reports.map(r => (
            <div key={r.id} className="report-card neu">
              <div className="file-thumb">
                {r.filetype === "pdf" ? "📕" : "🖼️"}
              </div>
              <div className="report-body">
                <div className="report-title">{r.filename}</div>
                <div className="report-date">
                  {new Date(r.shared_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  {" · "}
                  {new Date(r.shared_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
              <div className="report-right">
                <span className={`tag ${r.filetype}`}>{r.filetype}</span>
                {r.analyzed ? <span className="tag analyzed">Analyzed</span> : <span className="tag pending">Pending</span>}
                <a href={api.fileUrl(r.id)} target="_blank" rel="noopener">
                  <button className="neu-btn sm">View</button>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
