/**
 * Harness context → currently available actions.
 *
 * This module is pure: no Pi imports and no terminal rendering.
 */
import {
  actionAvailable,
  defaultProjectProfile,
  expandPrompt,
  resolveProjectRoot,
  sortActions,
} from 'action-hub';

import { loadBuiltinActions } from './builtins.js';

function decorateBuiltin(action, entry) {
  return {
    ...action,
    mode: 'command',
    pinned: entry?.pinned === true,
    usage: entry?.usage ?? { count: 0, lastAt: 0 },
    groups: entry?.groups ?? [],
  };
}

/** Load user actions and read-only built-ins, preserving their saved metadata. */
export async function loadAllActions(store) {
  const builtins = await loadBuiltinActions();
  const data = await store.read({ keep: builtins.map((action) => action.name), prune: true });
  const builtinIds = new Set(builtins.map((action) => action.name));
  return {
    data,
    actions: sortActions([
      ...data.actions.filter((action) => !builtinIds.has(action.name)),
      ...builtins.map((action) => decorateBuiltin(action, data.state.entries[action.name])),
    ]),
  };
}

/**
 * Resolve the action catalog for a Pi working directory.
 *
 * Project availability is scoped to the Pi workdir directory, not the shared
 * library. Callers pass the Pi scope store.
 */
export async function loadCatalog(store, cwd = process.cwd(), scopeStore) {
  const { data, actions } = await loadAllActions(store);
  const root = await resolveProjectRoot(cwd, []);
  const scope = scopeStore === undefined ? null : await scopeStore.readForRoot(root ?? '');
  const profile = scope ?? defaultProjectProfile(root ?? '', '', data.state.defaultGroup ?? '');
  return {
    root,
    profile,
    groups: data.state.groups,
    actions: sortActions(actions.filter((action) => actionAvailable(action, profile, data.state.groups))),
  };
}

/** Render the text Pi should receive for the selected Action. */
export function renderAction(action, args = '') {
  if (action === null || typeof action !== 'object') return '';
  const trimmed = typeof args === 'string' ? args.trim() : '';
  if (action.mode === 'skill') {
    return trimmed === '' ? `/skill:${action.name}` : `/skill:${action.name} ${trimmed}`;
  }
  return expandPrompt(action.prompt ?? '', { args: trimmed });
}

/** Human-readable group labels for a palette row. */
export function groupLabels(action, groups = []) {
  const byId = new Map(groups.map((group) => [group.id, group.name]));
  return (action.groups ?? []).map((id) => byId.get(id) ?? id).filter(Boolean);
}
