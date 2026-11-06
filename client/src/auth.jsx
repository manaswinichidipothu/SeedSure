import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./lib/api";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  // undefined = still checking the session, null = signed out, object = signed in
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    api.get("/auth/me").then((r) => setUser(r.user)).catch(() => setUser(null));
    const onExpired = () => setUser(null);
    window.addEventListener("seedsure:unauthorized", onExpired);
    return () => window.removeEventListener("seedsure:unauthorized", onExpired);
  }, []);

  const login = useCallback(async (email, password) => {
    const r = await api.post("/auth/login", { email, password });
    setUser(r.user);
  }, []);

  const logout = useCallback(async () => {
    try { await api.post("/auth/logout"); } finally { setUser(null); }
  }, []);

  const value = useMemo(() => ({ user, loading: user === undefined, login, logout }), [user, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
