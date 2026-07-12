import { useState } from "react";
import { Loader2, Globe } from "lucide-react";
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

async function notifyAdmin(kind: "created" | "changed", store: StoreRow, slug: string) {
  try {
    const title = kind === "created"
      ? "New reseller website published"
      : "Reseller changed website name";
    const body = `${store.name} → ${slug}.easystorebd.com`;
    await supabase.from("admin_notifications").insert({
      type: kind === "created" ? "reseller_site_created" : "reseller_site_changed",
      title,
      body,
      link: buildStorefrontUrl(slug),
      related_id: store.id,
    });
  } catch (e) {
    console.warn("[website-name-dialog] admin notify failed", e);
  }
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
  const publish = usePublishStore();
  const change = useChangeSlug();
  const busy = publish.isPending || change.isPending;

  const cleaned = slugifyStoreName(value);
  const preview = cleaned ? `${cleaned}.easystorebd.com` : "—";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cleaned.length < 3) {
      toast.error("Name must be at least 3 characters (letters and numbers only).");
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
      toast.error(err?.message ?? "Something went wrong.");
    }
  }

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
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || cleaned.length < 3}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "create" ? "Publish" : "Update"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
