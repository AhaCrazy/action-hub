import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createStore } from 'action-hub';
import { apply } from '../index.js';
import { createDshProjectScopeStore } from '../host/project-scopes.js';

function fakeContext(handlerRef) {
  const skills = { registerProvider() { return () => {}; } };
  const project = handlerRef.project;
  return {
    skills,
    effect(fn) {
      const cleanup = fn();
      return typeof cleanup === 'function' ? cleanup : () => {};
    },
    webServer: {
      register(route) {
        handlerRef.handler = route.handler;
        return () => {};
      },
    },
    on() {
      return () => {};
    },
    inject(_names, register) {
      register(this);
    },
    get(name) {
      if (name === 'skills') return skills;
      if (name === 'workspaceRegistry') {
        return { list: async () => [{ id: 'w1', title: 'Project', path: project }] };
      }
      if (name === 'sessions') {
        return { list: () => [{ header: { id: 's1', cwd: project, updatedAt: 1 } }] };
      }
      return undefined;
    },
    emit() {},
  };
}

function responseCollector() {
  let body = '';
  const headers = {};
  return {
    res: {
      writeHead(status, values) { headers.status = status; Object.assign(headers, values ?? {}); },
      end(value) { if (value !== undefined) body += String(value); },
    },
    get body() { return body; },
    get headers() { return headers; },
  };
}

test('/state uses DSH workspace scopes instead of shared project state', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'ah-dsh-state-home-'));
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ah-dsh-state-data-'));
  const project = await fs.mkdtemp(path.join(os.tmpdir(), 'ah-dsh-state-project-'));
  const previous = process.env.DSH_HOME;
  process.env.DSH_HOME = home;
  try {
    const ref = { project, handler: null };
    await apply(fakeContext(ref), { dataDir, seed: false });
    const store = createStore({ dataDir });
    const group = await store.createGroup('ProjectOnly');
    await store.create({ name: 'scoped', description: 'scoped', prompt: 'body', mode: 'command', groups: [group.id] });
    const scopeStore = createDshProjectScopeStore();
    await scopeStore.write('w1', { groups: [group.id], actions: [] });

    const collector = responseCollector();
    await ref.handler({
      method: 'GET',
      url: '/api/dsh-action-hub/state',
      headers: { host: 'localhost' },
    }, collector.res);
    assert.equal(collector.headers.status, 200);
    const body = JSON.parse(collector.body);
    assert.equal(body.projects[0].id, 'w1');
    assert.deepEqual(body.projectScopes[0].groups, [group.id]);
    assert.equal(body.currentProject.id, 'w1');
    assert.deepEqual(body.currentProfile.groups, [group.id]);
    assert.equal(body.actions.find((action) => action.name === 'scoped').available, true);
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previous;
    await fs.rm(home, { recursive: true, force: true });
    await fs.rm(dataDir, { recursive: true, force: true });
    await fs.rm(project, { recursive: true, force: true });
  }
});
