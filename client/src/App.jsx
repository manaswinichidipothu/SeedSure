import { Link, Route, Routes } from "react-router-dom";
import { PageShell } from "./components/ui";
import AdminLayout from "./components/AdminLayout";
import Home from "./pages/Home";
import Scan from "./pages/Scan";
import Search from "./pages/Search";
import SeedResult from "./pages/SeedResult";
import About from "./pages/About";
import Login from "./pages/Login";
import Dashboard from "./pages/admin/Dashboard";
import Batches from "./pages/admin/Batches";
import BatchForm from "./pages/admin/BatchForm";
import Import from "./pages/admin/Import";
import Labels from "./pages/admin/Labels";
import Activity from "./pages/admin/Activity";
import Account from "./pages/admin/Account";

function NotFound() {
  return (
    <PageShell>
      <main className="inner-page not-found"><h1>Page not found</h1><Link to="/" className="btn btn-primary">Back home</Link></main>
    </PageShell>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/scan" element={<Scan />} />
      <Route path="/search" element={<Search />} />
      <Route path="/about" element={<About />} />
      <Route path="/seed/:batchCode" element={<SeedResult />} />
      <Route path="/admin/login" element={<Login />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="batches" element={<Batches />} />
        <Route path="batches/new" element={<BatchForm />} />
        <Route path="batches/:id" element={<BatchForm />} />
        <Route path="import" element={<Import />} />
        <Route path="labels" element={<Labels />} />
        <Route path="activity" element={<Activity />} />
        <Route path="account" element={<Account />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
