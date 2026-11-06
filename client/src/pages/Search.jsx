import { useEffect, useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { PageShell, ErrorBox, Loading } from "../components/ui";
import BatchCard from "../components/BatchCard";
import { api, qs } from "../lib/api";
import { useDebounced, useFetch } from "../lib/hooks";
import { STATUSES } from "../lib/format";

const PAGE = 24;

export default function Search() {
  const [query, setQuery] = useState("");
  const [crop, setCrop] = useState("");
  const [status, setStatus] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const q = useDebounced(query.trim(), 300);

  useEffect(() => setLimit(PAGE), [q, crop, status]);

  const crops = useFetch(() => api.get("/batches/crops"), []);
  const { data, error, loading, reload } = useFetch(
    () => api.get(`/batches${qs({ q, crop, status, limit })}`), [q, crop, status, limit]);

  const clear = () => { setQuery(""); setCrop(""); setStatus(""); };
  return (
    <PageShell>
      <main className="inner-page">
        <div className="page-title"><div className="eyebrow">SEED DIRECTORY</div><h1>Explore seed records</h1><p>Search by crop, brand, variety, or batch code.</p></div>
        <div className="filter-bar">
          <div className="search-field"><SearchIcon size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search seed or batch..." aria-label="Search" /></div>
          <select value={crop} onChange={(e) => setCrop(e.target.value)} aria-label="Filter by crop">
            <option value="">All crops</option>
            {(crops.data?.crops || []).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>

        {error && <ErrorBox error={error} onRetry={reload} />}
        {!data && loading && <Loading />}
        {data && (
          <>
            <div className="search-results-head"><span><strong>{data.total}</strong> records found</span></div>
            {data.items.length ? (
              <>
                <div className="batch-grid">{data.items.map((b) => <BatchCard key={b.id} batch={b} />)}</div>
                {data.items.length < data.total && (
                  <div className="load-more"><button className="btn btn-secondary" disabled={loading} onClick={() => setLimit((l) => l + PAGE)}>{loading ? "Loading…" : "Show more"}</button></div>
                )}
              </>
            ) : (
              <div className="empty-state"><SearchIcon size={30} /><h3>No matching records</h3><p>Try another keyword or clear your filters.</p><button className="btn btn-secondary" onClick={clear}>Clear filters</button></div>
            )}
          </>
        )}
      </main>
    </PageShell>
  );
}
