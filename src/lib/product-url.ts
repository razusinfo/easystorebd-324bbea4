// Pure helpers for validating & normalizing pasted dropshipping product URLs.
// Used by the "Fetch Product" flow (single and bulk importers).

export type NormalizeResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

const TRACKING_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "gclid", "fbclid", "mc_cid", "mc_eid", "_ga", "ref", "ref_src", "spm",
  "aff", "affid", "affiliate", "tracking_id", "trk", "yclid",
]);

export function normalizeProductUrl(raw: string): NormalizeResult {
  let s = (raw ?? "").trim();
  if (!s) return { ok: false, error: "URL is empty" };

  // Strip whitespace inside (accidental paste)
  s = s.replace(/\s+/g, "");

  // Add protocol if missing
  if (!/^https?:\/\//i.test(s)) {
    if (/^\/\//.test(s)) s = "https:" + s;
    else s = "https://" + s;
  }

  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return { ok: false, error: "Not a valid URL" };
  }

  if (!/^https?:$/.test(u.protocol)) {
    return { ok: false, error: "Only http(s) URLs are supported" };
  }
  if (!u.hostname || !u.hostname.includes(".")) {
    return { ok: false, error: "URL is missing a valid host" };
  }

  // Strip common tracking params to increase dedup hit-rate
  const keep: [string, string][] = [];
  u.searchParams.forEach((v, k) => {
    if (!TRACKING_PARAMS.has(k.toLowerCase())) keep.push([k, v]);
  });
  u.search = "";
  for (const [k, v] of keep) u.searchParams.append(k, v);

  // Drop fragment
  u.hash = "";
  // Lowercase host
  u.hostname = u.hostname.toLowerCase();

  return { ok: true, url: u.toString() };
}

/** Split a textarea blob (newlines/commas) into a de-duped list of normalized URLs. */
export function parseBulkUrls(blob: string): { urls: string[]; invalid: string[] } {
  const parts = (blob ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const urls: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const r = normalizeProductUrl(p);
    if (!r.ok) {
      invalid.push(p);
      continue;
    }
    if (seen.has(r.url)) continue;
    seen.add(r.url);
    urls.push(r.url);
  }
  return { urls, invalid };
}
