import { cn } from "@/lib/utils";

interface ToolbarIconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export function ToolbarIconButton({
  active = false,
  className,
  children,
  ...props
}: ToolbarIconButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center size-8 rounded-xl transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
