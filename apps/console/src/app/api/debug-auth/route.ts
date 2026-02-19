import { NextResponse } from "next/server";
import { prisma } from "@omnibridge/db";
import { compareSync } from "bcryptjs";

export async function GET() {
  const checks: Record<string, unknown> = {};

  checks.DATABASE_URL_set = !!process.env.DATABASE_URL;
  checks.DIRECT_URL_set = !!process.env.DIRECT_URL;
  checks.NEXTAUTH_SECRET_set = !!process.env.NEXTAUTH_SECRET;
  checks.DATABASE_URL_prefix = process.env.DATABASE_URL?.substring(0, 30) + "...";

  try {
    const count = await prisma.user.count();
    checks.db_connected = true;
    checks.user_count = count;
  } catch (err) {
    checks.db_connected = false;
    checks.db_error = String(err);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: "francisco.fiedler@displai.ai" },
      select: { id: true, email: true, role: true, passwordHash: true },
    });
    checks.admin_found = !!user;
    checks.has_password_hash = !!user?.passwordHash;
    if (user?.passwordHash) {
      checks.password_matches = compareSync("OmniBridge2026!", user.passwordHash);
    }
  } catch (err) {
    checks.admin_lookup_error = String(err);
  }

  return NextResponse.json(checks);
}
