export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    /*
     * Protect everything except:
     *  - /login (sign-in page)
     *  - /api/auth/* (NextAuth endpoints)
     *  - /api/stripe/webhook (Stripe webhook — authenticated via signature)
     *  - /api/docusign/webhook (DocuSign webhook — authenticated via HMAC)
     *  - /accept/* (public quote acceptance pages)
     *  - /_next/* (Next.js internals)
     *  - /favicon.ico, /robots.txt, static assets
     */
    "/((?!login|accept|api/auth|api/stripe/webhook|api/docusign/webhook|api/checkout|_next/static|_next/image|favicon\\.ico|robots\\.txt).*)",
  ],
};
