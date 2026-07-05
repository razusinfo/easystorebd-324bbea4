import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  getMarketplaceStockReconciliation,
  runResyncMarketplaceStock,
} from "@/lib/marketplace-stock-reconciliation.functions";

type Row = {
  request_id: string;
  reseller_product_id: string;
  name: string;
  reseller_stock: number;
  source_stock: number | null;
  status: "match" | "mismatch" | "no_source" | "stuck_out_of_stock";
  mismatch: boolean;
};

export function MarketplaceStockReconciliationCard() {
  const qc = useQueryClient();
  const fetchReport = useServerFn(getMarketplaceStockReconciliation);
  const resync = useServerFn(runResyncMarketplaceStock);

  const q = useQuery({
    queryKey: ["marketplace-stock-reconciliation"],
    queryFn: () => fetchReport(),
    staleTime: 30_000,
  });

  const m = useMutation({
    mutationFn: () => resync(),
    onSuccess: (r: { updated: number; discrepancies: number; checked: number }) => {
      toast.success(
        `Resync: repaired ${r.updated} of ${r.discrepancies} mismatches (${r.checked} checked).`,
      );
      qc.invalidateQueries({ queryKey: ["marketplace-stock-reconciliation"] });
    },
    onError: (e: Error) => toast.error(e.message || "Resync failed"),
  });

  const rows = (q.data?.rows ?? []) as Row[];
  const mismatches = rows.filter((r) => r.mismatch);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">Marketplace stock reconciliation</CardTitle>
          <CardDescription>
            Approved marketplace products whose stock disagrees with the requester's source product.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => qc.invalidateQueries({ queryKey: ["marketplace-stock-reconciliation"] })}
            disabled={q.isFetching}
          >
            {q.isFetching ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
            Refresh
          </Button>
          <Button size="sm" onClick={() => m.mutate()} disabled={m.isPending}>
            {m.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Resync now
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Checked: <strong className="text-foreground">{q.data?.checked ?? 0}</strong></span>
          <span>Mismatches: <strong className="text-foreground">{mismatches.length}</strong></span>
          {q.data?.generated_at ? (
            <span>Generated: {new Date(q.data.generated_at).toLocaleString()}</span>
          ) : null}
        </div>

        {q.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading report…
          </div>
        ) : mismatches.length === 0 ? (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-3 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            All approved marketplace items are in sync with their source products.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Marketplace</TableHead>
                  <TableHead className="text-right">Source</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mismatches.map((r) => (
                  <TableRow key={r.reseller_product_id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-right">{r.reseller_stock}</TableCell>
                    <TableCell className="text-right">
                      {r.source_stock == null ? "—" : r.source_stock}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.status === "stuck_out_of_stock" ? "destructive" : "secondary"} className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {r.status === "stuck_out_of_stock" ? "Stuck out of stock" : r.status === "no_source" ? "No source" : "Mismatch"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
