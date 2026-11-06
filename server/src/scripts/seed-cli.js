// npm run seed            -> insert sample batches if the table is empty
// npm run seed -- --reset -> DELETE all batches, lookups and audit rows, then insert samples
import { config } from "../config.js";
import { openDb } from "../db.js";
import { seedSample } from "../seed.js";

const db = openDb(config.dbPath);
if (process.argv.includes("--reset")) {
  db.exec("DELETE FROM batches; DELETE FROM lookups; DELETE FROM audit_log;");
  console.log("All batch data cleared.");
}
console.log(`Inserted ${seedSample(db)} sample batches.`);
db.close();
