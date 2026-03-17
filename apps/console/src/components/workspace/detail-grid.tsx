import { cn } from "@/lib/utils";

interface DetailGridProps {
  columns?: 2 | 3;
  children: React.ReactNode;
  className?: string;
}

export function DetailGrid({
  columns = 2,
  children,
  className,
}: DetailGridProps) {
  return (
    <div
      className={cn(
        "grid gap-4",
        columns === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2",
        className,
      )}
    >
      {children}
    </div>
  );
}
