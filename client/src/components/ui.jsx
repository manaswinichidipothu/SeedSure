import { Link, NavLink } from "react-router-dom";
import { useState } from "react";
import {
  Sprout, Menu, X, CircleCheck, AlertTriangle, Clock3, Info, LayoutDashboard, LoaderCircle, TimerOff, Hourglass,
} from "lucide-react";
import { formatDate } from "../lib/format";

export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="header">
      <div className="nav-wrap">
        <Link to="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-mark"><Sprout size={23} /></span>
          <span>seed<span className="brand-light">sure</span><small>SEED QUALITY TRACKER</small></span>
        </Link>
        <button className="mobile-menu" onClick={() => setOpen(!open)} aria-label="Toggle menu">{open ? <X /> : <Menu />}</button>
        <nav className={open ? "nav-links open" : "nav-links"} onClick={() => setOpen(false)}>
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/scan">Scan QR</NavLink>
          <NavLink to="/search">Explore seeds</NavLink>
          <NavLink to="/about">About</NavLink>
          <NavLink to="/admin" className="nav-admin"><LayoutDashboard size={16} /> Admin</NavLink>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <Link to="/" className="footer-brand"><Sprout size={19} /> SeedSure</Link>
        <span>Making seed information easier to access.</span>
        <span>© {new Date().getFullYear()} SeedSure</span>
      </div>
    </footer>
  );
}

export function PageShell({ children }) {
  return <><Header />{children}<Footer /></>;
}

export function Status({ status }) {
  const cls = status === "Verified" ? "verified" : status === "Rejected" ? "rejected" : "pending";
  const Icon = status === "Verified" ? CircleCheck : status === "Rejected" ? AlertTriangle : Clock3;
  return <span className={`status ${cls}`}><Icon size={14} />{status}</span>;
}

/** Shows nothing for valid batches; a coloured pill for expired / expiring soon. */
export function ExpiryBadge({ batch, showDate = false }) {
  if (batch.expiryState === "expired") {
    return <span className="status rejected"><TimerOff size={13} />Expired{showDate ? ` ${formatDate(batch.expiry)}` : ""}</span>;
  }
  if (batch.expiryState === "expiring_soon") {
    return <span className="status pending"><Hourglass size={13} />{batch.daysToExpiry === 0 ? "Expires today" : `Expires in ${batch.daysToExpiry}d`}</span>;
  }
  return showDate ? <span>{formatDate(batch.expiry)}</span> : null;
}

export function Loading({ label = "Loading…" }) {
  return <div className="page-loading" role="status"><LoaderCircle className="spin" size={22} />{label}</div>;
}

export function ErrorBox({ error, onRetry }) {
  return (
    <div className="inline-error" role="alert">
      <Info size={17} />
      <span>{error?.message || "Something went wrong."} {onRetry && <button className="link-btn" onClick={onRetry}>Try again</button>}</span>
    </div>
  );
}

export function FieldError({ children }) {
  return children ? <small className="field-error">{children}</small> : null;
}
