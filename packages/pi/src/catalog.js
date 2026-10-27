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

/**
 * Resolve the action catalog for a Pi working directory.
 *
 * Project availability is scoped to the Pi workdir directory, not the shared
 * library. Callers pass the Pi scope store.
 */
export async function loadCatalog(store, cwd = process.cwd(), scopeStore) {
  const data = await store.read();
  const root = await resolveProjectRoot(cwd, []);
  const scope = scopeStore === undefined ? null : await scopeStore.readForRoot(root ?? '');
  const profile = scope ?? defaultProjectProfile(root ?? '', '', data.state.defaultGroup ?? '');
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
