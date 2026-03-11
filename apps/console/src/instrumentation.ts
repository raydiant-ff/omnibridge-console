export function register() {
  validateEnvironment();
}

function validateEnvironment() {
  const isProduction = process.env.NODE_ENV === "production";
  const useMockStripe = process.env.USE_MOCK_STRIPE === "true";
  const useMockSalesforce = process.env.USE_MOCK_SALESFORCE === "true";
  const useMockDocuSign = process.env.USE_MOCK_DOCUSIGN === "true";

  const errors: string[] = [];

  // Always required
  if (!process.env.DATABASE_URL) errors.push("DATABASE_URL");
  if (!process.env.NEXTAUTH_SECRET) errors.push("NEXTAUTH_SECRET");

  // Required in production unless mocked
  if (isProduction) {
    if (!useMockStripe && !process.env.STRIPE_SECRET_KEY) errors.push("STRIPE_SECRET_KEY");
    if (!useMockSalesforce && !process.env.SF_CLIENT_ID) errors.push("SF_CLIENT_ID");
    if (!useMockDocuSign && !process.env.DOCUSIGN_INTEGRATION_KEY) errors.push("DOCUSIGN_INTEGRATION_KEY");
  }

  if (errors.length > 0) {
    const msg = `[OmniBridge] Missing required environment variables: ${errors.join(", ")}`;
    if (isProduction) {
      throw new Error(msg);
    } else {
      console.warn(msg);
    }
  }
}
