import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Store as StoreIcon, Loader2, Globe, FileText, Truck, Landmark, BarChart3,
  MessageSquare, MessageCircle, Share2, Save, Check, Copy, ExternalLink,
  Upload, Trash2, Rocket, X,
} from "lucide-react";
import { toast } from "sonner";

import {
  useMyStore, useUpdateStore, useLogoSignedUrl, uploadStoreLogo, deleteStoreLogo,
  usePublishStore, useChangeSlug, slugifyStoreName, buildStorefrontUrl,
  TEMPLATES,
  type Category, type TemplateId, type ShopSettings,
} from "@/lib/eazystore-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/manage-shop")({
  head: () => ({
    meta: [
      { title: "Manage Shop — EazyStore" },
      { name: "description", content: "Manage all shop configurations — settings, domain, policy, delivery, payments, SEO and support in one place." },
    ],
  }),
  component: ManageShopPage,
});

type CardKey =
  | "settings" | "domain" | "policy" | "delivery" | "payment"
  | "seo" | "sms" | "chat" | "social";

const CARDS: {
  key: CardKey;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}[] = [
  { key: "settings", title: "Shop Settings", desc: "General shop configurations — name, logo, category and template.", icon: StoreIcon },
  { key: "domain", title: "Shop Domain", desc: "Manage your shop URL, publish status and custom slug.", icon: Globe },
  { key: "policy", title: "Shop Policy", desc: "Define return, refund, shipping, privacy and terms policies.", icon: FileText },
  { key: "delivery", title: "Delivery Support", desc: "Set delivery charges inside/outside Dhaka and free-shipping rules.", icon: Truck },
  { key: "payment", title: "Payment Gateway", desc: "Configure bKash, Nagad, Rocket, bank transfer and COD.", icon: Landmark },
  { key: "seo", title: "SEO & Marketing Integrations", desc: "Google Tag Manager, Facebook Pixel, TikTok Pixel and more.", icon: BarChart3, badge: "New" },
  { key: "sms", title: "SMS Support", desc: "SMS notifications to keep customers updated in real time.", icon: MessageSquare },
  { key: "chat", title: "Chat Support", desc: "Enable Messenger, WhatsApp or Tawk.to live chat on your store.", icon: MessageCircle },
  { key: "social", title: "Social Links", desc: "Connect Facebook, Instagram, WhatsApp and your website.", icon: Share2 },
];

function ManageShopPage() {
  const storeQ = useMyStore();
  const [open, setOpen] = useState<CardKey | null>(null);

  if (storeQ.isLoading) {
    return (
      <main className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }
  if (!storeQ.data) {
    return (
      <main className="grid min-h-[60vh] place-items-center px-5 text-center">
        <div className="max-w-sm space-y-4">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl gradient-primary text-white">
            <StoreIcon className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold">No store yet</h1>
          <p className="text-sm text-muted-foreground">
            Set up your store with the onboarding wizard first.
          </p>
          <Link
            to="/onboarding"
            className="inline-flex items-center justify-center rounded-2xl gradient-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-md"
          >
            Start onboarding
          </Link>
        </div>
      </main>
    );
  }

  const store = storeQ.data;

  if (open === "settings") {
    return <ShopSettingsView store={store} onBack={() => setOpen(null)} />;
  }

  return (
    <main className="mx-auto w-full max-w-6xl p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Manage Shop</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Set up and customize your shop to ensure a smooth and efficient experience.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => (
          <button
            key={c.key}
            onClick={() => setOpen(c.key)}
            className="group relative text-left rounded-xl border bg-card p-5 hover:border-primary/40 hover:shadow-md transition-all"
          >
            {c.badge && (
              <span className="absolute top-3 right-3 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                {c.badge}
              </span>
            )}
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center mb-3 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <c.icon className="h-5 w-5" />
            </div>
            <div className="font-semibold">{c.title}</div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.desc}</p>
          </button>
        ))}
      </div>

      {open === "domain" && <ShopDomainDialog store={store} onClose={() => setOpen(null)} />}
      {open === "policy" && <ShopPolicyDialog store={store} onClose={() => setOpen(null)} />}
      {open === "delivery" && <DeliveryDialog store={store} onClose={() => setOpen(null)} />}
      {open === "payment" && <PaymentDialog store={store} onClose={() => setOpen(null)} />}
      {open === "seo" && <SeoDialog store={store} onClose={() => setOpen(null)} />}
      {open === "sms" && <SmsDialog onClose={() => setOpen(null)} />}
      {open === "chat" && <ChatDialog store={store} onClose={() => setOpen(null)} />}
      {open === "social" && <SocialDialog store={store} onClose={() => setOpen(null)} />}
    </main>
  );
}


