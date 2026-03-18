export function register() {
  // instrumentation.register() runs in BOTH Node.js and Edge runtimes on Vercel.
  // Edge runtime has no access to DATABASE_URL or most server env vars, so we
  // must skip validation there to avoid crashing the middleware runtime.
  if (typeof (globalThis as Record<string, unknown>).EdgeRuntime !== "undefined") return;

  validateEnvironment();
}

function validateEnvironment() {
  const useMockStripe = process.env.USE_MOCK_STRIPE === "true";
  const useMockSalesforce = process.env.USE_MOCK_SALESFORCE === "true";
  const useMockDocuSign = process.env.USE_MOCK_DOCUSIGN === "true";

  const errors: string[] = [];

  // Always required (server runtime only — Edge is skipped above)
  if (!process.env.DATABASE_URL) errors.push("DATABASE_URL");
  if (!process.env.NEXTAUTH_SECRET) errors.push("NEXTAUTH_SECRET");

  // Required in production unless mocked
  if (process.env.NODE_ENV === "production") {
    if (!useMockStripe && !process.env.STRIPE_SECRET_KEY) errors.push("STRIPE_SECRET_KEY");
    if (!useMockSalesforce && !process.env.SF_CLIENT_ID) errors.push("SF_CLIENT_ID");
    if (!useMockDocuSign && !process.env.DOCUSIGN_INTEGRATION_KEY) errors.push("DOCUSIGN_INTEGRATION_KEY");
  }

  if (errors.length > 0) {
    console.error(`[OmniBridge] Missing required environment variables: ${errors.join(", ")}`);
  }
}
