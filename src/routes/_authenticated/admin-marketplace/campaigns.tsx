import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { Loader2, Plus, Trash2, Upload, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MarketplaceAdminShell } from "@/components/marketplace-admin/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  useMarketplaceCampaigns,
  useUpsertCampaign,
  useToggleCampaign,
  useDeleteCampaign,
  uploadCampaignBanner,
  type MarketplaceCampaignRow,
} from "@/lib/marketplace-admin";

export const Route = createFileRoute("/_authenticated/admin-marketplace/campaigns")({
  head: () => ({ meta: [{ title: "Campaigns & Banners — EasyStore365 Control" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    if (!(r ?? []).some((x) => x.role === "super_admin")) throw redirect({ to: "/dashboard" });
  },
  component: CampaignsPage,
});

function CampaignsPage() {
  const list = useMarketplaceCampaigns();
  const toggle = useToggleCampaign();
  const del = useDeleteCampaign();
  const [editing, setEditing] = useState<MarketplaceCampaignRow | null>(null);
  const [open, setOpen] = useState(false);

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (c: MarketplaceCampaignRow) => { setEditing(c); setOpen(true); };

  return (
    <MarketplaceAdminShell
      currentPath="/admin-marketplace/campaigns"
      title="Campaign & Banner Manager"
      description="Control mega events like Eid Mega Sale, 11.11, and custom seasonal campaigns. Toggle Active/Inactive to instantly show or hide banners on the marketplace."
      actions={
        <Button onClick={openNew} className="gradient-primary text-primary-foreground">
          <Plus className="mr-1.5 h-4 w-4" /> New Campaign
        </Button>
      }
    >
      {list.isLoading ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (list.data ?? []).length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card py-16 text-center text-sm text-muted-foreground">
          No campaigns yet. Click <span className="font-semibold text-foreground">New Campaign</span> to create one.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.data!.map((c) => (
            <div key={c.id} className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="relative aspect-[16/7] bg-muted">
                {c.banner_url ? (
                  <img src={c.banner_url} alt={c.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">No banner</div>
                )}
                <div className="absolute right-2 top-2 flex items-center gap-1.5 rounded-full bg-background/90 px-2 py-1 shadow">
                  <span className="text-[10px] font-bold uppercase tracking-wider">{c.is_active ? "Live" : "Off"}</span>
                  <Switch
                    checked={c.is_active}
                    onCheckedChange={(v) => toggle.mutate({ id: c.id, is_active: v })}
                  />
                </div>
              </div>
              <div className="p-4">
                <div className="font-bold">{c.name}</div>
                {c.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.description}</p>}
                <div className="mt-2 text-[11px] text-muted-foreground">
                  {c.starts_at ? new Date(c.starts_at).toLocaleDateString() : "—"} → {c.ends_at ? new Date(c.ends_at).toLocaleDateString() : "—"}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => { if (confirm(`Delete "${c.name}"?`)) del.mutate(c.id); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <CampaignDialog open={open} setOpen={setOpen} editing={editing} />
    </MarketplaceAdminShell>
  );
}

function CampaignDialog({
  open, setOpen, editing,
}: { open: boolean; setOpen: (v: boolean) => void; editing: MarketplaceCampaignRow | null }) {
  const upsert = useUpsertCampaign();
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [bannerUrl, setBannerUrl] = useState<string | null>(editing?.banner_url ?? null);
  const [startsAt, setStartsAt] = useState(editing?.starts_at?.slice(0, 16) ?? "");
  const [endsAt, setEndsAt] = useState(editing?.ends_at?.slice(0, 16) ?? "");
  const [isActive, setIsActive] = useState(editing?.is_active ?? false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reset when editing changes
  useState(() => {
    setName(editing?.name ?? "");
    setDescription(editing?.description ?? "");
    setBannerUrl(editing?.banner_url ?? null);
    setStartsAt(editing?.starts_at?.slice(0, 16) ?? "");
    setEndsAt(editing?.ends_at?.slice(0, 16) ?? "");
    setIsActive(editing?.is_active ?? false);
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const url = await uploadCampaignBanner(f);
      setBannerUrl(url);
      toast.success("Banner uploaded");
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function save() {
    if (!name.trim()) return toast.error("Name required");
    upsert.mutate(
      {
        id: editing?.id,
        name: name.trim(),
        description: description || null,
        banner_url: bannerUrl,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        is_active: isActive,
      },
      {
        onSuccess: () => { toast.success("Saved"); setOpen(false); },
        onError: (e: any) => toast.error(e.message || "Failed"),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Campaign" : "New Campaign"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Eid Mega Sale" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description ?? ""} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Starts</Label>
              <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div>
              <Label>Ends</Label>
              <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Banner</Label>
            <div className="mt-1 flex items-center gap-3">
              {bannerUrl ? (
                <img src={bannerUrl} alt="banner" className="h-16 w-32 rounded object-cover" />
              ) : (
                <div className="grid h-16 w-32 place-items-center rounded border border-dashed text-xs text-muted-foreground">No image</div>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
                Upload
              </Button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleUpload} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="font-semibold text-sm">Active</div>
              <div className="text-xs text-muted-foreground">Shows the banner on the marketplace immediately.</div>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={upsert.isPending} className="gradient-primary text-primary-foreground">
            {upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