// -------- Reusable dialog shell --------
function SectionDialog({
  title, description, onClose, children, footer,
}: {
  title: string; description?: string; onClose: () => void;
  children: React.ReactNode; footer?: React.ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-4 py-2">{children}</div>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}

// -------- Shop Settings --------
function ShopSettingsDialog({ store, onClose }: { store: any; onClose: () => void }) {
  const update = useUpdateStore();
  const [name, setName] = useState(store.name);
  const [tagline, setTagline] = useState(store.tagline ?? "");
  const [category, setCategory] = useState<Category>(store.category);
  const [template, setTemplate] = useState<TemplateId>(store.template);
  const [logoPath, setLogoPath] = useState<string | null>(store.logo_url);
  const [localLogo, setLocalLogo] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const signed = useLogoSignedUrl(logoPath);
  const logo = localLogo || signed.data || null;

  async function pickLogo(f: File) {
    if (!f.type.startsWith("image/")) return toast.error("Please choose an image.");
    if (f.size > 2 * 1024 * 1024) return toast.error("Logo must be ≤ 2MB.");
    const url = URL.createObjectURL(f);
    setLocalLogo(url);
    setUploading(true);
    try {
      const old = logoPath;
      const p = await uploadStoreLogo(f);
      setLogoPath(p);
      if (old && old !== p) await deleteStoreLogo(old);
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed.");
    } finally { setUploading(false); }
  }

  async function save() {
    try {
      await update.mutateAsync({
        id: store.id, name: name.trim(), tagline: tagline.trim() || null,
        category, template, logo_url: logoPath,
      });
      toast.success("Shop settings saved.");
      onClose();
    } catch (e: any) { toast.error(e?.message ?? "Save failed."); }
  }

  return (
    <SectionDialog
      title="Shop Settings" description="General configuration for your store."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={update.isPending || name.trim().length < 2}>
            {update.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
        </>
      }
    >
      <div className="flex items-center gap-4">
        <div className="h-20 w-20 rounded-xl border bg-muted grid place-items-center overflow-hidden">
          {logo ? <img src={logo} alt="logo" className="h-full w-full object-cover" /> : <StoreIcon className="h-8 w-8 text-muted-foreground" />}
        </div>
        <div className="flex flex-col gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => e.target.files?.[0] && pickLogo(e.target.files[0])} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload className="h-4 w-4 mr-1" /> {uploading ? "Uploading..." : "Upload logo"}
          </Button>
          {logoPath && (
            <Button variant="ghost" size="sm" onClick={() => { setLogoPath(null); setLocalLogo(null); }}>
              <Trash2 className="h-4 w-4 mr-1" /> Remove
            </Button>
          )}
        </div>
      </div>
      <div>
        <Label>Shop name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label>Tagline</Label>
        <Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Short tagline" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Clothes">Clothes</SelectItem>
              <SelectItem value="Electronics">Electronics</SelectItem>
              <SelectItem value="Sports">Sports</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Template</Label>
          <Select value={template} onValueChange={(v) => setTemplate(v as TemplateId)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TEMPLATES.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </SectionDialog>
  );
}

// -------- Shop Domain --------
function ShopDomainDialog({ store, onClose }: { store: any; onClose: () => void }) {
  const publish = usePublishStore();
  const changeSlug = useChangeSlug();
  const [slug, setSlug] = useState(store.slug ?? slugifyStoreName(store.name));
  const url = slug ? buildStorefrontUrl(slug) : "";

  async function saveSlug() {
    try {
      await changeSlug.mutateAsync({ id: store.id, slug });
      toast.success("Slug updated.");
    } catch (e: any) { toast.error(e?.message ?? "Slug change failed."); }
  }
  async function publishNow() {
    try {
      await publish.mutateAsync({ id: store.id, name: store.name, desiredSlug: slug });
      toast.success("Shop published.");
    } catch (e: any) { toast.error(e?.message ?? "Publish failed."); }
  }

  return (
    <SectionDialog title="Shop Domain" description="Your storefront URL and publish state." onClose={onClose}>
      <div>
        <Label>Shop slug</Label>
        <div className="flex gap-2">
          <Input value={slug} onChange={(e) => setSlug(slugifyStoreName(e.target.value))} />
          <Button variant="outline" onClick={saveSlug} disabled={changeSlug.isPending}>Update</Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Only lowercase letters, numbers and hyphens.
        </p>
      </div>
      <div className="rounded-lg border p-3 bg-muted/40">
        <div className="text-xs text-muted-foreground mb-1">Storefront URL</div>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate text-sm">{url || "—"}</code>
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(url); toast.success("Copied"); }}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.open(url, "_blank")}>
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <div className="font-medium text-sm">Publish status</div>
          <div className="text-xs text-muted-foreground">
            {store.published ? "Your storefront is live." : "Not published yet."}
          </div>
        </div>
        <Button onClick={publishNow} disabled={publish.isPending}>
          {publish.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Rocket className="h-4 w-4 mr-2" />}
          {store.published ? "Republish" : "Publish"}
        </Button>
      </div>
    </SectionDialog>
  );
}

