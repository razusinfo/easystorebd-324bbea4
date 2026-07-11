import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertCircle, Loader2, ShieldCheck, Wifi } from "lucide-react";
import type { DomainStatus } from "@/lib/custom-domains.functions";

export function DomainStatusBadge({ status }: { status: DomainStatus }) {
  const map: Record<DomainStatus, { label: string; className: string; Icon: React.ComponentType<{ className?: string }> }> = {
    pending:      { label: "Pending",        className: "bg-muted text-muted-foreground",                  Icon: Clock },
    verifying:    { label: "Verifying DNS",  className: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300", Icon: Loader2 },
    dns_ok:       { label: "DNS OK",         className: "bg-blue-500/15 text-blue-700 dark:text-blue-300", Icon: Wifi },
    ssl_pending:  { label: "SSL Issuing",    className: "bg-orange-500/15 text-orange-700 dark:text-orange-300", Icon: ShieldCheck },
    live:         { label: "Live",           className: "bg-green-500/15 text-green-700 dark:text-green-300", Icon: CheckCircle2 },
    failed:       { label: "Failed",         className: "bg-red-500/15 text-red-700 dark:text-red-300",     Icon: AlertCircle },
    offline:      { label: "Offline",        className: "bg-red-500/15 text-red-700 dark:text-red-300",     Icon: AlertCircle },
  };
  const { label, className, Icon } = map[status] ?? map.pending;
  const spin = status === "verifying" || status === "ssl_pending";
  return (
    <Badge variant="outline" className={`gap-1.5 ${className}`}>
      <Icon className={`h-3 w-3 ${spin ? "animate-spin" : ""}`} />
      {label}
    </Badge>
  );
}
