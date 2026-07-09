// Server-only helpers for the reseller-sync webhook and admin retry flow.
// Handles image rehosting into our own bucket and category fallback resolution
// via user-configurable mappings.

type SupabaseAdmin = {
  from: (table: string) => any;
  storage: { from: (b: string) => any };
};

export type RehostResult = {
  imageUrl: string | null;
  status: "ok" | "failed" | "skipped";
  error: string | null;
  attempted_at: string;
};

// Try each candidate URL (primary image, then media items) until one is
// successfully downloaded, uploaded to `reseller-images`, and signed.
export async function rehostImageFromCandidates(
  supabaseAdmin: SupabaseAdmin,
  externalId: string,
  candidates: string[],
): Promise<RehostResult> {
  const attempted_at = new Date().toISOString();
  const unique = Array.from(new Set(candidates.filter(Boolean)));
  if (unique.length === 0) {
    return { imageUrl: null, status: "skipped", error: "no image URLs provided", attempted_at };
  }

  let lastError: string | null = null;
  for (const src of unique) {
    try {
      const res = await fetch(src, { headers: { "User-Agent": "EazyStore-Sync/1.0" } });
      if (!res.ok) {
        lastError = `fetch ${res.status} ${res.statusText} — ${src.slice(0, 160)}`;
        continue;
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength === 0) {
        lastError = `empty body — ${src.slice(0, 160)}`;
        continue;
      }
      const ct = res.headers.get("content-type") || "image/jpeg";
      const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : ct.includes("gif") ? "gif" : "jpg";
      const path = `${externalId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("reseller-images")
        .upload(path, buf, { contentType: ct, upsert: true });
      if (upErr) {
        lastError = `upload ${upErr.message}`;
        continue;
      }
      const { data: signed, error: signErr } = await supabaseAdmin.storage
        .from("reseller-images")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10); // 10 years
      if (signErr || !signed?.signedUrl) {
        lastError = `sign ${signErr?.message ?? "no url returned"}`;
        continue;
      }
      return { imageUrl: signed.signedUrl, status: "ok", error: null, attempted_at };
    } catch (e) {
      lastError = `exception ${(e as Error).message}`;
    }
  }
  return { imageUrl: unique[0] ?? null, status: "failed", error: lastError, attempted_at };
}

export type RehostAllResult = {
  imageUrls: string[];
  status: "ok" | "partial" | "failed" | "skipped";
  error: string | null;
  attempted_at: string;
};

// Rehost every candidate URL. Returns all that succeeded, in original order.
export async function rehostAllImages(
  supabaseAdmin: SupabaseAdmin,
  externalId: string,
  candidates: string[],
): Promise<RehostAllResult> {
  const attempted_at = new Date().toISOString();
  const unique = Array.from(new Set(candidates.filter(Boolean)));
  if (unique.length === 0) {
    return { imageUrls: [], status: "skipped", error: "no image URLs provided", attempted_at };
  }
  const successes: string[] = [];
  const errors: string[] = [];
  for (const src of unique) {
    try {
      const res = await fetch(src, { headers: { "User-Agent": "EazyStore-Sync/1.0" } });
      if (!res.ok) { errors.push(`fetch ${res.status} — ${src.slice(0, 100)}`); continue; }
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength === 0) { errors.push(`empty — ${src.slice(0, 100)}`); continue; }
      const ct = res.headers.get("content-type") || "image/jpeg";
      const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : ct.includes("gif") ? "gif" : "jpg";
      const path = `${externalId}/${Date.now()}-${successes.length}.${ext}`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("reseller-images")
        .upload(path, buf, { contentType: ct, upsert: true });
      if (upErr) { errors.push(`upload ${upErr.message}`); continue; }
      const { data: signed, error: signErr } = await supabaseAdmin.storage
        .from("reseller-images")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signErr || !signed?.signedUrl) { errors.push(`sign ${signErr?.message ?? "no url"}`); continue; }
      successes.push(signed.signedUrl);
    } catch (e) {
      errors.push(`exception ${(e as Error).message}`);
    }
  }
  const status: RehostAllResult["status"] =
    successes.length === 0 ? "failed"
    : successes.length === unique.length ? "ok"
    : "partial";
  return {
    imageUrls: successes,
    status,
    error: errors.length ? errors.join("; ") : null,
    attempted_at,
  };
}

// Dotted-path getter, e.g. getByPath({a:{b:"x"}}, "a.b") === "x".
export function getByPath(obj: unknown, path: string): unknown {
  if (!obj || !path) return undefined;
  const parts = path.split(".").map((p) => p.trim()).filter(Boolean);
  let cur: any = obj;
  for (const key of parts) {
    if (cur == null) return undefined;
    cur = cur[key];
  }
  return cur;
}

export type CategoryMappingRow = {
  id: string;
  source: string | null;
  payload_path: string | null;
  fallback_value: string | null;
  priority: number;
  notes: string | null;
};

export type CategoryResolution = {
  category: string | null;
  missingReason: string | null;
  matched: { source: "payload" | "mapping_path" | "mapping_fallback"; detail: string } | null;
};

// If the payload doesn't have a category, walk user-defined mappings in
// priority order. Prefer mappings scoped to the same supplier `source`, then
// fall back to global (source IS NULL) mappings.
export async function resolveCategory(
  supabaseAdmin: SupabaseAdmin,
  rawPayload: Record<string, unknown>,
  supplierSource: string | null,
  providedCategory: string | null,
): Promise<CategoryResolution> {
  if (providedCategory && providedCategory.trim().length > 0) {
    return {
      category: providedCategory.trim(),
      missingReason: null,
      matched: { source: "payload", detail: "category field" },
    };
  }

  const { data, error } = await supabaseAdmin
    .from("reseller_category_mappings")
    .select("id, source, payload_path, fallback_value, priority, notes")
    .order("priority", { ascending: true });
  if (error) {
    return {
      category: null,
      missingReason: `Supplier did not send category. Mapping lookup failed: ${error.message}`,
      matched: null,
    };
  }

  const mappings = (data ?? []) as CategoryMappingRow[];
  const src = (supplierSource ?? "").trim().toLowerCase();
  const scoped = mappings.filter((m) => m.source && m.source.trim().toLowerCase() === src);
  const global = mappings.filter((m) => !m.source);
  const attemptedPaths: string[] = [];

  for (const m of [...scoped, ...global]) {
    if (m.payload_path) {
      const val = getByPath(rawPayload, m.payload_path);
      attemptedPaths.push(m.payload_path);
      const s = typeof val === "string" ? val.trim() : val != null ? String(val).trim() : "";
      if (s) {
        return {
          category: s,
          missingReason: null,
          matched: { source: "mapping_path", detail: `${m.payload_path}${m.source ? ` (supplier=${m.source})` : ""}` },
        };
      }
    }
    if (m.fallback_value && m.fallback_value.trim()) {
      return {
        category: m.fallback_value.trim(),
        missingReason: null,
        matched: {
          source: "mapping_fallback",
          detail: `literal "${m.fallback_value.trim()}"${m.source ? ` (supplier=${m.source})` : ""}`,
        },
      };
    }
  }

  if (mappings.length === 0) {
    return {
      category: null,
      missingReason: "Supplier did not send a category field, and no category mappings are configured.",
      matched: null,
    };
  }
  return {
    category: null,
    missingReason: `Supplier did not send a category field. Tried mapping paths: ${
      attemptedPaths.length > 0 ? attemptedPaths.join(", ") : "(no path mappings for this supplier)"
    }.`,
    matched: null,
  };
}
