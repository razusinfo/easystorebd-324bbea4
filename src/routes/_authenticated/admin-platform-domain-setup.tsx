import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, ExternalLink, Copy, Loader2, RefreshCw, Clock } from "lucide-react";

import {
  getPlatformSetup,
  updatePlatformSetup,
  verifyWildcardConnected,
} from "@/lib/custom-domains.functions";
import {
  PLATFORM_STEP_KEYS,
  advanceBlockedMessage,
  canAdvance,
  clampStep,
  completedCount,
  isStepDone,
  sanitizeLovableHostname,
} from "@/lib/platform-domain-setup-logic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/admin-platform-domain-setup")({
  head: () => ({ meta: [{ title: "Platform Domain Setup" }] }),
  errorComponent: ({ error }) => <div className="p-4 text-destructive">{String((error as Error)?.message ?? error)}</div>,
  notFoundComponent: () => <div className="p-4">Not found</div>,
  component: PlatformDomainSetupPage,
});

const STEP_TITLES: Record<(typeof PLATFORM_STEP_KEYS)[number], string> = {
  cloudflare_added: "1. Add site to Cloudflare",
  nameservers_updated: "2. Update Nameservers",
  dns_records_added: "3. Add DNS Records",
  ssl_mode_set: "4. Set SSL Mode",
  lovable_wildcard_connected: "5. Connect Wildcard in Lovable",
};
const STEPS = PLATFORM_STEP_KEYS.map((key) => ({ key, title: STEP_TITLES[key] }));

function copyText(t: string) { navigator.clipboard.writeText(t).then(() => toast.success("Copied")); }

