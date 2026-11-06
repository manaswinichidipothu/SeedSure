import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Info, LockKeyhole } from "lucide-react";
import { PageShell, Loading } from "../components/ui";
import { useAuth } from "../auth";

export default function Login() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/admin";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <PageShell><main className="inner-page"><Loading /></main></PageShell>;
  if (user) return <Navigate to={from} replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <main className="inner-page login-page">
        <section className="scan-panel login-card">
          <div className="scan-panel-icon"><LockKeyhole size={27} /></div>
          <h2>Admin sign in</h2>
          <p className="muted">Manage seed batches, QR labels and scan activity.</p>
          <form onSubmit={submit} className="lookup-form">
            <label htmlFor="email">Email</label>
            <div className="input-with-icon"><input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></div>
            <label htmlFor="password">Password</label>
            <div className="input-with-icon"><input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
            <button className="btn btn-primary full-btn" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          </form>
          {error && <div className="inline-error" role="alert"><Info size={17} />{error}</div>}
        </section>
      </main>
    </PageShell>
  );
}
