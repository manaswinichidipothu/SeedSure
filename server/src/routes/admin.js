import { HttpError } from "../http.js";
import { FIELDS } from "../repo.js";
import { crossCheck, parseBatch, STATUSES } from "../validation.js";
import { requireAuth } from "./auth.js";

const MAX_BULK = 1000;

const isUniqueError = (err) => /UNIQUE constraint failed: batches\.batch_code/.test(String(err?.message));

function csvCell(v) {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // stop spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function diff(before, after) {
  const changes = {};
  for (const f of FIELDS) if ((before[f] ?? null) !== (after[f] ?? null)) changes[f] = [before[f] ?? null, after[f] ?? null];
  return changes;
}

export function registerAdminRoutes(router, deps) {
  const { repo } = deps;
  const auth = requireAuth(deps);
  const idOf = (ctx) => {
    const id = Number(ctx.params.id);
    if (!Number.isInteger(id) || id < 1) throw new HttpError(404, "Batch not found.");
    return id;
  };
  const invalid = (errors) => new HttpError(422, "Please fix the highlighted fields.", errors);

  router.get("/api/admin/stats", auth, (ctx) => ctx.json(200, repo.stats()));

  router.get("/api/admin/batches", auth, (ctx) => {
    const { q = "", crop = "", status = "", sort = "updated", limit = "100", offset = "0" } = ctx.query;
    if (status && !STATUSES.includes(status)) throw new HttpError(400, "Unknown status filter");
    ctx.json(200, repo.list({ q: q.slice(0, 100), crop, status, sort, limit, offset }));
  });

  router.get("/api/admin/batches/:id", auth, (ctx) => {
    const batch = repo.getById(idOf(ctx));
    if (!batch) throw new HttpError(404, "Batch not found.");
    ctx.json(200, { batch });
  });

  router.post("/api/admin/batches", auth, async (ctx) => {
    const { value, errors } = parseBatch(await ctx.body());
    crossCheck(value, errors);
    if (Object.keys(errors).length) throw invalid(errors);
    try {
      const batch = repo.create(value);
      repo.recordAudit(ctx.user, "create", batch.batchCode, { seedName: batch.seedName });
      ctx.json(201, { batch });
    } catch (err) {
      if (isUniqueError(err)) throw invalid({ batchCode: "That batch code already exists." });
      throw err;
    }
  });

  router.put("/api/admin/batches/:id", auth, async (ctx) => {
    const id = idOf(ctx);
    const existing = repo.getById(id);
    if (!existing) throw new HttpError(404, "Batch not found.");
    const { value, errors } = parseBatch(await ctx.body(), { partial: true });
    const merged = { ...existing, ...value };
    crossCheck(merged, errors);
    if (Object.keys(errors).length) throw invalid(errors);
    try {
      const batch = repo.update(id, merged);
      const changes = diff(existing, batch);
      if (Object.keys(changes).length) repo.recordAudit(ctx.user, "update", batch.batchCode, changes);
      ctx.json(200, { batch });
    } catch (err) {
      if (isUniqueError(err)) throw invalid({ batchCode: "That batch code already exists." });
      throw err;
    }
  });

  // Quick status change from the table (Verified / Pending / Rejected).
  router.patch("/api/admin/batches/:id/status", auth, async (ctx) => {
    const id = idOf(ctx);
    const existing = repo.getById(id);
    if (!existing) throw new HttpError(404, "Batch not found.");
    const { status } = await ctx.body();
    if (!STATUSES.includes(status)) throw invalid({ status: `Status must be one of: ${STATUSES.join(", ")}.` });
    const batch = repo.update(id, { ...existing, status });
    if (existing.status !== status) repo.recordAudit(ctx.user, "status", batch.batchCode, { status: [existing.status, status] });
    ctx.json(200, { batch });
  });

  router.delete("/api/admin/batches/:id", auth, (ctx) => {
    const id = idOf(ctx);
    const existing = repo.getById(id);
    if (!existing) throw new HttpError(404, "Batch not found.");
    repo.remove(id);
    repo.recordAudit(ctx.user, "delete", existing.batchCode, { seedName: existing.seedName });
    ctx.json(200, { ok: true });
  });

  // Bulk import (CSV parsed in the browser). All-or-nothing; upserts by batch code.
  router.post("/api/admin/batches/bulk", auth, async (ctx) => {
    const body = await ctx.body();
    const items = Array.isArray(body.items) ? body.items : null;
    if (!items || !items.length) throw new HttpError(400, "Send { items: [...] } with at least one row.");
    if (items.length > MAX_BULK) throw new HttpError(413, `Import at most ${MAX_BULK} rows at a time.`);

    const rowErrors = [];
    const records = [];
    const seen = new Map();
    items.forEach((raw, i) => {
      const { value, errors } = parseBatch(raw && typeof raw === "object" ? raw : {});
      crossCheck(value, errors);
      const key = String(value.batchCode || "").toLowerCase();
      if (key && seen.has(key)) errors.batchCode = `Duplicate of row ${seen.get(key)} in this file.`;
      else if (key) seen.set(key, i + 1);
      if (Object.keys(errors).length) rowErrors.push({ row: i + 1, batchCode: raw?.batchCode ?? "", errors });
      else records.push(value);
    });
    if (rowErrors.length) {
      throw new HttpError(422, `${rowErrors.length} row(s) have problems. Nothing was imported.`, { rows: rowErrors.slice(0, 100) });
    }

    const willUpdate = records.filter((r) => repo.getByCode(r.batchCode)).length;
    if (body.dryRun) return ctx.json(200, { dryRun: true, create: records.length - willUpdate, update: willUpdate });

    const result = repo.upsertMany(records);
    repo.recordAudit(ctx.user, "import", null, result);
    ctx.json(200, result);
  });

  router.get("/api/admin/export.csv", auth, (ctx) => {
    const rows = repo.exportAll();
    const lines = [FIELDS.join(",")];
    for (const r of rows) lines.push(FIELDS.map((f) => csvCell(r[f])).join(","));
    repo.recordAudit(ctx.user, "export", null, { rows: rows.length });
    ctx.send(200, "﻿" + lines.join("\r\n") + "\r\n", {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="seedsure-batches-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    });
  });

  router.get("/api/admin/audit", auth, (ctx) => ctx.json(200, { items: repo.listAudit(ctx.query.limit) }));
  router.get("/api/admin/lookups", auth, (ctx) => ctx.json(200, { items: repo.listLookups(ctx.query.limit) }));
}
