# Omni Recommended Tool Stack

## Decision

This is the simplest recommended AI and design stack for Omni right now.

### Keep
- primary local coding workflow with Codex
- `shadcn` as the UI primitive system
- Figma for design source, inspection, and code linking

### Optional
- Cursor as an editor, if it is genuinely preferred day to day
- Cursor Bugbot, if automated first-pass PR comments are useful
- Claude in-editor workflows for CSS, Tailwind, and UI refinement

### Skip for now
- Cursor cloud/background agents as a default workflow
- overlapping AI subscriptions without a clear job
- design-to-code workflows that bypass the repo's real component system

## Why

Omni's hardest work is not generic code generation.
It is:

- billing correctness
- webhook safety
- auth and operational control
- source-of-truth boundaries
- careful review of Stripe, Salesforce, and DocuSign interactions

Those are best handled in the real repo with high-context local work.

Remote cloud agents are most useful for async sidecar work.
They are not the best default for env-heavy debugging, billing-sensitive behavior, or tasks that depend on local secrets and exact runtime state.

## Recommended stack

### 1. Primary coding lane

Use local repo-native work as the default.

Recommended owner:
- Codex + local repo workflow

Use for:
- implementation
- architecture-sensitive edits
- debugging with real context
- final decision-making

### 2. UI implementation lane

Use the existing shadcn-style primitives already in the repo.

Recommended owner:
- `components/ui`
- `globals.css`
- `omni-ui`

Use for:
- component composition
- visual refinement
- layout cleanup
- Tailwind and token work

Do not replace shadcn with ad hoc AI-generated UI structure.

### 3. Design source lane

Use Figma as the visual source of truth.

Recommended owner:
- Figma Dev Mode
- Code Connect where available
- linked design references for key surfaces

Use for:
- approved layouts
- interaction intent
- asset inspection/export
- mapping code to design

Keep implementation in the repo.

### 4. Review lane

Use an explicit review pass for sensitive diffs.

Recommended owner:
- `omni-reviewer`

Optional support:
- Bugbot, advisory only

Use for:
- billing changes
- auth changes
- webhook changes
- quote, subscription, invoice, and contract behavior

### 5. Debug lane

Use explicit bug-first workflows locally.

Recommended owner:
- `omni-debugger`

Use for:
- reproductions
- runtime issues
- webhook regressions
- instrument-first debugging

Skip cloud agents as the default debugging path.

## Cursor stance

### Cursor editor

Keep only if it is meaningfully improving the daily editing experience.

If not, let it go.

### Cursor Bugbot

Reasonable to keep if:
- you want automated first-pass PR review
- the team benefits from early issue spotting

Not required for Omni to function well.

### Cursor cloud/background agents

Do not make these a core part of the Omni workflow right now.

They are optional at best.

They can help with:
- repo scans
- async sidecar tasks
- isolated draft changes

They are not the preferred lane for:
- webhook debugging
- billing-sensitive implementation
- env-dependent integrations
- final production-safety judgment

## Final recommendation

If choosing the cleanest stack today:

1. keep local Codex-driven implementation
2. keep shadcn
3. keep Figma
4. optionally keep Bugbot
5. skip Cursor cloud agents for now

That gives Omni the highest leverage with the least overlap and the least operational ambiguity.
