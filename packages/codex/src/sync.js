/**
 * Codex adapter for Action Hub.
 *
 * Codex discovers Agent Skills from `<repo>/.agents/skills` and
 * `~/.agents/skills`. Action Hub projects the current scope there:
 *   - Skill mode   -> a copy of the SKILL.md directory (implicit invocation on)
 *   - Command mode -> a generated skill with
 *                     `agents/openai.yaml: policy.allow_implicit_invocation: false`
 *                     so it is only invoked explicitly with `$name` or /skills.
 *
 * Project scopes live in `.codex/action-hub/scope.json`; generated paths are
 * tracked so clean/sync never removes user-owned skills.
 */
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  actionAvailable,
  createStore,
  defaultProjectProfile,
  normalizeProjectScope,
  readProjectScope,
  resolveProjectRoot,
  writeProjectScope,
} from 'action-hub';

export const MANIFEST_FORMAT = 'action-hub/codex-generated@1';

export function agentsHome(env = process.env) {
  const configured = env.AGENTS_HOME?.trim();
  return configured !== undefined && configured !== '' ? configured : path.join(os.homedir(), '.agents');
}

export function projectScopePath(projectRoot) {
  return path.join(projectRoot, '.codex', 'action-hub', 'scope.json');
}

export function manifestPath(agentsRoot) {
  return path.join(agentsRoot, 'action-hub', 'generated.json');
}

function skillTarget(agentsRoot, name) {
  return path.join(agentsRoot, 'skills', name);
}

async function exists(target) {
  try {
    await fs.lstat(target);
    return true;
  } catch {
    return false;
  }
}

async function readManifest(agentsRoot) {
  try {
    const raw = JSON.parse(await fs.readFile(manifestPath(agentsRoot), 'utf8'));
    if (raw?.format !== MANIFEST_FORMAT || !Array.isArray(raw.items)) return [];
    return raw.items.filter((item) => typeof item?.name === 'string' && item.name !== '');
  } catch {
    return [];
  }
}

async function writeManifest(agentsRoot, items) {
  const target = manifestPath(agentsRoot);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify({ format: MANIFEST_FORMAT, items }, null, 2)}\n`, 'utf8');
  await fs.rename(temporary, target);
}

async function copyTree(source, target, options = {}) {
  const stat = await fs.lstat(source);
  if (stat.isSymbolicLink()) {
    const resolved = await fs.realpath(source);
    const resolvedStat = await fs.lstat(resolved);
    if (resolvedStat.isDirectory()) {
      await fs.mkdir(target, { recursive: true });
      for (const name of await fs.readdir(resolved)) await copyTree(path.join(resolved, name), path.join(target, name), options);
    } else {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.copyFile(resolved, target);
    }
    return;
  }
  if (stat.isDirectory()) {
    await fs.mkdir(target, { recursive: true });
    for (const name of await fs.readdir(source)) {
      if (options.skipSkillFile === true && name === 'SKILL.md') continue;
      if (options.skipOpenAiFile === true && name === 'openai.yaml') continue;
      await copyTree(path.join(source, name), path.join(target, name), options);
    }
    return;
  }
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
}

function oneLine(value, fallback = '') {
  return String(value ?? fallback)
    .replace(/\r?\n/gu, ' ')
    .replace(/---/gu, '- - -')
    .trim();
}

function commandSkillDocument(action) {
  const description = oneLine(action.description).slice(0, 500);
  const body = String(action.prompt ?? '').trimEnd();
  return `---\nname: ${action.name}\ndescription: ${JSON.stringify(description)}\n---\n\n${body}\n`;
}

function commandMetadata(action) {
  const display = oneLine(action.name);
  const short = oneLine(action.description).slice(0, 120);
  return `interface:\n  display_name: ${JSON.stringify(display)}\n  short_description: ${JSON.stringify(short)}\npolicy:\n  allow_implicit_invocation: false\n`;
}

async function writeGeneratedCommand(action, target) {
  await fs.mkdir(target, { recursive: true });
  if (action.dir !== undefined) {
    await copyTree(action.dir, target, { skipSkillFile: true, skipOpenAiFile: true });
  }
  await fs.mkdir(path.join(target, 'agents'), { recursive: true });
  await fs.writeFile(path.join(target, 'agents', 'openai.yaml'), commandMetadata(action), 'utf8');
  await fs.writeFile(path.join(target, 'SKILL.md'), commandSkillDocument(action), 'utf8');
}

export async function loadCodexActions(store, cwd, options = {}) {
  const global = options.global === true;
  const root = await resolveProjectRoot(cwd, []);
  if (root === null) throw new Error(`无法解析项目根：${cwd}`);
  const { state, actions, invalid } = await store.read();
  const scope = global ? null : await readProjectScope(projectScopePath(root));
  const profile = global
    ? defaultProjectProfile('', 'global', state.defaultGroup ?? '')
    : scope ?? defaultProjectProfile(root, path.basename(root), state.defaultGroup ?? '');
  const available = actions.filter((action) => actionAvailable(action, profile, state.groups));
  const agentsRoot = global ? agentsHome() : path.join(root, '.agents');
  return { root, scope, profile, actions: available, invalid, agentsRoot };
}

export async function syncProject(store, cwd, options = {}) {
  const loaded = await loadCodexActions(store, cwd, options);
  const { agentsRoot, actions } = loaded;
  const previous = await readManifest(agentsRoot);
  const previousNames = new Set(previous.map((item) => item.name));
  const warnings = [];
  const next = [];

  if (options.dryRun !== true) await fs.mkdir(path.join(agentsRoot, 'skills'), { recursive: true });

  for (const action of actions) {
    const kind = action.mode === 'skill' ? 'skill' : 'command';
    const target = skillTarget(agentsRoot, action.name);
    if (await exists(target)) {
      if (!previousNames.has(action.name)) {
        warnings.push(`跳过 ${action.name}：${target} 已存在且不是 Action Hub 生成物`);
        continue;
      }
      if (options.dryRun !== true) await fs.rm(target, { recursive: true, force: true });
    }
    if (options.dryRun === true) {
      next.push({ name: action.name, kind });
      continue;
    }
    try {
      if (kind === 'skill') await copyTree(action.dir, target);
      else await writeGeneratedCommand(action, target);
      next.push({ name: action.name, kind });
    } catch (error) {
      warnings.push(`写入 ${action.name} 失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const nextNames = new Set(next.map((item) => item.name));
  let removed = 0;
  if (options.dryRun !== true) {
    for (const item of previous) {
      if (nextNames.has(item.name)) continue;
      await fs.rm(skillTarget(agentsRoot, item.name), { recursive: true, force: true })
        .then(() => { removed += 1; })
        .catch(() => {});
    }
    await writeManifest(agentsRoot, next);
  }

  return {
    ...loaded,
    added: next.length,
    removed,
    warnings,
    dryRun: options.dryRun === true,
    items: next,
  };
}

