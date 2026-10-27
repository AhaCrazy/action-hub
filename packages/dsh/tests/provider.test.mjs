import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createStore, normalizeProjectScope } from 'action-hub';
import { installSkillsProvider } from '../host/skills-provider.js';

function fakeContext(options = {}) {
  let provider;
  const skills = {
    registerProvider(make) {
      provider = make({ invalidate() {} });
      return () => {};
    },
  };
  const workspaceRegistry = options.workspaces === undefined ? undefined : { list: () => options.workspaces };
  const ctx = {
    skills,
    get: (name) => (name === 'skills' ? skills : name === 'workspaceRegistry' ? workspaceRegistry : undefined),
    inject: (deps, cb) => cb({ skills, effect: (fn) => fn() }),
    effect: (fn) => fn(),
    logger: { warn() {} },
  };
  return { ctx, provider: () => provider };
}

function fakeScopeStore(scopes = {}) {
  return {
    async read(id) {
      return scopes[id] ?? null;
    },
    async write(id, profile) {
      scopes[id] = normalizeProjectScope(profile);
      return scopes[id];
    },
  };
}

test('provider exposes only Skill-mode entries', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ah-provider-'));
  const store = createStore({ dataDir });
  const group = await store.createGroup('Default');
  await store.create({ name: 'visible-skill', description: 'visible', prompt: 'body', mode: 'skill', groups: [group.id] });
  await store.create({ name: 'hidden-command', description: 'hidden', prompt: 'body', mode: 'command', groups: [group.id] });
  const workspace = { id: 'w1', title: 'default', path: dataDir };
  const scopeStore = fakeScopeStore({ w1: normalizeProjectScope({ groups: [group.id] }) });
  const { ctx, provider } = fakeContext({ workspaces: [workspace] });
  installSkillsProvider(ctx, store, scopeStore);
  const listed = await provider().list({ cwd: dataDir });
  assert.deepEqual(listed.candidates.map((entry) => entry.name), ['visible-skill']);
  assert.deepEqual(listed.candidates[0].invocation, { modelInvocable: true, userInvocable: false });
  const loaded = await provider().get({ name: 'visible-skill' }, { cwd: dataDir });
  assert.equal(loaded.content, 'body');
  assert.equal(loaded.source, 'action-hub');
  assert.deepEqual(loaded.invocation, { modelInvocable: true, userInvocable: false });
  assert.equal(await provider().get({ name: 'hidden-command' }, { cwd: dataDir }), undefined);
});

test('provider hides project-scoped entries outside the project', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ah-provider-'));
  const other = await fs.mkdtemp(path.join(os.tmpdir(), 'ah-other-'));
  const store = createStore({ dataDir });
  const group = await store.createGroup('Other');
  await store.create({
    name: 'scoped-skill',
    description: 'scoped',
    prompt: 'body',
    mode: 'skill',
    groups: [group.id],
  });
  const workspace = { id: 'w-other', title: 'other', path: other };
  const scopeStore = fakeScopeStore({ 'w-other': normalizeProjectScope({ groups: [group.id] }) });
  const { ctx, provider } = fakeContext({ workspaces: [workspace] });
  installSkillsProvider(ctx, store, scopeStore);
  assert.equal((await provider().list({ cwd: dataDir })).candidates.length, 0);
  assert.equal((await provider().list({ cwd: other })).candidates.length, 1);
});

test('provider matches a registered project ancestor when the session cwd is nested', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ah-provider-'));
  const project = await fs.mkdtemp(path.join(os.tmpdir(), 'ah-project-'));
  const nested = path.join(project, 'src', 'app');
  await fs.mkdir(nested, { recursive: true });
  const store = createStore({ dataDir });
  const group = await store.createGroup('Project');
  await store.create({
    name: 'ancestor-skill',
    description: 'ancestor',
    prompt: 'body',
    mode: 'skill',
    groups: [group.id],
  });
  const workspace = { id: 'w-project', title: 'project', path: project };
  const scopeStore = fakeScopeStore({ 'w-project': normalizeProjectScope({ groups: [group.id] }) });
  const { ctx, provider } = fakeContext({ workspaces: [workspace] });
  installSkillsProvider(ctx, store, scopeStore);
  assert.equal((await provider().list({ cwd: nested })).candidates.length, 1);
});
