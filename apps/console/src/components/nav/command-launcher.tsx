"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// CommandLauncher — global cmd+k command palette
// Supports navigation, quick actions, and page jumping.
// Register items via the `groups` prop.
// ---------------------------------------------------------------------------

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  href?: string;
  onSelect?: () => void;
  keywords?: string[];
}

export interface CommandGroup {
  heading: string;
  items: CommandItem[];
}

interface CommandLauncherProps {
  groups?: CommandGroup[];
  /** Trigger element override — defaults to a search button */
  trigger?: React.ReactNode;
  className?: string;
}

export function CommandLauncher({ groups = [], trigger, className }: CommandLauncherProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  // Global keyboard shortcut: cmd+k / ctrl+k
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleSelect = (item: CommandItem) => {
    setOpen(false);
    if (item.href) {
      router.push(item.href);
    } else {
      item.onSelect?.();
    }
  };

  return (
    <>
      {/* Trigger */}
      {trigger ?? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className={cn(
            "h-8 gap-2 text-muted-foreground text-sm font-normal px-3 w-48 justify-start",
            className,
          )}
        >
          <Search className="size-3.5" />
          Search…
          <kbd className="ml-auto text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded border border-border">
            ⌘K
          </kbd>
        </Button>
      )}

      {/* Dialog */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search pages, records, actions…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {groups.map((group, i) => (
            <>
              {i > 0 && <CommandSeparator key={`sep-${i}`} />}
              <CommandGroup key={group.heading} heading={group.heading}>
                {group.items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={[item.label, ...(item.keywords ?? [])].join(" ")}
                    onSelect={() => handleSelect(item)}
                  >
                    {item.icon && (
                      <span className="mr-2 flex items-center justify-center size-4 text-muted-foreground">
                        {item.icon}
                      </span>
                    )}
                    <span>{item.label}</span>
                    {item.description && (
                      <span className="ml-2 text-xs text-muted-foreground">{item.description}</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
