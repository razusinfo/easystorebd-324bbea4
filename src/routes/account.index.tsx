import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, MapPin, Package } from "lucide-react";
import type { User as SupaUser } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/account/")({
  component: ManageAccountPage,
});

type AddressRow = {
  id: string;
  full_name: string;
  phone: string;
  address_line: string;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string;
  is_default_shipping: boolean;
  is_default_billing: boolean;
};

function ManageAccountPage() {
  const qc = useQueryClient();
  const [user, setUser] = useState<SupaUser | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
  }, []);

  const { data: addresses } = useQuery({
    queryKey: ["account", "addresses"],
    queryFn: async (): Promise<AddressRow[]> => {
      const { data, error } = await supabase
        .from("customer_addresses")
        .select("*")
        .order("is_default_shipping", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AddressRow[];
    },
  });

  const { data: orders } = useQuery({
    queryKey: ["account", "recent-orders"],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) return [];
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, status, total, created_at")
        .eq("customer_user_id", uid)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  const shipping = addresses?.find((a) => a.is_default_shipping) ?? addresses?.[0];
  const billing = addresses?.find((a) => a.is_default_billing) ?? shipping;

  const md = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const displayName = (md.full_name as string) || (md.name as string) || "";
  const displayPhone = (md.phone as string) || "";
  const maskedEmail = user?.email ? maskEmail(user.email) : "";

  return (
    <div className="space-y-5">
      {/* Grey header band */}
      <div className="-mx-4 border-y bg-muted/60 px-4 py-4 sm:-mx-6 sm:px-6">
        <h1 className="text-xl font-semibold">Manage My Account</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Personal Profile */}
        <section className="rounded-lg border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-base font-semibold">Personal Profile</h2>
            <span className="text-muted-foreground/60">|</span>
            <ProfileDialog user={user} onSaved={(u) => setUser(u)} />
          </div>
          {user ? (
            <div className="space-y-2 text-sm">
              {displayPhone && <p>{displayPhone}</p>}
              <p>{maskedEmail}</p>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <Checkbox defaultChecked />
                <span>Receive marketing SMS</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox />
                <span>Receive marketing emails</span>
              </label>
            </div>
          ) : (
            <div className="grid place-items-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </section>

        {/* Address Book */}
        <section className="rounded-lg border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-base font-semibold">Address Book</h2>
            <span className="text-muted-foreground/60">|</span>
            <AddressDialog
              trigger={
                <button
                  type="button"
                  className="text-xs font-semibold uppercase tracking-wide text-primary hover:underline"
                >
                  Edit
                </button>
              }
              onSaved={() => qc.invalidateQueries({ queryKey: ["account", "addresses"] })}
            />
          </div>

          {!addresses ? (
            <div className="grid place-items-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : addresses.length === 0 ? (
            <div className="grid place-items-center gap-2 py-6 text-center text-sm text-muted-foreground">
              <MapPin className="h-8 w-8" />
              <p>No addresses saved yet.</p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              <AddressBlock label="DEFAULT SHIPPING ADDRESS" address={shipping} />
              <AddressBlock label="DEFAULT BILLING ADDRESS" address={billing} />
            </div>
          )}
        </section>
      </div>


      {/* Recent Orders */}
      <section className="rounded-lg border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Orders</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/account/orders">View all</Link>
          </Button>
        </div>
        {!orders ? (
          <div className="grid place-items-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : orders.length === 0 ? (
          <div className="grid place-items-center gap-2 py-6 text-center text-sm text-muted-foreground">
            <Package className="h-8 w-8" />
            <p>No orders yet.</p>
          </div>
        ) : (
          <ul className="divide-y">
            {orders.map((o) => (
              <li key={o.id}>
                <Link
                  to="/account/orders/$id"
                  params={{ id: o.id }}
                  className="flex items-center justify-between gap-3 py-3 text-sm hover:bg-muted/40 -mx-2 px-2 rounded"
                >
                  <div>
                    <p className="font-medium">#{o.order_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="capitalize">{o.status}</Badge>
                    <span className="font-semibold">{Number(o.total).toLocaleString()} ৳</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AddressBlock({ label, address }: { label: string; address?: AddressRow }) {
  if (!address) {
    return (
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm text-muted-foreground">Not set.</p>
      </div>
    );
  }
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{address.full_name}</p>
      <p className="text-sm text-muted-foreground">{address.address_line}</p>
      <p className="text-sm text-muted-foreground">
        {[address.city, address.region, address.postal_code].filter(Boolean).join(" · ")}
      </p>
      <p className="text-sm text-muted-foreground">{address.country}</p>
      <p className="text-sm text-muted-foreground">{address.phone}</p>
    </div>
  );
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const shown = local.slice(0, 2);
  return `${shown}${"*".repeat(Math.max(3, local.length - 2))}@${domain}`;
}

function ProfileDialog({
  user, onSaved,
}: { user: SupaUser | null; onSaved: (u: SupaUser | null) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const md = (user?.user_metadata ?? {}) as Record<string, unknown>;
    setName((md.full_name as string) || (md.name as string) || "");
    setPhone((md.phone as string) || "");
  }, [user, open]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: { name: name.trim(), full_name: name.trim(), phone: phone.trim() },
      });
      if (error) throw error;
      toast.success("Profile updated");
      onSaved(data.user ?? null);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update profile");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          disabled={!user}
          className="text-xs font-semibold uppercase tracking-wide text-primary hover:underline disabled:opacity-50"
        >
          Edit
        </button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit personal profile</DialogTitle>
        </DialogHeader>
        <form id="profile-form" onSubmit={save} className="space-y-3">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>
          <div className="space-y-2">
            <Label>Full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
          </div>
          <div className="space-y-2">
            <Label>Mobile number</Label>
            <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={32} />
          </div>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" form="profile-form" disabled={saving}>
            {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddressDialog({
  trigger, onSaved,
}: { trigger: React.ReactNode; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "", phone: "", address_line: "", city: "", region: "", postal_code: "",
    country: "Bangladesh", is_default_shipping: true, is_default_billing: true,
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Not signed in");
      if (!form.full_name.trim() || !form.phone.trim() || !form.address_line.trim()) {
        throw new Error("Name, phone and address are required.");
      }

      // If setting a new default, clear the previous default(s)
      if (form.is_default_shipping) {
        await supabase.from("customer_addresses")
          .update({ is_default_shipping: false })
          .eq("user_id", uid).eq("is_default_shipping", true);
      }
      if (form.is_default_billing) {
        await supabase.from("customer_addresses")
          .update({ is_default_billing: false })
          .eq("user_id", uid).eq("is_default_billing", true);
      }

      const { error } = await supabase.from("customer_addresses").insert({
        user_id: uid,
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        address_line: form.address_line.trim(),
        city: form.city.trim() || null,
        region: form.region.trim() || null,
        postal_code: form.postal_code.trim() || null,
        country: form.country.trim() || "Bangladesh",
        is_default_shipping: form.is_default_shipping,
        is_default_billing: form.is_default_billing,
      });
      if (error) throw error;
      toast.success("Address saved");
      onSaved();
      setOpen(false);
      setForm({
        full_name: "", phone: "", address_line: "", city: "", region: "", postal_code: "",
        country: "Bangladesh", is_default_shipping: true, is_default_billing: true,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save address");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add address</DialogTitle>
        </DialogHeader>
        <form id="addr-form" onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
          <Field label="Phone" type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <div className="sm:col-span-2">
            <Field label="Address" value={form.address_line} onChange={(v) => setForm({ ...form, address_line: v })} />
          </div>
          <Field label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
          <Field label="Region / District" value={form.region} onChange={(v) => setForm({ ...form, region: v })} />
          <Field label="Postal code" value={form.postal_code} onChange={(v) => setForm({ ...form, postal_code: v })} />
          <Field label="Country" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox
              checked={form.is_default_shipping}
              onCheckedChange={(c) => setForm({ ...form, is_default_shipping: Boolean(c) })}
            />
            Set as default shipping address
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox
              checked={form.is_default_billing}
              onCheckedChange={(c) => setForm({ ...form, is_default_billing: Boolean(c) })}
            />
            Set as default billing address
          </label>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" form="addr-form" disabled={saving}>
            {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Save address
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label, value, onChange, type = "text",
}: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
