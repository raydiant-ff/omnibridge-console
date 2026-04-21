import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  if (process.env.NODE_ENV === "development" && process.env.OMNI_REQUIRE_AUTH !== "true") {
    return NextResponse.next();
  }

  const secret = process.env.NEXTAUTH_SECRET;

  // Without a secret we cannot verify tokens. Redirect to login rather than
  // crashing the middleware runtime (which surfaces as MIDDLEWARE_INVOCATION_FAILED).
  if (!secret) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const token = await getToken({ req: request, secret });

    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.next();
  } catch (err) {
    console.error("[middleware] Auth verification failed:", err);
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: [
    /*
     * Protect everything except:
     *  - /login (sign-in page)
     *  - /api/auth/* (NextAuth endpoints)
     *  - /api/stripe/webhook (Stripe webhook — authenticated via signature)
     *  - /api/docusign/webhook (DocuSign webhook — authenticated via HMAC)
     *  - /api/cron/* (Vercel cron jobs — authenticated via CRON_SECRET)
     *  - /api/health/* (health checks — public)
     *  - /accept/* (public quote acceptance pages)
     *  - /_next/* (Next.js internals)
     *  - /favicon.ico, /robots.txt, static assets
     */
    "/((?!login|accept|api/auth|api/stripe/webhook|api/docusign/webhook|api/cron|api/health|api/checkout|_next/static|_next/image|favicon\\.ico|robots\\.txt).*)",
  ],
};
