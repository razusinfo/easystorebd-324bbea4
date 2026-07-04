import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  updateNotificationSettings,
  getNotificationProviderStatus,
  sendTestOrderEmail,
} from "@/lib/notification-settings.functions";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated/admin-notifications")({
  component: AdminNotificationsPage,
});

const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"] as const;
type Status = typeof STATUSES[number];

type SettingsRow = {
  email_enabled: boolean;
  sms_enabled: boolean;
  from_email: string;
  from_name: string;
  reply_to: string | null;
  notify_customer: boolean;
  notify_reseller: boolean;
  statuses_email: string[];
  statuses_sms: string[];
  delivery_eta: string;
  whatsapp_webhook_url: string | null;
};

const DEFAULTS: SettingsRow = {
  email_enabled: true,
  sms_enabled: true,
  from_email: "orders@resend.dev",
  from_name: "EazyStore",
  reply_to: null,
  notify_customer: true,
  notify_reseller: true,
  statuses_email: [...STATUSES],
  statuses_sms: [...STATUSES],
  delivery_eta: "3-5 business days",
  whatsapp_webhook_url: null,
};

function AdminNotificationsPage() {
  const qc = useQueryClient();
  const providerStatusFn = useServerFn(getNotificationProviderStatus);
  const saveFn = useServerFn(updateNotificationSettings);
  const testEmailFn = useServerFn(sendTestOrderEmail);

  const settingsQ = useQuery({
    queryKey: ["notification_settings"],
    queryFn: async (): Promise<SettingsRow> => {
      const { data, error } = await supabase
        .from("notification_settings")
        .select("*")
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      return { ...DEFAULTS, ...((data as Partial<SettingsRow>) ?? {}) };
    },
  });

  const providerQ = useQuery({
    queryKey: ["notification_providers"],
    queryFn: () => providerStatusFn(),
  });

  const [form, setForm] = useState<SettingsRow>(DEFAULTS);
  const [testTo, setTestTo] = useState("");

  useEffect(() => {
    if (settingsQ.data) setForm(settingsQ.data);
  }, [settingsQ.data]);

  const save = useMutation({
    mutationFn: async (v: SettingsRow) => saveFn({ data: v }),
    onSuccess: () => {
      toast.success("Notification settings saved");
      qc.invalidateQueries({ queryKey: ["notification_settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: async (to: string) => testEmailFn({ data: { to } }),
    onSuccess: () => toast.success("Test email sent"),
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleStatus(list: "statuses_email" | "statuses_sms", s: Status) {
    setForm((f) => {
      const has = f[list].includes(s);
      return { ...f, [list]: has ? f[list].filter((x) => x !== s) : [...f[list], s] };
    });
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          Configure how order confirmations and status updates are sent.
        </p>
      </header>

      <Card className="p-5 space-y-4">
        <h2 className="font-semibold">Providers</h2>
        <div className="flex flex-wrap gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span>Email (Resend):</span>
            <Badge variant={providerQ.data?.resend_configured ? "default" : "destructive"}>
              {providerQ.data?.resend_configured ? "Configured" : "Missing API key"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span>SMS (BulkSMSBD):</span>
            <Badge variant={providerQ.data?.sms_configured ? "default" : "destructive"}>
              {providerQ.data?.sms_configured ? "Configured" : "Missing credentials"}
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          API keys are stored securely as backend secrets. To change them, use the
          Backend → Secrets panel (RESEND_API_KEY, BULKSMSBD_API_KEY, BULKSMSBD_SENDER_ID).
        </p>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="font-semibold">Channels</h2>
        <div className="flex items-center justify-between">
          <div>
            <Label>Email notifications</Label>
            <p className="text-xs text-muted-foreground">Send emails via Resend.</p>
          </div>
          <Switch
            checked={form.email_enabled}
            onCheckedChange={(v) => setForm({ ...form, email_enabled: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label>SMS notifications</Label>
            <p className="text-xs text-muted-foreground">Send SMS via BulkSMSBD.</p>
          </div>
          <Switch
            checked={form.sms_enabled}
            onCheckedChange={(v) => setForm({ ...form, sms_enabled: v })}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={form.notify_customer}
              onCheckedChange={(v) => setForm({ ...form, notify_customer: Boolean(v) })}
            />
            <Label className="cursor-pointer">Notify customer</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={form.notify_reseller}
              onCheckedChange={(v) => setForm({ ...form, notify_reseller: Boolean(v) })}
            />
            <Label className="cursor-pointer">Notify reseller</Label>
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="font-semibold">Email branding</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>From name</Label>
            <Input
              value={form.from_name}
              onChange={(e) => setForm({ ...form, from_name: e.target.value })}
            />
          </div>
          <div>
            <Label>From email</Label>
            <Input
              type="email"
              value={form.from_email}
              onChange={(e) => setForm({ ...form, from_email: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Must be a verified sender in Resend.
            </p>
          </div>
          <div className="sm:col-span-2">
            <Label>Reply-to (optional)</Label>
            <Input
              type="email"
              value={form.reply_to ?? ""}
              onChange={(e) =>
                setForm({ ...form, reply_to: e.target.value.trim() || null })
              }
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Estimated delivery text</Label>
            <Input
              value={form.delivery_eta}
              onChange={(e) => setForm({ ...form, delivery_eta: e.target.value })}
            />
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="font-semibold">WhatsApp / Automation webhook</h2>
        <p className="text-xs text-muted-foreground">
          Paste a webhook URL from Make.com, Zapier, or n8n. Every new order and
          status change will POST a JSON payload (order id, product, customer &amp;
          reseller info) to this URL — connect that Zap/Scenario to the WhatsApp
          Business API to send instant messages.
        </p>
        <div>
          <Label>Webhook URL</Label>
          <Input
            type="url"
            placeholder="https://hook.eu2.make.com/xxxxxxxxxxxx"
            value={form.whatsapp_webhook_url ?? ""}
            onChange={(e) =>
              setForm({ ...form, whatsapp_webhook_url: e.target.value.trim() || null })
            }
          />
        </div>
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none font-medium">Sample payload</summary>
          <pre className="mt-2 overflow-x-auto rounded bg-muted p-3 text-[11px] leading-relaxed">{`{
  "event": "order.placed",
  "timestamp": "2026-07-04T12:00:00.000Z",
  "order": { "id": "...", "short_id": "A1B2C3D4", "product_name": "...", "quantity": 1, "total": 500, "currency": "BDT" },
  "customer": { "name": "...", "phone": "+8801...", "email": "..." },
  "reseller": { "id": "...", "shop_name": "My Shop", "phone": "+8801...", "email": "..." }
}`}</pre>
        </details>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="font-semibold">Trigger on statuses</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <Label className="mb-2 block">Email</Label>
            <div className="space-y-2">
              {STATUSES.map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <Checkbox
                    checked={form.statuses_email.includes(s)}
                    onCheckedChange={() => toggleStatus("statuses_email", s)}
                  />
                  <span className="capitalize text-sm">{s}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Label className="mb-2 block">SMS</Label>
            <div className="space-y-2">
              {STATUSES.map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <Checkbox
                    checked={form.statuses_sms.includes(s)}
                    onCheckedChange={() => toggleStatus("statuses_sms", s)}
                  />
                  <span className="capitalize text-sm">{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap justify-between gap-3">
        <div className="flex items-end gap-2">
          <div>
            <Label>Send test email to</Label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              className="w-64"
            />
          </div>
          <Button
            variant="outline"
            disabled={!testTo || test.isPending}
            onClick={() => test.mutate(testTo)}
          >
            {test.isPending ? "Sending…" : "Send test"}
          </Button>
        </div>
        <Button disabled={save.isPending} onClick={() => save.mutate(form)}>
          {save.isPending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </div>
  );
}
