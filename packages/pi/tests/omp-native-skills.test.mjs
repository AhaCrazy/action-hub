import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createStore, normalizeProjectScope } from 'action-hub';
import { createPiProjectScopeStore } from '../src/project-scopes.js';
import { OMP_MANIFEST_FORMAT, syncOmpNativeSkills } from '../src/omp-native-skills.js';

async function fixture() {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'omp-native-data-'));
  const project = await fs.mkdtemp(path.join(os.tmpdir(), 'omp-native-project-'));
  const sessions = await fs.mkdtemp(path.join(os.tmpdir(), 'omp-native-sessions-'));
  const store = createStore({ dataDir });
  const scopeStore = createPiProjectScopeStore({ sessionsDir: sessions });
  await store.create({
    name: 'skill-alpha',
    description: 'Skill alpha',
    prompt: 'Do skill work.',
    mode: 'skill',
    groups: ['common'],
  });
  await store.create({
    name: 'command-beta',
    description: 'Command beta',
    prompt: 'Do command work.',
    mode: 'command',
    groups: ['common'],
  });
  return { dataDir, project, sessions, store, scopeStore };
}

async function readManifest(project) {
  return JSON.parse(await fs.readFile(path.join(project, '.omp', 'action-hub', 'generated.json'), 'utf8'));
}

test('projects only Skill-mode actions into OMP native skills', async () => {
  const { dataDir, project, sessions, store, scopeStore } = await fixture();
  try {
    const result = await syncOmpNativeSkills(store, scopeStore, project);
    assert.equal(result.added, 1);
    const skillFile = path.join(project, '.omp', 'skills', 'skill-alpha', 'SKILL.md');
    assert.match(await fs.readFile(skillFile, 'utf8'), /Do skill work\./u);
    assert.equal(await fs.access(path.join(project, '.omp', 'skills', 'command-beta')).then(() => true).catch(() => false), false);
    const manifest = await readManifest(project);
    assert.equal(manifest.format, OMP_MANIFEST_FORMAT);
    assert.deepEqual(manifest.items.map((item) => item.name), ['skill-alpha']);
  } finally {
    await fs.rm(dataDir, { recursive: true, force: true });
    await fs.rm(project, { recursive: true, force: true });
    await fs.rm(sessions, { recursive: true, force: true });
  }
});

test('removes generated skills when an action becomes a Command', async () => {
  const { dataDir, project, sessions, store, scopeStore } = await fixture();
  try {
    await syncOmpNativeSkills(store, scopeStore, project);
    await store.update('skill-alpha', { mode: 'command' });
    const result = await syncOmpNativeSkills(store, scopeStore, project);
    assert.equal(result.removed, 1);
    assert.equal(await fs.access(path.join(project, '.omp', 'skills', 'skill-alpha')).then(() => true).catch(() => false), false);
    assert.deepEqual((await readManifest(project)).items, []);
  } finally {
    await fs.rm(dataDir, { recursive: true, force: true });
    await fs.rm(project, { recursive: true, force: true });
    await fs.rm(sessions, { recursive: true, force: true });
  }
});

test('never overwrites a user-owned native skill', async () => {
  const { dataDir, project, sessions, store, scopeStore } = await fixture();
  try {
    const target = path.join(project, '.omp', 'skills', 'skill-alpha');
    await fs.mkdir(target, { recursive: true });
    await fs.writeFile(path.join(target, 'SKILL.md'), '# user skill\n', 'utf8');
    const result = await syncOmpNativeSkills(store, scopeStore, project);
    assert.ok(result.warnings.some((warning) => warning.includes('已存在')));
    assert.equal(await fs.readFile(path.join(target, 'SKILL.md'), 'utf8'), '# user skill\n');
  } finally {
    await fs.rm(dataDir, { recursive: true, force: true });
    await fs.rm(project, { recursive: true, force: true });
    await fs.rm(sessions, { recursive: true, force: true });
  }
});

test('respects the OMP project scope before projecting skills', async () => {
  const { dataDir, project, sessions, store, scopeStore } = await fixture();
  try {
    await scopeStore.writeForRoot(await fs.realpath(project), normalizeProjectScope({ excludeActions: ['skill-alpha'] }));
    const result = await syncOmpNativeSkills(store, scopeStore, project);
    assert.equal(result.added, 0);
    assert.equal(await fs.access(path.join(project, '.omp', 'skills', 'skill-alpha')).then(() => true).catch(() => false), false);
  } finally {
    await fs.rm(dataDir, { recursive: true, force: true });
    await fs.rm(project, { recursive: true, force: true });
    await fs.rm(sessions, { recursive: true, force: true });
  }
});
