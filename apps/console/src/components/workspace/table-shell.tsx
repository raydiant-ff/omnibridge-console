import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

interface TableShellProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  toolbar?: React.ReactNode;
  className?: string;
}

export function TableShell({
  title,
  description,
  children,
  toolbar,
  className,
}: TableShellProps) {
  return (
    <Card className={className}>
      <CardHeader className="border-b pb-3">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        {description && (
          <CardDescription className="text-sm">{description}</CardDescription>
        )}
      </CardHeader>
      {toolbar && (
        <div className="border-b px-4 py-2">{toolbar}</div>
      )}
      <CardContent className="p-0">
        <div className="overflow-x-auto">{children}</div>
      </CardContent>
    </Card>
  );
}
