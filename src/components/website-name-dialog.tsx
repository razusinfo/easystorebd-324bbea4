import { useEffect, useState } from "react";
import { Loader2, Globe, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  usePublishStore, useChangeSlug, slugifyStoreName, buildStorefrontUrl,
  type StoreRow,
} from "@/lib/eazystore-data";
import { toast } from "sonner";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function tryDirectInsert(kind: "created" | "changed", store: StoreRow, slug: string) {
  const title = kind === "created"
    ? "New reseller website published"
    : "Reseller changed website name";
  const body = `${store.name} → ${slug}.easystorebd.com`;
  return supabase.from("admin_notifications").insert({
    type: kind === "created" ? "reseller_site_created" : "reseller_site_changed",
    title,
    body,
    link: buildStorefrontUrl(slug),
    related_id: store.id,
  });
}

/**
 * Best-effort admin notification with:
 *  1. Direct insert (RLS-guarded policy for reseller_site_* types)
 *  2. Exponential-backoff retry on network/5xx failures
 *  3. SECURITY DEFINER RPC fallback so the event is never lost
 * Returns { ok, via } for the caller to reflect in UI.
 */
export async function notifyAdmin(
  kind: "created" | "changed",
  store: StoreRow,
  slug: string,
): Promise<{ ok: boolean; via: "insert" | "rpc" | "none"; error?: string }> {
  let lastErr: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { error } = await tryDirectInsert(kind, store, slug);
    if (!error) return { ok: true, via: "insert" };
    lastErr = error;
    // Do not retry on hard auth/RLS errors — jump to RPC fallback.
    const code = (error as any)?.code ?? "";
    if (code === "42501" || code === "PGRST301") break;
    await sleep(300 * Math.pow(2, attempt));
  }
  const { error: rpcErr } = await supabase.rpc("record_reseller_site_event", {
    _kind: kind,
    _store_id: store.id,
    _slug: slug,
  });
  if (!rpcErr) return { ok: true, via: "rpc" };
  console.warn("[website-name-dialog] admin notify failed", { lastErr, rpcErr });
  return { ok: false, via: "none", error: rpcErr.message ?? lastErr?.message ?? "unknown" };
}

export function WebsiteNameDialog({
  open, onOpenChange, store, mode,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  store: StoreRow;
  mode: "create" | "change";
}) {
  const [value, setValue] = useState(store.slug ?? slugifyStoreName(store.name));
  const [availability, setAvailability] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const publish = usePublishStore();
  const change = useChangeSlug();
  const busy = publish.isPending || change.isPending;

  const cleaned = slugifyStoreName(value);
  const preview = cleaned ? `${cleaned}.easystorebd.com` : "—";
  const isOwnSlug = cleaned === (store.slug ?? "");

  // Debounced server-side uniqueness check
  useEffect(() => {
    setErrorMsg(null);
    if (!cleaned) { setAvailability("idle"); return; }
    if (cleaned.length < 3) { setAvailability("invalid"); return; }
    if (isOwnSlug) { setAvailability("available"); return; }

    setAvailability("checking");
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc("check_subdomain_available", {
        _slug: cleaned, _store_id: store.id,
      });
      if (error) { setAvailability("idle"); return; }
      setAvailability(data ? "available" : "taken");
    }, 400);
    return () => clearTimeout(t);
  }, [cleaned, isOwnSlug, store.id]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (cleaned.length < 3) {
      setErrorMsg("Name must be at least 3 characters (letters and numbers only).");
      return;
    }
    if (availability === "taken") {
      setErrorMsg("This name is already taken. Please try another.");
      return;
    }
    try {
      if (mode === "create") {
        const row = await publish.mutateAsync({ id: store.id, name: store.name, desiredSlug: cleaned });
        await notifyAdmin("created", row, row.slug ?? cleaned);
        toast.success("Your website is live!");
      } else {
        const row = await change.mutateAsync({ id: store.id, slug: cleaned });
        await notifyAdmin("changed", row, row.slug ?? cleaned);
        toast.success("Website name updated.");
      }
      onOpenChange(false);
    } catch (err: any) {
      const msg = err?.message ?? "Something went wrong.";
      setErrorMsg(msg);
      toast.error(msg);
    }
  }

  const canSubmit = !busy && cleaned.length >= 3 && availability !== "taken" && availability !== "checking";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Create your Website" : "Change Website Name"}
          </DialogTitle>
          <DialogDescription>চয়েজ ইওর ওয়েবসাইট নেইম</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Website name</label>
            <div className="flex items-stretch overflow-hidden rounded-xl border">
              <Input
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="myshop"
                className="border-0 focus-visible:ring-0"
              />
              <span className="hidden items-center border-l bg-muted px-3 text-xs text-muted-foreground sm:flex">
                .easystorebd.com
              </span>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Globe className="h-3 w-3" /> {preview}
            </p>

            {/* Inline availability / error */}
            <div className="mt-2 min-h-[20px] text-xs">
              {availability === "checking" && (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Checking availability…
                </span>
              )}
              {availability === "available" && cleaned.length >= 3 && !errorMsg && (
                <span className="inline-flex items-center gap-1.5 text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" /> {isOwnSlug ? "This is your current name" : "Available"}
                </span>
              )}
              {availability === "taken" && (
                <span className="inline-flex items-center gap-1.5 text-destructive">
                  <AlertCircle className="h-3 w-3" /> This name is already taken.
                </span>
              )}
              {availability === "invalid" && (
                <span className="inline-flex items-center gap-1.5 text-amber-600">
                  <AlertCircle className="h-3 w-3" /> At least 3 characters (letters & numbers).
                </span>
              )}
              {errorMsg && availability !== "taken" && (
                <span className="inline-flex items-center gap-1.5 text-destructive">
                  <AlertCircle className="h-3 w-3" /> {errorMsg}
                </span>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "create" ? "Publish" : "Update"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
