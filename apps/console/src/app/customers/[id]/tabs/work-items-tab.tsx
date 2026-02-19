import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRelative } from "@/lib/format";
import type { WorkItemWithRelations } from "../customer-tabs";

interface Props {
  items: WorkItemWithRelations[];
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  in_progress: "default",
  completed: "secondary",
  failed: "destructive",
  cancelled: "secondary",
};

export function WorkItemsTab({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
        <p className="text-sm font-medium">No work items</p>
        <p className="text-sm text-muted-foreground">
          Work items created for this customer will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created By</TableHead>
            <TableHead>Assigned To</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium capitalize">{item.type.replace(/_/g, " ")}</span>
                  <span className="text-xs text-muted-foreground font-mono">{item.id.slice(0, 12)}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[item.status] ?? "outline"} className="capitalize">
                  {item.status.replace(/_/g, " ")}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">
                {item.createdBy.name ?? item.createdBy.email}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {item.assignedTo?.name ?? item.assignedTo?.email ?? "—"}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatRelative(item.createdAt as string)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