// -------- Generic settings-section save helper --------
function useSaveSection(store: any) {
  const update = useUpdateStore();
  const save = async (patch: Partial<ShopSettings>) => {
    const merged: ShopSettings = { ...(store.shop_settings ?? {}), ...patch };
    await update.mutateAsync({ id: store.id, shop_settings: merged });
  };
  return { save, isPending: update.isPending };
}

// -------- Policy --------
function ShopPolicyDialog({ store, onClose }: { store: any; onClose: () => void }) {
  const p = store.shop_settings?.policy ?? {};
  const [ret, setRet] = useState(p.return ?? "");
  const [refund, setRefund] = useState(p.refund ?? "");
  const [ship, setShip] = useState(p.shipping ?? "");
  const [terms, setTerms] = useState(p.terms ?? "");
  const [privacy, setPrivacy] = useState(p.privacy ?? "");
  const { save, isPending } = useSaveSection(store);

  async function onSave() {
    try {
      await save({ policy: { return: ret, refund, shipping: ship, terms, privacy } });
      toast.success("Policies saved."); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Save failed."); }
  }

  return (
    <SectionDialog
      title="Shop Policy" description="Define store policies shown to customers."
      onClose={onClose}
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={onSave} disabled={isPending}><Save className="h-4 w-4 mr-2" />Save</Button>
      </>}
    >
      <div><Label>Return policy</Label><Textarea rows={3} value={ret} onChange={(e) => setRet(e.target.value)} /></div>
      <div><Label>Refund policy</Label><Textarea rows={3} value={refund} onChange={(e) => setRefund(e.target.value)} /></div>
      <div><Label>Shipping policy</Label><Textarea rows={3} value={ship} onChange={(e) => setShip(e.target.value)} /></div>
      <div><Label>Terms & conditions</Label><Textarea rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} /></div>
      <div><Label>Privacy policy</Label><Textarea rows={3} value={privacy} onChange={(e) => setPrivacy(e.target.value)} /></div>
    </SectionDialog>
  );
}

// -------- Delivery --------
function DeliveryDialog({ store, onClose }: { store: any; onClose: () => void }) {
  const d = store.shop_settings?.delivery ?? {};
  const [inside, setInside] = useState<string>(d.inside_dhaka?.toString() ?? "");
  const [sub, setSub] = useState<string>(d.sub_dhaka?.toString() ?? "");
  const [outside, setOutside] = useState<string>(d.outside_dhaka?.toString() ?? "");
  const [free, setFree] = useState<string>(d.free_above?.toString() ?? "");
  const [note, setNote] = useState(d.note ?? "");
  const { save, isPending } = useSaveSection(store);

  const n = (v: string) => (v.trim() === "" ? null : Number(v));

  async function onSave() {
    try {
      await save({ delivery: { inside_dhaka: n(inside), sub_dhaka: n(sub), outside_dhaka: n(outside), free_above: n(free), note } });
      toast.success("Delivery settings saved."); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Save failed."); }
  }

  return (
    <SectionDialog
      title="Delivery Support" description="Shipping charges applied at checkout."
      onClose={onClose}
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={onSave} disabled={isPending}><Save className="h-4 w-4 mr-2" />Save</Button>
      </>}
    >
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Inside Dhaka (৳)</Label><Input type="number" value={inside} onChange={(e) => setInside(e.target.value)} /></div>
        <div><Label>Sub Dhaka (৳)</Label><Input type="number" value={sub} onChange={(e) => setSub(e.target.value)} /></div>
        <div><Label>Outside Dhaka (৳)</Label><Input type="number" value={outside} onChange={(e) => setOutside(e.target.value)} /></div>
        <div><Label>Free shipping above (৳)</Label><Input type="number" value={free} onChange={(e) => setFree(e.target.value)} /></div>
      </div>
      <div><Label>Delivery note</Label><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Delivery within 2–3 days" /></div>
    </SectionDialog>
  );
}

