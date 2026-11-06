import { config } from "./config.js";
import { openDb } from "./db.js";
import { createApp } from "./app.js";
import { bootstrap } from "./seed.js";

const db = openDb(config.dbPath);
for (const msg of await bootstrap(db, config)) console.log(`[setup] ${msg}`);

const server = createApp({ db, config });
server.listen(config.port, config.host, () => {
  console.log(`SeedSure API running on http://localhost:${config.port}  (${config.isProd ? "production" : "development"})`);
  console.log(`Database: ${config.dbPath}`);
});

function shutdown(signal) {
  console.log(`\n${signal} received, shutting down...`);
  server.close(() => { db.close(); process.exit(0); });
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
