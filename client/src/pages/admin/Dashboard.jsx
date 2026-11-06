import { Link } from "react-router-dom";
import { AlertTriangle, BadgeCheck, Clock3, FlaskConical, PackagePlus, Plus, ScanSearch, ShieldAlert, TimerOff, XCircle } from "lucide-react";
import { ErrorBox, Loading } from "../../components/ui";
import { api } from "../../lib/api";
import { useFetch } from "../../lib/hooks";

export default function Dashboard() {
  const { data: s, error, loading, reload } = useFetch(() => api.get("/admin/stats"));
  if (loading && !s) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const max = Math.max(1, ...s.lookupsByDay.map((d) => d.count));
  const weekTotal = s.lookupsByDay.reduce((a, d) => a + d.count, 0);
  const day = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });

  return (
    <>
      <div className="admin-welcome">
        <div><div className="eyebrow">ADMIN DASHBOARD</div><h1>Seed management</h1><p>Overview of your batches and what people are scanning.</p></div>
        <Link className="btn btn-primary" to="/admin/batches/new"><Plus size={18} /> Add seed batch</Link>
      </div>

      <div className="admin-stats four">
        <div><span className="admin-stat-icon"><PackagePlus /></span><div><small>Total batches</small><strong>{s.total}</strong></div></div>
        <div><span className="admin-stat-icon green-icon"><BadgeCheck /></span><div><small>Verified</small><strong>{s.byStatus.Verified}</strong></div></div>
        <div><span className="admin-stat-icon amber-icon"><Clock3 /></span><div><small>Pending review</small><strong>{s.byStatus.Pending}</strong></div></div>
        <div><span className="admin-stat-icon red-icon"><XCircle /></span><div><small>Rejected</small><strong>{s.byStatus.Rejected}</strong></div></div>
      </div>

      <div className="attention-grid">
        <Link to="/admin/batches?expiry=expired" className={`attention ${s.expired ? "warn" : ""}`}><TimerOff size={20} /><div><strong>{s.expired}</strong><span>expired batch{s.expired === 1 ? "" : "es"}</span></div></Link>
        <Link to="/admin/batches?sort=expiry" className={`attention ${s.expiringSoon ? "caution" : ""}`}><AlertTriangle size={20} /><div><strong>{s.expiringSoon}</strong><span>expiring within 30 days</span></div></Link>
        <Link to="/admin/batches?sort=germ_low"className={`attention ${s.lowGermination ? "caution" : ""}`}><FlaskConical size={20} /><div><strong>{s.lowGermination}</strong><span>germination below 80%</span></div></Link>
      </div>

      <div className="dash-grid">
        <section className="dash-card">
          <div className="dash-head"><h2>Scans this week</h2><span>{weekTotal} lookups · {s.lookups30d} in 30 days</span></div>
          <div className="bars" role="img" aria-label="Lookups per day for the last 7 days">
            {s.lookupsByDay.map((d) => (
              <div className="bar-col" key={d.date} title={`${d.date}: ${d.count}`}>
                <span className="bar-value">{d.count}</span>
                <span className="bar" style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }} />
                <span className="bar-label">{day(d.date)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="dash-card">
          <div className="dash-head"><h2>Most scanned (30 days)</h2></div>
          {s.topBatches.length ? (
            <ol className="rank-list">
              {s.topBatches.map((b) => <li key={b.batchCode}><div><strong>{b.seedName}</strong><small>{b.batchCode}</small></div><span>{b.scans} scans</span></li>)}
            </ol>
          ) : <p className="muted small">No scans yet. They appear here as people use the scanner.</p>}
        </section>

        <section className="dash-card">
          <div className="dash-head"><h2><ShieldAlert size={16} /> Unknown codes scanned</h2><span>possible fakes or typos</span></div>
          {s.unknownCodes.length ? (
            <ul className="rank-list">
              {s.unknownCodes.map((u) => (
                <li key={u.batchCode}>
                  <div><strong className="mono">{u.batchCode}</strong><small>{u.scans} scan{u.scans === 1 ? "" : "s"}</small></div>
                  <Link className="btn btn-secondary btn-small" to={`/admin/batches/new?code=${encodeURIComponent(u.batchCode)}`}>Register</Link>
                </li>
              ))}
            </ul>
          ) : <p className="muted small">Every scanned code matched a batch.</p>}
        </section>

        <section className="dash-card">
          <div className="dash-head"><h2><ScanSearch size={16} /> Batches by crop</h2></div>
          {s.byCrop.length ? (
            <ul className="rank-list">{s.byCrop.map((c) => <li key={c.crop}><strong>{c.crop}</strong><span>{c.n}</span></li>)}</ul>
          ) : <p className="muted small">Add your first batch to get started.</p>}
        </section>
      </div>
    </>
  );
}
