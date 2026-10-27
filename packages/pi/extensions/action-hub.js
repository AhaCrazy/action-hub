/**
 * Pi adapter for Action Hub.
 *
 * Native TUI palette + full library management + Pi skill discovery.
 */
import { createStore, defaultDataDir } from 'action-hub';
import { loadCatalog } from '../src/catalog.js';
import { exportActions, importFromPath } from '../src/import-export.js';
import { insertAction } from '../src/insert.js';
import { openManager } from '../src/management.js';
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

async function openPalette(ctx, initialQuery = '') {
  if (ctx.mode !== 'tui') {
    notify(ctx, 'Action 面板只在 Pi 交互 TUI 模式可用。', 'warning');
    return;
  }
  const catalog = await loadCatalog(store, ctx.cwd ?? process.cwd());
  if (catalog.actions.length === 0) {
    notify(ctx, '当前没有可用的 Action。使用 /ah import <路径> 导入一个标准 Skill 目录。', 'info');
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
  await insertAction(store, ctx, selected, args);
}

export default function actionHub(pi) {
  pi.registerCommand('ah', {
    description: '打开 Action Hub 面板或管理界面',
    handler: async (args, ctx) => {
      const text = typeof args === 'string' ? args.trim() : '';
      if (text === 'reload') {
        await ctx.reload();
        return;
      }
      if (text === 'manage' || text === '管理') {
        await openManager(ctx, store, dataDir);
        return;
      }
      if (text === 'export' || text === '导出') {
        await exportActions(ctx, store, dataDir);
        return;
      }
      if (text.startsWith('import ') || text.startsWith('导入 ')) {
        const source = text.replace(/^(import|导入)\s+/u, '').trim();
        if (source === '') {
          notify(ctx, '用法：/ah import <目录或 ZIP 路径>', 'warning');
          return;
        }
        await importFromPath(ctx, store, dataDir, source);
        return;
      }
      if (text !== '') {
        await openPalette(ctx, text);
        return;
      }
      await openPalette(ctx);
    },
  });

  pi.registerShortcut('alt+a', {
    description: '打开 Action Hub 面板',
    handler: async (ctx) => {
      await openPalette(ctx);
    },
  });

  pi.registerShortcut('ctrl+alt+a', {
    description: '打开 Action Hub 管理界面',
    handler: async (ctx) => {
      await openManager(ctx, store, dataDir);
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
