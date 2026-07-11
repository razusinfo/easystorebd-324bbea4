// Client-side validation + dedup rules for the "Add my site" media picker.
// Kept pure so it can be unit-tested without a DOM.

export const MAX_MEDIA_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MEDIA_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const ALLOWED_MEDIA_EXT = ["jpg", "jpeg", "png", "webp", "gif"] as const;

export type MediaFileLike = { name: string; type: string; size: number };

export function validateMediaFile(
  file: MediaFileLike,
): { ok: true } | { ok: false; reason: "type" | "size" | "empty"; message: string } {
  if (file.size <= 0) {
    return { ok: false, reason: "empty", message: `"${file.name}" খালি ফাইল / empty file` };
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const typeOk =
    (ALLOWED_MEDIA_MIME as readonly string[]).includes(file.type) ||
    (ALLOWED_MEDIA_EXT as readonly string[]).includes(ext);
  if (!typeOk) {
    return {
      ok: false,
      reason: "type",
      message: `"${file.name}" অনুমোদিত টাইপ নয় (JPG/PNG/WEBP/GIF) / unsupported type`,
    };
  }
  if (file.size > MAX_MEDIA_FILE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      ok: false,
      reason: "size",
      message: `"${file.name}" ${mb}MB — সর্বোচ্চ ৫MB / max 5MB`,
    };
  }
  return { ok: true };
}

/** Split incoming files into accepted vs rejected (with reason messages). */
export function partitionMediaFiles<T extends MediaFileLike>(files: T[]): {
  accepted: T[];
  rejected: { file: T; message: string }[];
} {
  const accepted: T[] = [];
  const rejected: { file: T; message: string }[] = [];
  for (const f of files) {
    const r = validateMediaFile(f);
    if (r.ok) accepted.push(f);
    else rejected.push({ file: f, message: r.message });
  }
  return { accepted, rejected };
}

/**
 * Filter uploaded URLs against the URLs already present in the picker.
 * Also collapses duplicates within `incoming` itself. Returns which URLs to
 * add and which display names were skipped as duplicates.
 */
export function dedupeAgainstExisting(
  existingUrls: string[],
  incoming: { url: string; name: string }[],
): { toAdd: { url: string; name: string }[]; duplicates: string[] } {
  const seen = new Set(existingUrls);
  const toAdd: { url: string; name: string }[] = [];
  const duplicates: string[] = [];
  for (const item of incoming) {
    if (seen.has(item.url)) {
      duplicates.push(item.name);
      continue;
    }
    seen.add(item.url);
    toAdd.push(item);
  }
  return { toAdd, duplicates };
}
