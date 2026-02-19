# Displai Internal Console (Sales/CSM/Finance/Support)

## Goal
Replace clunky Salesforce workflows with a fast internal web console.
Salesforce and Stripe remain sources of truth. This app provides:
- Opinionated UIs for workflows
- Guardrails + approvals (where needed)
- Audit logs for every mutation
- Task/queue views for teams

## Authentication
- Internal only via Google SSO
- Allowlist: @displai.ai
- Roles: admin, sales, csm, finance, support
- Admin is Francisco (seeded by email)

## Systems of Record
- Salesforce: Accounts/Contacts/Opportunities/Orders (as applicable)
- Stripe: Customers/Subscriptions/Invoices/Payment Methods

## Data we store locally (Supabase Postgres)
We do NOT duplicate Salesforce/Stripe objects.
We store workflow state + indexes:
- customer_index: links SF Account <-> Stripe Customer, plus handy display fields
- work_items: workflow items (type/status/payload/assigned_to/due_at)
- audit_log: immutable event log of actions performed
- idempotency_keys: prevents accidental double writes to Stripe/Salesforce

## Primary UI Modules
1) Customer Search + Customer 360 (SF + Stripe summary)
2) Work Queue (team queues, filters, ownership, SLA)
3) Workflow Screens (guided wizards)

## First Workflow: Create Subscription (controlled)
A guided wizard to create a subscription for an existing Stripe customer with:
- Start date: editable (past or present allowed)
- End date: editable (past or present allowed)
- Billing choice:
  - Bill now
  - Bill on a specific future date
- Clear preview of outcomes (invoice timing, prorations, cancellation timing)
- Writes audit logs and saves a work_item record for traceability
