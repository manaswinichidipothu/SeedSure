import http from "node:http";
import { HttpError, Router, makeContext, securityHeaders, serveStatic } from "./http.js";
import { RateLimiter } from "./security.js";
import { createRepo } from "./repo.js";
import { registerPublicRoutes } from "./routes/public.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerAdminRoutes } from "./routes/admin.js";

export function createApp({ db, config }) {
  const repo = createRepo(db);
  const deps = { db, repo, config };
  const router = new Router();
  registerPublicRoutes(router, deps);
  registerAuthRoutes(router, deps);
  registerAdminRoutes(router, deps);

  const apiLimiter = new RateLimiter({ windowMs: 60_000, max: 300 });
  const allowedHosts = new Set();
  if (config.publicUrl) { try { allowedHosts.add(new URL(config.publicUrl).host); } catch { /* ignore */ } }

  // CSRF defence-in-depth (on top of SameSite=Lax cookies + JSON-only bodies):
  // a browser always sends Origin on cross-site writes, so reject any that isn't us.
  function checkOrigin(ctx) {
    if (ctx.method === "GET" || ctx.method === "HEAD" || ctx.method === "OPTIONS") return;
    const origin = ctx.req.headers.origin;
    if (!origin) return; // non-browser clients (curl, tests)
    let host;
    try { host = new URL(origin).host; } catch { throw new HttpError(403, "Bad origin"); }
    if (host !== ctx.req.headers.host && !allowedHosts.has(host)) throw new HttpError(403, "Cross-site request blocked.");
  }

  const server = http.createServer(async (req, res) => {
    securityHeaders(res);
    const ctx = makeContext(req, res, config);
    try {
      if (ctx.pathname.startsWith("/api/")) {
        const { limited, retryAfter } = apiLimiter.hit(ctx.ip);
        if (limited) {
          res.setHeader("Retry-After", retryAfter);
          throw new HttpError(429, "Too many requests. Slow down a little.");
        }
        checkOrigin(ctx);
        if (!(await router.handle(ctx))) throw new HttpError(404, "API route not found.");
      } else {
        serveStatic(ctx, config.clientDist);
      }
    } catch (err) {
      if (res.headersSent) return res.destroy();
      if (err instanceof HttpError) {
        const body = { error: err.message };
        if (err.details) body.details = err.details;
        return ctx.json(err.status, body);
      }
      console.error("Unhandled error:", err);
      ctx.json(500, { error: "Something went wrong on the server." });
    }
  });

  server.on("close", () => apiLimiter.timer && clearInterval(apiLimiter.timer));
  return server;
}
