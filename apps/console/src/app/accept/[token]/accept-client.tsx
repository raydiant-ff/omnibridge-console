"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Stripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  FlaskConical,
  Clock,
  AlertTriangle,
  FileSignature,
  ScrollText,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { acceptQuote } from "@/lib/actions/quotes";
import { getDocuSignSigningUrl } from "@/lib/actions/docusign-session";
import { DryRunLogPanel } from "@/components/ui/dry-run-log-panel";
import { formatCurrency } from "@/lib/format";

let stripePromise: Promise<Stripe | null> | null = null;
function getStripe() {
  if (!stripePromise) {
    stripePromise = import("@stripe/stripe-js").then(({ loadStripe }) =>
      loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!),
    );
  }
  return stripePromise;
}

declare global {
  interface Window {
    DocuSign?: {
      loadDocuSign(integrationKey: string): Promise<{
        signing(opts: Record<string, unknown>): {
          on(event: string, handler: (e: Record<string, unknown>) => void): void;
          mount(selector: string): void;
        };
      }>;
    };
  }
}

interface LineItem {
  productName: string;
  nickname: string;
  quantity: number;
  unitAmount: number;
  currency: string;
  interval: string;
}

interface Props {
  token: string;
  customerName: string;
  collectionMethod: string;
  paymentTerms: string | null;
  totalAmount: number;
  currency: string;
  status: string;
  expiresAt: string | null;
  lineItems: LineItem[];
  isDryRun: boolean;
  hasDocuSign: boolean;
  signerName: string | null;
  wasCanceled: boolean;
}

