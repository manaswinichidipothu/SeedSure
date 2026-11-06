import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { ArrowUpRight, CircleCheck, Pencil, Plus, QrCode, Search, Trash2 } from "lucide-react";
import { ErrorBox, ExpiryBadge, Loading } from "../../components/ui";
import { api, qs } from "../../lib/api";
import { useDebounced, useFetch } from "../../lib/hooks";
import { STATUSES, germLabel } from "../../lib/format";

const PAGE = 50;

export default function Batches() {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || "");
  const [crop, setCrop] = useState(params.get("crop") || "");
  const [status, setStatus] = useState(params.get("status") || "");
  const [sort, setSort] = useState(params.get("sort") || "updated");
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState(() => new Set());
  const [notice, setNotice] = useState(location.state?.notice || "");
  const [actionError, setActionError] = useState("");
  const q = useDebounced(query.trim(), 300);

  useEffect(() => setLimit(PAGE), [q, crop, status, sort]);
  // Keep the URL in sync so the page can be bookmarked or linked from the dashboard.
  const [onlyExpired, setOnlyExpired] = useState(params.get("expiry") === "expired");
  useEffect(() => {
    const next = {};
    if (q) next.q = q;
    if (crop) next.crop = crop;
    if (status) next.status = status;
    if (sort !== "updated") next.sort = sort;
    if (onlyExpired) next.expiry = "expired";
    setParams(next, { replace: true });
  }, [q, crop, status, sort, onlyExpired, setParams]);

  const crops = useFetch(() => api.get("/batches/crops"), []);
  const { data, error, loading, reload } = useFetch(
    () => api.get(`/admin/batches${qs({ q, crop, status, sort, limit })}`), [q, crop, status, sort, limit]);

  // The dashboard links here with ?expiry=expired: filter client-side on top of the loaded page.
  const items = useMemo(() => (data?.items || []).filter((b) => !onlyExpired || b.expiryState === "expired"), [data, onlyExpired]);

  async function changeStatus(b, next) {
    setActionError("");
    try { await api.patch(`/admin/batches/${b.id}/status`, { status: next }); setNotice(`${b.batchCode} marked ${next}.`); reload(); }
    catch (e) { setActionError(e.message); }
  }
  async function remove(b) {
    if (!window.confirm(`Delete ${b.seedName} (${b.batchCode})?\n\nPeople who scan its QR code will see "Batch not found". This cannot be undone.`)) return;
    setActionError("");
    try {
      await api.delete(`/admin/batches/${b.id}`);
      setSelected((s) => { const n = new Set(s); n.delete(b.batchCode); return n; });
      setNotice(`${b.batchCode} deleted.`);
      reload();
    } catch (e) { setActionError(e.message); }
  }
  const toggle = (code) => setSelected((s) => { const n = new Set(s); n.has(code) ? n.delete(code) : n.add(code); return n; });
  const allOnPage = items.length > 0 && items.every((b) => selected.has(b.batchCode));
  const toggleAll = () => setSelected(allOnPage ? new Set() : new Set(items.map((b) => b.batchCode)));

  return (
    <>
      <div className="admin-welcome">
        <div><div className="eyebrow">BATCH RECORDS</div><h1>Manage batches</h1><p>Add, edit, verify or remove the records people see when they scan.</p></div>
        <Link className="btn btn-primary" to="/admin/batches/new"><Plus size={18} /> Add seed batch</Link>
      </div>

      {notice && <div className="success-notice"><CircleCheck size={17} />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}
      {actionError && <div className="inline-error" role="alert">{actionError}</div>}

      <div className="filter-bar wrap">
        <div className="search-field"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, brand, variety or code…" aria-label="Search batches" /></div>
        <select value={crop} onChange={(e) => setCrop(e.target.value)} aria-label="Filter by crop"><option value="">All crops</option>{(crops.data?.crops || []).map((c) => <option key={c}>{c}</option>)}</select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status"><option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">
          <option value="updated">Recently updated</option><option value="newest">Newest added</option><option value="name">Name A–Z</option>
          <option value="code">Batch code</option><option value="expiry">Expiry (soonest)</option><option value="germination">Germination (highest)</option><option value="germ_low">Germination (lowest)</option>
        </select>
      </div>
      {onlyExpired && <div className="demo-notice">Showing expired batches only. <button className="link-btn" onClick={() => setOnlyExpired(false)}>Show all</button></div>}

      <div className="admin-table-card">
        <div className="table-title">
          <div><h2>{data ? `${onlyExpired ? items.length : data.total} record${(onlyExpired ? items.length : data.total) === 1 ? "" : "s"}` : "Records"}</h2><p>{selected.size ? `${selected.size} selected` : "Change a status straight from the table."}</p></div>
          {selected.size > 0 && <Link className="btn btn-secondary btn-small" to={`/admin/labels?codes=${encodeURIComponent([...selected].join(","))}`}><QrCode size={14} /> Print {selected.size} QR label{selected.size === 1 ? "" : "s"}</Link>}
        </div>
        {error && <div style={{ padding: 16 }}><ErrorBox error={error} onRetry={reload} /></div>}
        {loading && !data && <Loading />}
        {data && (
          <div className="table-scroll">
            <table>
              <thead><tr>
                <th className="check-col"><input type="checkbox" checked={allOnPage} onChange={toggleAll} aria-label="Select all" /></th>
                <th>Seed / Brand</th><th>Batch code</th><th>Germination</th><th>Expiry</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {items.map((b) => (
                  <tr key={b.id}>
                    <td className="check-col"><input type="checkbox" checked={selected.has(b.batchCode)} onChange={() => toggle(b.batchCode)} aria-label={`Select ${b.batchCode}`} /></td>
                    <td><strong>{b.icon} {b.seedName}</strong><small>{b.brand} · {b.crop}</small></td>
                    <td className="code-cell">{b.batchCode}</td>
                    <td>{germLabel(b.germination)}</td>
                    <td><ExpiryBadge batch={b} showDate /></td>
                    <td>
                      <select className={`status-select ${b.status.toLowerCase()}`} value={b.status} onChange={(e) => changeStatus(b, e.target.value)} aria-label={`Status for ${b.batchCode}`}>
                        {STATUSES.map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>
                      <div className="table-actions">
                        <Link title="Edit" to={`/admin/batches/${b.id}`}><Pencil size={16} /></Link>
                        <Link title="QR label" to={`/admin/labels?codes=${encodeURIComponent(b.batchCode)}`}><QrCode size={16} /></Link>
                        <Link title="View public page" to={`/seed/${encodeURIComponent(b.batchCode)}`} target="_blank"><ArrowUpRight size={16} /></Link>
                        <button title="Delete" onClick={() => remove(b)}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!items.length && <tr><td colSpan={7} className="empty-row">No batches match. <Link to="/admin/batches/new">Add one</Link> or <Link to="/admin/import">import a CSV</Link>.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {data && data.items.length < data.total && <div className="load-more"><button className="btn btn-secondary btn-small" onClick={() => setLimit((l) => l + PAGE)}>Show more</button></div>}
      </div>
    </>
  );
}
