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
    <Card className={cn("gap-0 overflow-hidden", className)}>
      <CardHeader className="border-b border-border/80 pb-3">
        <CardTitle className="text-base font-semibold tracking-[-0.01em]">
          {title}
        </CardTitle>
        {description && (
          <CardDescription className="text-[13px]">{description}</CardDescription>
        )}
      </CardHeader>
      {toolbar && (
        <div className="border-b border-border/80 px-5 py-3">{toolbar}</div>
      )}
      <CardContent className="p-0">
        <div className="overflow-x-auto">{children}</div>
      </CardContent>
    </Card>
  );
}
