Route this task to `omni-ui`.

Treat this as a design-implementation pass, not a logic rewrite.

Start with:

1. Identify the target surface and relevant files
2. Summarize the current UI briefly
3. Reuse existing `components/ui` primitives wherever possible
4. Check whether `src/app/globals.css` or existing tokens already support the requested direction
5. Apply the smallest safe visual change set

Focus on:
- hierarchy and readability
- spacing and alignment
- responsive behavior
- accessible interactions
- consistent use of local shadcn-based primitives

Rules:
- keep product logic unchanged unless explicitly requested
- avoid one-off components when an existing primitive can be extended
- use Figma as guidance if available, but keep the repo as implementation truth

When reporting back, include:
- surfaces changed
- visual intent
- files changed
- validation run
- any follow-up design debt worth tracking
