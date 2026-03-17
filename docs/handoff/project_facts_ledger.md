# Project Facts Ledger

High-confidence facts only. Format: Fact | Confidence | Evidence

| Fact | Confidence | Evidence |
|------|------------|----------|
| pnpm 9.15.4 is package manager | High | package.json packageManager |
| Stripe API version 2025-02-24.acacia | High | packages/integrations/stripe |
| NextAuth uses credentials + JWT | High | packages/auth |
| No test framework | High | AGENTS.md, no test files |
| IdempotencyKey used for Stripe webhooks | High | webhook route |
| Embedded checkout for Pay Now | High | accept-client, checkout/embedded |
| DocuSign used for e-signature (not PandaDoc) | High | docusign package, schema has both |
| Local mirror for subscriptions | High | StripeSubscription model, webhook handlers |
| /cs/amendments, /cs/downgrades, /cs/cancellations 404 | High | No page files under cs/ |
| PRODUCT.md mentions Google SSO but auth uses credentials | High | packages/auth, PRODUCT.md |
| escapeSoql over-escaped underscores for Stripe_Customer_ID__c | High | Fixed in customers.ts with manual escape |
