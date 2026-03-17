# Engineering Working Memory

Tacit context that is usually lost when switching agents.

**Naming conventions:**
- QuoteRecord (DB), stripeQuoteId (Stripe), sfQuoteId (Salesforce)
- CustomerIndex links SF Account ↔ Stripe Customer
- IdempotencyKey for webhook/request deduplication

**Architectural patterns:**
- Server actions for mutations; queries for reads
- "use server" on action files
- No React Query or SWR; fetch in client components

**Inconsistencies:**
- Co-term accessible via Expansion (contract mode) and via /quotes/co-term
- Cross-sell redirects to co-term
- Amendments/downgrades/cancellations under subscriptions/ but sidebar links to /cs/*

**Fragile areas:**
- Stripe webhook handlers use `as any` casts
- DocuSign HMAC only in production
- No retry for SF sync on quote acceptance

**Vocabulary:** co-term, charge_automatically, send_invoice, dry run, QuoteRecord, CustomerIndex, IdempotencyKey
