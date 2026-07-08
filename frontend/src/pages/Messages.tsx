import { useState, useEffect } from "react";
import * as api from "../api";

interface Props {
  onBack: () => void;
  notify: (msg: string, type?: "success" | "error") => void;
}

export function Messages({ onBack, notify }: Props) {
  const [messages, setMessages] = useState<any[]>([]);
  const [composing, setComposing] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState({ receiver_id: "", receiver_type: "patient", subject: "", body: "" });

  useEffect(() => {
    api.listMessages("doctor", "").then(setMessages).catch(() => {});
    api.listPatients().then(setPatients).catch(() => {});
  }, []);

  const handleSend = async () => {
    if (!form.body.trim()) return notify("Message body is required", "error");
    try {
      await api.sendMessage(form);
      notify("Message sent!");
      setComposing(false);
      setForm({ receiver_id: "", receiver_type: "patient", subject: "", body: "" });
      api.listMessages("doctor", "").then(setMessages);
    } catch (e: any) {
      notify(e.message, "error");
    }
  };

  const markRead = async (msg: any) => {
    if (!msg.is_read) {
      await api.markMessageRead(msg.id).catch(() => {});
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: 1 } : m));
    }
    setSelected(msg);
  };

  const fmtDate = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + " " +
      dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="page-enter">
      <div className="breadcrumb">
        <button onClick={onBack}>Home</button>
        <span className="sep">/</span>
        <span>Messages</span>
      </div>

      <div className="section-header">
        <div>
          <h1>Messages</h1>
          <div className="subtitle">{messages.length} message{messages.length !== 1 ? "s" : ""}</div>
        </div>
        <button className="neu-btn primary" onClick={() => setComposing(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Compose
        </button>
      </div>

      {composing && (
        <div className="neu" style={{ padding: 20, marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>New Message</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <select className="neu-input" value={form.receiver_id} onChange={e => setForm({ ...form, receiver_id: e.target.value })}>
              <option value="">Select patient...</option>
              {patients.map(p => <option key={p.id} value={p.id}>{p.name || p.phone}</option>)}
            </select>
            <input className="neu-input" placeholder="Subject" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
            <textarea className="neu-input" placeholder="Message body..." rows={4} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} style={{ resize: "vertical", minHeight: 80 }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="neu-btn ghost" onClick={() => setComposing(false)}>Cancel</button>
              <button className="neu-btn primary" onClick={handleSend}>Send</button>
            </div>
          </div>
        </div>
      )}

      {selected ? (
        <div>
          <button className="neu-btn sm ghost" onClick={() => setSelected(null)} style={{ marginBottom: 12 }}>← Back to inbox</button>
          <div className="neu" style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>{selected.subject || "(No subject)"}</h3>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{fmtDate(selected.created_at)}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
              From: {selected.sender_type} · To: {selected.receiver_type}
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{selected.body}</p>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {messages.length === 0 && (
            <div className="chart-empty">No messages yet</div>
          )}
          {messages.map(msg => (
            <div
              key={msg.id}
              className="neu"
              onClick={() => markRead(msg)}
              style={{ padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, opacity: msg.is_read ? 0.7 : 1 }}
            >
              <div style={{
                width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                background: msg.is_read ? "var(--text-muted)" : "var(--accent)",
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: msg.is_read ? 400 : 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {msg.subject || "(No subject)"}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {msg.body}
                </div>
              </div>
              <span style={{ fontSize: 10, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{fmtDate(msg.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
