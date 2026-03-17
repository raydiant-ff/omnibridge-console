"use client";

import { useState } from "react";
import {
  Loader2,
  Send,
  ArrowLeft,
  AlertCircle,
  FileText,
  UserCheck,
  Eye,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  preparePdfForPreview,
  createAndSendEnvelope,
} from "@/lib/actions/docusign-preview";
import { finalizeStripeQuote, type CreateQuoteResult } from "@/lib/actions/quotes";

interface Props {
  result: CreateQuoteResult;
  onSent: () => void;
  onBack: () => void;
}

export function DocumentPreview({ result, onSent, onBack }: Props) {
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [envelopeId, setEnvelopeId] = useState<string | null>(null);

  const isDryRun = result.dryRun ?? false;

  async function handleGeneratePreview() {
    if (!result.quoteRecordId) return;
    setCreating(true);
    setError(null);

    const res = await preparePdfForPreview(
      result.quoteRecordId,
      signerName.trim(),
      signerEmail.trim(),
    );

    if (!res.success) {
      setError(res.error ?? "Failed to generate PDF preview.");
      setCreating(false);
      return;
    }

    setPdfBase64(res.pdfBase64 ?? "");
    setCreating(false);
  }

  async function handleSend() {
    if (!result.quoteRecordId) return;

    if (isDryRun) {
      onSent();
      return;
    }

    setSending(true);
    setError(null);

    const res = await createAndSendEnvelope(result.quoteRecordId);
    if (!res.success) {
      setError(res.error ?? "Failed to send document.");
      setSending(false);
      return;
    }

    setEnvelopeId(res.envelopeId ?? null);
    setSent(true);
    setSending(false);
    onSent();
  }

  const [skipping, setSkipping] = useState(false);

  async function handleSkipDocument() {
    if (!result.quoteRecordId) return;
    setSkipping(true);
    setError(null);

    if (!isDryRun) {
      const finRes = await finalizeStripeQuote(result.quoteRecordId);
      if (!finRes.success) {
        setError(finRes.error ?? "Failed to finalize Stripe quote.");
        setSkipping(false);
        return;
      }
    }

    setSkipping(false);
    onSent();
  }

  const signerValid =
    signerName.trim().length > 0 && signerEmail.trim().includes("@");
  const showSignerForm = pdfBase64 === null;
  const showPreview = pdfBase64 !== null;

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1.5">
            <CardTitle>
              {showSignerForm
                ? "Document Signer"
                : "Preview Quote Document"}
            </CardTitle>
            <CardDescription>
              {showSignerForm
                ? "Enter the signer details, then generate the PDF for review."
                : "Review the Stripe quote PDF below before sending via DocuSign."}
            </CardDescription>
          </div>
          <Badge variant="outline" className="gap-1">
            {showSignerForm ? (
              <>
                <UserCheck className="size-3" />
                Signer
              </>
            ) : (
              <>
                <Eye className="size-3" />
                Preview
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">

        {showSignerForm && (
          <>
            {isDryRun && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-50/50 px-4 py-3">
                <p className="text-sm text-amber-700">
                  Dry run mode — no document will be created. Enter signer info
                  to continue.
                </p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="signer-name">Signer Name</Label>
                <Input
                  id="signer-name"
                  placeholder="e.g. Jane Smith"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="signer-email">Signer Email</Label>
                <Input
                  id="signer-email"
                  type="email"
                  placeholder="e.g. jane@company.com"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        {showPreview && isDryRun && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-50/50 px-4 py-3">
            <p className="text-sm text-amber-700">
              Dry run mode — no document was created. Click &ldquo;Continue&rdquo;
              to proceed.
            </p>
          </div>
        )}

        {showPreview && !isDryRun && pdfBase64 && (
          <div className="overflow-hidden rounded-xl border bg-white">
            <embed
              src={`data:application/pdf;base64,${pdfBase64}`}
              type="application/pdf"
              width="100%"
              height="700"
              className="block"
            />
          </div>
        )}

        {sent && envelopeId && (
          <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-50/50 px-4 py-3">
            <CheckCircle2 className="size-4 text-green-600" />
            <p className="text-sm text-green-700">
              DocuSign envelope created: {envelopeId}
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

      </CardContent>
      <CardFooter className="justify-between border-t">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={creating || sending || sent}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>

        {showSignerForm ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleSkipDocument}
              disabled={skipping}
            >
              {skipping ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Finalizing...
                </>
              ) : (
                "Skip (No Document)"
              )}
            </Button>
            <Button
              onClick={handleGeneratePreview}
              disabled={!signerValid || creating}
            >
              {creating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <FileText className="size-4" />
                  Generate &amp; Preview
                </>
              )}
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleSend}
            disabled={sending || sent}
          >
            {sending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Sending...
              </>
            ) : isDryRun ? (
              "Continue"
            ) : (
              <>
                <Send className="size-4" />
                Approve &amp; Send via DocuSign
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
