/**
 * Pi-owned project scopes.
 *
 * Pi has no workspace registry. Its per-workdir state lives under
 * `agent/sessions/<encoded-cwd>`, so the scope lives inside that same workdir
 * directory. When Pi removes that session directory, the scope goes with it.
 *
 * Shared actions/groups remain in the Action Hub state directory.
 */
import os from 'node:os';
import path from 'node:path';

import {
  defaultProjectProfile,
  deleteProjectScope,
  readProjectScope,
  resolveProjectRoot,
  writeProjectScope,
} from 'action-hub';

export function piAgentDir() {
  const configured = process.env.PI_CODING_AGENT_DIR?.trim();
  if (configured !== undefined && configured !== '') return configured;
  const configDir = process.env.PI_CONFIG_DIR?.trim();
  if (configDir !== undefined && configDir !== '') return path.join(os.homedir(), configDir, 'agent');
  return path.join(os.homedir(), '.pi', 'agent');
}

export function piWorkdirKey(projectRoot) {
  return `--${String(projectRoot).replace(/^[/\\]/u, '').replace(/[/\\:]/gu, '-')}--`;
}

export function createPiProjectScopeStore(options = {}) {
  const configuredSessions = process.env.PI_CODING_AGENT_SESSION_DIR?.trim();
  let sessionsDir = options.sessionsDir
    ?? (configuredSessions !== undefined && configuredSessions !== '' ? configuredSessions : path.join(piAgentDir(), 'sessions'));
  const fileForRoot = (projectRoot) => path.join(sessionsDir, piWorkdirKey(projectRoot), 'action-hub', 'scope.json');

  return {
    get sessionsDir() {
      return sessionsDir;
    },
    fileForRoot,
    configure(ctx) {
      const actual = ctx?.sessionManager?.getSessionDir?.();
      if (typeof actual === 'string' && actual.trim() !== '') sessionsDir = actual;
    },
    async readForRoot(projectRoot) {
      if (typeof projectRoot !== 'string' || projectRoot === '') return null;
      return readProjectScope(fileForRoot(projectRoot));
    },
    async writeForRoot(projectRoot, profile) {
      if (typeof projectRoot !== 'string' || projectRoot === '') throw new Error('projectRoot 不能为空');
      return writeProjectScope(fileForRoot(projectRoot), profile);
    },
    async deleteForRoot(projectRoot) {
      if (typeof projectRoot !== 'string' || projectRoot === '') return;
      await deleteProjectScope(fileForRoot(projectRoot));
    },
    async profileForCwd(cwd, defaultGroup = '') {
      const root = await resolveProjectRoot(cwd, []);
      const scope = await this.readForRoot(root ?? '');
      return {
        root,
        profile: scope ?? defaultProjectProfile(root ?? '', path.basename(root ?? ''), defaultGroup),
      };
    },
  };
}
