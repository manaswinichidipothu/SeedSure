// npm run backup -> writes a consistent copy of the database to server/backups/
import fs from "node:fs";
import path from "node:path";
import { ROOT, config } from "../config.js";
import { openDb } from "../db.js";

const dir = path.join(ROOT, "backups");
fs.mkdirSync(dir, { recursive: true });
const target = path.join(dir, `seedsure-${new Date().toISOString().replace(/[:.]/g, "-")}.db`);
const db = openDb(config.dbPath);
db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
db.close();
console.log(`Backup written: ${target}`);
