# Omni AI Operating Plan

## Purpose

This document defines how Omni uses AI tools while the core product work remains grounded in the real codebase, source-of-truth boundaries, and production safety expectations.

The goal is not to let an editor or model "run the product."
The goal is to make repetitive loops faster while preserving:

- billing correctness
- idempotent behavior
- auditability
- narrow diffs
- clear source-of-truth boundaries

## Principles

1. The repo is the source of implementation truth.
2. Stripe, Salesforce, and DocuSign constraints matter more than model speed.
3. Use specialized agents for bounded work, not vague delegation.
4. Debugging and review should be explicit lanes, not ad hoc side quests.
5. Design tools should feed implementation, not replace it.

## Core tool split

### Codex / primary coding partner

Use for:

- architecture-aware implementation
- repo-native edits
- domain-sensitive changes
- cross-file reasoning
- high-context pairing

This is the primary lane for real product work.

### Cursor

Use for:

- fast local editing if it is the preferred editor
- agent handoffs
- optional Bugbot or background review support

Cursor is useful infrastructure, not the product brain.
Cursor cloud/background agents are not a default Omni workflow.

### Claude in-editor workflows

Use for:

- CSS and Tailwind iteration
- component polish
- layout refinement
- scoped implementation support in the editor

Claude is especially good for frontend implementation passes, but it should work through the repo's existing component system and conventions.

### Figma

Use for:

- layout definition
- interaction intent
- shared visual language
- code-to-design mapping
- asset export and design inspection

Figma should inform implementation, not generate app truth.

## Recommended operating lanes

### 1. Implementation lane

Owner:
- `omni-implementer`

Default model profile:
- strong, fast implementation model

Use for:

- scoped feature work
- narrow refactors
- route or component changes
- form, table, and flow implementation
- safe follow-through after architecture is clear

Escalate when:

- source-of-truth boundaries are unclear
- multiple billing systems are affected
- the task is actually a bug hunt

### 2. Debug lane

Owner:
- `omni-debugger`

Default model profile:
- fast reasoning model for triage

Escalation profile:
- strongest available model when billing, auth, webhook, or cross-system risk is present

Use for:

- reproductions
- runtime failures
- webhook regressions
- broken flows
- instrumentation and evidence gathering

Workflow:

1. Restate the failure
2. Identify likely entry points
3. Gather evidence
4. Form hypotheses
5. Test the strongest hypothesis first
6. Patch narrowly
7. Verify with the smallest relevant command

Cursor cloud/background agents are optional here at most.
Do not use them as the default path for env-heavy domain debugging.

### 3. Review lane

Owner:
- `omni-reviewer`

Default model profile:
- strongest available review model

Use for:

- pull request review
- change-risk analysis
- domain regression review
- missing validation and operational safety checks

Review checklist:

- Could this create duplicate side effects?
- Does it weaken auth, validation, or financial controls?
- Does it move source-of-truth logic into the wrong layer?
- Does it break quote, invoice, or subscription consistency?
- Is retry behavior still safe?
- Is logging and diagnosability still adequate?
- Are validation steps appropriate for the risk?

Cursor Bugbot is optional as a first-pass reviewer.
It should remain advisory.
High-risk Omni changes still need explicit domain review.

### 4. Architecture lane

Owner:
- `omni-architect`

Default model profile:
- strongest available architecture model

Use for:

- multi-domain design
- rollout planning
- contract boundaries
- migration strategy
- high-risk reviews

Do not use this lane for routine implementation churn.

### 5. Repo inventory lane

Owner:
- `omni-repo-auditor`

Use for:

- branch status
- changed files
- recent commits
- implementation discovery
- "where does this live?" questions

### 6. UI / design implementation lane

Owner:
- `omni-ui`

Default model profile:
- strong frontend implementation model

Use for:

- translating approved Figma direction into code
- global CSS refinement
- Tailwind and component variant work
- shared primitive composition
- visual cleanup and UX polish

Rules:

- preserve the existing local `components/ui` layer
- prefer the existing shadcn-based primitives over ad hoc one-off components
- use `globals.css` and design tokens intentionally
- preserve accessibility and responsive behavior

This lane complements shadcn.
It does not replace it.

## Current Omni decisions

### Keep shadcn

Reason:

- Omni already relies on local shadcn-style primitives in `apps/console/src/components/ui`
- the repo has a live `components.json`
- the app theme and tokens already flow through `src/app/globals.css`

Decision:

- keep shadcn as the component primitive system
- use AI to extend and refine it, not replace it

### Keep Figma, but wire it properly

Reason:

- Figma is most valuable when designs map to real code via Dev Mode, Code Connect, and linked components

Decision:

- use Figma for approved layouts and visual direction
- link major screens and primitives to code
- keep implementation in the repo

Suggested first targets:

- workspace shell
- top navigation and sidebar
- cards, forms, tables, badges, tabs
- support and CS surfaces

### Keep Cursor only if it is actively leveraged

Reason:

- Cursor is useful for editor workflows and optional Bugbot support
- the repo does not depend on Cursor for product logic

Decision:

- keep it only if the editor itself or Bugbot is part of the daily loop
- otherwise consolidate and avoid paying for overlapping capability

### Skip Cursor cloud/background agents as a default

Reason:

- Omni's hardest tasks are local-context-heavy and integration-sensitive
- remote agents are weaker for env-dependent debugging and final production-safety judgment

Decision:

- do not make cloud/background agents part of the default workflow
- use them only for clearly bounded sidecar work, if at all

### Clean recommended stack

Default recommendation:

1. local Codex-driven implementation
2. shadcn for UI primitives
3. Figma for design source and code linking
4. optional Bugbot only if it proves useful
5. no default use of Cursor cloud/background agents

## Standard workflows

### Bug workflow

1. Route to `omni-debugger`
2. Reproduce or restate the failure
3. Add or inspect instrumentation
4. Patch the smallest root cause
5. Run targeted validation
6. If billing or webhook behavior changed, request `omni-reviewer` pass

### PR workflow

1. Let Bugbot or automated review run first if enabled
2. Route the diff to `omni-reviewer`
3. Require explicit review for Stripe, Salesforce sync, DocuSign, auth, quoting, checkout, subscriptions, invoices, and webhooks

### Design workflow

1. Define or refine the surface in Figma
2. Map the surface to real components where possible
3. Route implementation to `omni-ui`
4. Keep final logic and integration behavior in the repo
5. Request `omni-reviewer` if UI work touches domain-sensitive flows

## Validation ladder

Since the repo has no test runner, validation stays:

1. `pnpm lint`
2. `pnpm build`
3. manual verification in dev server

Run the smallest relevant validation first.
Do not claim validation that was not actually run.

## Starter rollout

### Week 1

- add `omni-reviewer`
- add `omni-ui`
- adopt explicit debug, review, and design lanes

### Week 2

- enable Bugbot if keeping Cursor
- use `omni-reviewer` for all high-risk diffs
- use `omni-debugger` for bug-first work instead of jumping straight to edits

### Week 3

- link key Figma frames to major Omni surfaces
- map shared primitives and workspace shell to real code

### Week 4

- normalize the loop:
  - Figma for visual source
  - shadcn primitives for implementation base
  - AI agents for debug, review, and UI execution

## Non-goals

- replacing source-of-truth logic with design tools
- allowing automated review to act as the only safety gate
- using AI-generated UI patterns that ignore Omni conventions
- broad rewrites in the name of "modernization"
