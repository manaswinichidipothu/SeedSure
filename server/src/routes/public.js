import { HttpError } from "../http.js";
import { BATCH_CODE_RE, STATUSES } from "../validation.js";
import { hashIp } from "../security.js";

const SOURCES = new Set(["camera", "image", "manual", "link", "web"]);

export function registerPublicRoutes(router, { repo, config }) {
  router.get("/api/health", (ctx) => ctx.json(200, { ok: true, time: new Date().toISOString() }));

  router.get("/api/config", (ctx) => ctx.json(200, { publicUrl: config.publicUrl }));

  // Directory search. Public: anyone can see batch records.
  router.get("/api/batches", (ctx) => {
    const { q = "", crop = "", status = "", sort = "updated", limit, offset } = ctx.query;
    if (status && !STATUSES.includes(status)) throw new HttpError(400, "Unknown status filter");
    ctx.json(200, repo.list({ q: q.slice(0, 100), crop: crop.slice(0, 60), status, sort, limit, offset }));
  });

  // Must be registered before "/api/batches/:code" so "crops" is not read as a batch code.
  router.get("/api/batches/crops", (ctx) => ctx.json(200, { crops: repo.crops() }));

  // Single batch lookup (used by QR scans). Every lookup is logged for the admin dashboard.
  router.get("/api/batches/:code", (ctx) => {
    const code = ctx.params.code.trim();
    if (!BATCH_CODE_RE.test(code)) throw new HttpError(404, "No batch record found for this code.");

    const batch = repo.getByCode(code);
    const source = SOURCES.has(ctx.query.source) ? ctx.query.source : "web";
    repo.logLookup(code, !!batch, source, hashIp(ctx.ip, config.jwtSecret));

    if (!batch) throw new HttpError(404, "No batch record found for this code.");
    ctx.json(200, { batch });
  });
}
