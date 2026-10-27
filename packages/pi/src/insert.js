import { expandPrompt } from 'action-hub';

/**
 * Insert an Action into the Pi editor and record usage.
 *
 * Pi applies programmatic editor input without scheduling a redraw (the redraw
 * normally comes from the next terminal keypress), so callers that own the TUI
 * pass it here to request a render immediately.
 */
export async function insertAction(store, ctx, action, args = '', tui) {
  const text = action.mode === 'skill'
    ? (String(args).trim() === '' ? `/skill:${action.name}` : `/skill:${action.name} ${String(args).trim()}`)
    : expandPrompt(action.prompt ?? '', { args });
  if (text === '') return;
  await store.touch(action.name).catch(() => {});
  ctx.ui.pasteToEditor(text);
  if (tui !== undefined && typeof tui.requestRender === 'function') {
    tui.requestRender();
    setTimeout(() => tui.requestRender(), 0);
  }
}
