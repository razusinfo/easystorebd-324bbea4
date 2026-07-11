import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, MessageSquare, Save, Ban } from "lucide-react";
import { useIsSuperAdmin } from "@/lib/eazystore-data";
import { getSmsSettings, updateSmsSettings } from "@/lib/sms-settings.functions";

export const Route = createFileRoute("/_authenticated/sms-settings")({
  head: () => ({ meta: [{ title: "SMS Template — EasyStore" }] }),
  component: SmsSettingsPage,
});

function renderPreview(template: string, app: string, signature: string) {
  return template
    .replaceAll("{code}", "123456")
    .replaceAll("{minutes}", "5")
    .replaceAll("{app}", app || "EasyStore")
    .replaceAll("{signature}", signature ? `\n${signature}` : "");
}

function SmsSettingsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const isAdmin = useIsSuperAdmin();
  const fetchSettings = useServerFn(getSmsSettings);
  const saveSettings = useServerFn(updateSmsSettings);

  const settings = useQuery({
    queryKey: ["sms-settings"],
    queryFn: () => fetchSettings(),
    enabled: !!isAdmin.data,
  });

  const [template, setTemplate] = useState("");
  const [signature, setSignature] = useState("");
  const [appName, setAppName] = useState("EasyStore");
  const [status, setStatus] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  useEffect(() => {
    if (settings.data) {
      setTemplate(settings.data.otp_template);
      setSignature(settings.data.signature ?? "");
      setAppName(settings.data.app_name ?? "EasyStore");
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () =>
      saveSettings({
        data: { otp_template: template.trim(), signature: signature.trim(), app_name: appName.trim() },
      }),
    onSuccess: () => {
      setStatus({ kind: "ok", msg: "Template saved. New codes will use this format." });
      qc.invalidateQueries({ queryKey: ["sms-settings"] });
    },
    onError: (e: Error) => setStatus({ kind: "err", msg: e.message }),
  });

  if (isAdmin.isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!isAdmin.data) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-5 text-center">
        <div className="max-w-sm space-y-3">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
            <Ban className="h-7 w-7" />
          </div>
          <h1 className="font-display text-2xl font-bold">Super admin only</h1>
          <p className="text-sm text-muted-foreground">
            Only super admins can edit the SMS OTP template.
          </p>
          <Link to="/dashboard" className="inline-block rounded-2xl border border-border bg-background px-4 py-2 text-sm font-semibold">
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  const preview = renderPreview(template, appName, signature);
  const length = preview.length;
  const segments = Math.max(1, Math.ceil(length / 160));
  const hasCodePlaceholder = template.includes("{code}");

  return (
    <main className="min-h-screen bg-background pb-16 text-foreground">
      <div className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.35),transparent_60%)]" />
        <div className="mx-auto max-w-3xl px-5 pb-8 pt-6">
          <button
            onClick={() => router.history.back()}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-white/70 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/10 backdrop-blur">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/70">SMS Settings</p>
              <h1 className="truncate font-display text-2xl font-black sm:text-3xl">OTP Message Template</h1>
            </div>
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-3xl space-y-5 px-5 py-6">
        {settings.isLoading ? (
          <div className="grid place-items-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">App / Brand name</label>
              <input
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                maxLength={40}
                className="w-full rounded-xl border-2 border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                placeholder="EasyStore"
              />
              <p className="text-xs text-muted-foreground">Replaces <code className="rounded bg-muted px-1">{"{app}"}</code> in the template.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold">OTP message template</label>
              <textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                rows={4}
                maxLength={480}
                className="w-full rounded-xl border-2 border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                placeholder="Your {app} verification code is {code}. It expires in {minutes} minutes."
              />
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>Placeholders:</span>
                <code className="rounded bg-muted px-1">{"{code}"}</code>
                <code className="rounded bg-muted px-1">{"{minutes}"}</code>
                <code className="rounded bg-muted px-1">{"{app}"}</code>
                <code className="rounded bg-muted px-1">{"{signature}"}</code>
              </div>
              {!hasCodePlaceholder && (
                <p className="text-xs font-medium text-destructive">Template must include {"{code}"}.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Signature (optional)</label>
              <input
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                maxLength={80}
                className="w-full rounded-xl border-2 border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                placeholder="— Team EasyStore"
              />
              <p className="text-xs text-muted-foreground">
                Inserted where <code className="rounded bg-muted px-1">{"{signature}"}</code> appears (on its own line).
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Live preview</p>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {length} chars · {segments} SMS
                </p>
              </div>
              <pre className="whitespace-pre-wrap break-words rounded-xl bg-muted/60 p-3 font-sans text-sm leading-relaxed">
                {preview}
              </pre>
            </div>

            {status && (
              <div
                className={`rounded-xl border px-3 py-2 text-sm ${
                  status.kind === "ok"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border-red-300 bg-red-50 text-red-700"
                }`}
              >
                {status.msg}
              </div>
            )}

            <button
              onClick={() => {
                setStatus(null);
                save.mutate();
              }}
              disabled={save.isPending || !hasCodePlaceholder || template.trim().length < 10}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl gradient-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm disabled:opacity-50"
            >
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save template
            </button>
          </>
        )}
      </section>
    </main>
  );
}
