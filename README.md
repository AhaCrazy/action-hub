# action-hub

Harness-agnostic core for a portable **Action** library:

- **Skill**: a standard `SKILL.md` directory that a harness may expose to the model.
- **Command**: the same standard directory, used as a user-invoked prompt template.
- Groups, global groups, project scopes, explicit per-project blocks.
- Search, import/export, usage metadata, and a versioned local state file.

This repository is the shared core. Harness integrations (DSH, Pi, and others)
are separate adapter packages that bundle this core and provide their own native
UI, shortcuts, and insertion behavior.

## Status

Early extraction of the proven `dsh-action-hub` core. The storage format and
public API are still stabilizing; do not treat this package as published yet.

## Layout

```text
src/
  store.js          # library + state, groups, scopes, modes, search data
  availability.js   # project/global/blocked resolution
  scope.js          # project-root and path matching
  skill-doc.js      # SKILL.md parsing and writing
  resources.js      # resource files inside a skill
  bundle.js         # folder/ZIP import and export
  zip.js            # deterministic ZIP codec
  index.js          # public exports
tests/              # Node test runner suites
docs/               # architecture and adapter contract
```

## Data

```text
$ACTION_HUB_HOME/            # defaults to ~/.action-hub
  library/<skill-name>/
    SKILL.md
    ...resources
  state.json                 # mode / groups / scopes / usage / excludes
```

`SKILL.md` is the only portable artifact. `state.json` is local metadata and is
never included in exported bundles.

On a fresh data directory, the core creates a global **Common** group. Built-in
Actions are supplied by the adapter, not hard-coded into the core.

Writes use a cross-process lock and atomic `state.json` replacement, so DSH and
Pi can use the same `ACTION_HUB_HOME` without one overwriting the other.

## Development

```bash
npm install
npm test
```

## Adapters

- DSH: [`../dsh-action-hub`](../dsh-action-hub) — Cordis plugin with the native
  Web UI, Alt+A palette, composer chips, and skill provider.
- Pi: [`../pi-action-hub`](../pi-action-hub) — Pi package with a native TUI
  palette and `resources_discover`.

Both adapters link this core with `file:../action-hub` while the API stabilizes.

See [docs/architecture.md](docs/architecture.md) and
[docs/adapter-contract.md](docs/adapter-contract.md).
