import { useState } from "react";
import { ErrorBox, Loading } from "../../components/ui";
import { api } from "../../lib/api";
import { useFetch } from "../../lib/hooks";
import { formatDateTime } from "../../lib/format";

const ACTION_LABEL = { login: "Signed in", create: "Added batch", update: "Edited batch", status: "Changed status", delete: "Deleted batch", import: "Imported CSV", export: "Exported CSV", password_change: "Changed password" };

function describe(a) {
  const d = a.details;
  if (!d) return "";
  if (a.action === "update" || a.action === "status") return Object.entries(d).map(([k, [from, to]]) => `${k}: ${from ?? "—"} → ${to ?? "—"}`).join(" · ");
  if (a.action === "import") return `${d.created} added, ${d.updated} updated`;
  if (a.action === "export") return `${d.rows} rows`;
  if (d.seedName) return d.seedName;
  return "";
}

export default function Activity() {
  const [tab, setTab] = useState("scans");
  const scans = useFetch(() => api.get("/admin/lookups?limit=100"));
  const audit = useFetch(() => api.get("/admin/audit?limit=100"));
  const cur = tab === "scans" ? scans : audit;

  return (
    <>
      <div className="admin-welcome"><div><div className="eyebrow">ACTIVITY</div><h1>What's happening</h1><p>Recent public scans and every change made by admins.</p></div></div>
      <div className="seg" role="tablist">
        <button role="tab" aria-selected={tab === "scans"} className={tab === "scans" ? "on" : ""} onClick={() => setTab("scans")}>Recent scans</button>
        <button role="tab" aria-selected={tab === "audit"} className={tab === "audit" ? "on" : ""} onClick={() => setTab("audit")}>Admin changes</button>
      </div>
      {cur.loading && !cur.data && <Loading />}
      {cur.error && <ErrorBox error={cur.error} onRetry={cur.reload} />}
      {cur.data && (
        <div className="admin-table-card"><div className="table-scroll">
          {tab === "scans" ? (
            <table><thead><tr><th>When (UTC)</th><th>Batch code</th><th>Result</th><th>Via</th></tr></thead>
              <tbody>{cur.data.items.map((l) => (
                <tr key={l.id}><td>{formatDateTime(l.createdAt)}</td><td className="code-cell">{l.batchCode}</td>
                  <td><span className={`status ${l.found ? "verified" : "rejected"}`}>{l.found ? "Found" : "Not found"}</span></td><td>{l.source}</td></tr>))}
                {!cur.data.items.length && <tr><td colSpan={4} className="empty-row">No scans recorded yet.</td></tr>}</tbody></table>
          ) : (
            <table><thead><tr><th>When (UTC)</th><th>Admin</th><th>Action</th><th>Batch</th><th>Details</th></tr></thead>
              <tbody>{cur.data.items.map((a) => (
                <tr key={a.id}><td>{formatDateTime(a.createdAt)}</td><td>{a.adminEmail || "—"}</td><td>{ACTION_LABEL[a.action] || a.action}</td><td className="code-cell">{a.batchCode || "—"}</td><td className="detail-cell">{describe(a)}</td></tr>))}
                {!cur.data.items.length && <tr><td colSpan={5} className="empty-row">No activity yet.</td></tr>}</tbody></table>
          )}
        </div></div>
      )}
    </>
  );
}
