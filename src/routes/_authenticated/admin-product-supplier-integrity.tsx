import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin-product-supplier-integrity")({
  head: () => ({
    meta: [
      { title: "Product supplier integrity — EasyStore admin" },
      { name: "description", content: "Audit products.supplier_id assignments against the expected supplier owner." },
    ],
  }),
  component: AdminProductSupplierIntegrityPage,
});

type Row = {
  product_id: string;
  product_name: string | null;
  store_id: string | null;
  actual_supplier_id: string | null;
  expected_supplier_id: string | null;
  issue: string;
};

function AdminProductSupplierIntegrityPage() {
  const q = useQuery({
    queryKey: ["admin", "product-supplier-integrity"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase.rpc("admin_check_product_supplier_integrity" as never);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const rows = q.data ?? [];
  const ok = !q.isLoading && !q.isError && rows.length === 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Product supplier integrity</h1>
          <p className="text-sm text-foreground/60">
            Lists products where <code>supplier_id</code> is missing or does not match the resolved owner.
          </p>
        </div>
        <Button variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
          {q.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Re-run check
        </Button>
      </div>

      {q.isLoading ? (
        <div className="grid place-items-center rounded-xl border border-dashed p-16">
          <Loader2 className="h-6 w-6 animate-spin text-foreground/40" />
        </div>
      ) : q.isError ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            Failed to load integrity report. You must be a super admin to use this page.
          </CardContent>
        </Card>
      ) : ok ? (
        <Card>
          <CardContent className="flex items-center gap-3 p-6 text-sm">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            All products have a correct <code>supplier_id</code>.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              {rows.length} mismatched {rows.length === 1 ? "product" : "products"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Actual supplier</TableHead>
                    <TableHead>Expected supplier</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.product_id}>
                      <TableCell className="font-medium">{r.product_name ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{r.store_id ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{r.actual_supplier_id ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{r.expected_supplier_id ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline">{r.issue}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
