/**
 * Pi adapter for Action Hub.
 *
 * Native TUI overlay + Pi skill discovery. No server, port, or browser.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { createStore, defaultDataDir, previewFolder, previewZipBuffer, applyFolderPlan, applyZipPlan } from 'action-hub';
import { loadCatalog, renderAction } from '../src/catalog.js';
import { ActionPalette } from '../src/palette.js';

const dataDir = defaultDataDir();
const store = createStore({ dataDir });

function notify(ctx, text, kind = 'info') {
  try {
    ctx.ui.notify(text, kind);
  } catch {
    /* non-TUI mode */
  }
}

async function openPalette(pi, ctx, initialQuery = '') {
  if (ctx.mode !== 'tui') {
    notify(ctx, 'Action Hub palette is only available in Pi interactive TUI mode.', 'warning');
    return;
  }
  const catalog = await loadCatalog(store, ctx.cwd ?? process.cwd());
  if (catalog.actions.length === 0) {
    notify(ctx, 'Action Hub has no available Actions. Import one with /ah import <path>.', 'info');
    return;
  }
  const selected = await ctx.ui.custom(
    (tui, theme, _keybindings, done) => new ActionPalette({
      tui,
      theme,
      actions: catalog.actions,
      groups: catalog.groups,
      done,
      initialQuery,
    }),
    { overlay: true },
  );
  if (selected === undefined || selected === null) return;
  let args = '';
  if (selected.argsHint) {
    args = await ctx.ui.input('Action 参数', `${selected.argsHint}（可留空）`) ?? '';
  }
  const text = renderAction(selected, args);
  if (text !== '') ctx.ui.pasteToEditor(text);
}

function importDecisions(preview) {
  return preview.items.map((item) => ({
    key: item.key,
    mode: item.status === 'new' ? 'create-command' : 'skip',
  }));
}

async function importFromPath(ctx, source) {
  if (ctx.mode !== 'tui') {
    notify(ctx, '/ah import is only available in Pi interactive TUI mode.', 'warning');
    return;
  }
  const target = path.resolve(ctx.cwd ?? process.cwd(), source);
  const stat = await fs.stat(target).catch(() => undefined);
  if (stat === undefined) {
    notify(ctx, `Path not found: ${target}`, 'error');
    return;
  }
  let preview;
  let planKind;
  if (stat.isDirectory()) {
    preview = await previewFolder(store, dataDir, target);
    planKind = 'folder';
  } else {
    const buffer = await fs.readFile(target);
    preview = await previewZipBuffer(store, dataDir, buffer);
    planKind = 'zip';
  }
  const summary = preview.summary;
  const confirmed = await ctx.ui.confirm(
    'Import Actions',
    `Import ${summary.total} item(s): ${summary.new} new, ${summary.duplicate} duplicate, ${summary.update} update, ${summary.conflict} conflict.\nExisting Actions are skipped.`,
  );
  if (!confirmed) return;
  const decisions = importDecisions(preview);
  const result = planKind === 'folder'
    ? await applyFolderPlan(store, dataDir, target, decisions, [])
    : await applyZipPlan(store, dataDir, await fs.readFile(target), decisions, []);
  notify(ctx, `Imported ${result.imported}, skipped ${result.skipped}, conflicts ${result.conflicts}.`, 'info');
  await ctx.reload();
}

export default function actionHub(pi) {
  pi.registerCommand('ah', {
    description: 'Open the Action Hub palette or import skills',
    handler: async (args, ctx) => {
      const text = typeof args === 'string' ? args.trim() : '';
      if (text === 'reload') {
        await ctx.reload();
        return;
      }
      if (text.startsWith('import ')) {
        await importFromPath(ctx, text.slice('import '.length).trim());
        return;
      }
      await openPalette(pi, ctx);
    },
  });

  pi.registerShortcut('alt+a', {
    description: 'Open Action Hub',
    handler: async (ctx) => {
      await openPalette(pi, ctx);
    },
  });

  pi.on('resources_discover', async (event) => {
    try {
      const catalog = await loadCatalog(store, event.cwd ?? process.cwd());
      return {
        skillPaths: catalog.actions
          .filter((action) => action.mode === 'skill')
          .map((action) => action.dir),
      };
    } catch {
      return { skillPaths: [] };
    }
  });
}
