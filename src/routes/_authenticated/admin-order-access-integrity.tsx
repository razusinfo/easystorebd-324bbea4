import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";
import {
  listOrderAccessAudit,
  runOrderAccessIntegrityCheck,
  type OrderAccessAuditEntry,
  type OrderIntegrityRow,
} from "@/lib/order-management.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";

export const Route = createFileRoute(
  "/_authenticated/admin-order-access-integrity",
)({
  head: () => ({
    meta: [{ title: "Order Access Integrity — EasyStore" }],
  }),
  component: AdminOrderAccessIntegrityPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">
      Failed to load: {error instanceof Error ? error.message : String(error)}
    </div>
  ),
  notFoundComponent: () => <div className="p-6">Not found.</div>,
});

const ISSUE_LABEL: Record<string, string> = {
  null_reseller_id: "Missing reseller assignment",
  unknown_reseller_profile: "Unknown reseller profile",
  duplicate_forward: "Duplicate forwarding",
  reseller_owner_mismatch: "Reseller ≠ storefront owner",
};

function AdminOrderAccessIntegrityPage() {
  const router = useRouter();
  const runCheck = useServerFn(runOrderAccessIntegrityCheck);
  const loadAudit = useServerFn(listOrderAccessAudit);

  const integrity = useQuery({
    queryKey: ["order-access-integrity"],
    queryFn: () => runCheck({}),
    staleTime: 30_000,
  });

  const audit = useQuery({
    queryKey: ["order-access-audit"],
    queryFn: () => loadAudit({}),
    staleTime: 30_000,
  });

  const rows: OrderIntegrityRow[] = integrity.data?.rows ?? [];
  const auditRows: OrderAccessAuditEntry[] = audit.data?.rows ?? [];

  const byIssue = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.issue] = (acc[r.issue] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <ShieldCheck className="h-5 w-5" />
            Order Access Integrity
          </h1>
          <p className="text-sm text-muted-foreground">
            Scans reseller orders for rows that would be routed to the wrong
            supplier under current RLS, and shows a log of who read the order
            list.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            integrity.refetch();
            audit.refetch();
            router.invalidate();
          }}
          disabled={integrity.isFetching || audit.isFetching}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${integrity.isFetching ? "animate-spin" : ""}`}
          />
          Rescan
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {rows.length === 0 ? (
              <>
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                No integrity issues detected
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                {rows.length} issue{rows.length === 1 ? "" : "s"} found
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(byIssue).map(([issue, n]) => (
                <Badge key={issue} variant="secondary">
                  {ISSUE_LABEL[issue] ?? issue}: {n}
                </Badge>
              ))}
            </div>
          )}

          {integrity.isLoading ? (
            <div className="text-sm text-muted-foreground">Scanning…</div>
          ) : integrity.error ? (
            <div className="text-sm text-destructive">
              {(integrity.error as Error).message}
            </div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Every reseller order is assigned to a real reseller, has no
              duplicate forwarding, and matches its storefront owner.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Issue</TableHead>
                    <TableHead>Reseller</TableHead>
                    <TableHead>Storefront owner</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={`${r.order_id}-${r.issue}`}>
                      <TableCell className="font-mono text-xs">
                        {r.order_id.slice(0, 8).toUpperCase()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive">
                          {ISSUE_LABEL[r.issue] ?? r.issue}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.reseller_id?.slice(0, 8) ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.storefront_owner_id?.slice(0, 8) ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {r.created_at
                          ? format(new Date(r.created_at), "yyyy-MM-dd HH:mm")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.detail}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Recent order-list access (last 500)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {audit.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : audit.error ? (
            <div className="text-sm text-destructive">
              {(audit.error as Error).message}
            </div>
          ) : auditRows.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No access recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead className="text-right">Rows</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {format(new Date(r.created_at), "yyyy-MM-dd HH:mm:ss")}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.actor_name || (
                          <span className="font-mono">
                            {r.actor_id?.slice(0, 8) ?? "—"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            r.actor_role === "super_admin"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {r.actor_role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{r.action}</TableCell>
                      <TableCell className="text-right text-xs">
                        {r.row_count}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {r.ip_address ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
