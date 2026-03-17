import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getServerSession } from "@omnibridge/auth";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ draftId: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { draftId } = await params;
  const body = await request.json();

  // Basic validation
  if (!body || typeof body !== "object" || body.id !== draftId) {
    return NextResponse.json({ error: "Invalid draft data" }, { status: 400 });
  }

  const jar = await cookies();
  jar.set(`renewal-draft-${draftId}`, JSON.stringify(body), {
    path: "/",
    maxAge: 60 * 60 * 24,
    httpOnly: true,
    sameSite: "lax",
  });

  return NextResponse.json({ success: true });
}