// -------- Payment --------
function PaymentDialog({ store, onClose }: { store: any; onClose: () => void }) {
  const p = store.shop_settings?.payment ?? {};
  const [cod, setCod] = useState<boolean>(p.cod ?? true);
  const [bkash, setBkash] = useState(p.bkash ?? "");
  const [nagad, setNagad] = useState(p.nagad ?? "");
  const [rocket, setRocket] = useState(p.rocket ?? "");
  const [bankName, setBankName] = useState(p.bank_name ?? "");
  const [bankAcc, setBankAcc] = useState(p.bank_account ?? "");
  const [bankBranch, setBankBranch] = useState(p.bank_branch ?? "");
  const [ins, setIns] = useState(p.instructions ?? "");
  const { save, isPending } = useSaveSection(store);

  async function onSave() {
    try {
      await save({ payment: { cod, bkash, nagad, rocket, bank_name: bankName, bank_account: bankAcc, bank_branch: bankBranch, instructions: ins } });
      toast.success("Payment settings saved."); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Save failed."); }
  }

  return (
    <SectionDialog
      title="Payment Gateway" description="Payment methods offered at checkout."
      onClose={onClose}
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={onSave} disabled={isPending}><Save className="h-4 w-4 mr-2" />Save</Button>
      </>}
    >
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <div className="font-medium text-sm">Cash on Delivery</div>
          <div className="text-xs text-muted-foreground">Accept payment on delivery.</div>
        </div>
        <Switch checked={cod} onCheckedChange={setCod} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><Label>bKash</Label><Input value={bkash} onChange={(e) => setBkash(e.target.value)} placeholder="01XXXXXXXXX" /></div>
        <div><Label>Nagad</Label><Input value={nagad} onChange={(e) => setNagad(e.target.value)} placeholder="01XXXXXXXXX" /></div>
        <div><Label>Rocket</Label><Input value={rocket} onChange={(e) => setRocket(e.target.value)} placeholder="01XXXXXXXXX" /></div>
      </div>
      <div className="rounded-lg border p-3 space-y-2">
        <div className="text-sm font-medium">Bank transfer</div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Bank name</Label><Input value={bankName} onChange={(e) => setBankName(e.target.value)} /></div>
          <div><Label>Account no.</Label><Input value={bankAcc} onChange={(e) => setBankAcc(e.target.value)} /></div>
        </div>
        <div><Label>Branch</Label><Input value={bankBranch} onChange={(e) => setBankBranch(e.target.value)} /></div>
      </div>
      <div><Label>Payment instructions</Label><Textarea rows={2} value={ins} onChange={(e) => setIns(e.target.value)} /></div>
    </SectionDialog>
  );
}