function HostnameSanitizerInput() {
  const [raw, setRaw] = useState("");
  const result = sanitizeLovableHostname(raw);
  const sanitizedShown = result.sanitized || "easystorebd.com";
  const describedBy = result.hasInvalidWildcard
    ? "hostname-error"
    : result.stripped
      ? "hostname-stripped"
      : "hostname-help";

  return (
    <div className="rounded-md border p-3 space-y-2" data-testid="hostname-sanitizer">
      <p className="font-medium text-sm">Hostname helper (wildcard-safe)</p>
      <p id="hostname-help" className="text-xs text-muted-foreground">
        <code>*.easystorebd.com</code> পেস্ট করলে <code>*.</code> স্বয়ংক্রিয়ভাবে বাদ যাবে যাতে Lovable-এর
        Connect Domain ইনপুটে Continue বাটন সক্রিয় থাকে।
      </p>
      <input
        type="text"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="*.easystorebd.com"
        aria-label="Lovable-এর জন্য hostname লিখুন"
        aria-invalid={result.hasInvalidWildcard || undefined}
        aria-describedby={describedBy}
        data-testid="hostname-input"
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
      />
      {/* aria-live: sanitizer state screen reader-কে জানাবে */}
      <div aria-live="polite" aria-atomic="true">
        {result.hasInvalidWildcard && (
          <p
            id="hostname-error"
            className="text-xs text-destructive"
            role="alert"
            data-testid="hostname-error"
          >
            ত্রুটি: {result.message} — Continue বাটন নিষ্ক্রিয় থাকবে।
          </p>
        )}
        {result.stripped && !result.hasInvalidWildcard && (
          <p
            id="hostname-stripped"
            className="text-xs text-emerald-700 dark:text-emerald-400"
            role="status"
            data-testid="hostname-stripped"
          >
            {result.message} এখন Continue বাটন আবার সক্রিয় হবে।
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <code
          className="rounded bg-muted px-2 py-1 text-xs"
          data-testid="hostname-sanitized"
          aria-label={`পরিশোধিত hostname ${sanitizedShown}`}
        >
          {sanitizedShown}
        </code>
        <Button
          size="sm"
          variant="outline"
          disabled={!result.isValid}
          data-testid="hostname-copy"
          onClick={() => {
            navigator.clipboard.writeText(result.sanitized).then(() => {
              if (result.stripped) {
                toast.success(`wildcard বাদ দিয়ে "${result.sanitized}" কপি হয়েছে`);
              } else {
                toast.success(`"${result.sanitized}" কপি হয়েছে`);
              }
            });
          }}
          title={
            result.hasInvalidWildcard
              ? "`*` ক্যারেক্টার থাকলে Lovable Continue বাটন নিষ্ক্রিয় করে"
              : "পরিশোধিত hostname কপি করুন"
          }
          aria-label="Lovable-এর জন্য পরিশোধিত hostname কপি করুন"
        >
          <Copy className="h-3.5 w-3.5 mr-1" /> Copy for Lovable
        </Button>
      </div>
    </div>
  );
}


function PlatformDomainSetupPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getPlatformSetup);
  const updFn = useServerFn(updatePlatformSetup);
  const verifyFn = useServerFn(verifyWildcardConnected);

  const setupQuery = useQuery({ queryKey: ["platform-domain-setup"], queryFn: () => getFn() });

  const updMut = useMutation({
    mutationFn: (patch: Record<string, boolean | number>) => updFn({ data: patch as never }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-domain-setup"] }),
    onError: (e) => toast.error((e as Error).message),
  });

  const verifyMut = useMutation({
    mutationFn: () => verifyFn(),
    onSuccess: (r) => {
      if (r.dnsOk && r.httpsOk) {
        toast.success("Wildcard সফলভাবে live হয়েছে 🎉");
        updMut.mutate({ lovable_wildcard_connected: true });
      } else if (r.dnsOk) {
        toast.warning("DNS ঠিক আছে, তবে HTTPS এখনো response দিচ্ছে না — SSL issue হতে কিছু সময় লাগতে পারে।");
      } else {
        toast.error(`DNS এখনো Lovable-এ point করছে না (পাওয়া গেছে: ${r.addrs.join(", ") || "কোনো উত্তর নেই"})`);
      }
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const setup = setupQuery.data;
  // Persisted current_step comes from Supabase, so a reload resumes on the
  // same step. clampStep guards against stale/corrupt values.
  const currentStep = clampStep(setup?.current_step);
  const doneCount = completedCount(setup);
  const progress = (doneCount / STEPS.length) * 100;

  const stepIdx = currentStep - 1;
  const step = STEPS[stepIdx];
  const isDone = isStepDone(setup, stepIdx);
  const canGoNext = canAdvance(setup, stepIdx);
  const blockedMsg = advanceBlockedMessage(stepIdx);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Platform Domain Setup</h1>
        <p className="text-sm text-muted-foreground">Configure Cloudflare wildcard so `*.easystorebd.com` works.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Progress</CardTitle>
            <span className="text-sm text-muted-foreground">{doneCount} / {STEPS.length} steps</span>
          </div>
          <Progress value={progress} className="mt-2" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {STEPS.map((s, i) => (
              <Button
                key={s.key}
                size="sm"
                variant={i === stepIdx ? "default" : setup?.[s.key] ? "secondary" : "outline"}
                onClick={() => updMut.mutate({ current_step: i + 1 })}
                className="text-xs"
              >
                {setup?.[s.key] && <Check className="h-3 w-3 mr-1" />}
                {s.title}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {setupQuery.isLoading ? (
        <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
      ) : step ? (
        <Card>
          <CardHeader>
            <CardTitle>{step.title}</CardTitle>
            <CardDescription>Follow the instructions, then mark done.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {stepIdx === 0 && (
              <div className="space-y-2">
                <p>1. Go to <a className="text-primary underline" href="https://dash.cloudflare.com/sign-up" target="_blank" rel="noreferrer">Cloudflare signup <ExternalLink className="inline h-3 w-3" /></a></p>
                <p>2. Click <b>Add a site</b> and enter <code className="bg-muted px-1">easystorebd.com</code></p>
                <p>3. Choose the <b>Free</b> plan.</p>
                <p>4. Let Cloudflare scan and import existing DNS records.</p>
              </div>
            )}
            {stepIdx === 1 && (
              <div className="space-y-2">
                <p>Cloudflare gives you 2 nameservers, e.g. <code className="bg-muted px-1">alice.ns.cloudflare.com</code>.</p>
                <p>Go to your <b>domain registrar</b> (where you bought easystorebd.com) and replace the current nameservers with Cloudflare's.</p>
                <p className="text-muted-foreground">DNS propagation can take up to 24 hours.</p>
              </div>
            )}
            {stepIdx === 2 && (
              <div className="space-y-3">
                <p>In Cloudflare Dashboard → <b>DNS → Records</b>, add these:</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border">
                    <thead className="bg-muted">
                      <tr><th className="p-2 text-left">Type</th><th className="p-2 text-left">Name</th><th className="p-2 text-left">Content</th><th className="p-2 text-left">Proxy</th></tr>
                    </thead>
                    <tbody>
                      {[["A", "@", "185.158.133.1"], ["A", "www", "185.158.133.1"], ["A", "*", "185.158.133.1"]].map(([t, n, v]) => (
                        <tr key={n} className="border-t">
                          <td className="p-2">{t}</td>
                          <td className="p-2"><code>{n}</code></td>
                          <td className="p-2 flex items-center gap-1"><code>{v}</code><Button variant="ghost" size="sm" onClick={() => copyText(v)}><Copy className="h-3 w-3" /></Button></td>
                          <td className="p-2">🟠 Proxied</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-muted-foreground">The <code>*</code> record enables all subdomains like <code>&lt;slug&gt;.easystorebd.com</code>.</p>
              </div>
            )}
            {stepIdx === 3 && (
              <div className="space-y-2">
                <p>In Cloudflare → <b>SSL/TLS → Overview</b>, set encryption mode to <b>Full</b> (not Flexible).</p>
                <p className="text-muted-foreground">This ensures end-to-end HTTPS between Cloudflare and Lovable.</p>
              </div>
            )}
            {stepIdx === 4 && (
              <div className="space-y-3">
                <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs space-y-1">
                  <p className="font-medium text-amber-900 dark:text-amber-200">⚠️ Lovable-এর Connect Domain ডায়ালগ <code>*</code> ক্যারেক্টার গ্রহণ করে না</p>
                  <p className="text-amber-800/90 dark:text-amber-200/80">
                    <code>*.easystorebd.com</code> টাইপ করলে Continue বাটন disable হয়ে যায় — এটা Lovable UI-এর hostname validation, বাগ নয়। wildcard self-serve সম্ভব না; নিচের যেকোনো একটা পথ ব্যবহার করুন।
                  </p>
                </div>

                <HostnameSanitizerInput />



                <div className="rounded-md border p-3 space-y-2">
                  <p className="font-medium">Option A — Root + www কানেক্ট করুন (সবচেয়ে সহজ)</p>
                  <p className="text-xs text-muted-foreground">প্রতি reseller-এর subdomain Cloudflare-এর wildcard A record + proxy দিয়ে কাজ করবে; Lovable-এ শুধু root domain কানেক্ট থাকলেই SSL wildcard cert issue হয়।</p>
                  <p>1. Lovable → <b>Project Settings → Domains → Connect domain</b></p>
                  <p>2. Enter: <code className="bg-muted px-1">easystorebd.com</code> (wildcard ছাড়া)</p>
                  <p>3. Advanced → ✅ <b>"Domain uses Cloudflare or a similar proxy"</b></p>
                  <p>4. একইভাবে <code className="bg-muted px-1">www.easystorebd.com</code> কানেক্ট করুন।</p>
                </div>

                <div className="rounded-md border p-3 space-y-2">
                  <p className="font-medium">Option B — প্রতি reseller subdomain আলাদা করে যোগ করুন</p>
                  <p className="text-xs text-muted-foreground">সীমিত reseller হলে প্রতিটা <code>&lt;slug&gt;.easystorebd.com</code> Lovable-এ কানেক্ট করুন (wildcard ছাড়া কাজ করবে)।</p>
                </div>

                <div className="rounded-md border p-3 space-y-2">
                  <p className="font-medium">Option C — Lovable support-কে wildcard enable-এর অনুরোধ</p>
                  <p className="text-xs text-muted-foreground">Enterprise/paid plan-এ support team ম্যানুয়ালি <code>*.easystorebd.com</code> attach করে দিতে পারে।</p>
                </div>

                <p className="pt-2">কানেক্ট শেষে নিচে verify করুন:</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={() => verifyMut.mutate()} disabled={verifyMut.isPending}>
                    {verifyMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Verify wildcard
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      toast.info("Re-checking DNS…");
                      verifyMut.mutate();
                    }}
                    disabled={verifyMut.isPending}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${verifyMut.isPending ? "animate-spin" : ""}`} />
                    Re-check DNS propagation
                  </Button>
                </div>
                {verifyMut.data && (
                  <div className="rounded-md border bg-muted/40 p-3 text-xs">
                    <div>Probed host: <code>{verifyMut.data.testHost}</code></div>
                    <div>DNS: {verifyMut.data.dnsOk ? "✅ points to Lovable" : `❌ got ${verifyMut.data.addrs.join(", ") || "no answer"}`}</div>
                    <div>HTTPS: {verifyMut.data.httpsOk ? "✅ live" : "⏳ not responding yet"}</div>
                  </div>
                )}
              </div>
            )}

            {(stepIdx === 1 || stepIdx === 2 || stepIdx === 4) && (
              <div className="flex gap-2 rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs">
                <Clock className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-amber-900 dark:text-amber-200">DNS propagation takes time</p>
                  <p className="text-amber-800/90 dark:text-amber-200/80">
                    Wildcard DNS and SSL can take anywhere from a few minutes up to 24–48 hours to propagate
                    globally. If verification fails, wait 10–15 minutes and click <b>Re-check DNS propagation</b>.
                    You can also test at{" "}
                    <a
                      className="underline"
                      href="https://dnschecker.org/#A/test.easystorebd.com"
                      target="_blank"
                      rel="noreferrer"
                    >
                      dnschecker.org
                    </a>
                    .
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-4 border-t">
              <Checkbox
                id="done"
                checked={!!isDone}
                onCheckedChange={(v) => updMut.mutate({ [step.key]: v === true })}
              />
              <label htmlFor="done" className="text-sm">Mark step complete</label>
            </div>

            {!canGoNext && (
              <p className="text-xs text-amber-700 dark:text-amber-300" role="status">
                {blockedMsg}
              </p>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" size="sm" disabled={stepIdx === 0} onClick={() => updMut.mutate({ current_step: stepIdx })}>
                <ChevronLeft className="h-4 w-4 mr-1" />Back
              </Button>
              {stepIdx === STEPS.length - 1 ? (
                <Button
                  size="sm"
                  disabled={!canGoNext}
                  title={!canGoNext ? blockedMsg : undefined}
                  onClick={() => {
                    if (!canGoNext) {
                      toast.error(blockedMsg);
                      return;
                    }
                    toast.success("Setup complete 🎉");
                  }}
                >
                  Finish
                  <Check className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={!canGoNext}
                  title={!canGoNext ? blockedMsg : undefined}
                  onClick={() => {
                    if (!canGoNext) {
                      toast.error(blockedMsg);
                      return;
                    }
                    updMut.mutate({ current_step: stepIdx + 2 });
                  }}
                >
                  Next<ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
