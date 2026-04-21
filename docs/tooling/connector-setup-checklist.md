# Omni Connector Setup Checklist

## Purpose

This document answers a simple question:

What external connectors, plugins, or integrations do we actually need in order to use the recommended Omni tool stack?

See also:

- `docs/ai/recommended-tool-stack.md`
- `docs/ai/operating-plan.md`

## Current recommendation

### Required now
- Figma MCP access in the coding tool you actually use

### Optional
- GitHub integration for PR review workflows
- Cursor Bugbot if you want advisory PR comments
- Vercel connector for protected preview inspection
- Claude IDE integration if you want in-editor CSS/UI help

### Skip for now
- Cursor cloud/background agents
- Slack, Gmail, or Google Docs connectors for the core coding/design stack

## Repo-local status

Current repo evidence:

- `docs/tooling/figma-extension-status.md` shows a Figma editor integration is already installed locally
- the repo has local AI agents, commands, and rules under `.ai/`
- there is no `.ai/BUGBOT.md` yet
- there is no committed `.ai/environment.json` for background-agent bootstrapping
- `origin` points to `https://github.com/raydiant-ff/omnibridge-console.git`

What that means:

- Figma is partly in place already
- Bugbot is not configured yet
- Cursor background agents are not configured and are not required by the recommended stack

## Setup decision by tool

### 1. Codex

Need to install a connector?

- For core local coding: no additional connector is required beyond the normal Codex app setup

Recommended:

- keep using local Codex-driven implementation as the default lane

Optional:

- GitHub connector if you want PR-aware workflows in Codex
- Vercel connector if you want help inspecting protected preview deployments

### 2. Figma

Need to install a connector?

- Yes, if you want the full recommended design workflow

Recommended minimum:

- enable the Figma MCP/plugin in the coding tool you actually use
- make sure the relevant user has a Full or Dev seat and file access

Recommended next step:

- use Figma Dev Mode for inspection
- add Code Connect selectively for key primitives and major surfaces

GitHub needed?

- not required for basic Dev Mode or MCP usage
- useful if you want Code Connect UI backed by GitHub repository mapping

### 3. shadcn

Need to install a connector?

- No

This is already a repo-native component workflow, not an external connector workflow.

### 4. Cursor editor

Need to install a connector?

- No, not for the default stack

Keep Cursor only if:

- you prefer it as your editor
- or you specifically want Bugbot

### 5. Cursor Bugbot

Need to install a connector?

- Yes, if you choose to use Bugbot

What it requires:

- Cursor admin access
- GitHub org admin access
- GitHub app installation through Cursor's Bugbot setup
- repository enablement in the Cursor dashboard

Recommended for Omni:

- optional only
- advisory only

Recommended repo follow-up if enabled:

- add a root `.ai/BUGBOT.md` with Omni-specific review rules

### 6. Cursor cloud/background agents

Need to install a connector?

- Yes, they depend on GitHub repo access and remote environment setup

What they require:

- GitHub connection with read-write repo access
- remote environment setup in Cursor
- usually an `environment.json` for repo bootstrapping

Recommended for Omni:

- do not set this up as part of the default stack

### 7. GitHub connector

Need to install a connector?

- Optional, but useful

Recommended if you want:

- PR-aware review
- issue/PR inspection from the coding tool
- PR creation from the coding tool

Strongest use cases for Omni:

- review workflows
- reading PR context
- opening PRs

### 8. Vercel connector

Need to install a connector?

- Optional

Recommended if:

- previews are protected
- you want the coding tool to inspect deployments and preview pages directly

### 9. Slack / Gmail / Google Docs

Need to install connectors?

- Not for the core coding + design stack

Only add these if you want operational workflows like:

- support/email analysis
- Slack drafting or status posting
- document creation or research capture

## Lowest-friction setup

If optimizing for the cleanest stack, set up only this:

1. local Codex workflow
2. Figma MCP/plugin in the tool you actually use
3. Figma Dev Mode access with the right seat
4. optional GitHub connector
5. optional Vercel connector

Do not spend time setting up cloud agents unless the team later finds a concrete recurring need for them.

## Recommended next actions

### Do now
- confirm Figma access and seat for the people doing design-to-code work
- keep using the local Codex workflow
- optionally connect GitHub for PR-aware workflows

### Do only if useful later
- enable Bugbot
- add `.ai/BUGBOT.md`
- connect Vercel if preview access becomes annoying

### Skip for now
- Cursor cloud/background agents
