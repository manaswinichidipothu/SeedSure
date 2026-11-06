import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowUpRight, QrCode, Trash2, X } from "lucide-react";
import { ErrorBox, FieldError, Loading } from "../../components/ui";
import { api } from "../../lib/api";
import { useFetch } from "../../lib/hooks";
import { COLORS, ICONS, STATUSES } from "../../lib/format";

const today = () => new Date().toISOString().slice(0, 10);
const inAYear = () => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10); };
const EMPTY = {
  seedName: "", brand: "", crop: "", variety: "", batchCode: "", germination: "", status: "Pending",
  packed: today(), expiry: inAYear(), soil: "", season: "", fertilizer: "", description: "", icon: "🌱", color: "green",
};

export default function BatchForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ ...EMPTY, batchCode: params.get("code") || "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const existing = useFetch(() => (isEdit ? api.get(`/admin/batches/${id}`) : Promise.resolve(null)), [id]);
  const crops = useFetch(() => api.get("/batches/crops"), []);

  useEffect(() => {
    const b = existing.data?.batch;
    if (b) setForm(Object.fromEntries(Object.keys(EMPTY).map((k) => [k, b[k] ?? ""])));
  }, [existing.data]);

  const set = (key) => (e) => { setForm((f) => ({ ...f, [key]: e.target.value })); setErrors((er) => ({ ...er, [key]: undefined })); };

  async function save(e) {
    e.preventDefault();
    setBusy(true); setErrors({}); setFormError("");
    try {
      const payload = { ...form, germination: form.germination === "" ? null : Number(form.germination) };
      const r = isEdit ? await api.put(`/admin/batches/${id}`, payload) : await api.post("/admin/batches", payload);
      navigate("/admin/batches", { state: { notice: isEdit ? `${r.batch.batchCode} updated.` : `${r.batch.batchCode} added. Print its QR label from the Labels tab.` } });
    } catch (err) {
      if (err.details) setErrors(err.details);
      setFormError(err.message);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!window.confirm(`Delete ${form.seedName} (${form.batchCode})? This cannot be undone.`)) return;
    try { await api.delete(`/admin/batches/${id}`); navigate("/admin/batches", { state: { notice: `${form.batchCode} deleted.` } }); }
    catch (err) { setFormError(err.message); }
  }

  if (isEdit && existing.loading) return <Loading />;
  if (isEdit && existing.error) return <ErrorBox error={existing.error} onRetry={existing.reload} />;

  const text = (key, label, extra = {}) => (
    <label className={extra.wide ? "wide-field" : ""}>{label}
      <input value={form[key] ?? ""} onChange={set(key)} {...extra.input} />
      <FieldError>{errors[key]}</FieldError>
    </label>
  );
  const area = (key, label) => (
    <label className="wide-field">{label}
      <textarea rows={2} value={form[key] ?? ""} onChange={set(key)} />
      <FieldError>{errors[key]}</FieldError>
    </label>
  );

  return (
    <>
      <div className="admin-welcome">
        <div><div className="eyebrow">{isEdit ? "EDIT BATCH" : "NEW BATCH"}</div><h1>{isEdit ? form.seedName || "Edit batch" : "Add a seed batch"}</h1><p>Fields marked * are required. Changes go live as soon as you save.</p></div>
        {isEdit && <div className="head-actions">
          <Link className="btn btn-secondary btn-small" to={`/admin/labels?codes=${encodeURIComponent(form.batchCode)}`}><QrCode size={14} /> QR label</Link>
          <Link className="btn btn-secondary btn-small" to={`/seed/${encodeURIComponent(form.batchCode)}`} target="_blank"><ArrowUpRight size={14} /> Public page</Link>
        </div>}
      </div>
      {formError && <div className="inline-error" role="alert">{formError}</div>}

      <form className="admin-form" onSubmit={save} noValidate>
        <div className="form-head"><div><h2>Batch details</h2><p>Identification, quality and dates</p></div><Link className="close-form" to="/admin/batches" aria-label="Cancel"><X /></Link></div>
        <div className="form-grid">
          {text("seedName", "Seed name *")}
          {text("brand", "Brand *")}
          <label>Crop type *
            <input list="crop-options" value={form.crop} onChange={set("crop")} />
            <datalist id="crop-options">{(crops.data?.crops || []).map((c) => <option key={c} value={c} />)}</datalist>
            <FieldError>{errors.crop}</FieldError>
          </label>
          {text("variety", "Variety")}
          {text("batchCode", "Batch code *", { input: { placeholder: "e.g. GF-RICE-2401", autoCapitalize: "characters" } })}
          {text("germination", "Germination (%)", { input: { type: "number", min: 0, max: 100, step: 1, placeholder: "0–100" } })}
          {text("packed", "Packed date", { input: { type: "date" } })}
          {text("expiry", "Expiry date", { input: { type: "date" } })}
          <label>Status
            <select value={form.status} onChange={set("status")}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
            <FieldError>{errors.status}</FieldError>
          </label>
          {area("soil", "Suitable soil")}
          {area("season", "Sowing season")}
          {area("fertilizer", "Fertilizer guidance")}
          {area("description", "Description")}

          <div className="wide-field picker">
            <span className="picker-label">Icon</span>
            <div className="chip-row">{ICONS.map((ic) => <button type="button" key={ic} className={`chip ${form.icon === ic ? "on" : ""}`} onClick={() => setForm((f) => ({ ...f, icon: ic }))} aria-label={`Icon ${ic}`}>{ic}</button>)}</div>
            <FieldError>{errors.icon}</FieldError>
          </div>
          <div className="wide-field picker">
            <span className="picker-label">Card colour</span>
            <div className="chip-row">{COLORS.map((c) => <button type="button" key={c} className={`swatch ${c} ${form.color === c ? "on" : ""}`} onClick={() => setForm((f) => ({ ...f, color: c }))} aria-label={c} title={c} />)}</div>
          </div>
        </div>
        <div className="form-actions">
          {isEdit && <button type="button" className="btn btn-danger btn-small push-left" onClick={remove}><Trash2 size={14} /> Delete</button>}
          <Link className="btn btn-secondary" to="/admin/batches">Cancel</Link>
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Saving…" : isEdit ? "Save changes" : "Add batch"}</button>
        </div>
      </form>
    </>
  );
}
