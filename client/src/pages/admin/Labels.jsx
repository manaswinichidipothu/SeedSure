import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { AlertTriangle, Download, Printer } from "lucide-react";
import { ErrorBox, Loading } from "../../components/ui";
import { api } from "../../lib/api";
import { useFetch } from "../../lib/hooks";
import { seedUrl } from "../../lib/qr";

const STORE = "seedsure-public-url";
const isLocal = (u) => /^(https?:\/\/)?(localhost|127\.|0\.0\.0\.0|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(u.trim());
const readStored = () => { try { return localStorage.getItem(STORE) || ""; } catch { return ""; } };

export default function Labels() {
  const [params] = useSearchParams();
  const fromUrl = useMemo(() => new Set((params.get("codes") || "").split(",").map((s) => s.trim()).filter(Boolean)), [params]);
  const [selected, setSelected] = useState(fromUrl);
  const [baseUrl, setBaseUrl] = useState(readStored);
  const touched = useRef(Boolean(readStored()));
  const sheetRef = useRef(null);

  const config = useFetch(() => api.get("/config"));
  const list = useFetch(() => api.get("/admin/batches?limit=200&sort=code"));

  // Default the public URL to the server's PUBLIC_URL, else the current site.
  useEffect(() => {
    if (touched.current || !config.data) return;
    setBaseUrl(config.data.publicUrl || window.location.origin);
  }, [config.data]);

  const batches = list.data?.items || [];
  const chosen = batches.filter((b) => selected.has(b.batchCode));
  const toggle = (code) => setSelected((s) => { const n = new Set(s); n.has(code) ? n.delete(code) : n.add(code); return n; });

  function changeBase(v) {
    touched.current = true;
    setBaseUrl(v);
    try { localStorage.setItem(STORE, v); } catch { /* storage unavailable: fine */ }
  }

  function downloadSvg(code) {
    const svg = sheetRef.current?.querySelector(`[data-code="${CSS.escape(code)}"] svg`);
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${code}-qr.svg` });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="admin-welcome no-print"><div><div className="eyebrow">PACKET LABELS</div><h1>QR labels</h1><p>Print a QR code for each batch and stick it on the packet. Scanning it opens the batch page.</p></div>
        <button className="btn btn-primary" disabled={!chosen.length} onClick={() => window.print()}><Printer size={17} /> Print {chosen.length || ""} label{chosen.length === 1 ? "" : "s"}</button></div>

      <section className="dash-card no-print">
        <label className="url-field">Public website address (encoded in every QR code)
          <input value={baseUrl} onChange={(e) => changeBase(e.target.value)} placeholder="https://seedsure.yourdomain.com" inputMode="url" />
        </label>
        {baseUrl && isLocal(baseUrl) && <div className="warning-banner pending-banner" style={{ marginTop: 12 }}><AlertTriangle size={18} /><span><strong>This address only works on your own network.</strong> Farmers' phones can't open it. Set your real public domain before printing labels you'll put on packets.</span></div>}
      </section>

      <div className="labels-layout">
        <aside className="dash-card no-print label-picker">
          <div className="dash-head"><h2>Choose batches</h2><span>{chosen.length} selected</span></div>
          {list.loading && !list.data && <Loading />}
          {list.error && <ErrorBox error={list.error} onRetry={list.reload} />}
          <div className="picker-actions"><button className="link-btn" onClick={() => setSelected(new Set(batches.map((b) => b.batchCode)))}>Select all</button><button className="link-btn" onClick={() => setSelected(new Set())}>Clear</button></div>
          <ul className="pick-list">
            {batches.map((b) => (
              <li key={b.id}><label><input type="checkbox" checked={selected.has(b.batchCode)} onChange={() => toggle(b.batchCode)} /><span><strong>{b.icon} {b.seedName}</strong><small>{b.batchCode}</small></span></label></li>
            ))}
          </ul>
        </aside>

        <div className="label-sheet" ref={sheetRef}>
          {!chosen.length && <div className="empty-state no-print"><Download size={30} /><h3>No labels yet</h3><p>Tick one or more batches to preview their labels.</p></div>}
          {baseUrl && chosen.map((b) => (
            <figure className="qr-label" key={b.id} data-code={b.batchCode}>
              <QRCodeSVG value={seedUrl(baseUrl, b.batchCode)} size={132} level="M" marginSize={2} />
              <figcaption>
                <strong>{b.seedName}</strong>
                <span>{b.brand}</span>
                <code>{b.batchCode}</code>
              </figcaption>
              <button className="link-btn no-print" onClick={() => downloadSvg(b.batchCode)}>Download SVG</button>
            </figure>
          ))}
        </div>
      </div>
    </>
  );
}
