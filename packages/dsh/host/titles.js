/**
 * Session titles that name the Action instead of its opaque `/ah-…` handle.
 *
 * DSH titles a Session from the first eligible human message (`user/message`
 * with `source.kind === 'user'`). An Action reference is stored as `/ah-<hash>`
 * and its body arrives as a separate `source.kind: 'action'` message that the
 * title service ignores, so both the deterministic fallback and the LLM title
 * only ever see the hash. This module listens for those title events and
 * rewrites the handle to the current Action name through
 * `ctx.sessionTitle.rename`, which pins the title (source `user`) and therefore
 * also supersedes an in-flight automatic generation.
 *
 * Marker-only first messages are titled immediately (there is nothing for the
 * model to summarize). Messages that carry other text keep the model's title
 * when it arrives; a fallback title is rewritten on a timer if the model does
 * not replace it.
 *
 * @module dsh-action-hub/host/titles
 */
import { planActionRefs } from './refs.js';
import { readAll } from './state.js';

/** How long a mixed message waits for the model title before its fallback is rewritten. */
export const PROVIDER_WAIT_MS = 10_000;

// A handle reaches a title in one of two spellings: the message form `/ah-…`
// and the bare `ah-…` the model often writes ("Command ah-… Request"). Each
// keeps the same boundary as the message scanner: text start or a non-ASCII
// word character. The bare form additionally rejects a preceding slash, so a
// path segment never turns into an Action name.
const SLASHED_MARKER = /(^|[^A-Za-z0-9_])\/(ah-[0-9a-f]{10})(?![0-9a-f])/gu;
const BARE_MARKER = /(^|[^A-Za-z0-9_/])(ah-[0-9a-f]{10})(?![0-9a-f])/gu;
const SLASHED_MARKER_TEST = /(^|[^A-Za-z0-9_])\/(ah-[0-9a-f]{10})(?![0-9a-f])/u;
const BARE_MARKER_TEST = /(^|[^A-Za-z0-9_/])(ah-[0-9a-f]{10})(?![0-9a-f])/u;

/** Whether the text carries at least one Action handle. */
function hasMarker(text) {
  return SLASHED_MARKER_TEST.test(text) || BARE_MARKER_TEST.test(text);
}

/**
 * Replace every known Action handle with its Action name.
 *
 * @param {string} title - the title text the session title service produced.
 * @param {ReadonlyMap<string, string>} handles - handle → Action name.
 * @returns {string | undefined} the rewritten title, or `undefined` when the
 *   title carries no known handle (and must stay untouched).
 */
export function resolveTitleHandles(title, handles) {
  if (typeof title !== 'string' || title === '') return undefined;
  let changed = false;
  const swap = (match, prefix, handle) => {
    const name = handles.get(handle);
    if (name === undefined) return match;
    changed = true;
    return `${prefix}${name}`;
  };
  const resolved = title.replace(SLASHED_MARKER, swap).replace(BARE_MARKER, swap);
  if (!changed) return undefined;
  const compact = resolved.replace(/\s+/gu, ' ').trim();
  return compact === '' ? undefined : compact;
}

/**
 * Whether a user message carries nothing but Action handles (and spacing), so
 * its title can be decided without a model round-trip.
 *
 * @param {string} text
 * @returns {boolean}
 */
export function isMarkerOnlyText(text) {
  if (typeof text !== 'string' || !hasMarker(text)) return false;
  const rest = text
    .replace(SLASHED_MARKER, (match, prefix) => prefix)
    .replace(BARE_MARKER, (match, prefix) => prefix)
    .replace(/\s+/gu, ' ')
    .trim();
  return rest === '';
}

/** First eligible human text of a Session, matching the title service's own filter. */
function firstUserText(session) {
  let events;
  try {
    events = session?.snapshotEvents?.();
  } catch {
    return '';
  }
  for (const event of Array.isArray(events) ? events : []) {
    if (event?.type !== 'user/message' || event.data?.source?.kind !== 'user') continue;
    const content = Array.isArray(event.data.content) ? event.data.content : [];
    const text = content
      .filter((block) => block?.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text)
      .join('\n');
    if (text.trim() !== '') return text;
  }
  return '';
}

