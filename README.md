# SeedSure: QR seed-batch tracker (full stack)

Farmers scan the QR code on a seed packet with their phone camera and see that batch's germination rate, dates, status and growing guidance. You, the admin, sign in to add and edit batches, print QR labels, import/export spreadsheets and watch what people scan.

```
seedsure/
├── client/   React + Vite frontend (public site + admin panel + camera scanner)
├── server/   Node.js API + SQLite database (no npm dependencies)
├── scripts/  dev runner and .env generator
└── Dockerfile
```

## 1. Run it on your computer

**Requirements:** Node.js **22.5 or newer** (`node -v`). The server uses Node's built-in SQLite, so it needs nothing else.

```bash
npm run setup          # installs the client, creates server/.env with a random secret
# open server/.env and set ADMIN_EMAIL and ADMIN_PASSWORD (10+ characters)
npm run dev            # API on :4000, website on :5173
```

Open **http://localhost:5173**. Sign in at **/admin** with the email and password you put in `.env`. The first start creates that admin account and inserts 5 sample batches (set `SEED_SAMPLE_DATA=0` to skip them).

Other commands: `npm test` (API tests), `npm run build`, `npm start` (production), `npm run create-admin`, `npm run backup`.

## 2. Camera scanning: what you must know

Browsers only allow camera access on **HTTPS** or **localhost**.

- On your computer at `http://localhost:5173`, the camera works.
- To test from a **phone on your Wi-Fi**, run `npm --prefix client run dev:https` and open `https://<your-computer-ip>:5173` (accept the self-signed certificate warning).
- In real use, deploy behind HTTPS (section 5). Every hosting option below gives you HTTPS.
- If the camera is blocked or unavailable, the scan page still offers **Upload / take photo** (works on any connection) and **manual code entry**.

The scanner accepts three QR formats: a full link (`https://yoursite.com/seed/GF-RICE-2401`), `SEEDSURE:GF-RICE-2401`, or just the code. The labels you print from the admin panel use the full-link format, so a **normal phone camera app** opens the batch page too, with no need to open the website first.

## 3. Admin tasks

| I want to… | Where |
|---|---|
| See totals, expiring/expired batches, low germination, scans per day, most scanned | **Dashboard** |
| Spot fake or mistyped packets | Dashboard → *Unknown codes scanned* (each has a **Register** button) |
| Add / edit / delete a batch | **Batches** → Add, pencil icon, bin icon |
| Mark Verified / Pending / Rejected quickly | Status dropdown in the Batches table |
| Update many batches at once | **Import / export**: download CSV, edit in Excel/Sheets, upload (matched by batch code; add + update only, never deletes; all-or-nothing) |
| Print QR stickers | **QR labels**: tick batches, check the *public website address*, Print (or download SVG for a printer/designer) |
| See who changed what | **Activity** → Admin changes (every create/edit/delete/import is logged) |
| Change password | **Account** (signs out all other devices) |

**Before printing labels for real packets**, set the *public website address* to your live domain (or set `PUBLIC_URL` in `.env`). A QR code that points to `localhost` will not work for anyone else. The page warns you if it detects this.

## 4. How it works

### API

Public (no login):

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/batches?q=&crop=&status=&sort=&limit=&offset=` | Search the directory |
| GET | `/api/batches/crops` | Crop names for filters |
| GET | `/api/batches/:code?source=camera` | One batch (logged as a scan; unknown codes are logged too) |
| GET | `/api/config`, `/api/health` | Public URL, health check |

Admin (cookie session):

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/login`, `/api/auth/logout` | Sign in/out |
| GET | `/api/auth/me` | Current user or `null` |
| POST | `/api/auth/change-password` | Change password |
| GET/POST | `/api/admin/batches` | List / create |
| GET/PUT/DELETE | `/api/admin/batches/:id` | Read / update / delete |
| PATCH | `/api/admin/batches/:id/status` | Change status |
| POST | `/api/admin/batches/bulk` | Import (`{items, dryRun}`) |
| GET | `/api/admin/export.csv` | Download all batches |
| GET | `/api/admin/stats`, `/audit`, `/lookups` | Dashboard, change log, scan log |

