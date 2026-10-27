# Architecture

## Goals

`action-hub` is a **library and data model**, not a daemon, not a web app, and
not a harness-specific plugin.

The same standard skill directory must work in every adapter while each adapter
keeps its own native experience:

- DSH: Cordis plugin, Alt+A overlay, composer insertion, skill provider.
- Pi: Pi package, TUI overlay, `resources_discover`, editor insertion.
- Other harnesses: their own extension points.

## Layers

```text
adapter (DSH / Pi / ...)
  ├─ harness context: cwd, project root, session identity
  ├─ native UI: palette, dialogs, shortcuts, theme, keybindings
  ├─ insertion: composer / editor / host prompt API
  └─ registration: model-visible skills and commands
            │
            ▼
core (this repository)
  ├─ SKILL.md library
  ├─ state schema: mode, groups, scopes, blocks, usage
  ├─ availability resolution
  ├─ search and sorting
  ├─ folder/ZIP import/export
  └─ storage locking and atomic writes
```

No adapter should read or write `state.json` directly. All mutations go through
the core so that DSH and Pi can share one library safely.

## Storage ownership

Recommended default:

```text
$ACTION_HUB_HOME/            # ~/.action-hub by default
  library/
  state.json
  .lock
```

Adapters may point `ACTION_HUB_HOME` at a harness-specific directory, but sharing
the default gives users one portable library across harnesses.

Writes must be:

1. guarded by a cross-process lock;
2. read-modify-write inside that lock;
3. written to a temporary file and atomically renamed;
4. followed by a file-watch notification to open UIs.

A later revision may add a monotonic `revision` to detect conflicting edits.

## Portability boundary

Core must not import:

- Cordis / DSH packages;
- Pi packages;
- React or DOM;
- terminal UI libraries;
- harness workspace registries.

Harness-specific concepts are supplied as `HarnessContext`:

```ts
interface HarnessContext {
  cwd: string;
  projectRoot?: string;
  workspaceId?: string;
}
```

Core exposes behavior, not presentation.

## Non-goals

- Running a shared HTTP server.
- Opening a separate browser window.
- A universal UI that every harness embeds.
- Executing skill scripts. Skill content is prompt data; harnesses remain
  responsible for tool approvals and sandboxing.
