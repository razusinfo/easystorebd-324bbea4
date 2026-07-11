import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  Loader2, Users, Store as StoreIcon, PackageSearch, Download, History, ChevronLeft, ChevronRight,
} from "lucide-react";

import {
  adminListResellerAdopters,
  adminGetAdopterAuditLog,
  adminGetProductHistory,
  type Adopter,
  type AdopterGroup,
} from "@/lib/admin-reseller-adopters.functions";
import { useIsSuperAdmin } from "@/lib/eazystore-data";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin-reseller-adopters")({
  head: () => ({ meta: [{ title: "Reseller product adopters · Admin" }] }),
  component: AdminResellerAdoptersPage,
});

type ListResult = {
  groups: AdopterGroup[];
  total: number;
  page: number;
  pageSize: number;
};

const STATUS_OPTIONS = ["", "approved", "pending", "rejected"] as const;

function csvEscape(v: unknown) {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function AdminResellerAdoptersPage() {
  const { data: isSuper, isLoading: roleLoading } = useIsSuperAdmin();
  const listFn = useServerFn(adminListResellerAdopters);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [resellerEmail, setResellerEmail] = useState("");
  const [onlyAdopted, setOnlyAdopted] = useState(true);
  const [selected, setSelected] = useState<
    | { group: AdopterGroup; adopter: Adopter }
    | null
  >(null);

  const queryArgs = {
    page,
    pageSize,
    search: search || null,
    status: status || null,
    dateFrom: dateFrom ? new Date(dateFrom).toISOString() : null,
    dateTo: dateTo ? new Date(dateTo + "T23:59:59").toISOString() : null,
    resellerEmail: resellerEmail || null,
    onlyAdopted,
  };

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["admin", "reseller-adopters", queryArgs],
    enabled: !!isSuper,
    queryFn: async (): Promise<ListResult> =>
      (await listFn({ data: queryArgs })) as ListResult,
  });

  const groups = data?.groups ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const allAdopterRows = useMemo(() => {
    const rows: { g: AdopterGroup; a: Adopter }[] = [];
    for (const g of groups) for (const a of g.adopters) rows.push({ g, a });
    return rows;
  }, [groups]);

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isSuper) return <Navigate to="/" />;

  const onExport = () => {
    const header = [
      "reseller_product", "adopter_product", "store", "reseller_name",
      "reseller_email", "selling_price", "stock", "status", "adopted_at",
    ];
    const rows = [header, ...allAdopterRows.map(({ g, a }) => [
      g.reseller_product.name, a.product_name, a.store_name ?? a.store_id ?? "",
      a.owner_name ?? "", a.owner_email ?? "", String(a.selling_price ?? ""),
      String(a.stock ?? 0), a.status ?? "", new Date(a.created_at).toISOString(),
    ])];
    downloadCsv(`reseller-adopters-page-${page}.csv`, rows);
  };

  return (
    <div className="container mx-auto max-w-6xl space-y-6 py-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" /> Reseller Product Adopters
          </h1>
          <p className="text-sm text-muted-foreground">
            See which reseller stores added each marketplace product to their own website.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onExport} disabled={!allAdopterRows.length}>
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin-requests">Back</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>{total} product{total === 1 ? "" : "s"} match.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Search product/reseller</Label>
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Product name…" />
          </div>
          <div>
            <Label className="text-xs">Reseller email</Label>
            <Input value={resellerEmail} onChange={(e) => { setResellerEmail(e.target.value); setPage(1); }} placeholder="user@example.com" />
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={status || "any"} onValueChange={(v) => { setStatus(v === "any" ? "" : v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                {STATUS_OPTIONS.filter(Boolean).map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Adopted from</Label>
            <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
          </div>
          <div>
            <Label className="text-xs">Adopted to</Label>
            <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
          </div>
          <div className="flex items-end">
            <Button
              variant={onlyAdopted ? "default" : "outline"}
              size="sm"
              onClick={() => { setOnlyAdopted((v) => !v); setPage(1); }}
            >
              {onlyAdopted ? "Adopted only" : "All products"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <div className="text-sm text-destructive">{(error as Error).message}</div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <PackageSearch className="h-4 w-4" /> No matching products.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <Card key={g.reseller_product.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {g.reseller_product.image_url ? (
                    <img src={g.reseller_product.image_url} alt={g.reseller_product.name}
                      className="h-12 w-12 rounded object-cover border" />
                  ) : (
                    <div className="h-12 w-12 rounded border bg-muted" />
                  )}
                  <div>
                    <CardTitle className="text-base">{g.reseller_product.name}</CardTitle>
                    <CardDescription>
                      Retail ৳{g.reseller_product.price ?? "—"} · Reseller ৳
                      {g.reseller_product.reseller_price ?? "—"} · Stock {g.reseller_product.stock ?? 0}
                    </CardDescription>
                  </div>
                </div>
                <Badge variant={g.adopters.length ? "default" : "secondary"}>
                  {g.adopters.length} adopter{g.adopters.length === 1 ? "" : "s"}
                </Badge>
              </CardHeader>
              <CardContent>
                {g.adopters.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No reseller has added this product yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Store</TableHead>
                          <TableHead>Reseller</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead className="text-right">Stock</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Added</TableHead>
                          <TableHead className="text-right">Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {g.adopters.map((a) => (
                          <TableRow
                            key={a.product_id}
                            className="cursor-pointer hover:bg-muted/40"
                            onClick={() => setSelected({ group: g, adopter: a })}
                          >
                            <TableCell className="font-medium">
                              <span className="inline-flex items-center gap-1">
                                <StoreIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                {a.store_slug ? (
                                  <a
                                    href={buildStorefrontUrl(a.store_slug)}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-primary underline-offset-2 hover:underline"
                                  >
                                    {buildStorefrontUrl(a.store_slug).replace(/^https?:\/\//, "").replace(/\/$/, "")}
                                  </a>
                                ) : (
                                  a.store_name ?? a.store_id ?? "—"
                                )}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">{a.owner_name ?? "—"}</div>
                              <div className="text-xs text-muted-foreground">{a.owner_email ?? "—"}</div>
                            </TableCell>
                            <TableCell className="text-right">৳{a.selling_price ?? "—"}</TableCell>
                            <TableCell className="text-right">{a.stock ?? 0}</TableCell>
                            <TableCell><Badge variant="outline">{a.status ?? "—"}</Badge></TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(a.created_at).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelected({ group: g, adopter: a }); }}>
                                <History className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-muted-foreground">
              Page {page} of {pageCount} {isFetching ? "· refreshing…" : ""}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <Button size="sm" variant="outline" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <AdopterDetailsDrawer selected={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function AdopterDetailsDrawer({
  selected, onClose,
}: {
  selected: { group: AdopterGroup; adopter: Adopter } | null;
  onClose: () => void;
}) {
  const auditFn = useServerFn(adminGetAdopterAuditLog);
  const historyFn = useServerFn(adminGetProductHistory);

  const key = selected ? `${selected.group.reseller_product.id}|${selected.adopter.product_id}` : "closed";

  const audit = useQuery({
    queryKey: ["admin", "adopter-audit", key],
    enabled: !!selected,
    queryFn: async () =>
      (await auditFn({
        data: {
          reseller_product_id: selected!.group.reseller_product.id,
          owner_user_id: selected!.adopter.owner_user_id,
        },
      })) as Array<{
        id: string; action: string; success: boolean; error: string | null;
        created_at: string; metadata: Record<string, unknown>;
      }>,
  });

  const history = useQuery({
    queryKey: ["admin", "adopter-product-history", key],
    enabled: !!selected,
    queryFn: async () =>
      (await historyFn({ data: { product_id: selected!.adopter.product_id } })) as Array<{
        id: string; action: string; old_status: string | null; new_status: string | null; created_at: string;
      }>,
  });

  return (
    <Sheet open={!!selected} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {selected && (
          <>
            <SheetHeader>
              <SheetTitle>{selected.adopter.product_name}</SheetTitle>
              <SheetDescription>
                Adopted from marketplace product “{selected.group.reseller_product.name}”
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <Info label="Store" value={selected.adopter.store_name ?? "—"} />
                <Info label="Reseller" value={selected.adopter.owner_email ?? "—"} />
                <Info label="Selling price" value={`৳${selected.adopter.selling_price ?? "—"}`} />
                <Info label="Marketplace price" value={`৳${selected.group.reseller_product.reseller_price ?? "—"}`} />
                <Info label="Retail price" value={`৳${selected.group.reseller_product.price ?? "—"}`} />
                <Info label="Stock" value={String(selected.adopter.stock ?? 0)} />
                <Info label="Status" value={selected.adopter.status ?? "—"} />
                <Info label="Adopted at" value={new Date(selected.adopter.created_at).toLocaleString()} />
              </div>

              <section>
                <h3 className="mb-2 text-sm font-semibold">Adoption audit log</h3>
                {audit.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (audit.data ?? []).length === 0 ? (
                  <div className="text-xs text-muted-foreground">No audit entries.</div>
                ) : (
                  <ul className="space-y-2">
                    {(audit.data ?? []).map((l) => (
                      <li key={l.id} className="rounded border p-2">
                        <div className="flex items-center justify-between">
                          <Badge variant={l.success ? "default" : "destructive"}>{l.action}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(l.created_at).toLocaleString()}
                          </span>
                        </div>
                        {l.error && <div className="mt-1 text-xs text-destructive">{l.error}</div>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="mb-2 text-sm font-semibold">Status history</h3>
                {history.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (history.data ?? []).length === 0 ? (
                  <div className="text-xs text-muted-foreground">No status changes recorded.</div>
                ) : (
                  <ul className="space-y-2">
                    {(history.data ?? []).map((l) => (
                      <li key={l.id} className="rounded border p-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{l.action}</span>
                          <span className="text-muted-foreground">
                            {new Date(l.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-muted-foreground">
                          {l.old_status ?? "—"} → {l.new_status ?? "—"}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}
