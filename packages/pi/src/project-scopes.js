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
  return configured !== undefined && configured !== '' ? configured : path.join(os.homedir(), '.pi', 'agent');
}

export function piWorkdirKey(projectRoot) {
  return `--${String(projectRoot).replace(/^[/\\]/u, '').replace(/[/\\:]/gu, '-')}--`;
}

export function createPiProjectScopeStore() {
  const configuredSessions = process.env.PI_CODING_AGENT_SESSION_DIR?.trim();
  const sessionsDir = configuredSessions !== undefined && configuredSessions !== ''
    ? configuredSessions
    : path.join(piAgentDir(), 'sessions');
  const fileForRoot = (projectRoot) => path.join(sessionsDir, piWorkdirKey(projectRoot), 'action-hub', 'scope.json');

  return {
    sessionsDir,
    fileForRoot,
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
