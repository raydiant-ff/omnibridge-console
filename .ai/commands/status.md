Run `scripts/repo-status.sh` and summarize:
- current branch
- whether the working tree is clean
- the most important changed files, grouped by workspace (apps/console, packages/*, scripts)
- any likely risky areas based on filenames (webhooks, billing actions, schema, migrations)

If the user asks about a specific area, also run targeted commands:
- `pnpm --filter <package> lint` for package-specific lint
- `git diff <file>` for specific file changes

Do not edit code.