function describe(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Watch `session/title` events and rewrite Action handles to Action names.
 *
 * @param {object} ctx - Host plugin context exposing `sessionTitle`.
 * @param {object} store - Action store used to resolve current handles.
 * @param {{
 *   readActions?: () => Promise<object[]>,
 *   setTimer?: (run: () => void, delayMs: number) => unknown,
 *   clearTimer?: (timer: unknown) => void,
 *   warn?: (message: string) => void,
 *   waitMs?: number,
 * }} [options]
 * @returns {() => void} teardown for tests and explicit disposal.
 */
export function installSessionTitles(ctx, store, options = {}) {
  const sessionTitle = ctx?.sessionTitle
    ?? (typeof ctx?.get === 'function' ? ctx.get('sessionTitle') : undefined);
  if (sessionTitle === undefined || typeof sessionTitle.rename !== 'function') return () => {};
  const readActions = options.readActions ?? (async () => (await readAll(store)).actions);
  const setTimer = options.setTimer ?? ((run, delayMs) => setTimeout(run, delayMs));
  const clearTimer = options.clearTimer ?? ((timer) => clearTimeout(timer));
  const waitMs = Number.isFinite(options.waitMs) && options.waitMs > 0 ? options.waitMs : PROVIDER_WAIT_MS;
  const warn = options.warn ?? ((message) => ctx.logger?.warn?.(message));
  const pending = new Map();
  let stopped = false;

  const clearPending = (sessionId) => {
    const held = pending.get(sessionId);
    if (held === undefined) return;
    clearTimer(held.timer);
    pending.delete(sessionId);
  };

  const rename = (session, title) => {
    try {
      sessionTitle.rename(session, title);
    } catch (error) {
      warn(`dsh-action-hub: could not title session ${session?.id}: ${describe(error)}`);
    }
  };

  const handlesOf = async () => {
    try {
      const actions = await readActions();
      return new Map(planActionRefs(actions).entries.map((entry) => [entry.name, entry.action.name]));
    } catch (error) {
      warn(`dsh-action-hub: could not read Actions for title: ${describe(error)}`);
      return new Map();
    }
  };

  const scheduleFallback = (session, title, resolved) => {
    const sessionId = session.id;
    clearPending(sessionId);
    const timer = setTimer(() => {
      pending.delete(sessionId);
      if (stopped) return;
      let current;
      try {
        current = sessionTitle.get?.(session);
      } catch {
        current = undefined;
      }
      // A manual rename or a provider title replaced the fallback meanwhile.
      if (current !== undefined && current.title !== title) return;
      if (current !== undefined && current.source?.kind === 'user') return;
      rename(session, resolved);
    }, waitMs);
    pending.set(sessionId, { timer, title });
  };

  const onTitle = async (session, event) => {
    if (stopped) return;
    const sessionId = session?.id;
    const title = event?.data?.title;
    const source = event?.data?.source?.kind;
    if (typeof sessionId !== 'string' || typeof title !== 'string' || title === '') return;
    if (source === 'user') {
      clearPending(sessionId);
      return;
    }
    if (source !== 'fallback' && source !== 'provider') return;
    const handles = await handlesOf();
    if (stopped) return;
    const resolved = resolveTitleHandles(title, handles);
    if (source === 'provider') {
      clearPending(sessionId);
      if (resolved !== undefined) rename(session, resolved);
      return;
    }
    if (resolved === undefined) return;
    if (isMarkerOnlyText(firstUserText(session))) {
      clearPending(sessionId);
      rename(session, resolved);
      return;
    }
    scheduleFallback(session, title, resolved);
  };

  const onSessionEvent = (session, event) => {
    if (stopped || event?.type !== 'session/title') return;
    void onTitle(session, event).catch((error) => {
      warn(`dsh-action-hub: session title rewrite failed: ${describe(error)}`);
    });
  };

  const onDisposed = (session) => {
    const sessionId = session?.id;
    if (typeof sessionId === 'string') clearPending(sessionId);
  };

  const offEvent = typeof ctx?.on === 'function' ? ctx.on('session/event', onSessionEvent) : undefined;
  const offDisposed = typeof ctx?.on === 'function' ? ctx.on('session/disposed', onDisposed) : undefined;
  const dispose = () => {
    stopped = true;
    for (const held of pending.values()) clearTimer(held.timer);
    pending.clear();
    offEvent?.();
    offDisposed?.();
  };
  if (typeof ctx?.effect === 'function') ctx.effect(() => dispose, 'action-hub: session titles');
  return dispose;
}