// -------- SEO --------
function SeoDialog({ store, onClose }: { store: any; onClose: () => void }) {
  const s = store.shop_settings?.seo ?? {};
  const [mt, setMt] = useState(s.meta_title ?? "");
  const [md, setMd] = useState(s.meta_description ?? "");
  const [gtm, setGtm] = useState(s.google_tag_manager ?? "");
  const [ga, setGa] = useState(s.google_analytics ?? "");
  const [fbp, setFbp] = useState(s.facebook_pixel ?? "");
  const [tt, setTt] = useState(s.tiktok_pixel ?? "");
  const { save, isPending } = useSaveSection(store);

  async function onSave() {
    try {
      await save({ seo: { meta_title: mt, meta_description: md, google_tag_manager: gtm, google_analytics: ga, facebook_pixel: fbp, tiktok_pixel: tt } });
      toast.success("SEO & marketing saved."); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Save failed."); }
  }

  return (
    <SectionDialog
      title="SEO & Marketing Integrations" description="Tracking pixels and search metadata."
      onClose={onClose}
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={onSave} disabled={isPending}><Save className="h-4 w-4 mr-2" />Save</Button>
      </>}
    >
      <div><Label>Meta title</Label><Input value={mt} onChange={(e) => setMt(e.target.value)} /></div>
      <div><Label>Meta description</Label><Textarea rows={2} value={md} onChange={(e) => setMd(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Google Tag Manager ID</Label><Input value={gtm} onChange={(e) => setGtm(e.target.value)} placeholder="GTM-XXXXXX" /></div>
        <div><Label>Google Analytics ID</Label><Input value={ga} onChange={(e) => setGa(e.target.value)} placeholder="G-XXXXXXX" /></div>
        <div><Label>Facebook Pixel ID</Label><Input value={fbp} onChange={(e) => setFbp(e.target.value)} /></div>
        <div><Label>TikTok Pixel ID</Label><Input value={tt} onChange={(e) => setTt(e.target.value)} /></div>
      </div>
    </SectionDialog>
  );
}

// -------- SMS (info + link) --------
function SmsDialog({ onClose }: { onClose: () => void }) {
  return (
    <SectionDialog
      title="SMS Support" description="SMS notifications for OTP and order updates."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Link to="/sms-settings" onClick={onClose}>
            <Button><ExternalLink className="h-4 w-4 mr-2" />Open SMS settings</Button>
          </Link>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">
        SMS templates and provider settings are managed centrally. Open the SMS Settings page to configure OTP template, sender signature and app name.
      </p>
    </SectionDialog>
  );
}

// -------- Chat --------
function ChatDialog({ store, onClose }: { store: any; onClose: () => void }) {
  const c = store.shop_settings?.chat ?? {};
  const [enabled, setEnabled] = useState<boolean>(c.enabled ?? false);
  const [msg, setMsg] = useState(c.messenger_url ?? "");
  const [wa, setWa] = useState(c.whatsapp_number ?? store.whatsapp_number ?? "");
  const [tawk, setTawk] = useState(c.tawk_to_id ?? "");
  const { save, isPending } = useSaveSection(store);

  async function onSave() {
    try {
      await save({ chat: { enabled, messenger_url: msg, whatsapp_number: wa, tawk_to_id: tawk } });
      toast.success("Chat support saved."); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Save failed."); }
  }

  return (
    <SectionDialog
      title="Chat Support" description="Enable live chat on your storefront."
      onClose={onClose}
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={onSave} disabled={isPending}><Save className="h-4 w-4 mr-2" />Save</Button>
      </>}
    >
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <div className="font-medium text-sm">Enable chat widget</div>
          <div className="text-xs text-muted-foreground">Show a floating chat button on your store.</div>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>
      <div><Label>Messenger page URL</Label><Input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="https://m.me/yourpage" /></div>
      <div><Label>WhatsApp number</Label><Input value={wa} onChange={(e) => setWa(e.target.value)} placeholder="8801XXXXXXXXX" /></div>
      <div><Label>Tawk.to widget ID</Label><Input value={tawk} onChange={(e) => setTawk(e.target.value)} /></div>
    </SectionDialog>
  );
}

// -------- Social --------
function SocialDialog({ store, onClose }: { store: any; onClose: () => void }) {
  const update = useUpdateStore();
  const [fb, setFb] = useState(store.facebook_url ?? "");
  const [ig, setIg] = useState(store.instagram_url ?? "");
  const [wa, setWa] = useState(store.whatsapp_number ?? "");
  const [web, setWeb] = useState(store.website_url ?? "");
  const [phone, setPhone] = useState(store.phone ?? "");
  const [email, setEmail] = useState(store.contact_email ?? "");
  const [addr, setAddr] = useState(store.address ?? "");

  async function onSave() {
    try {
      await update.mutateAsync({
        id: store.id,
        facebook_url: fb.trim() || null,
        instagram_url: ig.trim() || null,
        whatsapp_number: wa.trim() || null,
        website_url: web.trim() || null,
        phone: phone.trim() || null,
        contact_email: email.trim() || null,
        address: addr.trim() || null,
      });
      toast.success("Contact & socials saved."); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Save failed."); }
  }

  return (
    <SectionDialog
      title="Social Links & Contact" description="How customers can reach you."
      onClose={onClose}
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={onSave} disabled={update.isPending}><Save className="h-4 w-4 mr-2" />Save</Button>
      </>}
    >
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Facebook URL</Label><Input value={fb} onChange={(e) => setFb(e.target.value)} /></div>
        <div><Label>Instagram URL</Label><Input value={ig} onChange={(e) => setIg(e.target.value)} /></div>
        <div><Label>WhatsApp number</Label><Input value={wa} onChange={(e) => setWa(e.target.value)} /></div>
        <div><Label>Website</Label><Input value={web} onChange={(e) => setWeb(e.target.value)} /></div>
        <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <div><Label>Contact email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      </div>
      <div><Label>Address</Label><Textarea rows={2} value={addr} onChange={(e) => setAddr(e.target.value)} /></div>
    </SectionDialog>
  );
}