export function AcceptQuoteClient({
  token,
  customerName,
  collectionMethod,
  paymentTerms,
  totalAmount,
  currency,
  status,
  expiresAt,
  lineItems,
  isDryRun,
  hasDocuSign,
  signerName,
  wasCanceled,
}: Props) {
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(status === "accepted");
  const [dryRunLog, setDryRunLog] = useState<string[] | null>(null);

  const [signingReady, setSigningReady] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const [documentSigned, setDocumentSigned] = useState(false);
  const signingContainerRef = useRef<HTMLDivElement>(null);

  const [hasScrolledTerms, setHasScrolledTerms] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const termsRef = useRef<HTMLDivElement>(null);

  const [checkoutClientSecret, setCheckoutClientSecret] = useState<string | null>(null);
  const [loadingCheckout, setLoadingCheckout] = useState(false);

  const expired = expiresAt ? new Date(expiresAt) < new Date() : false;
  const isTerminal =
    status === "canceled" || status === "accepted" || expired;

  const isPayNow = collectionMethod === "charge_automatically";
  const showCheckout = isPayNow && !!checkoutClientSecret && !accepted && !isDryRun;

  useEffect(() => {
    const el = termsRef.current;
    if (!el) return;

    function handleScroll() {
      if (!el) return;
      const threshold = 20;
      const atBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
      if (atBottom) setHasScrolledTerms(true);
    }

    el.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => el.removeEventListener("scroll", handleScroll);
  }, [isTerminal, accepted, signingReady, showCheckout]);

  const handleDocuSignComplete = useCallback(() => {
    setDocumentSigned(true);
  }, []);

  useEffect(() => {
    if (documentSigned && !isAccepting && !loadingCheckout) {
      if (isPayNow && !isDryRun) {
        startEmbeddedCheckout();
      } else {
        handleAcceptAfterSign();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentSigned]);

  async function startEmbeddedCheckout() {
    setLoadingCheckout(true);
    setError(null);

    try {
      const res = await fetch("/api/checkout/embedded", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "Failed to create checkout session.");
        setLoadingCheckout(false);
        return;
      }

      setCheckoutClientSecret(data.clientSecret);
      setLoadingCheckout(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
      setLoadingCheckout(false);
    }
  }

  async function handleCheckoutComplete() {
    setIsAccepting(true);
    setError(null);

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get("session_id");

      if (!sessionId) {
        await new Promise((r) => setTimeout(r, 1500));
      }

      if (!sessionId) {
        const res = await fetch("/api/checkout/embedded", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (data.error?.includes("already been accepted")) {
          setAccepted(true);
          setIsAccepting(false);
          return;
        }
      }

      if (sessionId) {
        const res = await fetch(
          `/api/checkout/session-status?session_id=${sessionId}`,
        );
        const data = await res.json();
        if (data.status === "complete") {
          setAccepted(true);
          setIsAccepting(false);
          return;
        }
      }

      setAccepted(true);
      setIsAccepting(false);
    } catch {
      setAccepted(true);
      setIsAccepting(false);
    }
  }

  async function startSigning() {
    setLoadingSession(true);
    setError(null);

    try {
      const result = await getDocuSignSigningUrl(token);

      if (result.dryRun && result.dryRunLog) {
        setDryRunLog(result.dryRunLog);
        setLoadingSession(false);
        return;
      }

      if (result.error || !result.signingUrl) {
        setError(result.error ?? "Could not start signing session.");
        setLoadingSession(false);
        return;
      }

      setSigningReady(true);
      setLoadingSession(false);

      requestAnimationFrame(async () => {
        if (!signingContainerRef.current) return;
        if (!result.integrationKey || !result.jsBundleUrl) return;

        try {
          if (!window.DocuSign) {
            await new Promise<void>((resolve, reject) => {
              const script = document.createElement("script");
              script.src = result.jsBundleUrl!;
              script.onload = () => resolve();
              script.onerror = () => reject(new Error("Failed to load DocuSign JS SDK"));
              document.head.appendChild(script);
            });
          }

          const ds = await window.DocuSign!.loadDocuSign(result.integrationKey);
          const signing = ds.signing({
            url: result.signingUrl,
            displayFormat: "focused",
            style: {
              branding: {
                primaryButton: {
                  backgroundColor: "#1E3A5F",
                  color: "#fff",
                },
              },
              signingNavigationButton: {
                finishText: "Complete Signing",
                position: "bottom-right",
              },
            },
          });

          signing.on("ready", () => {
            console.log("[DocuSign] Signing UI ready");
          });

          signing.on("sessionEnd", (event: Record<string, unknown>) => {
            const endType = event.sessionEndType ?? event.type;
            console.log("[DocuSign] sessionEnd:", endType);
            if (endType === "signing_complete") {
              handleDocuSignComplete();
            } else if (endType === "decline") {
              setError("The document was declined.");
              setSigningReady(false);
            } else if (endType === "cancel") {
              setSigningReady(false);
            } else if (endType === "ttl_expired" || endType === "session_timeout") {
              setError("Signing session expired. Please try again.");
              setSigningReady(false);
            }
          });

          signing.mount("#docusign-signing-container");
        } catch (err) {
          setError(
            `Failed to load signing: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
      setLoadingSession(false);
    }
  }

  async function handleAcceptAfterSign() {
    setIsAccepting(true);
    setError(null);

    try {
      const result = await acceptQuote(token);
      if (!result.success) {
        setError(result.error ?? "Failed to accept quote.");
        setIsAccepting(false);
        return;
      }
      setAccepted(true);
      setIsAccepting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
      setIsAccepting(false);
    }
  }

  async function handleDirectAccept() {
    setIsAccepting(true);
    setError(null);
    setDryRunLog(null);

    if (isPayNow && !isDryRun) {
      setIsAccepting(false);
      await startEmbeddedCheckout();
      return;
    }

    try {
      const result = await acceptQuote(token);
      if (!result.success) {
        setError(result.error ?? "Failed to accept quote.");
        setIsAccepting(false);
        return;
      }
      if (result.dryRunLog && result.dryRunLog.length > 0) {
        setDryRunLog(result.dryRunLog);
        setIsAccepting(false);
        return;
      }
      setAccepted(true);
      setIsAccepting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
      setIsAccepting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <Card className={`w-full ${showCheckout ? "max-w-4xl" : "max-w-2xl"}`}>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            {accepted
              ? "Quote Accepted"
              : showCheckout
                ? "Complete Payment"
                : documentSigned
                  ? "Processing..."
                  : "Review Your Quote"}
          </CardTitle>
          <CardDescription>
            {accepted
              ? "Thank you — your agreement has been confirmed."
              : showCheckout
                ? `Complete your payment for ${customerName}`
                : `Prepared for ${customerName}`}
          </CardDescription>
          {isDryRun && (
            <Badge
              variant="outline"
              className="mx-auto mt-2 gap-1 border-amber-400 text-amber-600"
            >
              <FlaskConical className="size-3" />
              Dry Run
            </Badge>
          )}
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          {wasCanceled && !accepted && !showCheckout && (
            <div className="rounded-md border border-amber-500/50 bg-amber-50/50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
              <AlertTriangle className="mb-0.5 mr-1 inline size-4" />
              Payment was canceled. You can try again below.
            </div>
          )}

          {accepted && (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="size-12 text-green-500" />
              <p className="text-sm text-muted-foreground">
                {collectionMethod === "send_invoice"
                  ? "An invoice will be sent to your billing email."
                  : "Your payment has been processed."}
              </p>
              <Button
                variant="outline"
                className="mt-2"
                onClick={() => (window.location.href = "/")}
              >
                Go Home
              </Button>
            </div>
          )}

          {status === "canceled" && !accepted && (
            <div className="flex flex-col items-center gap-2 py-4">
              <XCircle className="size-12 text-destructive" />
              <p className="text-sm text-muted-foreground">
                This quote has been canceled.
              </p>
            </div>
          )}

          {expired && !accepted && status !== "canceled" && (
            <div className="flex flex-col items-center gap-2 py-4">
              <Clock className="size-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                This quote expired on{" "}
                {new Date(expiresAt!).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
                .
              </p>
            </div>
          )}

          {!isTerminal && !accepted && !signingReady && !showCheckout && (
            <>
              <div className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Items
                </h3>
                {lineItems.map((li, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{li.productName}</span>
                      <span className="text-xs text-muted-foreground">
                        {li.nickname} &times; {li.quantity}
                      </span>
                    </div>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(li.unitAmount * li.quantity, li.currency)}
                      /{li.interval}
                    </span>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total</span>
                <span className="text-lg font-bold tabular-nums">
                  {formatCurrency(totalAmount, currency)}
                </span>
              </div>

              <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Payment</span>
                  <span>
                    {collectionMethod === "charge_automatically"
                      ? "Card payment required"
                      : paymentTerms ?? "Invoice"}
                  </span>
                </div>
                {expiresAt && (
                  <div className="flex justify-between">
                    <span>Valid until</span>
                    <span>
                      {new Date(expiresAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                )}
                {signerName && (
                  <div className="flex justify-between">
                    <span>Signer</span>
                    <span>{signerName}</span>
                  </div>
                )}
              </div>

              <Separator />
            </>
          )}

          {/* DocuSign Focused View signing container */}
          {signingReady && !accepted && !showCheckout && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <FileSignature className="size-4 text-primary" />
                <span className="text-sm font-medium">
                  Please review and sign the agreement below
                </span>
              </div>
              <div
                id="docusign-signing-container"
                ref={signingContainerRef}
                className="min-h-[620px] overflow-hidden rounded-lg border"
              />
              {documentSigned && (
                <div className="flex items-center justify-center gap-2 py-2 text-sm text-green-600">
                  <CheckCircle2 className="size-4" />
                  Document signed — preparing payment...
                </div>
              )}
            </div>
          )}

          {/* Embedded Stripe Checkout */}
          {showCheckout && (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border bg-muted/20 px-4 py-3">
                <div className="flex items-center gap-2 text-sm">
                  <CreditCard className="size-4 text-primary" />
                  <span className="font-medium">
                    Order Summary — {formatCurrency(totalAmount, currency)}
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  {lineItems.map((li, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs text-muted-foreground"
                    >
                      <span>
                        {li.productName} &times; {li.quantity}
                      </span>
                      <span className="tabular-nums">
                        {formatCurrency(li.unitAmount * li.quantity, li.currency)}
                        /{li.interval}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <EmbeddedCheckoutProvider
                stripe={getStripe()}
                options={{
                  clientSecret: checkoutClientSecret!,
                  onComplete: handleCheckoutComplete,
                }}
              >
                <EmbeddedCheckout className="min-h-[400px]" />
              </EmbeddedCheckoutProvider>
            </div>
          )}

          {/* Loading checkout spinner */}
          {loadingCheckout && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Preparing secure payment form...
              </p>
            </div>
          )}

          {dryRunLog && dryRunLog.length > 0 && (
            <DryRunLogPanel logs={dryRunLog} maxHeight="max-h-60" />
          )}

          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {!isTerminal && !accepted && !signingReady && !showCheckout && !loadingCheckout && (
            <>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <ScrollText className="size-4 text-muted-foreground" />
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Terms of Use
                  </span>
                </div>
                <div
                  ref={termsRef}
                  className="max-h-48 overflow-y-auto rounded-lg border bg-muted/20 px-4 py-3 text-xs leading-relaxed text-muted-foreground"
                >
                  <p className="mb-3 text-center font-semibold uppercase tracking-wide text-foreground">
                    Terms of Use
                  </p>

                  <p className="mb-3">
                    This Terms of Service (&ldquo;TOS&rdquo;) contains the
                    exclusive terms and conditions between Displai Systems, Inc.
                    (&ldquo;we,&rdquo; &ldquo;us,&rdquo; &ldquo;our&rdquo; or
                    &ldquo;Company&rdquo;), a Delaware corporation and You, the
                    customer specifically identified in the order form
                    referencing this TOS (&ldquo;You&rdquo;, &ldquo;you&rdquo;,
                    &ldquo;your&rdquo;), regarding access and use of the
                    Services. The terms &ldquo;You&rdquo;, &ldquo;you&rdquo; and
                    &ldquo;your&rdquo; will refer to you, your heirs, and
                    assigns, and the organization you represent, including its
                    subsidiaries and affiliates, and their respective officers,
                    directors, employees and agents. By accessing, using,
                    purchasing or registering for the Services, you are agreeing
                    to these terms for yourself and the organization you
                    represent, and representing to Displai that you have the
                    authority to bind that organization (in which case, the terms
                    &ldquo;You&rdquo;, &ldquo;you&rdquo; and &ldquo;your&rdquo;
                    will refer to that organization) under all applicable laws.{" "}
                    <strong>
                      ONCE ACCEPTED, THESE TOS BECOME A BINDING LEGAL COMMITMENT
                      BETWEEN YOU AND DISPLAI. IF YOU DO NOT AGREE TO BE BOUND
                      BY THESE TOS, YOU SHOULD NOT ACCESS, USE, PURCHASE OR
                      REGISTER FOR DISPLAI SERVICES.
                    </strong>
                  </p>

                  <p className="mb-3">
                    Pursuant to this TOS, you may order from Displai licenses to
                    access and use Displai&apos;s Services. The specifics of
                    each order will be set forth on a written or electronic order
                    form, quote and/or invoice (each, an &ldquo;Order
                    Form&rdquo;) provided by Displai or made available on the
                    Displai website. Terms not defined below shall have the
                    meaning given to them in the Order Form.
                  </p>

                  <p className="mb-2">
                    <strong>1. Modifications to the TOS.</strong> Displai
                    reserves the right to modify the TOS, at any time and
                    without prior notice (except with respect to Section 15
                    governing arbitration). We will post modifications on the
                    Services and/or use other means to notify you. By continuing
                    to access or use the Services, you are agreeing to be bound
                    by the modified TOS.
                  </p>

                  <p className="mb-2">
                    <strong>2. Registration.</strong> You may only register for
                    the Services if you are at least 18 years of age (or have
                    reached the age of majority if that is not 18 years of age
                    where you live). You will be required to create an account
                    with an email and a password. You agree to provide accurate,
                    current and complete information during registration and at
                    all other times when you use the Services. We reserve the
                    right in our sole discretion to refuse to keep accounts for,
                    or provide services to, any individual or organization. You
                    may not share your account credentials with any individual
                    who is not an authorized user. You are responsible for
                    safeguarding your password.
                  </p>

                  <p className="mb-2">
                    <strong>3–17.</strong> The remaining provisions of this TOS
                    (covering The Services, Digital Displays, Intellectual
                    Property, Confidentiality, Your Responsibilities, Fees,
                    Subscription Term &amp; Termination, Rules of Conduct,
                    Customer Breach, Representations &amp; Warranty Disclaimers,
                    Limitations, Indemnification, Dispute Resolution &amp;
                    Binding Arbitration, and General Provisions) are incorporated
                    by reference. The full text is available at{" "}
                    <a
                      href="https://displai.ai/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      displai.ai/terms
                    </a>
                    .
                  </p>

                  <p className="border-t pt-2 text-center text-[10px] text-muted-foreground/60">
                    Displai Systems, Inc. &bull; Delaware Corporation &bull;{" "}
                    <a
                      href="https://displai.ai/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      displai.ai/terms
                    </a>
                  </p>
                </div>

                {!hasScrolledTerms && (
                  <p className="text-center text-xs text-muted-foreground/70">
                    Scroll to the bottom to continue
                  </p>
                )}

                <label
                  className={`flex items-start gap-2.5 rounded-lg border px-4 py-3 transition-colors ${
                    hasScrolledTerms
                      ? "cursor-pointer hover:bg-muted/30"
                      : "cursor-not-allowed opacity-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    disabled={!hasScrolledTerms}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 size-4 rounded border-gray-300 accent-primary"
                  />
                  <span className="text-sm">
                    I have read and agree to the{" "}
                    <a
                      href="https://displai.ai/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium underline"
                    >
                      Terms of Use
                    </a>
                  </span>
                </label>
              </div>

              <Button
                size="lg"
                className="w-full"
                onClick={hasDocuSign ? startSigning : handleDirectAccept}
                disabled={
                  isAccepting || loadingSession || !termsAccepted
                }
              >
                {isAccepting || loadingSession ? (
                  <>
                    <Loader2 className="animate-spin" />
                    {loadingSession
                      ? "Preparing document..."
                      : "Processing..."}
                  </>
                ) : isDryRun ? (
                  <>
                    <FlaskConical className="size-4" />
                    Test Accept (Dry Run)
                  </>
                ) : hasDocuSign ? (
                  <>
                    <FileSignature className="size-4" />
                    Review &amp; Sign Agreement
                  </>
                ) : collectionMethod === "charge_automatically" ? (
                  "Accept & Pay"
                ) : (
                  "Accept Quote"
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
