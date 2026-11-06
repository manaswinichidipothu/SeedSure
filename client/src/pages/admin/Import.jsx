import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CircleCheck, Download, FileUp, Info, Upload } from "lucide-react";
import { api } from "../../lib/api";
import { csvToBatches, templateCsv } from "../../lib/csv";

export default function Import() {
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState(null);
  const [check, setCheck] = useState(null);   // { create, update } from dry run
  const [rowErrors, setRowErrors] = useState([]);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);

  function reset() { setParsed(null); setCheck(null); setRowErrors([]); setError(""); setDone(null); setFileName(""); if (inputRef.current) inputRef.current.value = ""; }

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    reset();
    setFileName(file.name);
    if (file.size > 1_500_000) { setError("That file is too large (limit about 1.5 MB / 1000 rows)."); return; }
    const result = csvToBatches(await file.text());
    if (result.error) { setError(result.error); return; }
    if (result.missing.length) { setError(`Missing required column(s): ${result.missing.join(", ")}.`); return; }
    setParsed(result);
    setBusy(true);
    try { setCheck(await api.post("/admin/batches/bulk", { items: result.items, dryRun: true })); }
    catch (err) { setError(err.message); setRowErrors(err.details?.rows || []); }
    finally { setBusy(false); }
  }

  async function runImport() {
    setBusy(true); setError("");
    try { setDone(await api.post("/admin/batches/bulk", { items: parsed.items })); setCheck(null); }
    catch (err) { setError(err.message); setRowErrors(err.details?.rows || []); }
    finally { setBusy(false); }
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob(["﻿" + templateCsv()], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "seedsure-import-template.csv" });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="admin-welcome"><div><div className="eyebrow">BULK EDITING</div><h1>Import &amp; export</h1><p>Update many batches at once in Excel or Google Sheets, then upload the CSV.</p></div></div>

      <div className="two-col">
        <section className="dash-card">
          <div className="dash-head"><h2><Download size={16} /> Export</h2></div>
          <p className="muted small">Download every batch as CSV. Edit it in a spreadsheet and import it back: rows are matched by batch code.</p>
          <div className="stack-row"><a className="btn btn-primary btn-small" href="/api/admin/export.csv"><Download size={14} /> Download all batches (CSV)</a><button className="btn btn-secondary btn-small" onClick={downloadTemplate}>Blank template</button></div>
        </section>

        <section className="dash-card">
          <div className="dash-head"><h2><FileUp size={16} /> Import</h2></div>
          <p className="muted small">Existing batch codes are <strong>updated</strong>, new codes are <strong>added</strong>. Nothing is deleted. If any row has a problem, nothing is imported.</p>
          <label className="btn btn-secondary btn-small file-btn"><Upload size={14} /> Choose CSV file<input ref={inputRef} type="file" accept=".csv,text/csv" onChange={onFile} hidden /></label>
          {fileName && <span className="file-name">{fileName}</span>}
        </section>
      </div>

      {error && <div className="inline-error" role="alert"><Info size={17} />{error}</div>}
      {rowErrors.length > 0 && (
        <div className="admin-table-card"><div className="table-title"><div><h2>Fix these rows</h2><p>Row numbers count data rows, not the header.</p></div></div>
          <div className="table-scroll"><table><thead><tr><th>Row</th><th>Batch code</th><th>Problem</th></tr></thead>
            <tbody>{rowErrors.map((r) => <tr key={r.row}><td>{r.row}</td><td className="code-cell">{r.batchCode || "—"}</td><td>{Object.values(r.errors).join(" ")}</td></tr>)}</tbody></table></div></div>
      )}

      {parsed && !done && !rowErrors.length && !error && (
        <div className="admin-table-card">
          <div className="table-title"><div><h2>Ready to import</h2><p>{parsed.items.length} rows{check ? `: ${check.create} new, ${check.update} updates` : ""}</p></div>
            <button className="btn btn-primary btn-small" disabled={busy || !check} onClick={runImport}>{busy ? "Working…" : "Import now"}</button></div>
          {parsed.unknownHeaders.length > 0 && <div className="demo-notice" style={{ margin: 16 }}><Info size={16} />Ignored column(s): {parsed.unknownHeaders.join(", ")}</div>}
          <div className="table-scroll"><table><thead><tr><th>Code</th><th>Seed</th><th>Brand</th><th>Crop</th><th>Germ.</th><th>Status</th><th>Expiry</th></tr></thead>
            <tbody>{parsed.items.slice(0, 8).map((r, i) => <tr key={i}><td className="code-cell">{r.batchCode}</td><td>{r.seedName}</td><td>{r.brand}</td><td>{r.crop}</td><td>{r.germination}</td><td>{r.status || "Pending"}</td><td>{r.expiry}</td></tr>)}</tbody></table></div>
          {parsed.items.length > 8 && <p className="muted small" style={{ padding: "0 16px 14px" }}>…and {parsed.items.length - 8} more rows.</p>}
        </div>
      )}

      {done && (
        <div className="success-notice"><CircleCheck size={17} />Import complete: {done.created} added, {done.updated} updated. <Link to="/admin/batches" className="link-btn">View batches</Link><button onClick={reset} aria-label="Dismiss">×</button></div>
      )}
    </>
  );
}
