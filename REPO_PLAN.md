# Repo Plan (AI-buildable)

## Tech Stack
- Next.js (App Router) + TypeScript
- Tailwind + shadcn/ui (fast internal UI)
- Supabase Postgres
- Prisma
- NextAuth (Google provider) + domain allowlist @displai.ai
- Stripe SDK + webhook endpoint
- Salesforce integration via JWT OAuth (Connected App)

## Monorepo Layout
apps/console
packages/db
packages/auth
packages/integrations/stripe
packages/integrations/salesforce
packages/ui

## Build Steps (in order)

### Step 0: Scaffold
- Turborepo + pnpm
- Next.js app at apps/console
- shared packages wired via TS path aliases

### Step 1: Auth + RBAC
- NextAuth Google provider
- Restrict sign-in to @displai.ai
- Persist users via Prisma
- Roles: admin, sales, csm, finance, support
- Admin seed by email (FRANCISCO_EMAIL env)

### Step 2: Database schema (Prisma)
Tables:
- users (id, email, name, role, created_at)
- customer_index (id, sf_account_id, sf_account_name, stripe_customer_id, domain, updated_at)
- work_items (id, type, status, payload_json, created_by, assigned_to, created_at, updated_at)
- audit_log (id, actor_user_id, action, target_type, target_id, request_id, payload_json, created_at)
- idempotency_keys (key, scope, created_at, expires_at)

### Step 3: Customer Search + 360
Routes:
- /customers (search by name/domain/email)
- /customers/[id] (tabs: Overview, Stripe, Salesforce, Work Items, Audit)

Integrations can be mocked initially with fixtures.

### Step 4: Stripe Integration + Webhooks
- packages/integrations/stripe client
- /api/stripe/webhook verifies signature
- Store raw event (optional) and update customer_index

### Step 5: Salesforce JWT Integration
- packages/integrations/salesforce
- JWT bearer flow using Connected App
- helpers: soql(), getAccount(), searchAccounts()

### Step 6: First Workflow UI (Create Subscription Wizard)
Route:
- /workflows/create-subscription
Flow:
- Select customer (from customer_index search)
- Choose Stripe Price(s), quantity
- Choose start date + end date
- Choose billing option (bill now OR bill on future date)
- Show "Plan" summary
- Execute -> create work_item + call Stripe + write audit_log

### Step 7: Ops Controls
- "Replay" / "Retry safely" (idempotent)
- View audit logs per customer
