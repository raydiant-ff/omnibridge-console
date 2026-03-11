function resolveMockFlag(envOverride: string | undefined, envKey: string | undefined): boolean {
  if (envOverride === "true") return true;
  if (envOverride === "false") return false;
  return !envKey;
}

export const flags = Object.freeze({
  useMockStripe: resolveMockFlag(process.env.USE_MOCK_STRIPE, process.env.STRIPE_SECRET_KEY),
  useMockSalesforce: resolveMockFlag(process.env.USE_MOCK_SALESFORCE, process.env.SF_CLIENT_ID),
  useMockDocuSign: resolveMockFlag(process.env.USE_MOCK_DOCUSIGN, process.env.DOCUSIGN_INTEGRATION_KEY),
});
