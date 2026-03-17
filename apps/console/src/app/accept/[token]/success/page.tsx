import { prisma } from "@omnibridge/db";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface Props {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ session_id?: string }>;
}

export default async function AcceptSuccessPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { session_id } = await searchParams;

  const record = await prisma.quoteRecord.findUnique({
    where: { acceptToken: token },
  });

  if (!record) notFound();

  if (record.status === "pending_payment" && session_id) {
    await prisma.quoteRecord.update({
      where: { id: record.id },
      data: { status: "accepted", acceptedAt: new Date() },
    });

    if (record.sfQuoteId) {
      try {
        const { updateSfQuoteStatus, closeOpportunityWon } = await import(
          "@/lib/actions/sf-quote-mirror"
        );
        await updateSfQuoteStatus(record.sfQuoteId, "Accepted", record.dryRun);
        if (record.opportunityId) {
          await closeOpportunityWon(
            record.opportunityId,
            record.totalAmount ?? 0,
            record.dryRun,
          );
        }
      } catch (err) {
        console.error("[Accept Success] SF sync error:", err);
      }
    }
  }

  if (record.status !== "accepted" && record.status !== "pending_payment") {
    redirect(`/accept/${token}`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4">
            <div className="flex size-16 items-center justify-center rounded-xl bg-success/10">
              <CheckCircle2 className="size-8 text-success" />
            </div>
          </div>
          <CardTitle className="text-lg">Payment Confirmed</CardTitle>
          <CardDescription>
            Thank you, {record.customerName}. Your subscription is now active.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You will receive a confirmation email shortly. If you have any
            questions, please contact your account manager.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
