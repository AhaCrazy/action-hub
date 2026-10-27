# Adapter contract

An adapter is a thin harness-specific package that embeds `action-hub` and
translates its native capabilities into core calls.

## Required capabilities

```ts
type HarnessCapabilities = {
  skills: boolean;          // can expose model-visible skills
  commands: boolean;        // has a user-invoked prompt insertion surface
  nativePalette: boolean;   // can render a custom picker
  composerInsertion: boolean;
  projectContext: boolean;  // can provide a meaningful cwd/project root
};
```

Adapters may support a subset. A harness with only commands can expose every
Action as a command; a harness with only skills can expose Skill-mode Actions
only.

## Lifecycle

```ts
interface HarnessAdapter {
  id: string;
  capabilities: HarnessCapabilities;
  context(): HarnessContext;
  register?(): Promise<void>;
  dispose?(): Promise<void>;
}
```

The adapter owns:

- hotkeys, command names, and menu registration;
- palette rendering;
- editor/composer insertion;
- model skill registration;
- settings placement.

The adapter must not own:

- `SKILL.md` parsing;
- group/scope resolution;
- import/export;
- state file shape or direct writes.

## Skill projection

For each `resources_discover` (Pi) or provider list (DSH):

1. resolve project root from `cwd`;
2. load actions from the core;
3. select actions where `mode === 'skill'` and `actionAvailable(...)`;
4. expose each selected action's real directory.

Do not copy skills into a host-specific directory unless the host requires it.
The action directory itself is a valid standard skill root.

## Command projection

Commands are **user-only** prompt templates. They must never be registered as
model tools by default.

On selection, render the prompt and hand it to the host:

- DSH: insert a reference chip or expanded prompt;
- Pi: `ctx.ui.pasteToEditor(rendered)`;
- other hosts: their equivalent insertion API.

A Skill selected from a palette may instead insert the host's native skill
invocation (`/skill:name` on Pi) and let the host load the body.

## Project scope

Core matches project roots against registered profiles. Adapters should:

- pass the most specific known root (cwd, registered workspace, or repo root);
- fall back to global groups when no profile matches;
- never invent a project identity that hides global groups.

## Reload behavior

DSH skill providers can refresh in-process. Pi discovers skills at startup and
`/reload`; after a management action that changes Skill visibility, the Pi
adapter should close the overlay and request `ctx.reload()` (or clearly tell the
user to run `/reload`).
