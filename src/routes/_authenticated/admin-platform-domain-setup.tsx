import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, ExternalLink, Copy, Loader2 } from "lucide-react";

import {
  getPlatformSetup,
  updatePlatformSetup,
  verifyWildcardConnected,
} from "@/lib/custom-domains.functions";
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

const STEPS = [
  { key: "cloudflare_added", title: "1. Add site to Cloudflare" },
  { key: "nameservers_updated", title: "2. Update Nameservers" },
  { key: "dns_records_added", title: "3. Add DNS Records" },
  { key: "ssl_mode_set", title: "4. Set SSL Mode" },
  { key: "lovable_wildcard_connected", title: "5. Connect Wildcard in Lovable" },
] as const;

type StepKey = typeof STEPS[number]["key"];

function copyText(t: string) { navigator.clipboard.writeText(t).then(() => toast.success("Copied")); }

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
        toast.success("Wildcard is live!");
        updMut.mutate({ lovable_wildcard_connected: true });
      } else if (r.dnsOk) {
        toast.warning("DNS OK, but HTTPS not responding yet. SSL may still be issuing.");
      } else {
        toast.error(`DNS not pointing to Lovable (got: ${r.addrs.join(", ") || "no answer"})`);
      }
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const setup = setupQuery.data;
  const currentStep = setup?.current_step ?? 1;
  const doneCount = setup ? STEPS.filter((s) => setup[s.key]).length : 0;
  const progress = (doneCount / STEPS.length) * 100;

  const stepIdx = currentStep - 1;
  const step = STEPS[stepIdx];
  const isDone = setup && step ? setup[step.key] : false;

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
                <p>1. In Lovable → <b>Project Settings → Domains → Connect domain</b></p>
                <p>2. Enter: <code className="bg-muted px-1">*.easystorebd.com</code></p>
                <p>3. Expand <b>Advanced</b> and check ✅ <b>"Domain uses Cloudflare or a similar proxy"</b></p>
                <p>4. Follow any CNAME instructions Lovable shows.</p>
                <p>5. Once connected, click Verify below:</p>
                <Button onClick={() => verifyMut.mutate()} disabled={verifyMut.isPending} className="mt-2">
                  {verifyMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Verify wildcard
                </Button>
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

            <div className="flex justify-between pt-2">
              <Button variant="outline" size="sm" disabled={stepIdx === 0} onClick={() => updMut.mutate({ current_step: stepIdx })}>
                <ChevronLeft className="h-4 w-4 mr-1" />Back
              </Button>
              <Button size="sm" disabled={stepIdx === STEPS.length - 1} onClick={() => updMut.mutate({ current_step: stepIdx + 2 })}>
                Next<ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
