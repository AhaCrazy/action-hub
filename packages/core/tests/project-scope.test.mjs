import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  deleteProjectScope,
  normalizeProjectScope,
  pruneProjectScopes,
  readProjectScope,
  writeProjectScope,
} from '../src/project-scope.js';

test('project scope files are normalized and atomically readable', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ah-scope-'));
  const file = path.join(dir, 'nested', 'scope.json');
  await writeProjectScope(file, {
    label: ' demo ',
    groups: ['a', 'a', '', 'b'],
    actions: ['x'],
    excludeGroups: ['c'],
    excludeActions: ['y'],
  });
  const scope = await readProjectScope(file);
  assert.deepEqual(scope, {
    label: 'demo',
    groups: ['a', 'b'],
    actions: ['x'],
    excludeGroups: ['c'],
    excludeActions: ['y'],
    updatedAt: scope.updatedAt,
  });
  await deleteProjectScope(file);
  assert.equal(await readProjectScope(file), null);
  await fs.rm(dir, { recursive: true, force: true });
});

test('project scope files fail closed on malformed JSON', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ah-scope-bad-'));
  const file = path.join(dir, 'scope.json');
  await fs.writeFile(file, '{ bad', 'utf8');
  assert.equal(await readProjectScope(file), null);
  await fs.rm(dir, { recursive: true, force: true });
});

test('pruneProjectScopes removes only unknown direct json files', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ah-scope-prune-'));
  await fs.writeFile(path.join(dir, 'keep.json'), '{}', 'utf8');
  await fs.writeFile(path.join(dir, 'drop.json'), '{}', 'utf8');
  await fs.writeFile(path.join(dir, 'keep.txt'), 'x', 'utf8');
  const removed = await pruneProjectScopes(dir, ['keep']);
  assert.equal(removed, 1);
  assert.deepEqual((await fs.readdir(dir)).sort(), ['keep.json', 'keep.txt']);
  await fs.rm(dir, { recursive: true, force: true });
});

test('normalizeProjectScope accepts absent values', () => {
  assert.deepEqual(normalizeProjectScope({}), {
    label: '',
    groups: [],
    actions: [],
    excludeGroups: [],
    excludeActions: [],
  });
});
