import { useState, useEffect } from "react";
import * as api from "../api";

interface Props {
  onBack: () => void;
}

export function AuditLog({ onBack }: Props) {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    api.getAuditLog(200).then(setLogs).catch(() => {});
  }, []);

  const fmtDate = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) + " " +
      dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const actionColor = (a: string) =>
    a.includes("delete") ? "var(--danger)" :
    a.includes("create") || a.includes("add") ? "#10b981" :
    a.includes("update") ? "#f59e0b" : "var(--text-muted)";

  return (
    <div className="page-enter">
      <div className="breadcrumb">
        <button onClick={onBack}>Home</button>
        <span className="sep">/</span>
        <span>Audit Log</span>
      </div>

      <div className="section-header">
        <div>
          <h1>Audit Log</h1>
          <div className="subtitle">System activity trail — {logs.length} entries</div>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="chart-empty">No audit entries recorded yet</div>
      ) : (
        <div className="vitals-table-wrap">
          <table className="vitals-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: "nowrap", fontSize: 11 }}>{fmtDate(log.created_at)}</td>
                  <td style={{ fontSize: 12 }}>{log.actor_type}:{log.actor_id.slice(0, 8)}</td>
                  <td><span style={{ color: actionColor(log.action), fontWeight: 600, fontSize: 12 }}>{log.action}</span></td>
                  <td style={{ fontSize: 12 }}>{log.resource_type}{log.resource_id ? `:${log.resource_id.slice(0, 8)}` : ""}</td>
                  <td style={{ fontSize: 11, color: "var(--text-muted)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
