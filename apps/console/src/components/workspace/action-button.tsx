import { cn } from "@/lib/utils";

interface ActionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
}

export function ActionButton({
  icon,
  className,
  children,
  ...props
}: ActionButtonProps) {
  return (
    <button
      className={cn(
        "group flex items-center gap-3 w-full px-4 py-3 rounded-xl",
        "border border-border bg-card text-sm font-medium text-foreground/60",
        "hover:border-border hover:text-foreground/80 active:bg-muted/30 transition-colors",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/30",
        className,
      )}
      {...props}
    >
      {icon && (
        <span className="text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors">
          {icon}
        </span>
      )}
      {children}
    </button>
  );
}
