import React, { useState, useEffect } from "react";

interface CommandItem {
  id: string;
  label: string;
  category: string;
  icon: string;
  view: string;
}

const COMMANDS: CommandItem[] = [
  { id: "ocr-wb", label: "OCR Workbench & Multi-Engine Pipeline", category: "AI Tools", icon: "📄", view: "ocr-workbench" },
  { id: "doc-portal", label: "Doctor Portal & Patient Reports", category: "Clinical", icon: "👨‍⚕️", view: "doctor" },
  { id: "lab-interp", label: "Lab Result Interpretation", category: "Diagnostics", icon: "🧪", view: "lab-interpret" },
  { id: "vitals", label: "Live Vitals Monitor & ICU Track", category: "Monitoring", icon: "📈", view: "vitals-monitor" },
  { id: "analytics", label: "Advanced Clinical Analytics", category: "Analytics", icon: "📊", view: "analytics" },
  { id: "genomics", label: "Genomic Variant Inspector", category: "Precision Medicine", icon: "🧬", view: "genomics" },
  { id: "drug-int", label: "Drug Interaction Checker", category: "Pharmacy", icon: "💊", view: "drug-interactions" },
  { id: "patient-portal", label: "Patient Access Portal", category: "Patient Care", icon: "👤", view: "patient" },
  { id: "rx-refills", label: "Prescription Refills & e-Rx", category: "Pharmacy", icon: "📝", view: "rx-refills" },
  { id: "clinical-trials", label: "Clinical Trial Matching Engine", category: "Research", icon: "🔬", view: "clinical-trials" },
  { id: "telemed", label: "Telemedicine Video Consult", category: "Virtual Care", icon: "📹", view: "telemedicine" },
  { id: "imaging", label: "Medical Imaging DICOM Viewer", category: "Radiology", icon: "🖼️", view: "imaging" },
  { id: "settings", label: "System Settings & Model GPU Config", category: "Admin", icon: "⚙️", view: "settings" },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (view: string) => void;
}

export function CommandPalette({ isOpen, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = COMMANDS.filter(c =>
    c.label.toLowerCase().includes(query.toLowerCase()) ||
    c.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % (filtered.length || 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filtered.length) % (filtered.length || 1));
      } else if (e.key === "Enter" && filtered[selectedIndex]) {
        e.preventDefault();
        onSelect(filtered[selectedIndex].view);
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filtered, selectedIndex, onClose, onSelect]);

  if (!isOpen) return null;

  return (
    <div className="cmd-palette-overlay" onClick={onClose}>
      <div className="cmd-palette-box" onClick={e => e.stopPropagation()}>
        <input
          autoFocus
          className="cmd-palette-input"
          placeholder="🔍 Type a command or search feature... (Esc to cancel)"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <div className="cmd-palette-list">
          {filtered.length === 0 ? (
            <div style={{ padding: "16px", color: "var(--text-muted)", fontSize: "14px", textAlign: "center" }}>
              No matching features found.
            </div>
          ) : (
            filtered.map((item, idx) => (
              <div
                key={item.id}
                className={`cmd-item${idx === selectedIndex ? " selected" : ""}`}
                onClick={() => {
                  onSelect(item.view);
                  onClose();
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span>{item.icon}</span>
                  <span style={{ fontWeight: 600 }}>{item.label}</span>
                </div>
                <span className="stage-card-badge" style={{ fontSize: "10px" }}>
                  {item.category}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
