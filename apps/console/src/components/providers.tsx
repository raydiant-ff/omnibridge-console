"use client";

import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session?: Session | null;
}) {
  return (
    <SessionProvider session={session}>
      <TooltipProvider>{children}</TooltipProvider>
    </SessionProvider>
  );
}
