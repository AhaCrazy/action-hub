/**
 * OMP native skill projection.
 *
 * OMP exposes the Pi-compatible `resources_discover` event in its type surface,
 * but 18.1.x never emits it for the main session. Its native skill discovery
 * does scan `<project>/.omp/skills`, so Skill-mode Actions are copied there.
 * The copy is a generated view; the Action library remains the source of truth.
 */
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createPiProjectScopeStore } from './project-scopes.js';

export const OMP_MANIFEST_FORMAT = 'action-hub/omp-native@1';

export function ompAgentDir(env = process.env) {
  const configured = env.PI_CODING_AGENT_DIR?.trim();
  if (configured !== undefined && configured !== '') return configured;
  const profile = env.OMP_PROFILE?.trim();
  if (profile !== undefined && profile !== '') return path.join(os.homedir(), '.omp', 'profiles', profile, 'agent');
  return path.join(os.homedir(), '.omp', 'agent');
}

export function createOmpScopeStore(env = process.env) {
  const configured = env.PI_CODING_AGENT_SESSION_DIR?.trim();
  const sessionsDir = configured !== undefined && configured !== ''
    ? configured
    : path.join(ompAgentDir(env), 'sessions');
  return createPiProjectScopeStore({ sessionsDir });
}

export function isOmpRuntime(env = process.env) {
  return env.ACTION_HUB_OMP_NATIVE === '1'
    || process.versions.bun !== undefined
    || env.PI_BUNDLED === 'true';
}

function manifestPath(root) {
  return path.join(root, '.omp', 'action-hub', 'generated.json');
}

function skillsDir(root) {
  return path.join(root, '.omp', 'skills');
}

async function exists(target) {
  try {
    await fs.lstat(target);
    return true;
  } catch {
    return false;
  }
}

async function readManifest(root) {
  try {
    const raw = JSON.parse(await fs.readFile(manifestPath(root), 'utf8'));
    if (raw?.format !== OMP_MANIFEST_FORMAT || !Array.isArray(raw.items)) return [];
    return raw.items.filter((item) => typeof item?.name === 'string' && item.name !== '');
  } catch {
    return [];
  }
}

async function writeManifest(root, items) {
  const target = manifestPath(root);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify({ format: OMP_MANIFEST_FORMAT, items }, null, 2)}\n`, 'utf8');
  await fs.rename(temporary, target);
}

async function copyTree(source, target) {
  const stat = await fs.lstat(source);
  if (stat.isDirectory()) {
    await fs.mkdir(target, { recursive: true });
    for (const name of await fs.readdir(source)) await copyTree(path.join(source, name), path.join(target, name));
    return;
  }
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
}

/**
 * Materialize Skill-mode Actions into `<project>/.omp/skills`.
 * Returns the project root and counts; never throws for an individual skill
 * collision, so one bad name cannot hide the rest of the library.
 */
export async function syncOmpNativeSkills(store, scopeStore, cwd = process.cwd()) {
  const { loadCatalog } = await import('./catalog.js');
  const catalog = await loadCatalog(store, cwd, scopeStore);
  const root = catalog.root;
  if (typeof root !== 'string' || root === '') {
    return { root: null, added: 0, removed: 0, warnings: ['无法解析项目根'] };
  }

  const targetDir = skillsDir(root);
  const previous = await readManifest(root);
  const previousNames = new Set(previous.map((item) => item.name));
  const desired = catalog.actions
    .filter((action) => action.mode === 'skill')
    .map((action) => ({ name: action.name, source: action.dir }));
  const desiredNames = new Set(desired.map((item) => item.name));
  const warnings = [];
  const written = [];

  await fs.mkdir(targetDir, { recursive: true });
  for (const item of desired) {
    const target = path.join(targetDir, item.name);
    if (await exists(target)) {
      if (!previousNames.has(item.name)) {
        warnings.push(`跳过 ${item.name}：${target} 已存在且不是 Action Hub 生成物`);
        continue;
      }
      await fs.rm(target, { recursive: true, force: true });
    }
    try {
      await copyTree(item.source, target);
      written.push({ name: item.name });
    } catch (error) {
      warnings.push(`写入 ${item.name} 失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  let removed = 0;
  for (const item of previous) {
    if (desiredNames.has(item.name)) continue;
    await fs.rm(path.join(targetDir, item.name), { recursive: true, force: true })
      .then(() => { removed += 1; })
      .catch(() => {});
  }
  await writeManifest(root, written);

  return { root, added: written.length, removed, warnings };
}
