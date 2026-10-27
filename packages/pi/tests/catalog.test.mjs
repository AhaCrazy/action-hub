import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { canonicalPath, createStore, normalizeProjectScope } from 'action-hub';
import { seedDefaultBuiltin } from '../src/builtins.js';
import { loadCatalog, renderAction, groupLabels } from '../src/catalog.js';
import { ActionPalette } from '../src/palette.js';
import actionHub, { submitReloadThroughEditor } from '../extensions/action-hub.js';

function fixedScope(root, profile) {
  return {
    async readForRoot(candidate) {
      return canonicalPath(candidate) === canonicalPath(root) ? normalizeProjectScope(profile) : null;
    },
    async writeForRoot() {},
  };
}

test('loads only available actions and renders command/skill payloads', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pi-action-hub-'));
  const store = createStore({ dataDir });
  const group = await store.createGroup('Project');
  await store.create({
    name: 'commit',
    description: 'Create a commit',
    prompt: 'Commit the staged changes with {{args}}.',
    mode: 'command',
    groups: [group.id],
  });
  await store.create({
    name: 'review',
    description: 'Review code',
    prompt: 'Review the diff.',
    mode: 'skill',
    groups: [group.id],
  });
  const scopeStore = fixedScope(dataDir, { groups: [group.id], actions: [] });

  const catalog = await loadCatalog(store, dataDir, scopeStore);
  assert.deepEqual(
    catalog.actions.map((action) => action.name).filter((name) => name !== 'skill-import-assistant').sort(),
    ['commit', 'review'],
  );
  assert.ok(catalog.actions.some((action) => action.name === 'skill-import-assistant' && action.builtin === true));
  assert.equal(renderAction(catalog.actions.find((action) => action.name === 'commit'), 'fix bug'), 'Commit the staged changes with fix bug.');
  assert.equal(renderAction(catalog.actions.find((action) => action.name === 'review')), '/skill:review');
  assert.equal(renderAction(catalog.actions.find((action) => action.name === 'review'), 'src/a.ts'), '/skill:review src/a.ts');
  assert.deepEqual(groupLabels(catalog.actions.find((action) => action.name === 'commit'), catalog.groups), ['Project']);
});

test('empty data directory still exposes the built-in import assistant', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pi-action-hub-empty-'));
  const store = createStore({ dataDir });
  const catalog = await loadCatalog(store, dataDir);
  assert.deepEqual(catalog.actions.map((action) => action.name), ['skill-import-assistant']);
  assert.equal(catalog.actions[0].builtin, true);
  assert.equal(catalog.actions[0].mode, 'command');
});

test('fresh Pi library seeds the built-in into Common', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pi-action-hub-seed-'));
  const store = createStore({ dataDir });
  assert.equal(await seedDefaultBuiltin(store), true);
  const state = await store.readState();
  assert.deepEqual(state.groups.map((group) => group.id), ['common']);
  assert.deepEqual(state.entries['skill-import-assistant'].groups, ['common']);
  assert.equal(await seedDefaultBuiltin(store), false);
});

test('palette renders a native TUI overlay', () => {
  const theme = { fg: (_color, value) => value };
  const palette = new ActionPalette({
    tui: { requestRender() {} },
    theme,
    actions: [
      { name: 'commit', description: 'Create a commit', mode: 'command' },
      { name: 'review', description: 'Review code', mode: 'skill' },
    ],
    groups: [],
    done() {},
  });
  const lines = palette.render(80);
  assert.ok(lines.length > 5);
  assert.match(lines.join('\n'), /commit/u);
  assert.match(lines.join('\n'), /review/u);
  palette.handleInput('r');
  assert.match(palette.render(80).join('\n'), /review/u);
});

test('shortcut contexts can submit /ah reload through the editor', async () => {
  const submitted = [];
  const editor = { onSubmit(text) { submitted.push(text); } };
  const tui = { getFocusedComponent: () => editor };
  const ctx = { ui: { getEditorText: () => '' } };
  assert.equal(await submitReloadThroughEditor(ctx, tui), true);
  assert.deepEqual(submitted, ['/ah reload']);
});

test('shortcut reload never overwrites a draft', async () => {
  let submitted = 0;
  const tui = { getFocusedComponent: () => ({ onSubmit() { submitted += 1; } }) };
  const ctx = { ui: { getEditorText: () => 'draft' } };
  assert.equal(await submitReloadThroughEditor(ctx, tui), false);
  assert.equal(submitted, 0);
});

test('extension registers Pi command, shortcut, and resource discovery', () => {
  const commands = [];
  const shortcuts = [];
  const events = [];
  actionHub({
    registerCommand: (name, options) => commands.push({ name, options }),
    registerShortcut: (shortcut, options) => shortcuts.push({ shortcut, options }),
    on: (event, handler) => events.push({ event, handler }),
  });
  assert.deepEqual(commands.map((entry) => entry.name), ['ah']);
  assert.deepEqual(shortcuts.map((entry) => entry.shortcut), ['alt+a', 'ctrl+alt+a']);
  assert.deepEqual(events.map((entry) => entry.event), ['session_start', 'resources_discover']);
});
