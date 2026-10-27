/**
 * Harness-local project scope storage.
 *
 * Project scopes are owned by a harness (DSH workspace, Pi workdir). The core
 * only defines the file schema, normalization, and atomic read/write helpers;
 * each adapter decides where a scope belongs and how it follows the host's
 * workspace lifecycle.
 *
 * Shared state (actions, groups, global groups) remains in state.json.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const PROJECT_SCOPE_FORMAT = 'action-hub/project-scope@1';

function normalizeIds(value) {
  const seen = new Set();
  const out = [];
  for (const item of Array.isArray(value) ? value : []) {
    if (typeof item !== 'string') continue;
    const id = item.trim();
    if (id === '' || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function normalizeProjectScope(input = {}) {
  return {
    label: typeof input.label === 'string' ? input.label.trim() : '',
    groups: normalizeIds(input.groups),
    actions: normalizeIds(input.actions),
    excludeGroups: normalizeIds(input.excludeGroups),
    excludeActions: normalizeIds(input.excludeActions),
  };
}

export async function readProjectScope(file) {
  let raw;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch {
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== 'object') return null;
  const scope = normalizeProjectScope(parsed);
  if (typeof parsed.updatedAt === 'number') scope.updatedAt = parsed.updatedAt;
  return scope;
}

export async function writeProjectScope(file, profile = {}) {
  const scope = {
    format: PROJECT_SCOPE_FORMAT,
    ...normalizeProjectScope(profile),
    updatedAt: Date.now(),
  };
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(temporary, `${JSON.stringify(scope, null, 2)}\n`, 'utf8');
  await fs.rename(temporary, file);
  return scope;
}

export async function deleteProjectScope(file) {
  await fs.rm(file, { force: true });
}

/**
 * Remove scope files whose key is no longer known by the harness.
 * Only direct `.json` children of `dir` are considered.
 */
export async function pruneProjectScopes(dir, validKeys) {
  const keep = new Set((Array.isArray(validKeys) ? validKeys : []).map((key) => String(key)));
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  let removed = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const key = entry.name.slice(0, -'.json'.length);
    if (keep.has(key)) continue;
    await fs.rm(path.join(dir, entry.name), { force: true }).catch(() => {});
    removed += 1;
  }
  return removed;
}
