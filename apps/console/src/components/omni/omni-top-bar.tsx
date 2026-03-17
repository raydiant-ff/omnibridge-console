"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function OmniTopBar() {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-50 h-10 shrink-0 flex items-center gap-1 border-b border-border bg-background px-3">
      {/* Branding */}
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/displai-favicon.png"
          alt="Omni"
          className="w-5 h-5 rounded-[4px]"
        />
        <span className="text-sm font-semibold tracking-tight select-none">Omni</span>
      </div>

      <Separator orientation="vertical" className="h-4 mx-1.5" />

      {/* Navigation arrows */}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground hover:text-foreground"
        onClick={() => router.back()}
        title="Go back"
      >
        <ChevronLeft className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground hover:text-foreground"
        onClick={() => window.history.forward()}
        title="Go forward"
      >
        <ChevronRight className="size-3.5" />
      </Button>
    </header>
  );
}
