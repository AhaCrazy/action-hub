import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createStore, normalizeProjectScope } from 'action-hub';
import { createDshProjectScopeStore, migrateLegacyProjects } from '../host/project-scopes.js';

function fakeContext(projects) {
  return {
    get(name) {
      if (name === 'workspaceRegistry') return { list: async () => projects };
      return undefined;
    },
  };
}

test('DSH scopes are keyed by workspace id and pruned by surviving workspaces', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'ah-dsh-home-'));
  const project = await fs.mkdtemp(path.join(os.tmpdir(), 'ah-dsh-project-'));
  const previous = process.env.DSH_HOME;
  process.env.DSH_HOME = home;
  try {
    const store = createDshProjectScopeStore();
    await store.write('w-one', normalizeProjectScope({ label: 'One', groups: ['g1'] }));
    const scope = await store.read('w-one');
    assert.equal(scope.groups[0], 'g1');
    assert.equal(await store.read('missing'), null);
    const projects = [{ id: 'w-one', label: 'One', path: project }];
    const profiles = await store.listProfiles(projects);
    assert.equal(profiles.length, 1);
    assert.equal(profiles[0].id, 'w-one');
    assert.equal(profiles[0].path, project);
    assert.equal(await store.prune([]), 0);
    await store.write('w-old', normalizeProjectScope({}));
    assert.equal(await store.prune(projects), 1);
    assert.equal(await store.read('w-old'), null);
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previous;
    await fs.rm(home, { recursive: true, force: true });
    await fs.rm(project, { recursive: true, force: true });
  }
});

test('legacy shared project scopes migrate into workspace files', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'ah-dsh-home-'));
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ah-dsh-data-'));
  const project = await fs.mkdtemp(path.join(os.tmpdir(), 'ah-dsh-project-'));
  const previous = process.env.DSH_HOME;
  process.env.DSH_HOME = home;
  try {
    const store = createStore({ dataDir });
    const group = await store.createGroup('Legacy');
    await store.setProjectScope(project, { label: 'P', groups: [group.id], actions: [] });
    const scopeStore = createDshProjectScopeStore();
    const ctx = fakeContext([{ id: 'w-project', label: 'P', path: project }]);
    const count = await migrateLegacyProjects(ctx, store, scopeStore);
    assert.equal(count, 1);
    const scope = await scopeStore.read('w-project');
    assert.deepEqual(scope.groups, [group.id]);
    assert.deepEqual((await store.readState()).projects, []);
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previous;
    await fs.rm(home, { recursive: true, force: true });
    await fs.rm(dataDir, { recursive: true, force: true });
    await fs.rm(project, { recursive: true, force: true });
  }
});
