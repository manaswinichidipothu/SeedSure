import { HttpError } from "../http.js";
import {
  DUMMY_HASH, RateLimiter, hashPassword, parseCookies, serializeCookie, signJwt, verifyJwt, verifyPassword,
} from "../security.js";
import { validatePassword } from "../validation.js";

export const COOKIE = "ss_token";

export function registerAuthRoutes(router, { db, repo, config }) {
  const byEmail = db.prepare("SELECT * FROM admins WHERE email = ?");
  const byId = db.prepare("SELECT * FROM admins WHERE id = ?");
  const setPassword = db.prepare("UPDATE admins SET password_hash = ?, token_version = token_version + 1 WHERE id = ?");
  const pair = new RateLimiter({ windowMs: 15 * 60_000, max: 8 });   // same IP + same email
  const perIp = new RateLimiter({ windowMs: 15 * 60_000, max: 40 }); // same IP, any email

  const publicUser = (a) => ({ id: a.id, email: a.email, name: a.name });
  const cookieOpts = { secure: config.cookieSecure };

  function issue(ctx, admin) {
    const token = signJwt({ sub: admin.id, tv: admin.token_version }, config.jwtSecret, config.tokenTtlSeconds);
    ctx.res.setHeader("Set-Cookie", serializeCookie(COOKIE, token, { ...cookieOpts, maxAge: config.tokenTtlSeconds }));
  }

  router.post("/api/auth/login", async (ctx) => {
    const body = await ctx.body();
    const email = String(body.email || "").trim().toLowerCase().slice(0, 200);
    const password = String(body.password || "");
    if (!email || !password) throw new HttpError(400, "Email and password are required.");

    const pairKey = `${ctx.ip}|${email}`;
    const a = pair.hit(pairKey);
    const b = perIp.hit(ctx.ip);
    if (a.limited || b.limited) {
      ctx.res.setHeader("Retry-After", Math.max(a.retryAfter, b.retryAfter));
      throw new HttpError(429, "Too many login attempts. Please wait a few minutes and try again.");
    }

    const admin = byEmail.get(email);
    const ok = await verifyPassword(password, admin ? admin.password_hash : DUMMY_HASH);
    if (!admin || !ok) throw new HttpError(401, "Incorrect email or password.");

    pair.reset(pairKey);
    issue(ctx, admin);
    repo.recordAudit(admin, "login");
    ctx.json(200, { user: publicUser(admin) });
  });

  router.post("/api/auth/logout", (ctx) => {
    ctx.res.setHeader("Set-Cookie", serializeCookie(COOKIE, "", { ...cookieOpts, maxAge: 0 }));
    ctx.json(200, { ok: true });
  });

  router.get("/api/auth/me", (ctx) => {
    const admin = authenticate(ctx, { db, config });
    ctx.json(200, { user: admin ? publicUser(admin) : null });
  });

  router.post("/api/auth/change-password", requireAuth({ db, config }), async (ctx) => {
    const { currentPassword = "", newPassword = "" } = await ctx.body();
    const admin = byId.get(ctx.user.id);
    if (!(await verifyPassword(String(currentPassword), admin.password_hash))) {
      throw new HttpError(400, "Current password is incorrect.", { currentPassword: "Current password is incorrect." });
    }
    const problem = validatePassword(newPassword);
    if (problem) throw new HttpError(400, problem, { newPassword: problem });
    setPassword.run(await hashPassword(newPassword), admin.id); // bumps token_version: all old sessions die
    repo.recordAudit(admin, "password_change");
    issue(ctx, byId.get(admin.id)); // keep THIS session alive with the new token version
    ctx.json(200, { ok: true });
  });
}

/** Returns the admin row for a valid session cookie / Bearer token, else null. */
export function authenticate(ctx, { db, config }) {
  const header = String(ctx.req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7) : parseCookies(ctx.req.headers.cookie)[COOKIE];
  if (!token) return null;
  const payload = verifyJwt(token, config.jwtSecret);
  if (!payload) return null;
  const admin = db.prepare("SELECT * FROM admins WHERE id = ?").get(payload.sub);
  if (!admin || admin.token_version !== payload.tv) return null;
  return admin;
}

/** Middleware: 401 unless an admin session is present. Sets ctx.user. */
export function requireAuth(deps) {
  return (ctx) => {
    const admin = authenticate(ctx, deps);
    if (!admin) throw new HttpError(401, "Please sign in as an admin.");
    ctx.user = { id: admin.id, email: admin.email, name: admin.name };
  };
}
