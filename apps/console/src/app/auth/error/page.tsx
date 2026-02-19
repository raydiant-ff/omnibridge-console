"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const ERROR_MESSAGES: Record<string, string> = {
  Configuration: "There is a problem with the server configuration.",
  AccessDenied: "Access denied.",
  CredentialsSignin: "Invalid email or password.",
  Default: "An unexpected error occurred.",
};

function ErrorContent() {
  const searchParams = useSearchParams();
  const errorType = searchParams.get("error") ?? "Default";
  const message = ERROR_MESSAGES[errorType] ?? ERROR_MESSAGES.Default;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-6"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            Authentication Error
          </h1>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>

        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Back to Login</Link>
        </Button>
      </div>
    </main>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense>
      <ErrorContent />
    </Suspense>
  );
}
