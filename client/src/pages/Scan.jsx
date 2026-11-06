import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Info, ScanLine, Search } from "lucide-react";
import { PageShell } from "../components/ui";
import QrScanner from "../components/QrScanner";
import { parseQrPayload } from "../lib/qr";

export default function Scan() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  // Shared by the camera, photo upload and manual form. Returns true when the text was a batch code.
  function handleText(text, source) {
    const batchCode = parseQrPayload(text);
    if (!batchCode) {
      setMessage("That QR code isn't a SeedSure batch code. Keep scanning or type the code printed on the packet.");
      return false;
    }
    navigate(`/seed/${encodeURIComponent(batchCode)}?source=${source}`);
    return true;
  }

  function lookup(e) {
    e.preventDefault();
    setMessage("");
    if (!handleText(code, "manual")) setMessage("Enter a valid batch code (letters, numbers, dashes), for example GF-RICE-2401.");
  }

  return (
    <PageShell>
      <main className="inner-page">
        <div className="page-title">
          <div className="eyebrow">QR BATCH LOOKUP</div>
          <h1>Scan a seed packet</h1>
          <p>Use your camera to scan the QR code on the packet, or enter the batch code by hand.</p>
        </div>
        <div className="scan-layout">
          <section className="scan-panel">
            <QrScanner onDetected={handleText} />
            <div className="scan-or"><span>or enter the code manually</span></div>
            <form onSubmit={lookup} className="lookup-form">
              <label htmlFor="batchCode">Batch code or QR content</label>
              <div className="input-with-icon">
                <Search size={18} />
                <input id="batchCode" value={code} onChange={(e) => { setCode(e.target.value); setMessage(""); }} placeholder="e.g. GF-RICE-2401" autoComplete="off" autoCapitalize="characters" required />
              </div>
              <button className="btn btn-primary full-btn" type="submit">Find batch <ArrowRight size={17} /></button>
            </form>
            {message && <div className="inline-error" role="alert"><Info size={17} />{message}</div>}
          </section>
          <aside className="scan-help">
            <div className="help-illustration"><div className="qr-frame"><ScanLine size={78} strokeWidth={1.1} /></div></div>
            <h3>Tips for a quick scan</h3>
            <ol>
              <li><span>1</span>Allow camera access when your browser asks.</li>
              <li><span>2</span>Hold the packet steady with the whole QR code inside the square.</li>
              <li><span>3</span>Good light helps. If the camera won't start, upload a photo of the code.</li>
            </ol>
            <p className="small-note"><Info size={15} /> If a code isn't found, check it against the packet. An unknown code may mean a mistyped or unregistered batch.</p>
          </aside>
        </div>
      </main>
    </PageShell>
  );
}
