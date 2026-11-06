import { useState } from "react";
import { CircleCheck } from "lucide-react";
import { FieldError } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuth } from "../../auth";

export default function Account() {
  const { user } = useAuth();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors({}); setMessage(""); };

  async function submit(e) {
    e.preventDefault();
    if (form.newPassword !== form.confirm) { setErrors({ confirm: "The two new passwords don't match." }); return; }
    setBusy(true);
    try {
      await api.post("/auth/change-password", { currentPassword: form.currentPassword, newPassword: form.newPassword });
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
      setMessage("Password changed. Any other devices signed in as you have been signed out.");
    } catch (err) {
      setErrors(err.details || { currentPassword: err.message });
    } finally { setBusy(false); }
  }

  return (
    <>
      <div className="admin-welcome"><div><div className="eyebrow">ACCOUNT</div><h1>Your account</h1><p>Signed in as <strong>{user?.email}</strong></p></div></div>
      {message && <div className="success-notice"><CircleCheck size={17} />{message}</div>}
      <form className="admin-form narrow" onSubmit={submit}>
        <div className="form-head"><div><h2>Change password</h2><p>Use at least 10 characters.</p></div></div>
        <div className="form-grid one-col">
          <label>Current password<input type="password" autoComplete="current-password" value={form.currentPassword} onChange={set("currentPassword")} required /><FieldError>{errors.currentPassword}</FieldError></label>
          <label>New password<input type="password" autoComplete="new-password" minLength={10} value={form.newPassword} onChange={set("newPassword")} required /><FieldError>{errors.newPassword}</FieldError></label>
          <label>Confirm new password<input type="password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} required /><FieldError>{errors.confirm}</FieldError></label>
        </div>
        <div className="form-actions"><button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Update password"}</button></div>
      </form>
    </>
  );
}
