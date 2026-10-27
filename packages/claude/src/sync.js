/**
 * Claude Code adapter for Action Hub.
 *
 * Claude Code has no custom TUI extension API. The adapter materializes the
 * current Action Hub project scope into native Claude Code components:
 *   - Skill mode  -> .claude/skills/<name>/ (copied directory)
 *   - Command mode -> .claude/commands/ah/<name>.md (/ah:<name>)
 *
 * Generated paths are tracked so clean/sync never removes user-owned skills or
 * commands. Project scopes live in .claude/action-hub/scope.json.
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

export const MANIFEST_FORMAT = 'action-hub/claude-generated@1';
export const SCOPE_FORMAT = 'action-hub/project-scope@1';

export function claudeHome(env = process.env) {
  const configured = env.CLAUDE_CONFIG_DIR?.trim();
  return configured !== undefined && configured !== '' ? configured : path.join(os.homedir(), '.claude');
}

export function projectScopePath(projectRoot) {
  return path.join(projectRoot, '.claude', 'action-hub', 'scope.json');
}

export function manifestPath(claudeRoot) {
  return path.join(claudeRoot, 'action-hub', 'generated.json');
}

function commandTarget(claudeRoot, name) {
  return path.join(claudeRoot, 'commands', 'ah', `${name}.md`);
}

function skillTarget(claudeRoot, name) {
  return path.join(claudeRoot, 'skills', name);
}

function isInside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

async function exists(target) {
  try {
    await fs.lstat(target);
    return true;
  } catch {
    return false;
  }
}

async function readManifest(claudeRoot) {
  try {
    const raw = JSON.parse(await fs.readFile(manifestPath(claudeRoot), 'utf8'));
    if (raw?.format !== MANIFEST_FORMAT || !Array.isArray(raw.items)) return { items: [] };
    return { items: raw.items.filter((item) => typeof item?.target === 'string' && isInside(claudeRoot, item.target)) };
  } catch {
    return { items: [] };
  }
}

async function writeManifest(claudeRoot, items) {
  const target = manifestPath(claudeRoot);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify({ format: MANIFEST_FORMAT, generatedAt: new Date().toISOString(), items }, null, 2)}\n`, 'utf8');
  await fs.rename(temporary, target);
}

async function removeTarget(target) {
  await fs.rm(target, { recursive: true, force: true });
}

async function copyTree(source, target) {
  const stat = await fs.lstat(source);
  if (stat.isSymbolicLink()) {
    const resolved = await fs.realpath(source);
    const resolvedStat = await fs.lstat(resolved);
    if (resolvedStat.isDirectory()) {
      await fs.mkdir(target, { recursive: true });
      for (const name of await fs.readdir(resolved)) await copyTree(path.join(resolved, name), path.join(target, name));
    } else {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.copyFile(resolved, target);
    }
    return;
  }
  if (stat.isDirectory()) {
    await fs.mkdir(target, { recursive: true });
    for (const name of await fs.readdir(source)) await copyTree(path.join(source, name), path.join(target, name));
    return;
  }
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
}

function commandDocument(action) {
  const description = String(action.description ?? '')
    .replace(/\r?\n/gu, ' ')
    .replace(/---/gu, '- - -')
    .trim()
    .slice(0, 500);
  const hint = typeof action.argsHint === 'string' && action.argsHint.trim() !== ''
    ? action.argsHint.trim()
    : '$ARGUMENTS';
  let body = String(action.prompt ?? '').replace(/\{\{args\}\}|\{\{ARGS\}\}|\{\{input\}\}/gu, '$ARGUMENTS');
  if (!body.includes('$ARGUMENTS')) body = `${body.trimEnd()}\n\n$ARGUMENTS`;
  if (Array.isArray(action.resources) && action.resources.length > 0) {
    body = `${body.trimEnd()}\n\n## 资源\n\nAction 目录：${action.dir}`;
  }
  return `---\ndescription: ${JSON.stringify(description)}\nargument-hint: ${JSON.stringify(hint)}\n---\n\n${body.trimEnd()}\n`;
}

export async function loadClaudeActions(store, cwd, options = {}) {
  const global = options.global === true;
  const root = await resolveProjectRoot(cwd, []);
  if (root === null) throw new Error(`无法解析项目根：${cwd}`);
  const { state, actions, invalid } = await store.read();
  const scope = global ? null : await readProjectScope(projectScopePath(root));
  const profile = global
    ? defaultProjectProfile('', 'global', state.defaultGroup ?? '')
    : scope ?? defaultProjectProfile(root, path.basename(root), state.defaultGroup ?? '');
  const available = actions.filter((action) => actionAvailable(action, profile, state.groups));
  return { root, scope, profile, actions: available, invalid, claudeRoot: global ? claudeHome() : path.join(root, '.claude') };
}

export async function syncProject(store, cwd, options = {}) {
  const loaded = await loadClaudeActions(store, cwd, options);
  const { claudeRoot, actions } = loaded;
  if (options.dryRun === true) {
    return {
      ...loaded,
      added: actions.length,
      removed: 0,
      warnings: [],
      dryRun: true,
      items: actions.map((action) => ({
        id: action.id,
        kind: action.mode === 'skill' ? 'skill' : 'command',
        target: action.mode === 'skill' ? skillTarget(claudeRoot, action.name) : commandTarget(claudeRoot, action.name),
      })),
    };
  }

  const previous = await readManifest(claudeRoot);
  const previousByTarget = new Map(previous.items.map((item) => [path.resolve(item.target), item]));
  const warnings = [];
  const next = [];

  for (const action of actions) {
    const kind = action.mode === 'skill' ? 'skill' : 'command';
    const target = kind === 'skill' ? skillTarget(claudeRoot, action.name) : commandTarget(claudeRoot, action.name);
    const previousItem = previousByTarget.get(path.resolve(target));
    if (await exists(target)) {
      if (previousItem === undefined) {
        warnings.push(`跳过 ${action.name}：${target} 已存在且不是 Action Hub 生成物`);
        continue;
      }
      await removeTarget(target);
    }
    try {
      if (kind === 'skill') {
        await copyTree(action.dir, target);
      } else {
        await fs.mkdir(path.dirname(target), { recursive: true });
        const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
        await fs.writeFile(temporary, commandDocument(action), 'utf8');
        await fs.rename(temporary, target);
      }
      next.push({ id: action.id, kind, target });
    } catch (error) {
      warnings.push(`写入 ${action.name} 失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const nextTargets = new Set(next.map((item) => path.resolve(item.target)));
  let removed = 0;
  for (const item of previous.items) {
    if (nextTargets.has(path.resolve(item.target))) continue;
    await removeTarget(item.target).then(() => { removed += 1; }).catch(() => {});
  }
  await writeManifest(claudeRoot, next);

  return {
    ...loaded,
    added: next.length,
    removed,
    warnings,
    dryRun: false,
    items: next,
  };
}

export async function cleanProject(cwd, options = {}) {
  const global = options.global === true;
  const root = await resolveProjectRoot(cwd, []);
  if (root === null) throw new Error(`无法解析项目根：${cwd}`);
  const claudeRoot = global ? claudeHome() : path.join(root, '.claude');
  const previous = await readManifest(claudeRoot);
  let removed = 0;
  for (const item of previous.items) {
    await removeTarget(item.target).then(() => { removed += 1; }).catch(() => {});
  }
  await fs.rm(manifestPath(claudeRoot), { force: true });
  return { claudeRoot, removed };
}

export async function status(cwd, options = {}) {
  const store = options.store ?? createStore({ dataDir: options.dataDir });
  const loaded = await loadClaudeActions(store, cwd, options);
  const manifest = await readManifest(loaded.claudeRoot);
  return { ...loaded, generated: manifest.items.length, items: manifest.items };
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

export function createClaudeStore(options = {}) {
  return createStore({ dataDir: options.dataDir });
}
