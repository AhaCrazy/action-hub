/**
 * Pi adapter read-only built-ins.
 *
 * Built-ins are standard Skill directories shipped inside the package. They are
 * always Commands and are never written into the user's library.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_GROUP_ID, readSkillDir } from 'action-hub';

const DEFAULT_ROOT = fileURLToPath(new URL('../builtin-actions/', import.meta.url));
const DEFAULT_BUILTIN = 'skill-import-assistant';
const cache = new Map();

export function defaultBuiltinRoot() {
  return DEFAULT_ROOT;
}

export async function loadBuiltinActions(root = DEFAULT_ROOT) {
  if (cache.has(root)) return cache.get(root);
  const actions = [];
  let entries = [];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    cache.set(root, actions);
    return actions;
  }
  const seen = new Set();
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const dir = path.join(root, entry.name);
    const skill = await readSkillDir(dir);
    if (skill.error !== '' || seen.has(skill.name)) continue;
    seen.add(skill.name);
    actions.push({
      id: skill.name,
      name: skill.name,
      skillName: skill.name,
      description: skill.description,
      prompt: skill.body,
      category: '内置',
      tags: [],
      argsHint: '',
      pinned: false,
      usage: { count: 0, lastAt: 0 },
      mode: 'command',
      groups: [],
      resources: skill.files.map((name) => ({ name, bytes: 0 })),
      frontmatter: skill.frontmatter,
      builtin: true,
      dir,
      fingerprint: skill.fingerprint,
    });
  }
  actions.sort((left, right) => left.name.localeCompare(right.name));
  cache.set(root, actions);
  return actions;
}

export function clearBuiltinCache() {
  cache.clear();
}

/**
 * Seed the built-in import assistant into Common on a fresh library, matching
 * the DSH adapter. Existing libraries are never rewritten automatically.
 */
export async function seedDefaultBuiltin(store) {
  const state = await store.readState();
  const names = Object.keys(state.entries ?? {});
  if (names.length !== 0) return false;
  if (state.groups.length !== 1 || state.groups[0].id !== DEFAULT_GROUP_ID) return false;
  await store.setGroupActions(DEFAULT_GROUP_ID, [DEFAULT_BUILTIN], [DEFAULT_BUILTIN]);
  return true;
}
