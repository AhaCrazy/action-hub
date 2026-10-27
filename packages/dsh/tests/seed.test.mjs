import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createStore } from 'action-hub';
import { apply } from '../index.js';

async function tempData() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'dsh-action-hub-apply-'));
}

function fakeContext() {
  const skills = { registerProvider() { return () => {}; } };
  return {
    skills,
    effect(fn) {
      const cleanup = fn();
      return typeof cleanup === 'function' ? cleanup : () => {};
    },
    webServer: { register() {} },
    on() {
      return () => {};
    },
    inject(_names, register) {
      register(this);
    },
    get(name) {
      if (name === 'skills') return skills;
      if (name === 'sessions') return { list: () => [] };
      return undefined;
    },
    emit() {},
  };
}

test('fresh DSH install seeds the built-in import assistant in Common', async () => {
  const dataDir = await tempData();
  try {
    await apply(fakeContext(), { dataDir });
    const state = await createStore({ dataDir }).readState();
    assert.deepEqual(state.groups.map((group) => group.id), ['common']);
    assert.deepEqual(state.entries['skill-import-assistant'].groups, ['common']);
  } finally {
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});

test('seed:false leaves the fresh library empty', async () => {
  const dataDir = await tempData();
  try {
    await apply(fakeContext(), { dataDir, seed: false });
    const state = await createStore({ dataDir }).readState();
    assert.deepEqual(state.entries, {});
  } finally {
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});
