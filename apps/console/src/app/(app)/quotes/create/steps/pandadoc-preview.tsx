"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Send, ArrowLeft, AlertCircle, FileText, UserCheck, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createPandaDocForQuote,
  getDocumentEditingSession,
  sendPandaDocAfterPreview,
} from "@/lib/actions/pandadoc-preview";
import { finalizeStripeQuote, type CreateQuoteResult } from "@/lib/actions/quotes";

interface Props {
  result: CreateQuoteResult;
  onSent: () => void;
  onBack: () => void;
}

function PandaDocEditor({ token }: { token: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<InstanceType<typeof import("pandadoc-editor").Editor> | null>(null);

  useEffect(() => {
    if (!containerRef.current || !token) return;

    let destroyed = false;

    (async () => {
      const { Editor, UIElement } = await import("pandadoc-editor");
      if (destroyed) return;

      const editor = new Editor("pandadoc-editor-inner", {
        token,
        fieldPlacementOnly: true,
        width: 1400,
        height: 800,
        hiddenElements: [
          UIElement.MANAGE_RECIPIENTS,
          UIElement.MANAGE_ROLES,
          UIElement.MANAGE_VARIABLES_PANEL,
        ],
      });

      editorRef.current = editor;
      await editor.open({ token });
    })();

    return () => {
      destroyed = true;
      editorRef.current?.destroy();
      editorRef.current = null;
    };
  }, [token]);

  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-lg border bg-white"
      style={{ height: 800, position: "relative" }}
    >
      <div
        id="pandadoc-editor-inner"
        style={{ width: 1400, height: "100%", position: "absolute", left: 0, top: 0 }}
      />
    </div>
  );
}

export function PandaDocPreview({ result, onSent, onBack }: Props) {
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [pandadocDocId, setPandadocDocId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [editorToken, setEditorToken] = useState<string | null>(null);
  const [loadingEditor, setLoadingEditor] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const isDryRun = result.dryRun ?? false;
  const isMock = pandadocDocId?.startsWith("pd_mock_") ?? false;
  const isDryRunDoc = pandadocDocId?.startsWith("pd_dryrun_") ?? false;

  useEffect(() => {
    if (!pandadocDocId || isDryRun || isDryRunDoc || isMock) return;

    let cancelled = false;
    setLoadingEditor(true);

    (async () => {
      const res = await getDocumentEditingSession(pandadocDocId);
      if (cancelled) return;
      if (!res.success || !res.token) {
        setError(res.error ?? "Failed to get editing session.");
      } else {
        setEditorToken(res.token);
      }
      setLoadingEditor(false);
    })();

    return () => { cancelled = true; };
  }, [pandadocDocId, isDryRun, isDryRunDoc, isMock]);

  async function handleCreateDoc() {
    if (!result.quoteRecordId) return;
    setCreating(true);
    setError(null);

    const res = await createPandaDocForQuote(
      result.quoteRecordId,
      signerName.trim(),
      signerEmail.trim(),
    );

    if (!res.success) {
      setError(res.error ?? "Failed to create PandaDoc document.");
      setCreating(false);
      return;
    }

    setPandadocDocId(res.pandadocDocId ?? null);
    setCreating(false);
  }

  async function handleSend() {
    if (!pandadocDocId || !result.quoteRecordId) return;

    if (isDryRun || isMock || isDryRunDoc) {
      onSent();
      return;
    }

    setSending(true);
    setError(null);

    const res = await sendPandaDocAfterPreview(pandadocDocId, result.quoteRecordId);
    if (!res.success) {
      setError(res.error ?? "Failed to send document.");
      setSending(false);
      return;
    }

    const finRes = await finalizeStripeQuote(result.quoteRecordId);
    if (!finRes.success) {
      setError(finRes.error ?? "Failed to finalize Stripe quote.");
      setSending(false);
      return;
    }

    setSent(true);
    setSending(false);
    onSent();
  }

  const [skipping, setSkipping] = useState(false);

  async function handleSkipPandaDoc() {
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

  const signerValid = signerName.trim().length > 0 && signerEmail.trim().includes("@");
  const showSignerForm = !pandadocDocId;
  const showPreview = !!pandadocDocId;
  const canSend = isDryRun || isMock || isDryRunDoc || !!editorToken;

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              {showSignerForm ? "Document Signer" : "Preview Quote Document"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {showSignerForm
                ? "Enter the signer details, then generate the PandaDoc document for review."
                : "Review the document below before sending it to the customer."}
            </p>
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

        {showSignerForm && (
          <>
            {isDryRun && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-50/50 px-4 py-3">
                <p className="text-sm text-amber-700">
                  Dry run mode — no PandaDoc document will be created. Enter
                  signer info to continue.
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

        {showPreview && (isDryRun || isDryRunDoc) && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-50/50 px-4 py-3">
            <p className="text-sm text-amber-700">
              Dry run mode — no PandaDoc document was created. Click
              &ldquo;Continue&rdquo; to proceed.
            </p>
          </div>
        )}

        {showPreview && isMock && !isDryRun && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm text-amber-800">
              Mock mode — PandaDoc preview is simulated.
            </p>
          </div>
        )}

        {showPreview && !isDryRun && !isDryRunDoc && !isMock && loadingEditor && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              Loading document editor...
            </span>
          </div>
        )}

        {showPreview && !isDryRun && !isDryRunDoc && !isMock && !loadingEditor && editorToken && (
          <PandaDocEditor token={editorToken} />
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
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
                onClick={handleSkipPandaDoc}
                disabled={skipping}
              >
                {skipping ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Finalizing...
                  </>
                ) : (
                  "Skip (No PandaDoc)"
                )}
              </Button>
              <Button
                onClick={handleCreateDoc}
                disabled={!signerValid || creating}
              >
                {creating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Generating Document...
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
              disabled={sending || sent || !canSend}
            >
              {sending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Sending...
                </>
              ) : isDryRun || isMock || isDryRunDoc ? (
                "Continue"
              ) : (
                <>
                  <Send className="size-4" />
                  Approve &amp; Send to Customer
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
