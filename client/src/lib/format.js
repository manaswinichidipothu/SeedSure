export function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function formatDateTime(sqliteUtc) {
  if (!sqliteUtc) return "—";
  const d = new Date(`${sqliteUtc.replace(" ", "T")}Z`);
  return Number.isNaN(d.getTime()) ? sqliteUtc : d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export const germLabel = (g) => (g === null || g === undefined ? "N/A" : `${g}%`);

export const COLORS = ["green", "gold", "orange", "red", "purple", "blue"];
export const ICONS = ["🌱", "🌾", "🌽", "🍅", "🥜", "🌻", "🥕", "🧅", "🌶️", "🍆", "🥔", "🫘", "🍉", "🥬", "☕", "🎋"];
export const STATUSES = ["Verified", "Pending", "Rejected"];
