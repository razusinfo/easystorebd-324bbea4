import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Guards against server-only imports leaking into the client bundle.
 * Scans dist/client/**\/*.js for forbidden module specifiers.
 *
 * Skipped locally unless dist/client exists — CI runs `bun run build`
 * before `bun run test` so the artifacts are present.
 */
const CLIENT_DIST = join(process.cwd(), "dist", "client");

const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /@tanstack\/react-start\/server/, reason: "server-only runtime utilities" },
  { pattern: /@supabase\/supabase-js.*service_role/i, reason: "service-role key" },
  { pattern: /SUPABASE_SERVICE_ROLE_KEY/, reason: "service-role secret name" },
  { pattern: /LOVABLE_API_KEY/, reason: "server-only AI gateway key" },
  { pattern: /client\.server(?:\.[cm]?[jt]sx?)?["']/, reason: "*.server module import" },
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) out.push(...walk(full));
    else if (entry.endsWith(".js") || entry.endsWith(".mjs")) out.push(full);
  }
  return out;
}

describe("client bundle guard", () => {
  let files: string[] = [];
  try {
    files = walk(CLIENT_DIST);
  } catch {
    // No build output — skip. CI must run build before tests.
  }

  const runOrSkip = files.length > 0 ? it : it.skip;

  runOrSkip("does not include server-only imports", () => {
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
        if (pattern.test(content)) {
          violations.push(`${file.replace(CLIENT_DIST, "")}: ${reason} (${pattern})`);
        }
      }
    }
    expect(violations, `Server-only code leaked into client bundle:\n${violations.join("\n")}`).toEqual([]);
  });
});