### Database (SQLite, one file: `server/data/seedsure.db`)

- `admins`: email, scrypt password hash, token version
- `batches`: batch_code (unique, case-insensitive), seed_name, brand, crop, variety, germination (0-100 or empty), status, packed, expiry, soil, season, fertilizer, description, icon, color, timestamps
- `lookups`: every public scan (code, found?, camera/manual/image/link, hashed IP, time)
- `audit_log`: every admin action

Schema changes go in the `MIGRATIONS` array in `server/src/db.js` (append only). To add a field to batches: add a migration, then add the field name to `FIELDS`/`COLUMN` in `server/src/repo.js`, `parseBatch` in `server/src/validation.js`, the form in `client/src/pages/admin/BatchForm.jsx`, and the detail page.

### Security built in

Passwords hashed with scrypt; sessions are signed JWTs in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` in production); changing the password invalidates every other session; login rate-limited (per IP and per IP+email) with constant-time checks so account existence can't be probed; cross-site write requests rejected (Origin check); strict Content-Security-Policy and other headers; all input validated server-side; SQL uses bound parameters only; CSV export neutralises spreadsheet formula injection; static file serving blocks path traversal.

## 5. Put it online

You need a host that runs Node 22+ and keeps a **persistent disk** (the database is a file). Examples: a small VPS (DigitalOcean, Hetzner, Lightsail), Render or Railway with a disk, Fly.io with a volume.

```bash
npm --prefix client install && npm run build      # builds client/dist
```

Set these environment variables on the host (see `server/.env.example`):

```
NODE_ENV=production
JWT_SECRET=<48+ random characters>          # node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=<strong password>            # used once, to create the first admin
PUBLIC_URL=https://seedsure.yourdomain.com
TRUST_PROXY=1                               # when behind a proxy/platform load balancer
DB_PATH=/data/seedsure.db                   # a path on the persistent disk
```

Start with `npm start`. In production the server **refuses to start** with a missing/short `JWT_SECRET` or the default admin password. HTTPS comes from your platform or from a reverse proxy such as Caddy (`seedsure.yourdomain.com { reverse_proxy localhost:4000 }` gets you automatic certificates).

A `Dockerfile` is included: `docker build -t seedsure . && docker run -p 4000:4000 -v seedsure-data:/data -e JWT_SECRET=... -e ADMIN_EMAIL=... -e ADMIN_PASSWORD=... -e PUBLIC_URL=... seedsure`.

**Backups:** `npm run backup` writes a consistent copy to `server/backups/`. Schedule it (cron) and copy the files off the machine.

## 6. Honest status of this code

- **Tested:** the whole backend has 16 automated tests (`npm test`: auth, CRUD, validation, bulk import, CSV, stats, rate limiting, CSRF, production config checks), and it was run live including static serving and path-traversal probes.
- **Checked but not run in a browser:** the React app was compiled for syntax/imports and every page was render-tested with stand-ins for the UI libraries. It has **not** been run in a real browser, and the camera scanner has **not** been tried on a real device. The environment this was built in could not install npm packages. Expect to do a first pass of clicking through it; if something misbehaves, the likeliest places are `QrScanner.jsx` and CSS polish in `admin.css`.
- **Docker:** the Dockerfile has not been built.
- SQLite is the right size for this project (thousands of batches, many scans). If you later need several servers or very heavy traffic, move to PostgreSQL by replacing `server/src/db.js` and `repo.js`.
- Scan counts include repeat views (and dev-mode double renders), so treat them as activity, not unique people.
- The app shows information the admin enters. It is **not** an official seed certification: keep the disclaimers on the About and batch pages.
