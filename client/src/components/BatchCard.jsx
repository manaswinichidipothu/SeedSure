import { Link } from "react-router-dom";
import { ArrowRight, FlaskConical, ScanLine } from "lucide-react";
import { ExpiryBadge, Status } from "./ui";
import { germLabel } from "../lib/format";

export default function BatchCard({ batch }) {
  return (
    <article className="batch-card">
      <div className={`crop-art ${batch.color || "green"}`}>
        <span className="crop-emoji">{batch.icon || "🌱"}</span>
        <span className="crop-tag">{batch.crop}</span>
      </div>
      <div className="batch-body">
        <div className="batch-card-top"><span className="brand-name">{batch.brand}</span><Status status={batch.status} /></div>
        <h3>{batch.seedName}</h3>
        <p className="variety">{batch.variety}</p>
        <div className="batch-meta">
          <span><FlaskConical size={15} />{germLabel(batch.germination)} germination</span>
          <span><ScanLine size={15} />{batch.batchCode}</span>
        </div>
        {batch.expiryState !== "valid" && batch.expiryState !== "none" && <div style={{ marginBottom: 10 }}><ExpiryBadge batch={batch} /></div>}
        <Link to={`/seed/${encodeURIComponent(batch.batchCode)}`} className="card-link">View batch details <ArrowRight size={16} /></Link>
      </div>
    </article>
  );
}
