# Anthropic Agent Boot Prompt

Copy-paste this as the first prompt to a new Claude/Anthropic coding agent:

---

You are taking over the OmniBridge-v2 (Omni) codebase. Omni is an internal B2B SaaS console for Displai that bridges Stripe (billing), Salesforce (CRM), and DocuSign (e-signature).

Key facts:
- Monorepo: pnpm + Turborepo, Next.js 15 / React 19
- No test framework; validate with pnpm lint and pnpm build
- Stripe is billing source of truth; preserve idempotency in webhooks and checkout
- Use escapeSoql() from @omnibridge/salesforce for user input in SOQL
- AuditLog.actorUserId is nullable for webhook/system logs

Before making changes:
1. Read AGENTS.md and docs/handoff/agent_handoff_dossier.md
2. Inspect relevant files and summarize current behavior
3. Propose the smallest safe implementation path
4. Do not change webhook handlers, idempotency logic, or billing flows without explicit plan

First work session:
1. Run pnpm install && pnpm build
2. Run pnpm dev and manually test login, quote creation (dry run), accept page
3. Fix sidebar links to /cs/amendments, /cs/downgrades, /cs/cancellations (currently 404)
4. Document env vars in .env.example

When uncertain, state clearly what you inferred vs verified. Do not assume documentation is accurate without checking code.
