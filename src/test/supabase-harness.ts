// Minimal Supabase test harness.
// Builds a chainable stub client whose `.from(table)` returns queued responses.
// Enough surface for our server-fn core logic: select().eq().eq().limit().maybeSingle(),
// select().eq().maybeSingle(), select().eq() (awaited), insert(...).select().single().
//
// Usage:
//   const admin = createSupabaseHarness({
//     reseller_products: { maybeSingle: { data: {...}, error: null } },
//     stores:             { maybeSingle: { data: { id: "store-1" }, error: null } },
//     product_categories: { maybeSingle: { data: { id: "cat-1" }, error: null } },
//     products: [
//       { maybeSingle: { data: null, error: null } },   // dedup check
//       { single:      { data: { id: "new-id" }, error: null } }, // insert
//     ],
//   });
//
// A per-table config can be a single response object or an array (consumed in order).

import { vi } from "vitest";

export type Response<T = any> = { data: T; error: any };

export type TableConfig = {
  maybeSingle?: Response;
  single?: Response;
  await?: Response; // for `await supabase.from(t).select().eq(...)` shape
  insertOk?: boolean;
};

export type HarnessConfig = Record<string, TableConfig | TableConfig[]>;

export function createSupabaseHarness(config: HarnessConfig) {
  const cursors: Record<string, number> = {};
  const inserts: Array<{ table: string; payload: any }> = [];
  const updates: Array<{ table: string; payload: any }> = [];
  const audits: any[] = [];

  function nextFor(table: string): TableConfig {
    const entry = config[table];
    if (!entry) throw new Error(`[harness] unmocked table: ${table}`);
    if (Array.isArray(entry)) {
      const idx = cursors[table] ?? 0;
      cursors[table] = idx + 1;
      return entry[Math.min(idx, entry.length - 1)];
    }
    return entry;
  }

  function makeChain(table: string) {
    const chain: any = {};
    chain.select = () => chain;
    chain.eq = () => chain;
    chain.ilike = () => chain;
    chain.in = () => chain;
    chain.order = () => chain;
    chain.limit = () => chain;
    chain.maybeSingle = async () => nextFor(table).maybeSingle ?? { data: null, error: null };
    chain.single = async () => nextFor(table).single ?? { data: null, error: null };
    chain.insert = (payload: any) => {
      inserts.push({ table, payload });
      if (table === "reseller_marketplace_audit_logs") audits.push(payload);
      return chain;
    };
    chain.update = (payload: any) => {
      updates.push({ table, payload });
      return chain;
    };
    // Awaitable directly (e.g. select().eq() or update().eq() with no terminal method)
    chain.then = (r: any, j: any) => {
      const entry = config[table] ? nextFor(table).await : undefined;
      return Promise.resolve(entry ?? { data: [], error: null }).then(r, j);
    };
    return chain;
  }

  const rpcCalls: Array<{ fn: string; args: any }> = [];
  const client = {
    from: vi.fn((table: string) => makeChain(table)),
    rpc: vi.fn(async (fn: string, args: any) => {
      rpcCalls.push({ fn, args });
      const cfg = (config as any)[`rpc:${fn}`];
      return cfg ?? { data: null, error: null };
    }),
  };
  return { client, inserts, updates, audits, rpcCalls };
}

/** Convenience: a user-scoped supabase stub that returns a single role. */
export function userClientWithRole(role: string | null) {
  return createSupabaseHarness({
    user_roles: { await: { data: role ? [{ role }] : [], error: null } },
  }).client;
}
