import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Loader2, Users, Store as StoreIcon, PackageSearch } from "lucide-react";

import { adminListResellerAdopters } from "@/lib/admin-reseller-adopters.functions";
import { useIsSuperAdmin } from "@/lib/eazystore-data";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin-reseller-adopters")({
  head: () => ({ meta: [{ title: "Reseller product adopters · Admin" }] }),
  component: AdminResellerAdoptersPage,
});

type Adopter = {
  product_id: string;
  product_name: string;
  selling_price: number | null;
  stock: number | null;
  status: string | null;
  created_at: string;
  store_id: string | null;
  store_name: string | null;
  owner_user_id: string | null;
  owner_email: string | null;
  owner_name: string | null;
};

type Group = {
  reseller_product: {
    id: string;
    name: string;
    image_url: string | null;
    price: number | null;
    reseller_price: number | null;
    stock: number | null;
    updated_at: string;
  };
  adopters: Adopter[];
};

function AdminResellerAdoptersPage() {
  const { data: isSuper, isLoading: roleLoading } = useIsSuperAdmin();
  const listFn = useServerFn(adminListResellerAdopters);
  const [q, setQ] = useState("");
  const [onlyAdopted, setOnlyAdopted] = useState(true);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "reseller-adopters"],
    enabled: !!isSuper,
    queryFn: async (): Promise<Group[]> => (await listFn()) as Group[],
  });

  const filtered = useMemo(() => {
    const rows = data ?? [];
    return rows
      .filter((g) => (onlyAdopted ? g.adopters.length > 0 : true))
      .filter((g) => {
        if (!q.trim()) return true;
        const needle = q.toLowerCase();
        return (
          g.reseller_product.name.toLowerCase().includes(needle) ||
          g.adopters.some(
            (a) =>
              (a.store_name ?? "").toLowerCase().includes(needle) ||
              (a.owner_email ?? "").toLowerCase().includes(needle) ||
              (a.owner_name ?? "").toLowerCase().includes(needle),
          )
        );
      });
  }, [data, q, onlyAdopted]);

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isSuper) return <Navigate to="/" />;

  const totalAdoptions = (data ?? []).reduce((n, g) => n + g.adopters.length, 0);

  return (
    <div className="container mx-auto max-w-6xl space-y-6 py-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" /> Reseller Product Adopters
          </h1>
          <p className="text-sm text-muted-foreground">
            See which reseller stores have added each marketplace product to their own website.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/admin-requests">Back to admin</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>
            {totalAdoptions} adoption{totalAdoptions === 1 ? "" : "s"} across{" "}
            {(data ?? []).filter((g) => g.adopters.length > 0).length} product
            {(data ?? []).filter((g) => g.adopters.length > 0).length === 1 ? "" : "s"}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Search product, store, or reseller email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-sm"
          />
          <Button
            variant={onlyAdopted ? "default" : "outline"}
            size="sm"
            onClick={() => setOnlyAdopted((v) => !v)}
          >
            {onlyAdopted ? "Showing adopted only" : "Showing all products"}
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <div className="text-sm text-destructive">{(error as Error).message}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <PackageSearch className="h-4 w-4" /> No matching products.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((g) => (
            <Card key={g.reseller_product.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {g.reseller_product.image_url ? (
                    <img
                      src={g.reseller_product.image_url}
                      alt={g.reseller_product.name}
                      className="h-12 w-12 rounded object-cover border"
                    />
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
                  <div className="text-sm text-muted-foreground">
                    No reseller has added this product yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Store</TableHead>
                          <TableHead>Owner</TableHead>
                          <TableHead className="text-right">Selling price</TableHead>
                          <TableHead className="text-right">Stock</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Added</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {g.adopters.map((a) => (
                          <TableRow key={a.product_id}>
                            <TableCell className="font-medium">
                              <span className="inline-flex items-center gap-1">
                                <StoreIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                {a.store_name ?? a.store_id ?? "—"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">{a.owner_name ?? "—"}</div>
                              <div className="text-xs text-muted-foreground">{a.owner_email ?? "—"}</div>
                            </TableCell>
                            <TableCell className="text-right">৳{a.selling_price ?? "—"}</TableCell>
                            <TableCell className="text-right">{a.stock ?? 0}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{a.status ?? "—"}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(a.created_at).toLocaleString()}
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
        </div>
      )}
    </div>
  );
}
