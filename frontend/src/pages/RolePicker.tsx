interface Props {
  onPick: (role: string, data?: any) => void;
}

export function RolePicker({ onPick }: Props) {
  return (
    <div className="landing">
      <div className="landing-hero">
        <div className="landing-logo-big">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
        </div>
        <h2>Medical Intelligence<br />Ecosystem</h2>
        <p>
          The open-source clinical platform. Plug in any OCR engine and AI model.
          Upload reports, track vitals, write prescriptions, manage appointments — all in one place.
        </p>
      </div>

      <div className="role-grid three">
        <div className="role-card neu" onClick={() => onPick("patient")}>
          <div className="role-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <h3>Patient Portal</h3>
          <p>Upload reports, view analysis, manage your medical profile</p>
        </div>
        <div className="role-card neu" onClick={() => onPick("doctor")}>
          <div className="role-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.8 2.62A2 2 0 0 1 6.6 2h.89a2 2 0 0 1 1.82.62l.73.82a2 2 0 0 0 1.49.67H13a2 2 0 0 0 1.49-.67l.73-.82A2 2 0 0 1 17 2h.89"/>
              <path d="M4 7v3a8 8 0 0 0 8 8 8 8 0 0 0 8-8V7"/><circle cx="19" cy="14" r="2"/>
              <path d="M19 16v3a3 3 0 0 1-3 3h-1a3 3 0 0 1-3-3v-1"/>
            </svg>
          </div>
          <h3>Doctor Portal</h3>
          <p>Patient charts, OCR analysis, prescriptions, SOAP notes</p>
        </div>
        <div className="role-card neu" onClick={() => onPick("dashboard")}>
          <div className="role-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </div>
          <h3>Dashboard</h3>
          <p>Analytics, stats, and practice overview at a glance</p>
        </div>
      </div>

      <div className="role-grid three" style={{ marginTop: 14 }}>
        <div className="role-card neu" onClick={() => onPick("drug-interactions")}>
          <div className="role-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.5 1.5H8A6.5 6.5 0 0 0 8 14.5h8A6.5 6.5 0 0 0 16 1.5h-2.5"/>
              <line x1="9" y1="8" x2="15" y2="8"/>
            </svg>
          </div>
          <h3>Drug Interactions</h3>
          <p>Check medications for potential interactions and conflicts</p>
        </div>
        <div className="role-card neu" onClick={() => onPick("messages")}>
          <div className="role-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <h3>Messages</h3>
          <p>Secure messaging between doctors and patients</p>
        </div>
        <div className="role-card neu" onClick={() => onPick("audit-log")}>
          <div className="role-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <h3>Audit Log</h3>
          <p>Complete system activity trail and compliance records</p>
        </div>
      </div>

      <div className="role-grid three" style={{ marginTop: 14 }}>
        <div className="role-card neu" onClick={() => onPick("analytics")}>
          <div className="role-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>
            </svg>
          </div>
          <h3>Advanced Analytics</h3>
          <p>Population health, trends, quality metrics, and insights</p>
        </div>
        <div className="role-card neu" onClick={() => onPick("consent-forms")}>
          <div className="role-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
          </div>
          <h3>Consent Forms</h3>
          <p>Digital consent, HIPAA authorization, surgical and research forms</p>
        </div>
        <div className="role-card neu" onClick={() => onPick("education")}>
          <div className="role-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
          </div>
          <h3>Patient Education</h3>
          <p>Evidence-based health information and self-care guides</p>
        </div>
      </div>

      <div className="role-grid three" style={{ marginTop: 14 }}>
        <div className="role-card neu" onClick={() => onPick("imaging")}>
          <div className="role-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="2"/><circle cx="12" cy="12" r="4"/><line x1="2" y1="2" x2="8" y2="8"/><line x1="22" y1="2" x2="16" y2="8"/><line x1="2" y1="22" x2="8" y2="16"/><line x1="22" y1="22" x2="16" y2="16"/>
            </svg>
          </div>
          <h3>Medical Imaging</h3>
          <p>DICOM viewer, annotations, window/level presets, comparison mode</p>
        </div>
        <div className="role-card neu" onClick={() => onPick("telemedicine")}>
          <div className="role-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
          </div>
          <h3>Telemedicine</h3>
          <p>Video consultations, in-call chat, post-visit summaries</p>
        </div>
        <div className="role-card neu" onClick={() => onPick("rx-refills")}>
          <div className="role-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9m-9 9a9 9 0 0 1 9-9"/>
            </svg>
          </div>
          <h3>Rx Refills</h3>
          <p>Prescription refill queue, e-prescribe, pharmacy directory</p>
        </div>
      </div>

      <div className="role-grid three" style={{ marginTop: 14 }}>
        <div className="role-card neu" onClick={() => onPick("genomics")}>
          <div className="role-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 15c6.667-6 13.333 0 20-6"/><path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993"/><path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993"/><path d="M17 6l-2.5-2.5"/><path d="M14 8l-1-1"/><path d="M7 18l2.5 2.5"/><path d="M3.5 14.5l.5.5"/><path d="M20 9l.5.5"/>
            </svg>
          </div>
          <h3>Genomics</h3>
          <p>Pharmacogenomics, genetic risk, ancestry, family pedigree</p>
        </div>
        <div className="role-card neu" onClick={() => onPick("clinical-trials")}>
          <div className="role-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 2h6v3H9z"/><path d="M16 5H8a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z"/><path d="M12 11v6"/><path d="M9 14h6"/>
            </svg>
          </div>
          <h3>Clinical Trials</h3>
          <p>Trial matching, enrollment, adverse events, eligibility</p>
        </div>
        <div className="role-card neu" onClick={() => onPick("vitals-monitor")}>
          <div className="role-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/><circle cx="12" cy="12" r="10"/>
            </svg>
          </div>
          <h3>Vitals Monitor</h3>
          <p>Real-time multi-patient monitoring, alerts, waveforms</p>
        </div>
      </div>

      <div className="role-grid three" style={{ marginTop: 14 }}>
        <div className="role-card neu" onClick={() => onPick("lab-interpret")}>
          <div className="role-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/>
              <path d="M8.5 2h7"/><path d="M7 16h10"/>
            </svg>
          </div>
          <h3>Lab Interpretation</h3>
          <p>AI-powered lab analysis, panels, trends, critical alerts</p>
        </div>
        <div className="role-card neu" onClick={() => onPick("research")}>
          <div className="role-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/>
              <path d="M8.5 2h7"/>
            </svg>
          </div>
          <h3>Research Pipeline</h3>
          <p>Experiments, datasets, AI analysis, team collaboration</p>
        </div>
        <div className="role-card neu" onClick={() => onPick("ocr-workbench")}>
          <div className="role-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h4v4H7z"/><path d="M7 15h10"/><path d="M7 19h6"/><path d="M15 7h2"/><path d="M15 11h2"/>
            </svg>
          </div>
          <h3>OCR Workbench</h3>
          <p>Multi-engine OCR, pipeline builder, comparison, templates</p>
        </div>
      </div>

      <div className="landing-features">
        <div className="landing-feature">
          <div className="feature-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <span>HIPAA-ready</span>
        </div>
        <div className="landing-feature">
          <div className="feature-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <span>Vitals Tracking</span>
        </div>
        <div className="landing-feature">
          <div className="feature-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <span>AI Analysis</span>
        </div>
        <div className="landing-feature">
          <div className="feature-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
          </div>
          <span>Prescriptions</span>
        </div>
        <div className="landing-feature">
          <div className="feature-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <span>Appointments</span>
        </div>
        <div className="landing-feature">
          <div className="feature-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4"/></svg>
          </div>
          <span>Plug & Play</span>
        </div>
      </div>

      <button className="neu-btn ghost" onClick={() => onPick("settings")} style={{ marginTop: 8 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4"/></svg>
        Configure Providers
      </button>
    </div>
  );
}
