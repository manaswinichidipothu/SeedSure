import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, "..");

// Load server/.env if present (Node 21.7+). Real environment variables win.
try { process.loadEnvFile(path.join(ROOT, ".env")); } catch { /* no .env file: fine */ }

const DEFAULT_ADMIN_PASSWORD = "ChangeMe!12345";

export function loadConfig(env = process.env) {
  const isProd = env.NODE_ENV === "production";
  const flag = (v, fallback) => (v === undefined || v === "" ? fallback : v === "1" || v === "true");

  const config = {
    isProd,
    port: Number(env.PORT || 4000),
    host: env.HOST || "0.0.0.0",
    dbPath: env.DB_PATH === ":memory:" ? ":memory:" : env.DB_PATH ? path.resolve(ROOT, env.DB_PATH) : path.join(ROOT, "data", "seedsure.db"),
    jwtSecret: env.JWT_SECRET || (isProd ? "" : "dev-only-insecure-secret-change-me-please"),
    tokenTtlSeconds: 60 * 60 * 8, // admin session length: 8 hours
    cookieSecure: flag(env.COOKIE_SECURE, isProd),
    trustProxy: flag(env.TRUST_PROXY, false),
    publicUrl: (env.PUBLIC_URL || "").replace(/\/+$/, ""),
    clientDist: path.resolve(ROOT, "..", "client", "dist"),
    adminEmail: (env.ADMIN_EMAIL || "").trim(),
    adminPassword: env.ADMIN_PASSWORD || "",
    adminName: env.ADMIN_NAME || "Admin",
    seedSample: flag(env.SEED_SAMPLE_DATA, !isProd),
  };

  if (isProd) {
    if (config.jwtSecret.length < 32) {
      throw new Error("JWT_SECRET must be set to at least 32 characters when NODE_ENV=production.");
    }
    if (config.adminPassword === DEFAULT_ADMIN_PASSWORD) {
      throw new Error("Refusing to start in production with the default ADMIN_PASSWORD. Set a strong one.");
    }
  }
  return config;
}

export const config = loadConfig();