export async function cleanProject(cwd, options = {}) {
  const global = options.global === true;
  const root = await resolveProjectRoot(cwd, []);
  if (root === null) throw new Error(`无法解析项目根：${cwd}`);
  const agentsRoot = global ? agentsHome() : path.join(root, '.agents');
  const previous = await readManifest(agentsRoot);
  let removed = 0;
  for (const item of previous) {
    await fs.rm(skillTarget(agentsRoot, item.name), { recursive: true, force: true })
      .then(() => { removed += 1; })
      .catch(() => {});
  }
  await fs.rm(manifestPath(agentsRoot), { force: true });
  return { agentsRoot, removed };
}

export async function status(cwd, options = {}) {
  const store = options.store ?? createStore({ dataDir: options.dataDir });
  const loaded = await loadCodexActions(store, cwd, options);
  const manifest = await readManifest(loaded.agentsRoot);
  return { ...loaded, generated: manifest.length, items: manifest };
}

export async function writeScopeFromNames(store, cwd, options = {}) {
  const root = await resolveProjectRoot(cwd, []);
  if (root === null) throw new Error(`无法解析项目根：${cwd}`);
  const { state, actions } = await store.read();
  const groupMap = new Map();
  for (const group of state.groups) {
    groupMap.set(group.id, group.id);
    groupMap.set(group.name, group.id);
  }
  const actionNames = new Set(actions.map((action) => action.name));
  const resolveGroup = (name) => {
    const id = groupMap.get(name);
    if (id === undefined) throw new Error(`未知分组：${name}`);
    return id;
  };
  const resolveAction = (name) => {
    if (!actionNames.has(name)) throw new Error(`未知 Action：${name}`);
    return name;
  };
  const list = (value) => (Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []);
  const profile = normalizeProjectScope({
    label: options.label ?? path.basename(root),
    groups: list(options.groups).map(resolveGroup),
    actions: list(options.actions).map(resolveAction),
    excludeGroups: list(options.excludeGroups).map(resolveGroup),
    excludeActions: list(options.excludeActions).map(resolveAction),
  });
  await writeProjectScope(projectScopePath(root), profile);
  return { root, profile };
}

export function createCodexStore(options = {}) {
  return createStore({ dataDir: options.dataDir });
}
