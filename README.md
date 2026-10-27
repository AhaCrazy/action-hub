# Action Hub

One portable Action library, native in every harness.

An **Action** is a standard Agent Skill directory: `SKILL.md` plus optional
resources. The same directory can be exposed to the model as a **Skill**, or
kept user-invoked as a **Command**. Groups, global groups, project scopes, and
per-project blocks live in local state, never in the portable skill document.

This repository is a monorepo:

```text
packages/
  core/   action-hub       harness-agnostic library and state model
  dsh/    dsh-action-hub   DSH Cordis adapter (native Web UI, Alt+A)
  pi/     pi-action-hub    Pi package (native TUI palette, Alt+A)
docs/     architecture and adapter contract
```

The core is intentionally free of Cordis, DSH, Pi, React, and terminal UI
dependencies. Each adapter supplies only harness-native UI, shortcuts,
insertion, project discovery, and skill registration.

## Development

```bash
npm install
npm test
```

`npm test` runs the core, DSH adapter, and Pi adapter test suites.

The adapters use workspace-local `file:../core` links while the core API is
stabilizing. They remain separately publishable packages.

## Packages

- [`packages/core`](packages/core) — library, `state.json`, groups, scopes,
  search, import/export.
- [`packages/dsh`](packages/dsh) — DSH plugin (Cordis).
- [`packages/pi`](packages/pi) — Pi package.

## Data

All adapters use the same default:

```text
$ACTION_HUB_HOME/            # defaults to ~/.action-hub
  library/<skill-name>/
    SKILL.md
  state.json
```

`SKILL.md` is portable. `state.json` is local metadata and is never written into
exported bundles.

Core writes use a cross-process lock and atomic `state.json` replacement, so a
DSH process and a Pi process can share the same library.

## Documentation

- [Architecture](docs/architecture.md)
- [Adapter contract](docs/adapter-contract.md)
- [Pi adapter design](docs/pi-adapter.md)

## Status

Early consolidation. The package boundaries and storage schema are stable
enough for validation, but not yet a frozen public API.
