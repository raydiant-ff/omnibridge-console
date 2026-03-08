import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import type { AuditLogWithActor } from "../customer-tabs";

interface Props {
  logs: AuditLogWithActor[];
}

export function AuditTab({ logs }: Props) {
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
        <p className="text-sm font-medium">No audit logs</p>
        <p className="text-sm text-muted-foreground">
          Actions performed on this customer will be recorded here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Timestamp</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Request ID</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                {formatDateTime(log.createdAt as string)}
              </TableCell>
              <TableCell className="text-sm">
                {log.actor.name ?? log.actor.email}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="font-mono text-xs">
                  {log.action}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {log.targetType && log.targetId
                  ? `${log.targetType}:${log.targetId.slice(0, 12)}`
                  : "—"}
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {log.requestId?.slice(0, 12) ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
