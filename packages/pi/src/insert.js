import { expandPrompt } from 'action-hub';

/** Insert an Action into the Pi editor and record usage. */
export async function insertAction(store, ctx, action, args = '') {
  const text = action.mode === 'skill'
    ? (String(args).trim() === '' ? `/skill:${action.name}` : `/skill:${action.name} ${String(args).trim()}`)
    : expandPrompt(action.prompt ?? '', { args });
  if (text === '') return;
  await store.touch(action.name).catch(() => {});
  ctx.ui.pasteToEditor(text);
}
