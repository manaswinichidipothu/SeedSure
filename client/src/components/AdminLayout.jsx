import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { Activity, FileUp, LayoutDashboard, LogOut, PackageSearch, QrCode, UserCog } from "lucide-react";
import { useAuth } from "../auth";
import { Loading, PageShell } from "./ui";

/** Wraps all /admin pages: redirects to the login page when signed out. */
export default function AdminLayout() {
  const { user, loading, logout } = useAuth();
  const location = useLocation();

  if (loading) return <PageShell><main className="inner-page"><Loading label="Checking your session…" /></main></PageShell>;
  if (!user) return <Navigate to="/admin/login" replace state={{ from: location.pathname + location.search }} />;

  const tab = ({ isActive }) => (isActive ? "admin-tab active" : "admin-tab");
  return (
    <PageShell>
      <main className="inner-page admin-page">
        <div className="admin-bar">
          <nav className="admin-tabs" aria-label="Admin sections">
            <NavLink end to="/admin" className={tab}><LayoutDashboard size={15} /> Dashboard</NavLink>
            <NavLink to="/admin/batches" className={tab}><PackageSearch size={15} /> Batches</NavLink>
            <NavLink to="/admin/import" className={tab}><FileUp size={15} /> Import / export</NavLink>
            <NavLink to="/admin/labels" className={tab}><QrCode size={15} /> QR labels</NavLink>
            <NavLink to="/admin/activity" className={tab}><Activity size={15} /> Activity</NavLink>
            <NavLink to="/admin/account" className={tab}><UserCog size={15} /> Account</NavLink>
          </nav>
          <div className="admin-user">
            <span>{user.email}</span>
            <button className="btn btn-secondary btn-small" onClick={logout}><LogOut size={14} /> Sign out</button>
          </div>
        </div>
        <Outlet />
      </main>
    </PageShell>
  );
}
