/**
 * DSH-owned project scopes.
 *
 * Project availability belongs to a DSH workspace, not to the shared Action
 * library. Scope files live beside the harness home and are keyed by the stable
 * workspace id, so renaming a workspace keeps its scope while deleting it can
 * be reconciled and cleaned up.
 *
 * @module dsh-action-hub/host/project-scopes
 */
import os from 'node:os';
import path from 'node:path';

import {
  canonicalPath,
  defaultProjectProfile,
  deleteProjectScope,
  pruneProjectScopes,
  readProjectScope,
  resolveProjectRoot,
  writeProjectScope,
} from 'action-hub';

import { listProjects } from './projects.js';

export function dshHome() {
  const configured = process.env.DSH_HOME?.trim();
  return configured !== undefined && configured !== '' ? configured : path.join(os.homedir(), '.dsh');
}

function safeKey(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]/gu, '-');
}

export function createDshProjectScopeStore() {
  const root = path.join(dshHome(), 'action-hub', 'workspaces');
  const fileFor = (workspaceId) => path.join(root, `${safeKey(workspaceId)}.json`);

  return {
    root,
    fileFor,
    async read(workspaceId) {
      if (typeof workspaceId !== 'string' || workspaceId === '') return null;
      return readProjectScope(fileFor(workspaceId));
    },
    async write(workspaceId, profile) {
      if (typeof workspaceId !== 'string' || workspaceId === '') throw new Error('workspaceId 不能为空');
      return writeProjectScope(fileFor(workspaceId), profile);
    },
    async delete(workspaceId) {
      if (typeof workspaceId !== 'string' || workspaceId === '') return;
      await deleteProjectScope(fileFor(workspaceId));
    },
    async listProfiles(projects) {
      const out = [];
      for (const project of Array.isArray(projects) ? projects : []) {
        if (project === null || typeof project !== 'object' || typeof project.id !== 'string') continue;
        const scope = await this.read(project.id);
        if (scope === null) continue;
        out.push({
          ...scope,
          id: project.id,
          label: project.label,
          path: project.path,
        });
      }
      return out;
    },
    async prune(projects) {
      const list = Array.isArray(projects) ? projects : [];
      // An empty list can mean the workspace service is not available. Do not
      // treat that as "all workspaces were deleted".
      if (list.length === 0) return 0;
      const ids = list
        .map((project) => project?.id)
        .filter((id) => typeof id === 'string' && id !== '');
      return pruneProjectScopes(root, ids);
    },
    async profileForCwd(ctx, cwd, defaultGroup = '') {
      const projects = await listProjects(ctx);
      const rootPath = await resolveProjectRoot(cwd, projects);
      const project = projects.find((entry) => canonicalPath(entry.path) === canonicalPath(rootPath ?? ''));
      const scope = project === undefined ? null : await this.read(project.id);
      return {
        project: project ?? null,
        root: rootPath,
        profile: scope ?? defaultProjectProfile(rootPath ?? '', project?.label ?? '', defaultGroup),
      };
    },
  };
}

/**
 * One-time migration: move old shared state.projects into workspace-id files.
 * Old data is cleared only after a successful write for at least one workspace.
 */
export async function migrateLegacyProjects(ctx, store, scopeStore) {
  const state = await store.readState();
  const legacy = Array.isArray(state.projects) ? state.projects : [];
  if (legacy.length === 0) return 0;
  const projects = await listProjects(ctx);
  let migrated = 0;
  let matched = 0;
  for (const entry of legacy) {
    if (entry === null || typeof entry !== 'object' || typeof entry.path !== 'string') continue;
    const project = projects.find((item) => canonicalPath(item.path) === canonicalPath(entry.path));
    if (project === undefined) continue;
    matched += 1;
    const existing = await scopeStore.read(project.id);
    if (existing === null) {
      await scopeStore.write(project.id, entry);
      migrated += 1;
    }
  }
  // Keep unmatched legacy entries so a temporarily missing workspace can still
  // migrate later instead of silently losing its scope.
  if (matched === legacy.length) await store.clearProjects();
  return migrated;
}
