export const STATUSES = ["Verified", "Pending", "Rejected"];
export const COLORS = ["green", "gold", "orange", "red", "purple", "blue"];
export const BATCH_CODE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isRealDate = (s) => {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

const TEXT_FIELDS = {
  seedName: { max: 120, required: true, label: "Seed name" },
  brand: { max: 120, required: true, label: "Brand" },
  crop: { max: 60, required: true, label: "Crop type" },
  variety: { max: 120, label: "Variety" },
  soil: { max: 500, label: "Suitable soil" },
  season: { max: 500, label: "Sowing season" },
  fertilizer: { max: 1000, label: "Fertilizer guidance" },
  description: { max: 2000, label: "Description" },
};

/**
 * Validate a batch payload from the client.
 * partial=true: only validate keys that are present (used by PUT/PATCH merges).
 * Returns { value, errors } where errors is { field: message }.
 */
export function parseBatch(input, { partial = false } = {}) {
  const errors = {};
  const value = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(input, k);
  const str = (v) => (v === undefined || v === null ? "" : String(v).trim());

  for (const [key, rule] of Object.entries(TEXT_FIELDS)) {
    if (partial && !has(key)) continue;
    const v = str(input[key]);
    if (rule.required && !v) errors[key] = `${rule.label} is required.`;
    else if (v.length > rule.max) errors[key] = `${rule.label} must be ${rule.max} characters or fewer.`;
    else value[key] = v;
  }

  if (!partial || has("batchCode")) {
    const v = str(input.batchCode);
    if (!v) errors.batchCode = "Batch code is required.";
    else if (!BATCH_CODE_RE.test(v)) {
      errors.batchCode = "Batch code must be 2-64 characters: letters, numbers, dot, dash or underscore (no spaces).";
    } else value.batchCode = v;
  }

  if (!partial || has("germination")) {
    const raw = input.germination;
    if (raw === undefined || raw === null || raw === "") value.germination = null;
    else {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0 || n > 100) errors.germination = "Germination must be a whole number from 0 to 100.";
      else value.germination = n;
    }
  }

  if (!partial || has("status")) {
    const v = str(input.status) || "Pending";
    if (!STATUSES.includes(v)) errors.status = `Status must be one of: ${STATUSES.join(", ")}.`;
    else value.status = v;
  }

  for (const [key, label] of [["packed", "Packed date"], ["expiry", "Expiry date"]]) {
    if (partial && !has(key)) continue;
    const v = str(input[key]);
    if (!v) value[key] = null;
    else if (!isRealDate(v)) errors[key] = `${label} must be a valid date (YYYY-MM-DD).`;
    else value[key] = v;
  }

  if (!partial || has("icon")) {
    const v = str(input.icon) || "🌱";
    if ([...v].length > 4) errors.icon = "Icon should be a single emoji.";
    else value.icon = v;
  }

  if (!partial || has("color")) {
    const v = str(input.color) || "green";
    if (!COLORS.includes(v)) errors.color = `Colour must be one of: ${COLORS.join(", ")}.`;
    else value.color = v;
  }

  return { value, errors };
}

/** Cross-field rule, run on the final merged record. */
export function crossCheck(record, errors) {
  if (record.packed && record.expiry && record.expiry < record.packed && !errors.expiry) {
    errors.expiry = "Expiry date cannot be before the packed date.";
  }
  return errors;
}

export function validatePassword(pw) {
  if (typeof pw !== "string" || pw.length < 10) return "Password must be at least 10 characters.";
  if (pw.length > 200) return "Password is too long.";
  return null;
}
