import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createStore } from 'action-hub';
import { manifestPath, syncProject, cleanProject } from '../src/sync.js';

async function fixture() {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-action-hub-data-'));
  const project = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-action-hub-project-'));
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
    prompt: 'Use {{args}} for the task.',
    mode: 'command',
    groups: ['common'],
  });
  return { dataDir, project, store };
}

test('sync writes native skills and namespaced commands', async () => {
  const { project, store, dataDir } = await fixture();
  try {
    const result = await syncProject(store, project);
    assert.equal(result.added, 2);
    const skillFile = path.join(project, '.claude', 'skills', 'skill-alpha', 'SKILL.md');
    assert.ok((await fs.readFile(skillFile, 'utf8')).includes('Do skill work.'));
    const commandFile = path.join(project, '.claude', 'commands', 'ah', 'command-beta.md');
    const command = await fs.readFile(commandFile, 'utf8');
    assert.match(command, /description: "Command beta"/u);
    assert.match(command, /\$ARGUMENTS/u);
    const manifest = JSON.parse(await fs.readFile(manifestPath(path.join(project, '.claude')), 'utf8'));
    assert.equal(manifest.items.length, 2);
  } finally {
    await fs.rm(dataDir, { recursive: true, force: true });
    await fs.rm(project, { recursive: true, force: true });
  }
});

test('clean removes only generated paths', async () => {
  const { project, store, dataDir } = await fixture();
  try {
    await syncProject(store, project);
    const userFile = path.join(project, '.claude', 'skills', 'user-owned', 'SKILL.md');
    await fs.mkdir(path.dirname(userFile), { recursive: true });
    await fs.writeFile(userFile, '# user\n', 'utf8');
    const result = await cleanProject(project);
    assert.ok(result.removed >= 2);
    assert.equal(await fs.access(userFile).then(() => true).catch(() => false), true);
    assert.equal(await fs.access(path.join(project, '.claude', 'skills', 'skill-alpha')).then(() => true).catch(() => false), false);
  } finally {
    await fs.rm(dataDir, { recursive: true, force: true });
    await fs.rm(project, { recursive: true, force: true });
  }
});

test('sync never overwrites a user-owned skill', async () => {
  const { project, store, dataDir } = await fixture();
  try {
    const target = path.join(project, '.claude', 'skills', 'skill-alpha');
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
