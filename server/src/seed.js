import { hashPassword } from "./security.js";
import { validatePassword } from "./validation.js";

export const SAMPLE_BATCHES = [
  { batchCode: "GF-RICE-2401", seedName: "Swarna Paddy", brand: "GreenField Seeds", crop: "Rice", variety: "Swarna-Sub1", germination: 92, status: "Verified", packed: "2026-01-10", expiry: "2027-01-10", soil: "Clayey and loamy soil with good water retention", season: "Kharif (June–July)", fertilizer: "Use soil-test-based NPK recommendations. Split nitrogen application during crop growth.", description: "A popular paddy variety suitable for lowland cultivation. Confirm local suitability with your agriculture extension officer.", icon: "🌾", color: "gold" },
  { batchCode: "AN-MAIZE-882", seedName: "Hybrid Maize", brand: "AgriNova", crop: "Maize", variety: "AN-HM 707", germination: 96, status: "Verified", packed: "2026-02-14", expiry: "2027-02-14", soil: "Well-drained loamy soil; avoid waterlogged fields", season: "Kharif or Rabi, depending on region", fertilizer: "Base fertilizer and top dressing should follow a local soil test and regional crop guidance.", description: "Hybrid maize seed for demonstration purposes. Select a hybrid suitable for your climate and sowing window.", icon: "🌽", color: "green" },
  { batchCode: "HP-GN-517", seedName: "Groundnut", brand: "HarvestPro", crop: "Groundnut", variety: "HP-Runner 12", germination: 88, status: "Pending", packed: "2026-03-02", expiry: "2026-12-02", soil: "Light, well-drained sandy loam soil", season: "Season depends on rainfall and local conditions", fertilizer: "Use soil-test guidance; calcium and other nutrients may be important depending on soil conditions.", description: "Sample record awaiting verification of the batch information.", icon: "🥜", color: "orange" },
  { batchCode: "FB-TOM-330", seedName: "Tomato", brand: "FarmBright", crop: "Vegetable", variety: "FB Ruby", germination: 94, status: "Verified", packed: "2026-04-06", expiry: "2027-04-06", soil: "Fertile, well-drained loamy soil", season: "Follow the locally recommended planting season", fertilizer: "Apply compost and nutrients according to soil testing and crop stage.", description: "Demonstration vegetable seed entry with basic growing guidance.", icon: "🍅", color: "red" },
  { batchCode: "GF-BG-421", seedName: "Black Gram", brand: "GreenField Seeds", crop: "Pulse", variety: "GF-Black 21", germination: 90, status: "Rejected", packed: "2025-11-01", expiry: "2026-05-01", soil: "Well-drained loamy soil", season: "Varies by local cropping system", fertilizer: "Follow locally approved pulse-crop nutrient recommendations.", description: "Sample record marked rejected to demonstrate how the website displays a warning.", icon: "🌱", color: "purple" },
];

/** Create the first admin (from env) if there are none. Returns a message for the log. */
export async function ensureAdmin(db, config) {
  const count = db.prepare("SELECT COUNT(*) n FROM admins").get().n;
  if (count > 0) return null;
  if (!config.adminEmail || !config.adminPassword) {
    return "No admin exists yet. Set ADMIN_EMAIL and ADMIN_PASSWORD in .env, or run `npm run create-admin`.";
  }
  const problem = validatePassword(config.adminPassword);
  if (problem) return `ADMIN_PASSWORD rejected: ${problem}`;
  db.prepare("INSERT INTO admins (email, name, password_hash) VALUES (?, ?, ?)")
    .run(config.adminEmail.toLowerCase(), config.adminName, await hashPassword(config.adminPassword));
  return `Created admin account ${config.adminEmail.toLowerCase()}`;
}

export function seedSample(db, { force = false } = {}) {
  const existing = db.prepare("SELECT COUNT(*) n FROM batches").get().n;
  if (existing > 0 && !force) return 0;
  const insert = db.prepare(`INSERT OR IGNORE INTO batches
    (batch_code, seed_name, brand, crop, variety, germination, status, packed, expiry, soil, season, fertilizer, description, icon, color)
    VALUES (@batchCode, @seedName, @brand, @crop, @variety, @germination, @status, @packed, @expiry, @soil, @season, @fertilizer, @description, @icon, @color)`);
  let n = 0;
  for (const b of SAMPLE_BATCHES) n += Number(insert.run(b).changes);
  return n;
}

export async function bootstrap(db, config) {
  const messages = [];
  const adminMsg = await ensureAdmin(db, config);
  if (adminMsg) messages.push(adminMsg);
  if (config.seedSample) {
    const n = seedSample(db);
    if (n) messages.push(`Inserted ${n} sample batches`);
  }
  return messages;
}
