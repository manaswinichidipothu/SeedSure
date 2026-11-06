import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../src/db.js";
import { loadConfig } from "../src/config.js";
import { createApp } from "../src/app.js";
import { bootstrap } from "../src/seed.js";

const EMAIL = "admin@test.dev";
const PASSWORD = "correct-horse-9";
let server, base, db, cookie;

before(async () => {
  const config = loadConfig({ ADMIN_EMAIL: EMAIL, ADMIN_PASSWORD: PASSWORD, SEED_SAMPLE_DATA: "1", PUBLIC_URL: "https://seeds.example" });
  db = openDb(":memory:");
  await bootstrap(db, config);
  server = createApp({ db, config });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((r) => server.close(() => { db.close(); r(); })));

async function call(method, path, body, headers = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(cookie ? { cookie } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const type = res.headers.get("content-type") || "";
  const data = type.includes("json") ? await res.json() : await res.text();
  return { status: res.status, data, headers: res.headers };
}

const validBatch = (over = {}) => ({
  batchCode: "TEST-001", seedName: "Test Seed", brand: "Acme", crop: "Wheat", variety: "W1",
  germination: 90, status: "Pending", packed: "2026-01-01", expiry: "2027-01-01", ...over,
});

test("health + public config", async () => {
  assert.equal((await call("GET", "/api/health")).data.ok, true);
  assert.equal((await call("GET", "/api/config")).data.publicUrl, "https://seeds.example");
});

test("public directory lists samples, filters and searches", async () => {
  const all = await call("GET", "/api/batches");
  assert.equal(all.status, 200);
  assert.equal(all.data.total, 5);
  const rice = await call("GET", "/api/batches?q=swarna");
  assert.equal(rice.data.items[0].batchCode, "GF-RICE-2401");
  assert.equal((await call("GET", "/api/batches?status=Rejected")).data.total, 1);
  assert.equal((await call("GET", "/api/batches?crop=maize")).data.total, 1); // case-insensitive
  assert.equal((await call("GET", "/api/batches?q=%25")).data.total, 0);      // % is literal, not a wildcard
  assert.equal((await call("GET", "/api/batches?status=Nope")).status, 400);
  assert.deepEqual((await call("GET", "/api/batches/crops")).data.crops.slice(0, 2), ["Groundnut", "Maize"]);
});

test("batch lookup: case-insensitive, computed expiry, logs scans", async () => {
  const ok = await call("GET", "/api/batches/gf-rice-2401?source=camera");
  assert.equal(ok.status, 200);
  assert.equal(ok.data.batch.seedName, "Swarna Paddy");
  assert.ok(["valid", "expiring_soon", "expired"].includes(ok.data.batch.expiryState));
  const expired = await call("GET", "/api/batches/GF-BG-421");
  assert.equal(expired.data.batch.expiryState, "expired");

  assert.equal((await call("GET", "/api/batches/FAKE-999?source=camera")).status, 404);
  assert.equal((await call("GET", "/api/batches/bad%20code%21")).status, 404); // invalid format, not logged
  const row = db.prepare("SELECT * FROM lookups WHERE batch_code = 'FAKE-999'").get();
  assert.equal(row.found, 0);
  assert.equal(row.source, "camera");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM lookups WHERE batch_code LIKE 'bad%'").get().n, 0);
});

test("admin routes require a session", async () => {
  for (const [m, p] of [["GET", "/api/admin/stats"], ["GET", "/api/admin/batches"], ["POST", "/api/admin/batches"], ["GET", "/api/admin/export.csv"], ["GET", "/api/admin/audit"]]) {
    const r = await call(m, p, m === "POST" ? {} : undefined);
    assert.equal(r.status, 401, `${m} ${p}`);
  }
  const forged = await call("GET", "/api/admin/stats", undefined, { Authorization: "Bearer aaa.bbb.ccc" });
  assert.equal(forged.status, 401);
});

test("login: wrong password rejected, right password sets httpOnly cookie", async () => {
  const bad = await call("POST", "/api/auth/login", { email: EMAIL, password: "nope-nope-nope" });
  assert.equal(bad.status, 401);
  const unknown = await call("POST", "/api/auth/login", { email: "ghost@test.dev", password: "whatever-123" });
  assert.equal(unknown.status, 401);
  assert.equal(unknown.data.error, bad.data.error); // same message: no account enumeration

  const ok = await call("POST", "/api/auth/login", { email: EMAIL.toUpperCase(), password: PASSWORD });
  assert.equal(ok.status, 200);
  const set = ok.headers.get("set-cookie");
  assert.match(set, /HttpOnly/);
  assert.match(set, /SameSite=Lax/);
  cookie = set.split(";")[0];
  const me = await call("GET", "/api/auth/me");
  assert.equal(me.data.user.email, EMAIL);
});

test("create / read / update / status / delete a batch", async () => {
  const created = await call("POST", "/api/admin/batches", validBatch());
  assert.equal(created.status, 201);
  const id = created.data.batch.id;
  assert.equal(created.data.batch.expiryState !== undefined, true);

  assert.equal((await call("GET", `/api/admin/batches/${id}`)).data.batch.batchCode, "TEST-001");

  const dup = await call("POST", "/api/admin/batches", validBatch({ batchCode: "test-001" }));
  assert.equal(dup.status, 422);
  assert.ok(dup.data.details.batchCode);

  const upd = await call("PUT", `/api/admin/batches/${id}`, { germination: 75, soil: "Sandy" });
  assert.equal(upd.status, 200);
  assert.equal(upd.data.batch.germination, 75);
  assert.equal(upd.data.batch.seedName, "Test Seed"); // untouched fields preserved

  const st = await call("PATCH", `/api/admin/batches/${id}/status`, { status: "Verified" });
  assert.equal(st.data.batch.status, "Verified");
  assert.equal((await call("PATCH", `/api/admin/batches/${id}/status`, { status: "Great" })).status, 422);

  // public side sees the change immediately
  assert.equal((await call("GET", "/api/batches/TEST-001")).data.batch.status, "Verified");

  const audit = (await call("GET", "/api/admin/audit")).data.items.map((a) => a.action);
  for (const a of ["login", "create", "update", "status"]) assert.ok(audit.includes(a), `audit has ${a}`);

  assert.equal((await call("DELETE", `/api/admin/batches/${id}`)).status, 200);
  assert.equal((await call("GET", "/api/batches/TEST-001")).status, 404);
  assert.equal((await call("DELETE", `/api/admin/batches/${id}`)).status, 404);
});

test("validation errors are specific", async () => {
  const r = await call("POST", "/api/admin/batches", { batchCode: "bad code", seedName: "", germination: 120, status: "Maybe", expiry: "2026-02-31", packed: "nonsense" });
  assert.equal(r.status, 422);
  for (const f of ["batchCode", "seedName", "brand", "crop", "germination", "status", "expiry", "packed"]) assert.ok(r.data.details[f], `error for ${f}`);
  const dates = await call("POST", "/api/admin/batches", validBatch({ batchCode: "DATE-1", packed: "2026-05-01", expiry: "2026-01-01" }));
  assert.match(dates.data.details.expiry, /before/);
  assert.equal((await call("POST", "/api/admin/batches", validBatch({ batchCode: "NULL-GERM", germination: "" }))).data.batch.germination, null);
  const notJson = await fetch(base + "/api/admin/batches", { method: "POST", headers: { cookie, "Content-Type": "text/plain" }, body: "x" });
  assert.equal(notJson.status, 415);
});

test("bulk import: dry run, atomic failure, upsert", async () => {
  const items = [validBatch({ batchCode: "BULK-1" }), validBatch({ batchCode: "BULK-2" }), validBatch({ batchCode: "GF-RICE-2401", seedName: "Renamed Paddy" })];
  const dry = await call("POST", "/api/admin/batches/bulk", { items, dryRun: true });
  assert.deepEqual([dry.data.create, dry.data.update], [2, 1]);
  assert.equal((await call("GET", "/api/batches/BULK-1")).status, 404); // dry run wrote nothing

  const bad = await call("POST", "/api/admin/batches/bulk", { items: [validBatch({ batchCode: "BULK-3" }), validBatch({ batchCode: "bulk-3" }), validBatch({ batchCode: "", crop: "" })] });
  assert.equal(bad.status, 422);
  assert.equal(bad.data.details.rows.length, 2);
  assert.equal((await call("GET", "/api/batches/BULK-3")).status, 404); // atomic: nothing imported

  const real = await call("POST", "/api/admin/batches/bulk", { items });
  assert.deepEqual([real.data.created, real.data.updated], [2, 1]);
  assert.equal((await call("GET", "/api/batches/GF-RICE-2401")).data.batch.seedName, "Renamed Paddy");
  assert.equal((await call("POST", "/api/admin/batches/bulk", { items: [] })).status, 400);
});

test("CSV export escapes quotes and neutralises formulas", async () => {
  await call("POST", "/api/admin/batches", validBatch({ batchCode: "CSV-1", seedName: '=HYPERLINK("x")', description: 'He said "hi", ok' }));
  const r = await call("GET", "/api/admin/export.csv");
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /text\/csv/);
  assert.match(r.data, /batchCode,seedName/);
  assert.match(r.data, /"'=HYPERLINK\(""x""\)"/);
  assert.match(r.data, /"He said ""hi"", ok"/);
});

test("dashboard stats reflect scans, unknown codes and expiry", async () => {
  const s = (await call("GET", "/api/admin/stats")).data;
  assert.ok(s.total >= 5);
  assert.ok(s.expired >= 1);
  assert.equal(s.lookupsByDay.length, 7);
  assert.ok(s.lookups30d >= 3);
  assert.ok(s.unknownCodes.some((u) => u.batchCode === "FAKE-999"));
  assert.ok(s.topBatches.length >= 1);
  assert.ok((await call("GET", "/api/admin/lookups")).data.items.length >= 1);
});

test("cross-site writes are blocked, same-origin allowed", async () => {
  const evil = await call("POST", "/api/admin/batches", validBatch({ batchCode: "EVIL-1" }), { Origin: "https://evil.example" });
  assert.equal(evil.status, 403);
  const own = await call("POST", "/api/admin/batches", validBatch({ batchCode: "OWN-1" }), { Origin: base });
  assert.equal(own.status, 201);
  const configured = await call("POST", "/api/admin/batches", validBatch({ batchCode: "PUB-1" }), { Origin: "https://seeds.example" });
  assert.equal(configured.status, 201);
});

test("change password signs out other sessions, keeps this one", async () => {
  const other = (await call("POST", "/api/auth/login", { email: EMAIL, password: PASSWORD })).headers.get("set-cookie").split(";")[0];
  assert.equal((await call("POST", "/api/auth/change-password", { currentPassword: "wrong", newPassword: "another-pass-12" })).status, 400);
  assert.equal((await call("POST", "/api/auth/change-password", { currentPassword: PASSWORD, newPassword: "short" })).status, 400);
  const ok = await call("POST", "/api/auth/change-password", { currentPassword: PASSWORD, newPassword: "another-pass-12" });
  assert.equal(ok.status, 200);
  cookie = ok.headers.get("set-cookie").split(";")[0];
  assert.equal((await call("GET", "/api/auth/me")).data.user.email, EMAIL);
  const old = await fetch(base + "/api/auth/me", { headers: { cookie: other } });
  assert.equal((await old.json()).user, null);
  assert.equal((await call("POST", "/api/auth/login", { email: EMAIL, password: "another-pass-12" })).status, 200);
});

test("logout clears the session cookie", async () => {
  const r = await call("POST", "/api/auth/logout");
  assert.match(r.headers.get("set-cookie"), /Max-Age=0/);
});

test("login is rate limited", async () => {
  let last;
  for (let i = 0; i < 10; i++) last = await call("POST", "/api/auth/login", { email: "brute@test.dev", password: "guess-guess-1" });
  assert.equal(last.status, 429);
  assert.ok(last.headers.get("retry-after"));
});

test("unknown API routes 404, wrong method 405, security headers present, no static build => helpful 404", async () => {
  assert.equal((await call("GET", "/api/nope")).status, 404);
  assert.equal((await call("DELETE", "/api/health")).status, 405);
  const h = await call("GET", "/api/health");
  assert.match(h.headers.get("permissions-policy"), /camera=\(self\)/);
  assert.equal(h.headers.get("x-content-type-options"), "nosniff");
  const page = await call("GET", "/scan");
  assert.equal(page.status, 404);
  assert.match(page.data.error, /not built/i);
});

test("production config refuses weak secrets", () => {
  assert.throws(() => loadConfig({ NODE_ENV: "production", JWT_SECRET: "short" }), /JWT_SECRET/);
  assert.throws(() => loadConfig({ NODE_ENV: "production", JWT_SECRET: "x".repeat(40), ADMIN_PASSWORD: "ChangeMe!12345" }), /ADMIN_PASSWORD/);
  assert.doesNotThrow(() => loadConfig({ NODE_ENV: "production", JWT_SECRET: "x".repeat(40), ADMIN_PASSWORD: "a-strong-one-123" }));
});
