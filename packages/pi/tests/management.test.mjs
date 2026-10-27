import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createStore } from 'action-hub';
import { MultiSelect } from '../src/multi-select.js';
import { openManager } from '../src/management.js';
import { insertAction } from '../src/insert.js';

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

test('manager can create an Action through the native dialog sequence', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pi-action-hub-manager-'));
  const store = createStore({ dataDir });
  const selections = ['Action 管理', '新建 Action', 'Command（仅用户调用）', '返回', '关闭'];
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
      async custom() { return []; },
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

test('insertAction expands commands and uses native skill commands', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pi-action-hub-insert-'));
  const store = createStore({ dataDir });
  const pasted = [];
  const ctx = { ui: { pasteToEditor(text) { pasted.push(text); } } };
  await insertAction(store, ctx, {
    name: 'demo',
    mode: 'command',
    prompt: 'Do {{args}}.',
  }, 'work');
  await insertAction(store, ctx, {
    name: 'review',
    mode: 'skill',
    prompt: 'Review.',
  }, 'src/a.ts');
  assert.deepEqual(pasted, ['Do work.', '/skill:review src/a.ts']);
  await fs.rm(dataDir, { recursive: true, force: true });
});
