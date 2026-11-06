import fs from "node:fs";
import path from "node:path";

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const MAX_BODY = 2 * 1024 * 1024; // 2 MB (bulk imports)

/** Tiny router: router.get("/api/x/:id", ...handlers). A handler can end the response, or just return. */
export class Router {
  constructor() { this.routes = []; }

  add(method, pattern, ...handlers) {
    const keys = [];
    const source = pattern.replace(/:([A-Za-z_]+)/g, (_, k) => { keys.push(k); return "([^/]+)"; });
    this.routes.push({ method, regex: new RegExp(`^${source}/?$`), keys, handlers });
  }
  get(p, ...h) { this.add("GET", p, ...h); }
  post(p, ...h) { this.add("POST", p, ...h); }
  put(p, ...h) { this.add("PUT", p, ...h); }
  patch(p, ...h) { this.add("PATCH", p, ...h); }
  delete(p, ...h) { this.add("DELETE", p, ...h); }

  async handle(ctx) {
    const { method, pathname } = ctx;
    let pathMatched = false;
    for (const route of this.routes) {
      const m = route.regex.exec(pathname);
      if (!m) continue;
      pathMatched = true;
      if (route.method !== method) continue;
      ctx.params = {};
      route.keys.forEach((k, i) => { ctx.params[k] = decodeURIComponent(m[i + 1]); });
      for (const handler of route.handlers) {
        await handler(ctx);
        if (ctx.res.writableEnded) break;
      }
      return true;
    }
    if (pathMatched) throw new HttpError(405, "Method not allowed");
    return false;
  }
}

export function makeContext(req, res, { trustProxy }) {
  const url = new URL(req.url, "http://localhost");
  const forwarded = trustProxy ? String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() : "";
  const ctx = {
    req, res, url,
    method: req.method,
    pathname: url.pathname,
    query: Object.fromEntries(url.searchParams),
    params: {},
    user: null,
    ip: forwarded || req.socket.remoteAddress || "unknown",
    _body: undefined,
    json(status, data, headers = {}) {
      const payload = JSON.stringify(data);
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(payload),
        "Cache-Control": "no-store",
        ...headers,
      });
      res.end(payload);
    },
    send(status, body, headers = {}) {
      res.writeHead(status, { "Content-Length": Buffer.byteLength(body), ...headers });
      res.end(body);
    },
    async body() {
      if (ctx._body !== undefined) return ctx._body;
      const type = String(req.headers["content-type"] || "");
      if (!type.includes("application/json")) throw new HttpError(415, "Content-Type must be application/json");
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BODY) throw new HttpError(413, "Request body too large");
        chunks.push(chunk);
      }
      try {
        ctx._body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      } catch {
        throw new HttpError(400, "Invalid JSON body");
      }
      if (ctx._body === null || typeof ctx._body !== "object") throw new HttpError(400, "JSON body must be an object or array");
      return ctx._body;
    },
  };
  return ctx;
}

/* ---------- static files (the built React app) ---------- */

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon",
  ".woff": "font/woff", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".map": "application/json",
  ".webmanifest": "application/manifest+json",
};

export function serveStatic(ctx, root) {
  const { req, res, pathname } = ctx;
  if (req.method !== "GET" && req.method !== "HEAD") throw new HttpError(405, "Method not allowed");
  if (!fs.existsSync(path.join(root, "index.html"))) {
    throw new HttpError(404, "Frontend not built. Run `npm run build` in /client, or use the Vite dev server on :5173.");
  }

  let rel;
  try { rel = decodeURIComponent(pathname); } catch { throw new HttpError(400, "Bad path"); }
  let file = path.normalize(path.join(root, rel));
  if (file !== root && !file.startsWith(root + path.sep)) throw new HttpError(403, "Forbidden");

  let isSpaFallback = false;
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    if (path.extname(rel)) throw new HttpError(404, "Not found"); // missing asset: don't fall back to HTML
    file = path.join(root, "index.html");
    isSpaFallback = true;
  }

  const ext = path.extname(file).toLowerCase();
  const immutable = rel.startsWith("/assets/") && !isSpaFallback;
  res.writeHead(200, {
    "Content-Type": TYPES[ext] || "application/octet-stream",
    "Content-Length": fs.statSync(file).size,
    "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
  });
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(file).pipe(res);
}

/* ---------- headers ---------- */

export function securityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // camera=(self) is REQUIRED for the QR scanner to work.
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      "media-src 'self' blob:",
      "connect-src 'self'",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  );
}
