import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, ShieldAlert, Eye, EyeOff } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useIsSuperAdmin } from "@/lib/eazystore-data";
import {
  canReadResellerProducts,
  canSeeResellerPrice,
  type AppRole,
} from "@/lib/reseller-products-access";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin-reseller-visibility")({
  head: () => ({
    meta: [{ title: "Reseller visibility check · Admin" }],
  }),
  component: AdminResellerVisibilityPage,
});

type Row = {
  id: string;
  name: string;
  price: number | null;
  reseller_price: number | null;
  stock: number | null;
  category: string | null;
};

const ROLES: { key: AppRole; label: string }[] = [
  { key: "customer", label: "Customer / Anonymous" },
  { key: "store_owner", label: "Store owner (reseller)" },
  { key: "super_admin", label: "Super admin" },
];

function AdminResellerVisibilityPage() {
  const { data: isSuper, isLoading: roleLoading } = useIsSuperAdmin();
  const [simulatedRole, setSimulatedRole] = useState<AppRole>("customer");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "reseller-visibility-check"],
    enabled: !!isSuper,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("reseller_products")
        .select("id,name,price,reseller_price,stock,category")
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSuper) {
    return <Navigate to="/" />;
  }

  const roleList = [simulatedRole];
  const canRead = canReadResellerProducts(roleList);
  const canPrice = canSeeResellerPrice(roleList);

  return (
    <div className="container mx-auto max-w-6xl space-y-6 py-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Reseller Visibility Check</h1>
          <p className="text-sm text-muted-foreground">
            Preview what each role sees on the reseller products list. Enforcement lives in the
            <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">reseller_products</code>
            RLS policy — this page mirrors it via the shared
            <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">canReadResellerProducts</code>
            helper (covered by regression tests).
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/admin-requests">Back to admin</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Simulate role</CardTitle>
          <CardDescription>Switch to see the exact visibility that role receives.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {ROLES.map((r) => (
              <Button
                key={r.key}
                size="sm"
                variant={simulatedRole === r.key ? "default" : "outline"}
                onClick={() => setSimulatedRole(r.key)}
              >
                {r.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant={canRead ? "default" : "destructive"} className="gap-1">
              {canRead ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              List access: {canRead ? "allowed" : "blocked"}
            </Badge>
            <Badge variant={canPrice ? "default" : "secondary"} className="gap-1">
              {canPrice ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              Reseller price: {canPrice ? "visible" : "hidden"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reseller products (as {simulatedRole})</CardTitle>
          <CardDescription>
            {canRead
              ? "This role can query the reseller_products table."
              : "This role cannot query the reseller_products table — RLS returns 0 rows."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!canRead ? (
            <div className="flex items-center gap-2 rounded-md border border-dashed p-6 text-sm text-muted-foreground">
              <ShieldAlert className="h-4 w-4" /> No rows visible for this role.
            </div>
          ) : isLoading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : error ? (
            <div className="text-sm text-destructive">
              {(error as Error).message}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Retail price</TableHead>
                    <TableHead className="text-right">Reseller price</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data ?? []).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>{row.category ?? "—"}</TableCell>
                      <TableCell className="text-right">{row.price ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {canPrice ? (row.reseller_price ?? "—") : (
                          <span className="text-muted-foreground">hidden</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{row.stock ?? 0}</TableCell>
                    </TableRow>
                  ))}
                  {(data ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No reseller products found.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
