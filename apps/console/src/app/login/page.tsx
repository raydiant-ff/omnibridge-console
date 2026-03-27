"use client";

import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function LoginForm() {
  const slackEnabled = process.env.NEXT_PUBLIC_SLACK_AUTH_ENABLED === "true";
  const searchParams = useSearchParams();
  const router = useRouter();
  const error = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [slackLoading, setSlackLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFormError(null);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setFormError("Invalid email or password.");
      return;
    }

    router.push("/opportunities");
    router.refresh();
  }

  async function handleSlackSignIn() {
    setSlackLoading(true);
    setFormError(null);

    await signIn("slack", {
      callbackUrl: "/opportunities",
    });
  }

  const displayError =
    formError ??
    (error === "CredentialsSignin"
      ? "Invalid email or password."
      : error === "AccessDenied"
        ? "Your Slack account is not provisioned for Omni yet."
      : error
        ? "Something went wrong. Please try again."
        : null);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-6 rounded-2xl border bg-card p-8 card-shadow"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-lg font-semibold tracking-tight">Displai Omni</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to continue
          </p>
        </div>

        {displayError && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {displayError}
          </div>
        )}

        {slackEnabled ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              size="lg"
              disabled={slackLoading || loading}
              onClick={handleSlackSignIn}
            >
              {slackLoading ? "Redirecting to Slack…" : "Continue with Slack"}
            </Button>

            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              <span>Password login</span>
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        ) : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
