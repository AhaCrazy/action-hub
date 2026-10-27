import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createStore } from 'action-hub';
import { ManagerDashboard } from '../src/manager-dashboard.js';
import { MultiSelect } from '../src/multi-select.js';
import { openManager } from '../src/management.js';
import { insertAction } from '../src/insert.js';

test('dashboard renders three columns with section counts and details', () => {
  let chosen;
  const dashboard = new ManagerDashboard({
    tui: { requestRender() {} },
    theme: { fg: (_color, value) => value },
    data: {
      actions: [{ name: 'commit', description: 'Commit', mode: 'command', groups: [] }],
      state: { groups: [{ id: 'common', name: 'Common', global: true, includes: [] }], projects: [] },
      dataDir: 'E:\\data',
    },
    cwd: 'E:\\project',
    done(value) { chosen = value; },
  });
  const lines = dashboard.render(110);
  assert.ok(lines.length > 15);
  const text = lines.join('\n');
  assert.match(text, /Action/u);
  assert.match(text, /commit/u);
  assert.match(text, /详情/u);
  dashboard.handleInput('\t');
  assert.equal(chosen.kind, 'insert-action');
  dashboard.handleInput('\u001b[D');
  assert.equal(dashboard.focus, 'left');
  dashboard.handleInput('\u001b[C');
  assert.equal(dashboard.focus, 'middle');
  dashboard.handleInput('f');
  assert.equal(dashboard.search, true);
  dashboard.handleInput('z');
  dashboard.handleInput('z');
  dashboard.handleInput('z');
  assert.equal(dashboard.query, 'zzz');
});

test('dashboard shows the current project by label', () => {
  const dashboard = new ManagerDashboard({
    tui: { requestRender() {} },
    theme: { fg: (_color, value) => value },
    data: {
      actions: [],
      state: { groups: [], projects: [] },
      projects: [{ label: 'AgilityDog_Git', path: 'C:\\Work\\AgilityDog_Git', groups: ['dev'] }],
      dataDir: 'E:\\data',
      currentProjectRoot: 'C:\\Work\\AgilityDog_Git',
    },
    cwd: 'C:\\Work\\AgilityDog_Git',
    done() {},
  });
  dashboard.setSection('projects');
  const text = dashboard.render(110).join('\n');
  assert.match(text, /AgilityDog_Git/u);
  assert.doesNotMatch(text, /undefined/u);
});

test('dashboard restores the selected action after a mutation', () => {
  const dashboard = new ManagerDashboard({
    tui: { requestRender() {} },
    theme: { fg: (_color, value) => value },
    data: {
      actions: [
        { name: 'alpha', description: 'A', mode: 'command', groups: [] },
        { name: 'beta', description: 'B', mode: 'command', groups: [] },
      ],
      state: { groups: [], projects: [] },
      dataDir: 'E:\\data',
    },
    cwd: 'E:\\project',
    initialKey: 'beta',
    done() {},
  });
  assert.equal(dashboard.currentKey, 'beta');
  assert.equal(dashboard.selected, 1);
});

test('multi-select filters, toggles, and returns checked keys', () => {
  let result;
  const component = new MultiSelect({
    tui: { requestRender() {} },
    theme: { fg: (_color, value) => value },
    title: '选择',
    items: [
      { key: 'one', label: 'One', description: 'first' },
      { key: 'two', label: 'Two', description: 'second' },
    ],
    initialSelected: ['one'],
    done: (value) => { result = value; },
  });
  component.handleInput(' ');
  component.handleInput('\r');
  assert.deepEqual(result, []);
});

test('manager can create an Action through the split-pane dashboard', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pi-action-hub-manager-'));
  const store = createStore({ dataDir });
  const customResults = [{ kind: 'new-action' }, [], { kind: 'close' }];
  const selections = ['Command（仅用户调用）'];
  const inputs = ['demo-action', '演示 Action'];
  const editors = ['演示正文'];
  const ctx = {
    mode: 'tui',
    cwd: dataDir,
    ui: {
      async select() { return selections.shift(); },
      async input() { return inputs.shift(); },
      async editor() { return editors.shift(); },
      async confirm() { return true; },
      async custom() { return customResults.shift(); },
      notify() {},
      pasteToEditor() {},
      async reload() {},
    },
  };
  await openManager(ctx, store, dataDir);
  const data = await store.read();
  assert.equal(data.actions.length, 1);
  assert.equal(data.actions[0].name, 'demo-action');
  assert.equal(data.actions[0].mode, 'command');
  await fs.rm(dataDir, { recursive: true, force: true });
});

test('manager can save the current Pi workdir scope', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pi-action-hub-scope-'));
  const store = createStore({ dataDir });
  const group = await store.createGroup('Scoped');
  const customResults = [
    { kind: 'edit-project', project: { path: dataDir } },
    [group.id],
    { kind: 'close' },
  ];
  const selections = ['启用分组', '保存'];
  let written = null;
  const scopeStore = {
    async readForRoot() { return null; },
    async writeForRoot(_root, profile) { written = profile; return profile; },
  };
  const ctx = {
    mode: 'tui',
    cwd: dataDir,
    ui: {
      async select() { return selections.shift(); },
      async input() { return undefined; },
      async editor() { return ''; },
      async confirm() { return true; },
      async custom() { return customResults.shift(); },
      notify() {},
      pasteToEditor() {},
      async reload() {},
    },
  };
  await openManager(ctx, store, dataDir, scopeStore);
  assert.deepEqual(written.groups, [group.id]);
  await fs.rm(dataDir, { recursive: true, force: true });
});

test('manager asks the caller to reload after a mode change', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pi-action-hub-reload-'));
  const store = createStore({ dataDir });
  await store.create({ name: 'demo', description: 'Demo', prompt: 'Body.', mode: 'command' });
  const customResults = [
    { kind: 'toggle-mode', action: { id: 'demo', name: 'demo', mode: 'command' }, selectedKey: 'demo' },
    { kind: 'close' },
  ];
  const ctx = {
    mode: 'tui',
    cwd: dataDir,
    ui: {
      async custom() { return customResults.shift(); },
      notify() {},
    },
  };
  const changed = await openManager(ctx, store, dataDir);
  assert.equal(changed, true);
  assert.equal((await store.readState()).entries.demo.mode, 'skill');
  await fs.rm(dataDir, { recursive: true, force: true });
});

test('insertAction expands commands and uses native skill commands', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pi-action-hub-insert-'));
  const store = createStore({ dataDir });
  const pasted = [];
  let renders = 0;
  const ctx = { ui: { pasteToEditor(text) { pasted.push(text); } } };
  const tui = { requestRender() { renders += 1; } };
  await insertAction(store, ctx, {
    name: 'demo',
    mode: 'command',
    prompt: 'Do {{args}}.',
  }, 'work', tui);
  await insertAction(store, ctx, {
    name: 'review',
    mode: 'skill',
    prompt: 'Review.',
  }, 'src/a.ts');
  assert.deepEqual(pasted, ['Do work.', '/skill:review src/a.ts']);
  assert.ok(renders >= 1);
  await fs.rm(dataDir, { recursive: true, force: true });
});
