import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { normalizeProjectScope } from 'action-hub';
import { createPiProjectScopeStore, piWorkdirKey } from '../src/project-scopes.js';

test('scope store follows the active session directory', async () => {
  const fallback = await fs.mkdtemp(path.join(os.tmpdir(), 'pi-agent-fallback-'));
  const actual = await fs.mkdtemp(path.join(os.tmpdir(), 'omp-profile-sessions-'));
  const project = await fs.mkdtemp(path.join(os.tmpdir(), 'omp-project-'));
  try {
    const store = createPiProjectScopeStore({ sessionsDir: path.join(fallback, 'sessions') });
    store.configure({ sessionManager: { getSessionDir: () => actual } });
    const file = store.fileForRoot(project);
    assert.ok(file.startsWith(path.join(actual, piWorkdirKey(project))));
    await store.writeForRoot(project, normalizeProjectScope({ label: 'OMP', groups: ['dev'] }));
    assert.equal((await store.readForRoot(project)).label, 'OMP');
  } finally {
    await fs.rm(fallback, { recursive: true, force: true });
    await fs.rm(actual, { recursive: true, force: true });
    await fs.rm(project, { recursive: true, force: true });
  }
});

test('Pi scopes live inside the matching workdir session directory', async () => {
  const agent = await fs.mkdtemp(path.join(os.tmpdir(), 'pi-agent-'));
  const project = await fs.mkdtemp(path.join(os.tmpdir(), 'pi-project-'));
  const previous = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = agent;
  try {
    const store = createPiProjectScopeStore();
    const file = store.fileForRoot(project);
    assert.ok(file.startsWith(path.join(agent, 'sessions', piWorkdirKey(project))));
    await store.writeForRoot(project, normalizeProjectScope({ label: 'P', groups: ['g1'] }));
    const scope = await store.readForRoot(project);
    assert.equal(scope.label, 'P');
    assert.deepEqual(scope.groups, ['g1']);
    await store.deleteForRoot(project);
    assert.equal(await store.readForRoot(project), null);
  } finally {
    if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previous;
    await fs.rm(agent, { recursive: true, force: true });
    await fs.rm(project, { recursive: true, force: true });
  }
});
