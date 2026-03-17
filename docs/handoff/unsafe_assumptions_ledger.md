# Unsafe Assumptions Ledger

Do not assume without verification:

- **PRODUCT.md is correct** — mentions Google SSO; auth uses credentials
- **REPO_PLAN.md reflects current state** — initial plan, likely stale
- **All env vars are documented** — no .env.example exists
- **Webhook secret is the same for all environments** — verify per-env
- **SF sync always succeeds on quote acceptance** — no retry logic
- **Mock flags are never used in production** — USE_MOCK_* may be set
- **escapeSoql is correct for all SOQL contexts** — Stripe_Customer_ID__c had issues
- **Sidebar links match existing routes** — /cs/amendments etc 404
- **PandaDoc is in use** — schema has pandadocDocId but integration removed; DocuSign used
