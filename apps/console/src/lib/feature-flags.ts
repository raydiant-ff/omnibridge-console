export const flags = {
  get useMockStripe() {
    if (process.env.USE_MOCK_STRIPE === "true") return true;
    if (process.env.USE_MOCK_STRIPE === "false") return false;
    return !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.startsWith("sk_live_or_test");
  },

  get useMockSalesforce() {
    if (process.env.USE_MOCK_SALESFORCE === "true") return true;
    if (process.env.USE_MOCK_SALESFORCE === "false") return false;
    return !process.env.SF_CLIENT_ID || process.env.SF_CLIENT_ID === "connected_app_consumer_key";
  },
} as const;
