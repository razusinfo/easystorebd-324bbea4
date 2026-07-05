import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Truck, Save, Trash2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/courier-settings")({
  head: () => ({
    meta: [
      { title: "Courier Settings — EazyStore" },
      { name: "description", content: "Configure courier partner API keys, pickup zones and status mapping." },
    ],
  }),
  component: CourierSettingsPage,
});

const PARTNERS = ["Pathao", "Steadfast", "RedX", "Paperfly", "SA Paribahan"] as const;
type Partner = typeof PARTNERS[number];

type Row = {
  id: string;
  user_id: string;
  partner: string;
  api_key: string | null;
  api_secret: string | null;
  base_url: string | null;
  pickup_zone: string | null;
  pickup_address: string | null;
  status_mapping: Record<string, string> | null;
  is_active: boolean;
  updated_at: string;
};

async function fetchRows(): Promise<Row[]> {
  const { data, error } = await supabase
    .from("courier_partner_settings" as never)
    .select("*")
    .order("partner");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Row[];
}

function CourierSettingsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["courier-settings"], queryFn: fetchRows });
  const [newPartner, setNewPartner] = useState<Partner>("Pathao");

  const existingPartners = useMemo(
    () => new Set((q.data ?? []).map((r) => r.partner)),
    [q.data],
  );

  const upsert = useMutation({
    mutationFn: async (r: Partial<Row> & { partner: string }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const payload = { ...r, user_id: u.user.id };
      const { error } = await supabase
        .from("courier_partner_settings" as never)
        .upsert(payload as never, { onConflict: "user_id,partner" });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["courier-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("courier_partner_settings" as never).delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["courier-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addPartner = () => {
    if (existingPartners.has(newPartner)) {
      toast.error(`${newPartner} is already configured`);
      return;
    }
    upsert.mutate({
      partner: newPartner,
      is_active: true,
      status_mapping: { picked_up: "shipped", in_transit: "shipped", delivered: "delivered", returned: "cancelled" },
    });
  };

  return (
    <main className="p-4 sm:p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Courier Settings</h1>
            <p className="text-sm text-muted-foreground">API keys, pickup zones and status mapping per partner.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={newPartner} onValueChange={(v) => setNewPartner(v as Partner)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PARTNERS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={addPartner} disabled={upsert.isPending}>
            <Plus className="h-4 w-4 mr-1" /> Add partner
          </Button>
        </div>
      </header>

      {q.isLoading ? (
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (q.data ?? []).length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No courier partners configured yet. Add one above to get started.
        </Card>
      ) : (
        <div className="grid gap-4">
          {q.data!.map((r) => (
            <PartnerCard
              key={r.id}
              row={r}
              onSave={(patch) => upsert.mutate({ ...patch, partner: r.partner })}
              onDelete={() => del.mutate(r.id)}
            />
          ))}
        </div>
      )}

      <Card className="p-4 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground mb-1">Webhook URL</p>
        <code className="block break-all rounded bg-muted px-2 py-1 text-[11px]">
          POST /api/public/hooks/order-courier-status
        </code>
        <p className="mt-2">
          Send <code>x-webhook-secret</code> header and JSON body{" "}
          <code>{`{ order_id, status, provider?, tracking_id?, tracking_url? }`}</code>.
          Statuses are mapped via each partner's Status Mapping below.
        </p>
      </Card>
    </main>
  );
}

function PartnerCard({
  row, onSave, onDelete,
}: { row: Row; onSave: (patch: Partial<Row>) => void; onDelete: () => void }) {
  const [apiKey, setApiKey] = useState(row.api_key ?? "");
  const [apiSecret, setApiSecret] = useState(row.api_secret ?? "");
  const [baseUrl, setBaseUrl] = useState(row.base_url ?? "");
  const [zone, setZone] = useState(row.pickup_zone ?? "");
  const [address, setAddress] = useState(row.pickup_address ?? "");
  const [mapping, setMapping] = useState<string>(
    JSON.stringify(row.status_mapping ?? {}, null, 2),
  );
  const [active, setActive] = useState(row.is_active);

  const save = () => {
    let parsed: Record<string, string> = {};
    try { parsed = JSON.parse(mapping || "{}"); }
    catch { toast.error("Status mapping must be valid JSON"); return; }
    onSave({
      api_key: apiKey.trim() || null,
      api_secret: apiSecret.trim() || null,
      base_url: baseUrl.trim() || null,
      pickup_zone: zone.trim() || null,
      pickup_address: address.trim() || null,
      status_mapping: parsed,
      is_active: active,
    });
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary font-bold">
            {row.partner.slice(0, 1)}
          </div>
          <div>
            <div className="font-semibold">{row.partner}</div>
            <div className="text-xs text-muted-foreground">Updated {new Date(row.updated_at).toLocaleString()}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Label className="flex items-center gap-2 text-xs">
            <Switch checked={active} onCheckedChange={setActive} />
            Active
          </Label>
          <Button size="sm" variant="ghost" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">API Key</Label>
          <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="xxxxx" />
        </div>
        <div>
          <Label className="text-xs">API Secret</Label>
          <Input value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} type="password" placeholder="••••••" />
        </div>
        <div>
          <Label className="text-xs">Base URL</Label>
          <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.partner.com" />
        </div>
        <div>
          <Label className="text-xs">Pickup Zone</Label>
          <Input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Dhaka - Mirpur" />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs">Pickup Address</Label>
          <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder="House, road, area, city…" />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs">Status Mapping (JSON)</Label>
          <Textarea
            value={mapping}
            onChange={(e) => setMapping(e.target.value)}
            rows={5}
            className="font-mono text-xs"
            placeholder='{"in_transit":"shipped","delivered":"delivered"}'
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Maps this partner's status names → EazyStore order status (pending/confirmed/shipped/delivered/cancelled).
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save}>
          <Save className="h-4 w-4 mr-1" /> Save
        </Button>
      </div>
    </Card>
  );
}
