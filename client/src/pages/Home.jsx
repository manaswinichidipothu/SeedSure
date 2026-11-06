import { Link } from "react-router-dom";
import { ArrowRight, ChevronRight, CircleCheck, FlaskConical, ScanLine, ScanQrCode, ShieldCheck, Sprout } from "lucide-react";
import { PageShell, ErrorBox, Loading } from "../components/ui";
import BatchCard from "../components/BatchCard";
import { api } from "../lib/api";
import { useFetch } from "../lib/hooks";

export default function Home() {
  const { data, error, loading, reload } = useFetch(async () => {
    const [featured, verified] = await Promise.all([api.get("/batches?limit=3"), api.get("/batches?status=Verified&limit=1")]);
    return { featured: featured.items, total: featured.total, verified: verified.total };
  });
  const pad = (n) => String(n ?? 0).padStart(2, "0");

  return (
    <PageShell>
      <main>
        <section className="hero">
          <div className="hero-content">
            <div className="eyebrow"><span className="eyebrow-dot" /> SMART AGRICULTURE · SEED TRANSPARENCY</div>
            <h1>Better seeds.<br /><em>Stronger harvests.</em></h1>
            <p className="hero-copy">Scan a seed packet. Understand its batch details. Make more informed growing decisions with seed information in one simple place.</p>
            <div className="hero-actions">
              <Link className="btn btn-primary" to="/scan"><ScanLine size={18} /> Scan a seed packet <ArrowRight size={17} /></Link>
              <Link className="btn btn-ghost" to="/search">Explore seed records <ChevronRight size={17} /></Link>
            </div>
            <div className="hero-proof"><span className="proof-avatars"><i>🌾</i><i>🌽</i><i>🍅</i></span><span><strong>One simple lookup</strong><br />Batch details and growing guidance</span></div>
          </div>
          <div className="hero-visual">
            <div className="visual-orbit orbit-one"></div><div className="visual-orbit orbit-two"></div>
            <div className="sun-disc"></div>
            <div className="plant-emoji">🌱</div>
            <div className="floating-card floating-top"><span className="floating-icon"><ShieldCheck size={19} /></span><span><strong>Batch information</strong><small>Organized in one place</small></span><CircleCheck className="floating-check" size={18} /></div>
            <div className="floating-card floating-bottom"><span className="mini-progress"><span /></span><span><strong>Germination rate</strong><small>Recorded for every batch</small></span></div>
            <div className="visual-caption"><span>01</span> TRACE · LEARN · GROW</div>
          </div>
          <div className="hero-bottom-label"><span>SEED INFORMATION, MADE ACCESSIBLE</span><span>SCROLL TO EXPLORE ↓</span></div>
        </section>

        <section className="stats-strip">
          <div><strong>{data ? pad(data.total) : "--"}</strong><span>Seed batches</span></div>
          <div><strong>{data ? pad(data.verified) : "--"}</strong><span>Marked verified</span></div>
          <div><strong>QR</strong><span>Quick batch lookup</span></div>
          <div className="stats-note">Status labels reflect what the seed company or administrator has recorded.</div>
        </section>

        <section className="section section-how">
          <div className="section-intro"><div className="eyebrow">HOW IT WORKS</div><h2>From packet to <em>peace of mind.</em></h2><p>A straightforward way to find available seed and batch information.</p></div>
          <div className="steps-grid">
            <article className="step-card"><div className="step-number">01</div><div className="step-icon"><ScanQrCode size={24} /></div><h3>Scan the QR code</h3><p>Point your phone camera at the QR code on a seed packet, or type its batch code.</p><span className="step-line" /></article>
            <article className="step-card"><div className="step-number">02</div><div className="step-icon"><FlaskConical size={24} /></div><h3>Review batch details</h3><p>View the recorded germination rate, dates, and current information status.</p><span className="step-line" /></article>
            <article className="step-card"><div className="step-number">03</div><div className="step-icon"><Sprout size={24} /></div><h3>Learn how to grow</h3><p>Explore general soil, sowing season, and fertilizer guidance in the record.</p><span className="step-line" /></article>
          </div>
        </section>

        <section className="section featured-section">
          <div className="section-heading"><div><div className="eyebrow">EXPLORE THE DATABASE</div><h2>Latest seed batches</h2></div><Link to="/search" className="text-link">View all batches <ArrowRight size={16} /></Link></div>
          {loading && <Loading />}
          {error && <ErrorBox error={error} onRetry={reload} />}
          {data && (data.featured.length
            ? <div className="batch-grid">{data.featured.map((b) => <BatchCard key={b.id} batch={b} />)}</div>
            : <p className="muted">No batches have been added yet.</p>)}
        </section>

        <section className="cta-band"><div className="cta-leaf"><Sprout size={30} /></div><div><div className="eyebrow">START WITH A SCAN</div><h2>Every seed has a story.</h2><p>Make batch information easier to find, understand, and use.</p></div><Link className="btn btn-light" to="/scan">Open the QR scanner <ArrowRight size={17} /></Link></section>
      </main>
    </PageShell>
  );
}
