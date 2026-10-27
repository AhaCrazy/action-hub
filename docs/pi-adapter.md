# Pi adapter design

Local Pi: `@earendil-works/pi-coding-agent@1.4.0`, TUI harness.

## Native surfaces

| Surface | Pi API |
| --- | --- |
| Command | `pi.registerCommand('ah', ...)` |
| Shortcut | `pi.registerShortcut('alt+a', ...)` |
| Palette | `ctx.ui.custom(...)` with `@earendil-works/pi-tui` |
| Insertion | `ctx.ui.pasteToEditor(text)` |
| Skill discovery | `pi.on('resources_discover', ...)` → `skillPaths` |
| Settings UI | custom TUI screen or `ctx.ui.select/input` |

## Mapping

- **Skill action** → return its directory from `resources_discover`; Pi shows it
  in the model catalog and exposes `/skill:<name>`.
- **Command action** → never returned as a skill; the palette inserts the
  rendered prompt into the editor.
- **Palette** → custom TUI overlay: search (substring + regex), list, preview,
  args, Enter to insert.
- **Project scope** → `ctx.cwd` or nearest `.git` root; global groups apply
  everywhere; per-project blocks use the shared state.
- **Management** → `/ah manage` TUI screen for groups, scopes, import/export,
  and mode changes. After changing Skill visibility, trigger `ctx.reload()` or
  notify the user.

## Package shape

```text
pi-action-hub/
  package.json        # pi manifest, pi-package keyword, peerDependencies
  extensions/ah.ts    # extension entry
  src/core/           # bundled/action-hub core
  src/ui/             # Pi TUI palette and manager
```

Install with `pi install npm:pi-action-hub` (or a git/local source). Pi runs the
extension in its own process; no server, port, or browser window.

## Constraints found in Pi 1.4.0

- `ctx.ui.custom` is TUI-only; print/JSON modes have no UI.
- Commands and shortcuts are available in interactive mode.
- Skills are discovered at startup and `/reload`; scope changes need a reload.
- Use Pi's theme and `KeybindingsManager`; do not hard-code colors or terminal
  key handling.
- Extension factory must not start watchers/timers; start them on
  `session_start` and clean up on `session_shutdown`.
