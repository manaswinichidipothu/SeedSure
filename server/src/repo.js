import { transaction } from "./db.js";

const FIELDS = ["batchCode", "seedName", "brand", "crop", "variety", "germination", "status", "packed", "expiry", "soil", "season", "fertilizer", "description", "icon", "color"];
const COLUMN = {
  batchCode: "batch_code", seedName: "seed_name", brand: "brand", crop: "crop", variety: "variety",
  germination: "germination", status: "status", packed: "packed", expiry: "expiry", soil: "soil",
  season: "season", fertilizer: "fertilizer", description: "description", icon: "icon", color: "color",
};
const SORTS = {
  updated: "updated_at DESC, id DESC",
  newest: "id DESC",
  name: "seed_name COLLATE NOCASE ASC",
  code: "batch_code COLLATE NOCASE ASC",
  expiry: "CASE WHEN expiry IS NULL THEN 1 ELSE 0 END, expiry ASC",
  germination: "CASE WHEN germination IS NULL THEN 1 ELSE 0 END, germination DESC",
  germ_low: "CASE WHEN germination IS NULL THEN 1 ELSE 0 END, germination ASC",
};

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** DB row -> API object (camelCase + computed expiry info). */
export function toApi(row) {
  if (!row) return null;
  let expiryState = "none";
  let daysToExpiry = null;
  if (row.expiry) {
    daysToExpiry = Math.round((Date.parse(`${row.expiry}T00:00:00Z`) - Date.parse(`${today()}T00:00:00Z`)) / 86400000);
    expiryState = daysToExpiry < 0 ? "expired" : daysToExpiry <= 30 ? "expiring_soon" : "valid";
  }
  return {
    id: row.id, batchCode: row.batch_code, seedName: row.seed_name, brand: row.brand, crop: row.crop,
    variety: row.variety, germination: row.germination, status: row.status, packed: row.packed,
    expiry: row.expiry, soil: row.soil, season: row.season, fertilizer: row.fertilizer,
    description: row.description, icon: row.icon, color: row.color,
    expiryState, daysToExpiry, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

const escLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const dbParams = (rec) => Object.fromEntries(FIELDS.map((f) => [f, rec[f] ?? null]));

export function createRepo(db) {
  const q = {
    byCode: db.prepare("SELECT * FROM batches WHERE batch_code = ?"),
    byId: db.prepare("SELECT * FROM batches WHERE id = ?"),
    insert: db.prepare(`INSERT INTO batches (${FIELDS.map((f) => COLUMN[f]).join(", ")})
                        VALUES (${FIELDS.map((f) => "@" + f).join(", ")})`),
    update: db.prepare(`UPDATE batches SET ${FIELDS.map((f) => `${COLUMN[f]} = @${f}`).join(", ")},
                        updated_at = datetime('now') WHERE id = @id`),
    remove: db.prepare("DELETE FROM batches WHERE id = ?"),
    crops: db.prepare("SELECT DISTINCT crop FROM batches ORDER BY crop COLLATE NOCASE"),
    logLookup: db.prepare("INSERT INTO lookups (batch_code, found, source, ip_hash) VALUES (?, ?, ?, ?)"),
    audit: db.prepare("INSERT INTO audit_log (admin_id, admin_email, action, batch_code, details) VALUES (?, ?, ?, ?, ?)"),
  };

  function list({ q: text = "", crop = "", status = "", sort = "updated", limit = 50, offset = 0 } = {}) {
    const where = [];
    const params = [];
    if (text) {
      const like = `%${escLike(text.trim())}%`;
      where.push(`(seed_name LIKE ? ESCAPE '\\' OR brand LIKE ? ESCAPE '\\' OR variety LIKE ? ESCAPE '\\'
                   OR batch_code LIKE ? ESCAPE '\\' OR crop LIKE ? ESCAPE '\\')`);
      params.push(like, like, like, like, like);
    }
    if (crop) { where.push("crop = ? COLLATE NOCASE"); params.push(crop); }
    if (status) { where.push("status = ?"); params.push(status); }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const off = Math.max(Number(offset) || 0, 0);
    const total = db.prepare(`SELECT COUNT(*) AS n FROM batches ${clause}`).get(...params).n;
    const rows = db.prepare(`SELECT * FROM batches ${clause} ORDER BY ${SORTS[sort] || SORTS.updated} LIMIT ? OFFSET ?`)
      .all(...params, lim, off);
    return { items: rows.map(toApi), total, limit: lim, offset: off };
  }

  const getByCode = (code) => toApi(q.byCode.get(code));
  const getById = (id) => toApi(q.byId.get(id));
  const crops = () => q.crops.all().map((r) => r.crop);

  function create(rec) {
    const info = q.insert.run(dbParams(rec));
    return getById(Number(info.lastInsertRowid));
  }
  function update(id, rec) {
    q.update.run({ ...dbParams(rec), id });
    return getById(id);
  }
  const remove = (id) => q.remove.run(id).changes > 0;

  /** Insert or update by batch code. Atomic: any DB error rolls the whole import back. */
  function upsertMany(records) {
    return transaction(db, () => {
      let created = 0, updated = 0;
      for (const rec of records) {
        const existing = q.byCode.get(rec.batchCode);
        if (existing) { q.update.run({ ...dbParams(rec), id: existing.id }); updated += 1; }
        else { q.insert.run(dbParams(rec)); created += 1; }
      }
      return { created, updated };
    });
  }

  function logLookup(code, found, source, ipHash) {
    q.logLookup.run(String(code).slice(0, 64), found ? 1 : 0, source, ipHash);
  }

  function recordAudit(admin, action, batchCode = null, details = null) {
    q.audit.run(admin?.id ?? null, admin?.email ?? null, action, batchCode, details ? JSON.stringify(details) : null);
  }
  function listAudit(limit = 50) {
    return db.prepare("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?").all(Math.min(Number(limit) || 50, 200))
      .map((r) => ({ id: r.id, adminEmail: r.admin_email, action: r.action, batchCode: r.batch_code,
        details: r.details ? JSON.parse(r.details) : null, createdAt: r.created_at }));
  }
  function listLookups(limit = 50) {
    return db.prepare("SELECT * FROM lookups ORDER BY id DESC LIMIT ?").all(Math.min(Number(limit) || 50, 200))
      .map((r) => ({ id: r.id, batchCode: r.batch_code, found: !!r.found, source: r.source, createdAt: r.created_at }));
  }

  function stats() {
    const t = today();
    const one = (sql, ...p) => db.prepare(sql).get(...p);
    const all = (sql, ...p) => db.prepare(sql).all(...p);

    const total = one("SELECT COUNT(*) n FROM batches").n;
    const byStatus = Object.fromEntries(["Verified", "Pending", "Rejected"].map((s) => [s, 0]));
    for (const r of all("SELECT status, COUNT(*) n FROM batches GROUP BY status")) byStatus[r.status] = r.n;

    const expired = one("SELECT COUNT(*) n FROM batches WHERE expiry IS NOT NULL AND expiry < ?", t).n;
    const expiringSoon = one("SELECT COUNT(*) n FROM batches WHERE expiry IS NOT NULL AND expiry >= ? AND expiry <= ?", t, addDays(t, 30)).n;
    const lowGermination = one("SELECT COUNT(*) n FROM batches WHERE germination IS NOT NULL AND germination < 80").n;

    const since7 = addDays(t, -6);
    const perDay = Object.fromEntries(all(
      "SELECT date(created_at) d, COUNT(*) n FROM lookups WHERE date(created_at) >= ? GROUP BY d", since7).map((r) => [r.d, r.n]));
    const lookupsByDay = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(since7, i);
      return { date: d, count: perDay[d] || 0 };
    });

    const since30 = addDays(t, -29);
    return {
      total, byStatus, expired, expiringSoon, lowGermination, lookupsByDay,
      lookups30d: one("SELECT COUNT(*) n FROM lookups WHERE date(created_at) >= ?", since30).n,
      byCrop: all("SELECT crop, COUNT(*) n FROM batches GROUP BY crop ORDER BY n DESC, crop LIMIT 8"),
      topBatches: all(
        `SELECT l.batch_code AS batchCode, b.seed_name AS seedName, COUNT(*) AS scans
           FROM lookups l JOIN batches b ON b.batch_code = l.batch_code
          WHERE l.found = 1 AND date(l.created_at) >= ? GROUP BY l.batch_code ORDER BY scans DESC LIMIT 5`, since30),
      unknownCodes: all(
        `SELECT batch_code AS batchCode, COUNT(*) AS scans, MAX(created_at) AS lastSeen
           FROM lookups WHERE found = 0 AND date(created_at) >= ? GROUP BY batch_code
          ORDER BY scans DESC, lastSeen DESC LIMIT 8`, since30),
    };
  }

  function exportAll() {
    return db.prepare("SELECT * FROM batches ORDER BY batch_code COLLATE NOCASE").all().map(toApi);
  }

  return { list, getByCode, getById, crops, create, update, remove, upsertMany, logLookup, recordAudit, listAudit, listLookups, stats, exportAll };
}

export { FIELDS };
