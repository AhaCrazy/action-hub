import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createStore, normalizeProjectScope } from 'action-hub';
import { cleanProject, manifestPath, syncProject } from '../src/sync.js';

async function fixture() {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codex-action-hub-data-'));
  const project = await fs.mkdtemp(path.join(os.tmpdir(), 'codex-action-hub-project-'));
  await fs.mkdir(path.join(project, '.git'));
  const store = createStore({ dataDir });
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
    prompt: 'Use this command prompt.',
    mode: 'command',
    groups: ['common'],
  });
  return { dataDir, project, store };
}

test('projects Skill and explicit-only Command into Codex skills', async () => {
  const { dataDir, project, store } = await fixture();
  try {
    const result = await syncProject(store, project);
    assert.equal(result.added, 2);
    const skillFile = path.join(project, '.agents', 'skills', 'skill-alpha', 'SKILL.md');
    assert.match(await fs.readFile(skillFile, 'utf8'), /Do skill work\./u);
    const commandFile = path.join(project, '.agents', 'skills', 'command-beta', 'SKILL.md');
    assert.match(await fs.readFile(commandFile, 'utf8'), /Use this command prompt\./u);
    const metadata = await fs.readFile(path.join(project, '.agents', 'skills', 'command-beta', 'agents', 'openai.yaml'), 'utf8');
    assert.match(metadata, /allow_implicit_invocation: false/u);
    const manifest = JSON.parse(await fs.readFile(manifestPath(path.join(project, '.agents')), 'utf8'));
    assert.equal(manifest.items.length, 2);
  } finally {
    await fs.rm(dataDir, { recursive: true, force: true });
    await fs.rm(project, { recursive: true, force: true });
  }
});

test('clean removes only generated paths', async () => {
  const { dataDir, project, store } = await fixture();
  try {
    await syncProject(store, project);
    const userFile = path.join(project, '.agents', 'skills', 'user-owned', 'SKILL.md');
    await fs.mkdir(path.dirname(userFile), { recursive: true });
    await fs.writeFile(userFile, '# user\n', 'utf8');
    const result = await cleanProject(project);
    assert.ok(result.removed >= 2);
    assert.equal(await fs.access(userFile).then(() => true).catch(() => false), true);
    assert.equal(await fs.access(path.join(project, '.agents', 'skills', 'skill-alpha')).then(() => true).catch(() => false), false);
  } finally {
    await fs.rm(dataDir, { recursive: true, force: true });
    await fs.rm(project, { recursive: true, force: true });
  }
});

test('never overwrites a user-owned Codex skill', async () => {
  const { dataDir, project, store } = await fixture();
  try {
    const target = path.join(project, '.agents', 'skills', 'skill-alpha');
    await fs.mkdir(target, { recursive: true });
    await fs.writeFile(path.join(target, 'SKILL.md'), '# user skill\n', 'utf8');
    const result = await syncProject(store, project);
    assert.ok(result.warnings.some((warning) => warning.includes('已存在')));
    assert.equal(await fs.readFile(path.join(target, 'SKILL.md'), 'utf8'), '# user skill\n');
  } finally {
    await fs.rm(dataDir, { recursive: true, force: true });
    await fs.rm(project, { recursive: true, force: true });
  }
});

test('respects the Codex project scope before projecting skills', async () => {
  const { dataDir, project, store } = await fixture();
  try {
    const scopeDir = path.join(await fs.realpath(project), '.codex', 'action-hub');
    await fs.mkdir(scopeDir, { recursive: true });
    await fs.writeFile(path.join(scopeDir, 'scope.json'), JSON.stringify(normalizeProjectScope({ excludeActions: ['skill-alpha', 'command-beta'] })), 'utf8');
    const result = await syncProject(store, project);
    assert.equal(result.added, 0);
    assert.equal(await fs.access(path.join(project, '.agents', 'skills', 'skill-alpha')).then(() => true).catch(() => false), false);
  } finally {
    await fs.rm(dataDir, { recursive: true, force: true });
    await fs.rm(project, { recursive: true, force: true });
  }
});
