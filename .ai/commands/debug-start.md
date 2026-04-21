Route this task to `omni-debugger`.

First, gather evidence before proposing fixes:

1. Restate the bug in one sentence
2. Run `scripts/repo-status.sh`
3. Identify the likely entry points and files
4. Inspect recent diffs for the touched area
5. If there is runtime output, logs, or payload data, summarize the strongest signals
6. Form 1-3 root-cause hypotheses
7. Test the strongest hypothesis first

When reporting back, include:
- symptom
- most likely root cause
- files to inspect or patch
- smallest safe fix path
- validation command to run first

Rules:
- do not jump straight to a rewrite
- add or inspect instrumentation before speculative changes
- if billing, auth, webhook, or cross-system behavior is involved, flag this as high risk
