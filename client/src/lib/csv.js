/** Minimal RFC 4180 CSV parser (quotes, escaped quotes, commas/newlines inside quotes, BOM). */
export function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", inQuotes = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false; }
      else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v.trim() !== "")) rows.push(row);
  return rows;
}

export const BATCH_COLUMNS = ["batchCode", "seedName", "brand", "crop", "variety", "germination", "status", "packed", "expiry", "soil", "season", "fertilizer", "description", "icon", "color"];

// Friendly header names people might use in Excel -> our field names.
const ALIASES = {
  batchcode: "batchCode", batch: "batchCode", code: "batchCode", batchid: "batchCode",
  seedname: "seedName", seed: "seedName", name: "seedName",
  brand: "brand", company: "brand", crop: "crop", croptype: "crop", variety: "variety",
  germination: "germination", germinationrate: "germination", germ: "germination", status: "status",
  packed: "packed", packeddate: "packed", packedon: "packed", expiry: "expiry", expirydate: "expiry",
  soil: "soil", suitablesoil: "soil", season: "season", sowingseason: "season",
  fertilizer: "fertilizer", fertiliser: "fertilizer", fertilizerguidance: "fertilizer",
  description: "description", icon: "icon", color: "color", colour: "color",
};

/** Convert CSV text into { items, unknownHeaders, missing }. Values are strings; the server validates them. */
export function csvToBatches(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { items: [], unknownHeaders: [], missing: [], error: "The file needs a header row and at least one data row." };
  const headers = rows[0].map((h) => ALIASES[h.trim().toLowerCase().replace(/[^a-z]/g, "")] || null);
  const unknownHeaders = rows[0].filter((_, i) => !headers[i]).map((h) => h.trim()).filter(Boolean);
  const missing = ["batchCode", "seedName", "brand", "crop"].filter((k) => !headers.includes(k));
  const items = rows.slice(1).map((r) => {
    const o = {};
    headers.forEach((key, i) => { if (key) o[key] = (r[i] ?? "").trim(); });
    return o;
  });
  return { items, unknownHeaders, missing, error: "" };
}

export function templateCsv() {
  const sample = ["GF-RICE-2401", "Swarna Paddy", "GreenField Seeds", "Rice", "Swarna-Sub1", "92", "Pending", "2026-01-10", "2027-01-10", "Clayey loam", "Kharif (June–July)", "Follow soil-test advice", "Lowland paddy variety", "🌾", "gold"];
  return `${BATCH_COLUMNS.join(",")}\r\n${sample.map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(",")}\r\n`;
}
