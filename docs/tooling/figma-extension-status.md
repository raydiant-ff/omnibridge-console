# Figma Extension Status

Captured on 2026-03-24 from the local VS Code/Cursor extension runtime view.

## Take

Yes, this is useful.

It confirms that the installed Figma integration is a real editor-side workflow tool, not just a passive panel. In particular, it gives us:

- file opening from the editor
- layer selection and traversal
- code-to-design linking
- design-to-code navigation
- asset export configuration

That makes it useful for:

- keeping Omni screens linked to Figma frames
- navigating from code to the relevant design
- exporting assets into the app
- using Figma as the visual source of truth while implementation stays in the repo

It is less useful as a full design runtime or implementation engine. For Omni, the right split is still:

- Figma for design exploration and layout definition
- Cursor/Codex for implementation in the real Next.js codebase

## Runtime Status

- Activation: `Activated by onView:figma.views.login event: 2ms`
- Activation Event: `onStartupFinished`

## Commands

| ID | Title | Shortcuts | Context |
| --- | --- | --- | --- |
| `figma.createRelatedLinkForCurrentFile` | Link Code to Selected Design |  | `commandPalette` |
| `figma.disabledCommand` | Disabled Command |  | `commandPalette` |
| `figma.expandLayer` | Expand Selected Layer | `Ctrl+Cmd+Right` | `commandPalette` |
| `figma.gotoRelatedComponentForCurrentFile` | Go to Linked Design |  | `commandPalette`, `editor/title` |
| `figma.logout` | Log Out |  | `commandPalette`, `view/title` |
| `figma.openUrl` | Open Design File |  | `commandPalette` |
| `figma.quickPickLayer` | Select Layer |  | `commandPalette` |
| `figma.removeRelatedLinkForCurrentFile` | Remove Link from Code to Design |  | `commandPalette` |
| `figma.saveDebugInformation` | Save Debug Information |  | `commandPalette` |
| `figma.selectNextLayer` | Select Next Layer | `Ctrl+Cmd+Down` | `commandPalette` |
| `figma.selectOrg` | Select Organization... |  | `commandPalette`, `view/title` |
| `figma.selectParentLayer` | Select Parent Layer | `Ctrl+Cmd+Left` | `commandPalette` |
| `figma.selectPreviousLayer` | Select Previous Layer | `Ctrl+Cmd+Up` | `commandPalette` |

## Views

| ID | Name | Where |
| --- | --- | --- |
| `figma.views.dummyLoginNotifications` | Figma | `figma` |
| `figma.views.files` | Files | `figma` |
| `figma.views.login` | Log In To Figma | `figma` |
| `figma.views.notifications` | Notifications | `figma` |

## Settings

| ID | Description | Current Value |
| --- | --- | --- |
| `figma.assetExportDirectory` | Directory where exported assets are saved | `public/images` |
| `figma.assetPublicPath` | Assets are served from this server path and used to construct clipboard URLs | `/images` |
| `figma.autocompleteBlocks` | Experimental multi-line code block suggestions based on cursor position | `false` |
| `figma.autocompleteProperties` | Line-by-line property suggestions like variables, colors, and dimensions | `true` |

## Recommended Use In Omni

1. Use Figma to design the `/cs` shell and major workspace surfaces.
2. Keep exported assets under `public/images` unless we intentionally change the convention.
3. Use code-to-design linking for major pages and shared components once the visual direction is locked.
4. Use Cursor/Codex to implement the final design in the real app.
