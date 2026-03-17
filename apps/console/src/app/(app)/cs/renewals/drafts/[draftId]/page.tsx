export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { DraftEditor } from "./draft-editor";
import { PageHeader } from "@/components/workspace/page-header";

interface Props {
  params: Promise<{ draftId: string }>;
}

export default async function DraftPage({ params }: Props) {
  const { draftId } = await params;

  // Load draft from cookie
  const jar = await cookies();
  const raw = jar.get(`renewal-draft-${draftId}`)?.value;
  if (!raw) notFound();

  let draft;
  try {
    draft = JSON.parse(raw);
  } catch {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/cs/renewals" className="hover:text-foreground">
          Renewals
        </Link>
        <span>/</span>
        <Link
          href={`/cs/renewals/${encodeURIComponent(draft.candidateId)}`}
          className="hover:text-foreground"
        >
          {draft.customerName}
        </Link>
        <span>/</span>
        <span className="text-foreground">Draft</span>
      </div>

      <PageHeader
        title="Renewal Draft"
        description={`Renewing ${draft.customerName}${draft.contractNumber ? ` · Contract #${draft.contractNumber}` : ""}${draft.csmName ? ` · CSM: ${draft.csmName}` : ""}`}
      />

      <DraftEditor initialDraft={draft} />
    </div>
  );
}
