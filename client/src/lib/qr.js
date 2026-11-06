const CODE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/;

/**
 * Turn whatever a QR code contains into a batch code, or null if it isn't one of ours.
 * Accepts:  GF-RICE-2401
 *           SEEDSURE:GF-RICE-2401   (and legacy SEEDTRACKER:...)
 *           https://your-site.com/seed/GF-RICE-2401
 */
export function parseQrPayload(raw) {
  let s = String(raw ?? "").trim();
  if (!s) return null;

  const prefixed = s.match(/^(?:SEEDSURE|SEEDTRACKER)\s*:\s*(.+)$/i);
  if (prefixed) s = prefixed[1].trim();
  else if (/^https?:\/\//i.test(s)) {
    try {
      const url = new URL(s);
      const m = url.pathname.match(/\/seed\/([^/]+)\/?$/i);
      s = m ? decodeURIComponent(m[1]) : url.searchParams.get("code") || url.searchParams.get("batch") || "";
    } catch {
      return null;
    }
  }
  return CODE_RE.test(s) ? s : null;
}

/** The URL that gets printed inside a packet's QR code. */
export const seedUrl = (base, code) => `${String(base).replace(/\/+$/, "")}/seed/${encodeURIComponent(code)}`;
