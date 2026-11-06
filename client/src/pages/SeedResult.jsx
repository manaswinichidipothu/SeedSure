import { Link, useParams, useSearchParams } from "react-router-dom";
import { AlertTriangle, CalendarDays, ChevronRight, FlaskConical, Info, MapPin, PackagePlus, ScanLine, Search, Sprout, WifiOff } from "lucide-react";
import { ExpiryBadge, Loading, PageShell, Status } from "../components/ui";
import { api } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { formatDate, germLabel } from "../lib/format";

const InfoRow = ({ label, value }) => <div className="info-row"><span>{label}</span><strong>{value || "Not provided"}</strong></div>;

export default function SeedResult() {
  const { batchCode } = useParams();
  const [params] = useSearchParams();
  const source = params.get("source") || "link";
  const { data, error, loading, reload } = useFetch(
    () => api.get(`/batches/${encodeURIComponent(batchCode)}?source=${encodeURIComponent(source)}`), [batchCode]);

  if (loading) return <PageShell><main className="inner-page"><Loading label="Looking up batch…" /></main></PageShell>;

  if (error?.status === 404) {
    return (
      <PageShell>
        <main className="inner-page not-found">
          <div className="empty-icon"><Search size={30} /></div>
          <h1>Batch not found</h1>
          <p>No record exists for <strong>{batchCode}</strong>. Check the code on the packet. If it is correct, this batch may not be registered, so treat the seed with caution.</p>
          <Link className="btn btn-primary" to="/scan">Try another code</Link>
        </main>
      </PageShell>
    );
  }
  if (error) {
    return (
      <PageShell>
        <main className="inner-page not-found">
          <div className="empty-icon"><WifiOff size={30} /></div>
          <h1>Couldn't load this batch</h1>
          <p>{error.message}</p>
          <button className="btn btn-primary" onClick={reload}>Try again</button>
        </main>
      </PageShell>
    );
  }

  const b = data.batch;
  return (
    <PageShell>
      <main className="inner-page">
        <div className="breadcrumb"><Link to="/">Home</Link><ChevronRight size={14} /><Link to="/search">Seed records</Link><ChevronRight size={14} /><span>{b.batchCode}</span></div>
        <div className="result-hero">
          <div className={`result-crop ${b.color}`}><span>{b.icon}</span></div>
          <div className="result-title">
            <div className="eyebrow">SEED BATCH PROFILE</div>
            <h1>{b.seedName}</h1>
            <p>{b.brand} <span className="bullet">•</span> {b.variety}</p>
            <div className="result-status"><Status status={b.status} /><ExpiryBadge batch={b} /><span className="batch-id">BATCH ID: {b.batchCode}</span></div>
          </div>
          <div className="result-germ">
            <span>Recorded germination</span>
            <strong>{germLabel(b.germination)}</strong>
            <div className="progress-track"><span style={{ width: `${b.germination ?? 0}%` }} /></div>
            <small>{b.germination === null ? "No germination value recorded" : "As recorded for this batch"}</small>
          </div>
        </div>

        {b.status === "Rejected" && <div className="warning-banner"><AlertTriangle size={20} /><span><strong>Attention: this batch is marked Rejected.</strong> Do not use this seed for planting. Contact the seller or your local agriculture office.</span></div>}
        {b.status === "Pending" && <div className="warning-banner pending-banner"><Info size={20} /><span><strong>This batch is still awaiting verification.</strong> Details may change once it has been checked.</span></div>}
        {b.expiryState === "expired" && <div className="warning-banner"><AlertTriangle size={20} /><span><strong>This batch is past its expiry date ({formatDate(b.expiry)}).</strong> Germination may be much lower than recorded.</span></div>}
        {b.expiryState === "expiring_soon" && <div className="warning-banner pending-banner"><Info size={20} /><span><strong>This batch expires on {formatDate(b.expiry)}.</strong> Sow it soon.</span></div>}

        <div className="result-grid">
          <section className="info-panel">
            <div className="panel-heading"><span className="panel-icon"><PackagePlus size={19} /></span><div><h2>Batch information</h2><p>Identification and date details</p></div></div>
            <div className="info-rows">
              <InfoRow label="Crop type" value={b.crop} />
              <InfoRow label="Variety" value={b.variety} />
              <InfoRow label="Packed on" value={b.packed ? formatDate(b.packed) : ""} />
              <InfoRow label="Expiry date" value={b.expiry ? formatDate(b.expiry) : ""} />
              <InfoRow label="Information status" value={<Status status={b.status} />} />
            </div>
          </section>
          <section className="info-panel">
            <div className="panel-heading"><span className="panel-icon"><Sprout size={19} /></span><div><h2>Growing guidance</h2><p>General information for this crop</p></div></div>
            <div className="guidance-item"><MapPin size={18} /><div><strong>Suitable soil</strong><p>{b.soil || "Not provided"}</p></div></div>
            <div className="guidance-item"><CalendarDays size={18} /><div><strong>Sowing season</strong><p>{b.season || "Not provided"}</p></div></div>
            <div className="guidance-item"><FlaskConical size={18} /><div><strong>Fertilizer guidance</strong><p>{b.fertilizer || "Not provided"}</p></div></div>
          </section>
          <section className="info-panel description-panel">
            <div className="panel-heading"><span className="panel-icon"><Info size={19} /></span><div><h2>About this seed</h2><p>Record description</p></div></div>
            <p>{b.description || "No description provided."}</p>
          </section>
        </div>

        <div className="disclaimer"><Info size={17} /><p><strong>Important:</strong> This information is provided as recorded by the batch administrator and is general guidance only. Confirm fertilizer use and sowing time with your local agriculture office.</p></div>
        <Link className="btn btn-primary" to="/scan"><ScanLine size={17} /> Look up another batch</Link>
      </main>
    </PageShell>
  );
}
