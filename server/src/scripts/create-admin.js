// npm run create-admin                       -> prompts for email + password
// ADMIN_EMAIL=.. ADMIN_PASSWORD=.. npm run create-admin
// Existing email? The password is reset and every old session is signed out.
import readline from "node:readline";
import { config } from "../config.js";
import { openDb } from "../db.js";
import { hashPassword } from "../security.js";
import { validatePassword } from "../validation.js";

function ask(question, { hidden = false } = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) rl._writeToOutput = (s) => { if (s.includes(question)) process.stdout.write(s); };
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); if (hidden) process.stdout.write("\n"); resolve(a); }));
}

const email = (process.env.ADMIN_EMAIL || (await ask("Admin email: "))).trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || (await ask("Password (hidden, 10+ chars): ", { hidden: true }));
const name = process.env.ADMIN_NAME || "Admin";

if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { console.error("That doesn't look like an email address."); process.exit(1); }
const problem = validatePassword(password);
if (problem) { console.error(problem); process.exit(1); }

const db = openDb(config.dbPath);
const hash = await hashPassword(password);
const existing = db.prepare("SELECT id FROM admins WHERE email = ?").get(email);
if (existing) {
  db.prepare("UPDATE admins SET password_hash = ?, token_version = token_version + 1 WHERE id = ?").run(hash, existing.id);
  console.log(`Password updated for ${email}.`);
} else {
  db.prepare("INSERT INTO admins (email, name, password_hash) VALUES (?, ?, ?)").run(email, name, hash);
  console.log(`Admin ${email} created.`);
}
db.close();
