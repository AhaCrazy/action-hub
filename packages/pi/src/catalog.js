/**
 * Harness context → currently available actions.
 *
 * This module is pure: no Pi imports and no terminal rendering.
 */
import {
  actionAvailable,
  expandPrompt,
  profileFor,
  resolveProjectRoot,
  sortActions,
} from 'action-hub';

/**
 * Resolve the action catalog for a Pi working directory.
 *
 * Pi has no workspace registry. We use the nearest registered project root, or
 * the nearest `.git`/cwd fallback supplied by the core.
 */
export async function loadCatalog(store, cwd = process.cwd()) {
  const data = await store.read();
  const root = await resolveProjectRoot(cwd, data.state.projects);
  const profile = profileFor(data.state.projects, root, data.state.defaultGroup ?? '');
  const actions = sortActions(
    data.actions.filter((action) => actionAvailable(action, profile, data.state.groups)),
  );
  return {
    root,
    profile,
    groups: data.state.groups,
    actions,
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
