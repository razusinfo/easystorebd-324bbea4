import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, Globe, CheckCircle2, Pencil, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/admin-website-requests")({
  head: () => ({ meta: [{ title: "Website Requests — Admin" }] }),
  component: AdminWebsiteRequestsPage,
});

type NotifRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  related_id: string | null;
  created_at: string;
};

type SiteRow = {
  id: string;
  store_id: string;
  subdomain: string | null;
  status: "not_created" | "inactive" | "live";
  first_published_at: string | null;
  last_changed_at: string | null;
  change_count: number;
  updated_at: string;
};

function AdminWebsiteRequestsPage() {
  const notifsQ = useQuery({
    queryKey: ["admin-website-notifs"],
    queryFn: async (): Promise<NotifRow[]> => {
      const { data, error } = await supabase
        .from("admin_notifications")
        .select("id,type,title,body,link,related_id,created_at")
        .in("type", ["reseller_site_created", "reseller_site_changed"])
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as NotifRow[];
    },
  });

  const sitesQ = useQuery({
    queryKey: ["reseller-sites-all"],
    queryFn: async (): Promise<SiteRow[]> => {
      const { data, error } = await supabase
        .from("reseller_sites")
        .select("id,store_id,subdomain,status,first_published_at,last_changed_at,change_count,updated_at")
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as SiteRow[];
    },
  });

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6">
      <header>
        <h1 className="font-display text-2xl font-black">Website Requests</h1>
        <p className="text-sm text-muted-foreground">
          Reseller website publish & rename events, with quick review links.
        </p>
      </header>

      {/* Feed */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Recent activity</h2>
        {notifsQ.isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (notifsQ.data ?? []).length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">No website requests yet.</Card>
        ) : (
          <ul className="space-y-2">
            {notifsQ.data!.map((n) => {
              const isCreated = n.type === "reseller_site_created";
              return (
                <li key={n.id}>
                  <Card className="flex items-start gap-3 p-3">
                    <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${isCreated ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}>
                      {isCreated ? <CheckCircle2 className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">{n.title}</span>
                        <Badge variant="secondary" className="shrink-0">{isCreated ? "Created" : "Changed"}</Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{n.body}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {n.link && (
                        <a href={n.link} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="gap-1">
                            <ExternalLink className="h-3.5 w-3.5" /> Visit
                          </Button>
                        </a>
                      )}
                      {n.related_id && (
                        <Link to="/admin" search={{ storeId: n.related_id } as never}>
                          <Button size="sm" variant="default">Review</Button>
                        </Link>
                      )}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Ownership table */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Subdomain ownership</h2>
        {sitesQ.isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Subdomain</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">First published</th>
                    <th className="px-3 py-2">Last change</th>
                    <th className="px-3 py-2">Changes</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {(sitesQ.data ?? []).map((s) => (
                    <tr key={s.id} className="border-t">
                      <td className="px-3 py-2 font-mono text-xs">
                        {s.subdomain ? `${s.subdomain}.easystorebd.com` : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={s.status === "live" ? "default" : s.status === "inactive" ? "secondary" : "outline"}>
                          {s.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {s.first_published_at ? new Date(s.first_published_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {s.last_changed_at ? formatDistanceToNow(new Date(s.last_changed_at), { addSuffix: true }) : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs">{s.change_count}</td>
                      <td className="px-3 py-2 text-right">
                        {s.subdomain && s.status === "live" && (
                          <a href={`https://${s.subdomain}.easystorebd.com`} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="ghost" className="gap-1">
                              <Globe className="h-3.5 w-3.5" /> Visit
                            </Button>
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(sitesQ.data ?? []).length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">No sites yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>
    </main>
  );
}
