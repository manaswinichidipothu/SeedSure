// Creates server/.env from the example with a fresh random JWT secret (only if it doesn't exist yet).
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "server");
const target = path.join(dir, ".env");
if (fs.existsSync(target)) { console.log("server/.env already exists, leaving it alone."); process.exit(0); }
const secret = crypto.randomBytes(48).toString("hex");
const text = fs.readFileSync(path.join(dir, ".env.example"), "utf8").replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`);
fs.writeFileSync(target, text, { mode: 0o600 });
console.log("Created server/.env. Open it and set ADMIN_EMAIL / ADMIN_PASSWORD before first start.");
