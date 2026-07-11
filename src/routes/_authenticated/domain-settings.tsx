import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { RefreshCcw, Trash2, Plus, Copy, ExternalLink, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import {
  listMyCustomDomains,
  addCustomDomain,
  removeCustomDomain,
  checkDomainStatus,
} from "@/lib/custom-domains.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { DomainStatusBadge } from "@/components/domain-status-badge";

export const Route = createFileRoute("/_authenticated/domain-settings")({
  head: () => ({ meta: [{ title: "Domain Settings" }] }),
  errorComponent: ({ error }) => <div className="p-4 text-destructive">{String((error as Error)?.message ?? error)}</div>,
  notFoundComponent: () => <div className="p-4">Not found</div>,
  component: DomainSettingsPage,
});

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success("Copied"));
}

function DomainSettingsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyCustomDomains);
  const addFn = useServerFn(addCustomDomain);
  const removeFn = useServerFn(removeCustomDomain);
  const checkFn = useServerFn(checkDomainStatus);

  const [store, setStore] = useState<{ id: string; slug: string; name: string } | null>(null);
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("stores")
        .select("id, slug, name")
        .eq("owner_user_id", u.user.id)
        .maybeSingle();
      if (data) setStore(data as { id: string; slug: string; name: string });
    })();
  }, []);

  const domainsQuery = useQuery({
    queryKey: ["my-custom-domains"],
    queryFn: () => listFn(),
    refetchInterval: (q) => {
      const rows = q.state.data ?? [];
      const hasPending = rows.some((r) => r.status !== "live" && r.status !== "failed");
      return hasPending ? 15000 : 60000;
    },
  });

  const addMut = useMutation({
    mutationFn: (input: { storeId: string; domain: string }) => addFn({ data: input }),
    onSuccess: () => { toast.success("Domain added"); qc.invalidateQueries({ queryKey: ["my-custom-domains"] }); setOpen(false); setDomainInput(""); },
    onError: (e) => toast.error((e as Error).message),
  });
  const removeMut = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["my-custom-domains"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const checkMut = useMutation({
    mutationFn: (id: string) => checkFn({ data: { id } }),
    onSuccess: () => { toast.success("Rechecked"); qc.invalidateQueries({ queryKey: ["my-custom-domains"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const [open, setOpen] = useState(false);
  const [domainInput, setDomainInput] = useState("");

  const subdomainUrl = store ? `https://${store.slug}.easystorebd.com` : "";

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Globe className="h-6 w-6" /> Domain Settings</h1>
        <p className="text-sm text-muted-foreground">Manage the URLs where customers reach your store.</p>
      </div>

      {store && (
        <Card>
          <CardHeader>
            <CardTitle>Your default subdomain</CardTitle>
            <CardDescription>Included free with your store. Always live.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <code className="rounded bg-muted px-3 py-1.5 text-sm">{subdomainUrl}</code>
            <Button variant="outline" size="sm" onClick={() => copyToClipboard(subdomainUrl)}><Copy className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" asChild><a href={subdomainUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>
            <DomainStatusBadge status="live" />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Custom domains</CardTitle>
            <CardDescription>Point your own domain (like myshop.com) to your store.</CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={!store}><Plus className="h-4 w-4 mr-1" />Add Domain</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a custom domain</DialogTitle>
                <DialogDescription>Enter the domain, then add the DNS record shown below at your registrar.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Domain</Label>
                  <Input placeholder="myshop.com" value={domainInput} onChange={(e) => setDomainInput(e.target.value)} />
                </div>
                <div className="rounded border bg-muted/40 p-3 text-xs space-y-1">
                  <div className="font-medium">Add this DNS A record at your registrar:</div>
                  <div><b>Type:</b> A</div>
                  <div><b>Name:</b> @ (or the subdomain)</div>
                  <div><b>Value:</b> <code>185.158.133.1</code></div>
                  <div className="pt-1 text-muted-foreground">SSL is issued automatically once DNS propagates (usually 5–60 min).</div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button
                  disabled={!store || !domainInput.trim() || addMut.isPending}
                  onClick={() => store && addMut.mutate({ storeId: store.id, domain: domainInput })}
                >
                  {addMut.isPending ? "Adding..." : "Add"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {domainsQuery.isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
          ) : (domainsQuery.data ?? []).length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No custom domains yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last checked</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(domainsQuery.data ?? []).map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="font-medium">{d.domain}</div>
                      {d.last_error && <div className="text-xs text-destructive">{d.last_error}</div>}
                    </TableCell>
                    <TableCell><DomainStatusBadge status={d.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {d.last_checked_at ? new Date(d.last_checked_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => checkMut.mutate(d.id)} disabled={checkMut.isPending}>
                        <RefreshCcw className={`h-4 w-4 ${checkMut.isPending ? "animate-spin" : ""}`} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => removeMut.mutate(d.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
