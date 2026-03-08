"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  FlaskConical,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FileSignature,
  ScrollText,
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
import { getSigningSession } from "@/lib/actions/pandadoc-session";

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
  hasPandaDoc: boolean;
  signerName: string | null;
  wasCanceled: boolean;
}

function formatCurrency(cents: number, curr = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: curr,
  }).format(cents / 100);
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
  hasPandaDoc,
  signerName,
  wasCanceled,
}: Props) {
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(status === "accepted");
  const [dryRunLog, setDryRunLog] = useState<string[] | null>(null);
  const [logExpanded, setLogExpanded] = useState(true);

  const [signingReady, setSigningReady] = useState(false);
  const [signingSessionId, setSigningSessionId] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [documentSigned, setDocumentSigned] = useState(false);
  const signingContainerRef = useRef<HTMLDivElement>(null);

  const [hasScrolledTerms, setHasScrolledTerms] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const termsRef = useRef<HTMLDivElement>(null);

  const expired = expiresAt ? new Date(expiresAt) < new Date() : false;
  const isTerminal =
    status === "canceled" || status === "accepted" || expired;

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
  }, [isTerminal, accepted, signingReady]);

  const handlePandaDocMessage = useCallback(
    (event: MessageEvent) => {
      if (
        event.origin !== "https://app.pandadoc.com" &&
        event.origin !== "https://eSign.pandadoc.com"
      )
        return;

      const type = event.data?.type;
      if (
        type === "session_view.document.completed" ||
        type === "document.completed"
      ) {
        setDocumentSigned(true);
      }
    },
    [],
  );

  useEffect(() => {
    window.addEventListener("message", handlePandaDocMessage);
    return () => window.removeEventListener("message", handlePandaDocMessage);
  }, [handlePandaDocMessage]);

  useEffect(() => {
    if (documentSigned && !isAccepting) {
      handleAcceptAfterSign();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentSigned]);

  async function startSigning() {
    setLoadingSession(true);
    setError(null);

    try {
      const result = await getSigningSession(token);

      if (result.dryRun && result.dryRunLog) {
        setDryRunLog(result.dryRunLog);
        setLoadingSession(false);
        return;
      }

      if (result.error || !result.sessionId) {
        setError(result.error ?? "Could not start signing session.");
        setLoadingSession(false);
        return;
      }

      setSigningSessionId(result.sessionId);
      setSigningReady(true);
      setLoadingSession(false);

      requestAnimationFrame(async () => {
        if (!signingContainerRef.current || !result.sessionId) return;
        try {
          const { Signing } = await import("pandadoc-signing");
          const signing = new Signing(
            signingContainerRef.current.id,
            { sessionId: result.sessionId, width: "100%", height: 600 },
            { region: "com" },
          );
          await signing.open();
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
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
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
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
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
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            {accepted
              ? "Quote Accepted"
              : documentSigned
                ? "Processing..."
                : "Review Your Quote"}
          </CardTitle>
          <CardDescription>
            {accepted
              ? "Thank you — your agreement has been confirmed."
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
          {wasCanceled && !accepted && (
            <div className="rounded-md border border-amber-500/50 bg-amber-50/50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
              <AlertTriangle className="mb-0.5 mr-1 inline size-4" />
              Payment was canceled. You can try again below.
            </div>
          )}

          {accepted && (
            <div className="flex flex-col items-center gap-2 py-4">
              <CheckCircle2 className="size-12 text-green-500" />
              <p className="text-sm text-muted-foreground">
                {collectionMethod === "send_invoice"
                  ? "An invoice will be sent to your billing email."
                  : "Your payment has been processed."}
              </p>
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

          {!isTerminal && !accepted && !signingReady && (
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

          {/* PandaDoc embedded signing iframe */}
          {signingReady && signingSessionId && !accepted && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <FileSignature className="size-4 text-primary" />
                <span className="text-sm font-medium">
                  Please review and sign the agreement below
                </span>
              </div>
              <div
                id="pandadoc-signing-container"
                ref={signingContainerRef}
                className="min-h-[620px] overflow-hidden rounded-lg border"
              />
              {documentSigned && (
                <div className="flex items-center justify-center gap-2 py-2 text-sm text-green-600">
                  <CheckCircle2 className="size-4" />
                  Document signed — finalizing...
                </div>
              )}
            </div>
          )}

          {dryRunLog && dryRunLog.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
              <button
                type="button"
                onClick={() => setLogExpanded((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  Dry Run Results ({dryRunLog.length} entries)
                </span>
                {logExpanded ? (
                  <ChevronDown className="size-4 text-amber-600" />
                ) : (
                  <ChevronRight className="size-4 text-amber-600" />
                )}
              </button>
              {logExpanded && (
                <div className="max-h-60 overflow-y-auto border-t border-amber-500/20 px-4 py-3">
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-amber-900 dark:text-amber-200">
                    {dryRunLog.join("\n")}
                  </pre>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {!isTerminal && !accepted && !signingReady && (
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
                    <strong>3. The Services.</strong> The Displai Services
                    include a proprietary software application to be hosted and
                    made available by Displai on a software-as-a-service basis
                    and technology through which digital feeds, apps, and content
                    created and provided by you or third parties (the
                    &ldquo;Digital Displays&rdquo;) can be hosted and displayed
                    (collectively, the &ldquo;Services&rdquo;). The Services may
                    also contain links, text, graphics, images, audio, video,
                    information, code, or other materials provided by Displai
                    (&ldquo;Displai Content&rdquo;). Displai does not guarantee
                    that any parts of the Services will be available at all
                    times, and Displai may change, update, or discontinue the
                    Services without notice to you.
                  </p>

                  <p className="mb-2">
                    <strong>4. Digital Displays; Third Party Content.</strong>{" "}
                    You expressly agree and acknowledge that you will not hold
                    Displai responsible for the Digital Displays or any other
                    third-party content created by you or third parties that may
                    be hosted or displayed on or through the Services, and you
                    agree to indemnify and hold Displai harmless from and against
                    any claims or damages arising out of or resulting from the
                    Digital Displays or any other third-party content. Displai
                    does not review or guarantee the existence, quality, or
                    legality of the Digital Displays; the truth or accuracy of
                    Digital Displays; or that Digital Displays will not contain
                    offensive content.
                  </p>

                  <p className="mb-2">
                    <strong>5. Intellectual Property.</strong> You acknowledge
                    that the Services and Displai Content are the proprietary
                    intellectual property of Displai or its licensors. The
                    Services are protected by copyright, trademark, and other
                    laws. Except as expressly provided in these TOS, Displai and
                    its licensors exclusively own all right, title, and interest
                    in and to the Services and Displai Content, including all
                    associated intellectual property rights. We grant you (and to
                    the extent applicable, your employees or individual
                    contractors acting for your exclusive benefit) a limited,
                    non-exclusive, non-transferable license, without the right to
                    sublicense, to access and use the Services solely for your
                    internal business purposes and as permitted by these TOS. You
                    agree not to: (i) rent, lease, sublicense, distribute,
                    resell, transfer, copy, modify, create derivative works of,
                    publicly display, publicly perform, transmit, stream,
                    broadcast or time-share the Services; (ii) commercially
                    exploit, or make the Services available to any third party,
                    in whole or in part; (iii) except to the limited extent
                    expressly prohibited by law, decompile, disassemble, reverse-
                    compile, reverse-assemble or otherwise reverse-engineer any
                    aspect of the Services; (iv) permit anyone else to do any of
                    the foregoing; or (v) otherwise use the Services in any way
                    not expressly permitted by this TOS. All trademarks, service
                    marks, logos, trade names and any other proprietary
                    designations of Displai used herein are trademarks or
                    registered trademarks of Displai. No rights or licenses are
                    granted to you other than the express rights granted in these
                    TOS.
                  </p>

                  <p className="mb-2">
                    <strong>6. Confidentiality.</strong>{" "}
                    &ldquo;Confidential Information&rdquo; means, with respect
                    to a party (the &ldquo;disclosing party&rdquo;), information
                    that pertains to such party&apos;s business, including,
                    without limitation, technical, marketing, financial,
                    employee, planning, product roadmaps and documentation,
                    Customer Content, performance results, pricing, and other
                    confidential or proprietary information. The receiving party
                    shall preserve the confidentiality of the disclosing
                    party&apos;s Confidential Information and treat such
                    Confidential Information with at least the same degree of
                    care that the receiving party uses to protect its own
                    Confidential Information, but not less than a reasonable
                    standard of care.
                  </p>

                  <p className="mb-2">
                    <strong>7. Your Responsibilities.</strong> You are solely
                    responsible for all data, information, feedback, suggestions,
                    text, content and other materials that you upload, post,
                    deliver, provide or otherwise transmit or store in connection
                    with or relating to the Services (&ldquo;Customer
                    Content&rdquo;). You, not Displai, own Customer Content and
                    are solely responsible for the quality and legality of your
                    Customer Content. You are solely responsible for: (a) having
                    Internet access and an active Third Party Provider account,
                    if applicable; (b) ensuring that all registration and account
                    information and data are current and accurate; (c) managing
                    all account activity; (d) maintaining the confidentiality and
                    security of your username, password and account information;
                    and (e) securing all consents and permissions to enable you
                    to maintain your Third Party Provider accounts.
                  </p>

                  <p className="mb-2">
                    <strong>8. Fees.</strong> We may offer subscriptions or other
                    offers (e.g., free trials), containing different options and
                    features. You agree to pay the usage fees set forth in your
                    Order Form, as applicable, and any applicable taxes. Payment
                    obligations cannot be canceled and fees paid are
                    non-refundable. If at any time you are overdue on your
                    account, Displai may suspend your access to the Services
                    and/or terminate these TOS. Unless you have filed a fee
                    dispute, if you are overdue on payment and fail to pay within
                    ten (10) days of the payment due date, then at our sole
                    discretion we may (i) assess a late fee of either 1.5% per
                    month, or the maximum amount allowable by law, whichever is
                    less, and (ii) suspend our Services to you until you pay the
                    amount you are overdue plus any applicable fees.
                  </p>

                  <p className="mb-2">
                    <strong>9. Subscription Term; Termination.</strong> The
                    period of these TOS will commence on the date they are
                    accepted by you and continue for the period specified in your
                    Order Form (the &ldquo;Initial Period&rdquo;). Unless
                    otherwise set forth in the Order Form, the Subscription Term
                    shall automatically renew for successive periods equal to the
                    term specified in the Order Form, unless either party
                    notifies the other party of its intent not to renew at least
                    thirty (30) days prior to the conclusion of the
                    then-current term. You have the right to terminate these TOS
                    at any time if Displai has materially breached these TOS and
                    does not cure such breach within thirty (30) days following
                    notice from you. All Customer Content may be permanently
                    deleted by Displai thirty days after any termination of your
                    account. All fees paid are non-refundable and non-cancelable.
                  </p>

                  <p className="mb-2">
                    <strong>10. Rules of Conduct.</strong> You expressly agree
                    not to do any of the following: (a) send unlawful,
                    threatening, abusive or defamatory communications; (b)
                    utilize intellectual property without authorization; (c)
                    violate any law, rule or regulation; (d) transmit viruses or
                    interfere with the operation of the Services; (e) adapt or
                    hack the Services or attempt to gain unauthorized access; (f)
                    collect personally identifiable information without
                    permission; (g) develop a competing product or service; (h)
                    impose an unreasonable load on our infrastructure; or (i)
                    impersonate another person.
                  </p>

                  <p className="mb-2">
                    <strong>11. Customer Breach.</strong> You are in breach of
                    these TOS if you (a) fail to meet your material obligations,
                    including any nonpayment of Fees; or (b) file or initiate
                    proceedings seeking liquidation, reorganization or other
                    relief under any bankruptcy or insolvency law. Upon your
                    breach, Displai may suspend or terminate performance and
                    obligations without notice or further liability. You agree
                    and acknowledge that a breach of your obligations will cause
                    irreparable harm to Displai.
                  </p>

                  <p className="mb-2">
                    <strong>
                      12. Representations and Warranty Disclaimers.
                    </strong>{" "}
                    Each party represents and warrants that it has full power and
                    authority to enter into these TOS. Displai represents and
                    warrants that it will perform the Services in a professional
                    and workmanlike manner.{" "}
                    <strong>
                      THE SERVICES AND DISPLAI CONTENT ARE PROVIDED ON AN
                      &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; BASIS,
                      WITHOUT WARRANTY OF ANY KIND. WE EXPLICITLY DISCLAIM ANY
                      WARRANTIES OF FITNESS FOR A PARTICULAR PURPOSE,
                      MERCHANTABILITY, QUIET ENJOYMENT OR NON-INFRINGEMENT, AND
                      ANY WARRANTIES RELATED TO THIRD-PARTY CONTENT, EQUIPMENT,
                      MATERIAL, WEBSITES, SERVICES OR SOFTWARE.
                    </strong>
                  </p>

                  <p className="mb-2">
                    <strong>13. Limitations.</strong>{" "}
                    <strong>
                      YOU UNDERSTAND AND AGREE THAT UNDER NO LEGAL THEORY SHALL
                      WE BE LIABLE TO YOU FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
                      CONSEQUENTIAL OR EXEMPLARY DAMAGES, INCLUDING WITHOUT
                      LIMITATION DAMAGES FOR LOSS OF PROFITS, GOODWILL, OR OTHER
                      LOSSES. OUR LIABILITY TO YOU FOR ANY CAUSE WHATSOEVER WILL
                      AT ALL TIMES BE LIMITED TO THE AMOUNT PAID BY YOU TO US FOR
                      THE SERVICES DURING THE 12 MONTHS PRECEDING THE CLAIM.
                    </strong>
                  </p>

                  <p className="mb-2">
                    <strong>14. Indemnification.</strong> You agree to defend,
                    indemnify, and hold Displai harmless from and against any
                    claims, liabilities, damages, losses, and expenses,
                    including reasonable legal fees, arising out of or in any way
                    connected with your access to or use of the Services, your
                    breach of any law or the rights of a third party, or your
                    violation of these TOS.
                  </p>

                  <p className="mb-2">
                    <strong>
                      15. Dispute Resolution and Binding Arbitration.
                    </strong>{" "}
                    If you have any dispute with us, you agree that before taking
                    any formal action, you will contact us and provide a written
                    description of the dispute. Except as provided herein, any
                    dispute will be resolved only by binding arbitration in San
                    Francisco, CA. The arbitration will be conducted under the
                    rules of JAMS.{" "}
                    <strong>
                      ARBITRATION MEANS THAT YOU WAIVE YOUR RIGHT TO A JURY
                      TRIAL.
                    </strong>{" "}
                    Both parties agree that any claims or controversies must be
                    brought on an individual basis only. The arbitrator cannot
                    combine more than one person&apos;s or entity&apos;s claims
                    into a single case, and cannot preside over any consolidated,
                    class or representative proceeding.
                  </p>

                  <p className="mb-2">
                    <strong>16. General Provisions.</strong> You agree that any
                    notice, agreements, disclosure or other communications that
                    we send to you electronically will satisfy any requirement
                    that such communications be in writing. You may not assign
                    your rights or obligations without our prior written consent.
                    We may assign or transfer these TOS without restriction.
                    These TOS supersede all prior and contemporaneous proposals,
                    statements, and agreements, oral and written. These TOS shall
                    be governed by the laws of California regardless of any
                    conflicts of law principles. Except for claims that must be
                    arbitrated, all claims must be resolved exclusively by a
                    state or federal court located in the Northern District of
                    California.
                  </p>

                  <p className="mb-3">
                    <strong>17. Contacting Displai.</strong> If you have any
                    questions, please contact us at{" "}
                    <a
                      href="mailto:support@displai.ai"
                      className="underline"
                    >
                      support@displai.ai
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
                onClick={hasPandaDoc ? startSigning : handleDirectAccept}
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
                ) : hasPandaDoc ? (
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
