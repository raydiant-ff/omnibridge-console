Route this task to `omni-reviewer`.

Review the current diff or changed files with a production-safety mindset.

Start with:

1. Run `scripts/repo-status.sh`
2. Inspect changed files and recent commits relevant to the change
3. Identify the highest-risk behavior change first

Review for:
- duplicate side effects or replay risk
- weakened auth or validation
- billing correctness regressions
- source-of-truth drift into the wrong layer
- missing audit/logging coverage
- missing validation relative to change risk

Output format:
- findings first, ordered by severity, with file references
- open questions or assumptions
- residual risk
- validation gaps

If no findings are discovered, say that explicitly and note any remaining risk.
Do not edit code unless explicitly requested.
