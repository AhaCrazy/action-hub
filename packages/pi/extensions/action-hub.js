/**
 * Pi adapter for Action Hub.
 *
 * Native TUI palette + full library management + Pi skill discovery.
 */
import { createStore, defaultDataDir } from 'action-hub';
import { loadCatalog } from '../src/catalog.js';
import { seedDefaultBuiltin } from '../src/builtins.js';
import { exportActions, importFromPath } from '../src/import-export.js';
import { insertAction } from '../src/insert.js';
import { openManager } from '../src/management.js';
import { ActionPalette } from '../src/palette.js';
import { createPiProjectScopeStore } from '../src/project-scopes.js';
import {
  createOmpScopeStore,
  isOmpRuntime,
  syncOmpNativeSkills,
} from '../src/omp-native-skills.js';

const dataDir = defaultDataDir();
const store = createStore({ dataDir });
const ompRuntime = isOmpRuntime();
const scopeStore = ompRuntime ? createOmpScopeStore() : createPiProjectScopeStore();

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
  scopeStore.configure(ctx);
  await seedDefaultBuiltin(store).catch(() => {});
  const catalog = await loadCatalog(store, ctx.cwd ?? process.cwd(), scopeStore);
  if (catalog.actions.length === 0) {
    notify(ctx, '当前没有可用的 Action。使用 /ah import <路径> 导入一个标准 Skill 目录。', 'info');
    return;
  }
  let paletteTui;
  const selected = await ctx.ui.custom(
    (tui, theme, _keybindings, done) => {
      paletteTui = tui;
      return new ActionPalette({
        tui,
        theme,
        actions: catalog.actions,
        groups: catalog.groups,
        done,
        initialQuery,
      });
    },
    { overlay: true },
  );
  if (selected === undefined || selected === null) return;
  let args = '';
  if (selected.argsHint) {
    args = await ctx.ui.input('Action 参数', `${selected.argsHint}（可留空）`) ?? '';
  }
  await insertAction(store, ctx, selected, args, paletteTui);
}

export async function submitReloadThroughEditor(ctx, tui) {
  if (typeof tui?.getFocusedComponent !== 'function') return false;
  for (const delay of [0, 25, 80]) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    // Only use the editor-submit path when the draft is empty; never overwrite
    // something the user was writing.
    if (typeof ctx.ui.getEditorText === 'function' && ctx.ui.getEditorText().trim() !== '') return false;
    const editor = tui.getFocusedComponent();
    if (editor !== null && typeof editor?.onSubmit === 'function') {
      void Promise.resolve(editor.onSubmit('/ah reload')).catch(() => {});
      return true;
    }
  }
  return false;
}

async function openManagerWithReload(ctx) {
  scopeStore.configure(ctx);
  await seedDefaultBuiltin(store).catch(() => {});
  let tui;
  const reloadNeeded = await openManager(ctx, store, dataDir, scopeStore, {
    onTui(value) { tui = value; },
  });
  if (ompRuntime) {
    await syncOmpNativeSkills(store, scopeStore, ctx.cwd ?? process.cwd()).catch(() => {});
  }
  if (!reloadNeeded) return;
  // Pi 1.4.0 only exposes reload() on command contexts. Shortcut handlers get
  // the smaller ExtensionContext, so fall back to submitting the reload command
  // through the normal editor path.
  if (typeof ctx.reload === 'function') {
    try {
      await ctx.reload();
    } catch (error) {
      notify(ctx, `自动重新加载失败：${error instanceof Error ? error.message : String(error)}`, 'error');
    }
    return;
  }
  try {
    if (await submitReloadThroughEditor(ctx, tui)) return;
  } catch (error) {
    notify(ctx, `自动重新加载失败：${error instanceof Error ? error.message : String(error)}`, 'error');
    return;
  }
  notify(ctx, '修改已保存。当前上下文不能自动重载，请执行 /ah reload。', 'warning');
}

// OMP 18.1.x does not emit the Pi-compatible resources_discover event, and its
// native skill catalog is built before session_start. Project the current
// Skill-mode Actions before OMP scans `<project>/.omp/skills`, so the first
// session already sees them. The projection is refreshed on session_start and
// after manager changes for the next launch.
if (ompRuntime) {
  try {
    await seedDefaultBuiltin(store);
    await syncOmpNativeSkills(store, scopeStore, process.cwd());
  } catch {
    /* OMP startup must not fail because a generated skill could not be written */
  }
}

export default function actionHub(pi) {
  pi.registerCommand('ah', {
    description: '打开 Action Hub 面板或管理界面',
    handler: async (args, ctx) => {
      const text = typeof args === 'string' ? args.trim() : '';
      scopeStore.configure(ctx);
      if (text === 'reload') {
        await ctx.reload();
        return;
      }
      if (text === 'manage' || text === '管理') {
        await openManagerWithReload(ctx);
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
        const imported = await importFromPath(ctx, store, dataDir, source);
        if (imported) {
          if (typeof ctx.reload === 'function') await ctx.reload();
          else notify(ctx, '导入完成。请执行 /ah reload 刷新 Pi 资源。', 'warning');
        }
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

  // OMP binds Alt+A to its built-in Agent Hub. Keep a non-conflicting fallback.
  pi.registerShortcut('alt+shift+a', {
    description: '打开 Action Hub 面板（备用快捷键）',
    handler: async (ctx) => {
      await openPalette(ctx);
    },
  });

  pi.registerShortcut('ctrl+alt+a', {
    description: '打开 Action Hub 管理界面',
    handler: async (ctx) => {
      await seedDefaultBuiltin(store).catch(() => {});
      await openManagerWithReload(ctx);
    },
  });

  pi.on('session_start', (_event, ctx) => {
    scopeStore.configure(ctx);
    if (ompRuntime) {
      // OMP's native catalog is already built for this session; refresh the
      // on-disk projection so the next launch sees the exact project scope.
      void syncOmpNativeSkills(store, scopeStore, ctx.cwd ?? process.cwd()).catch(() => {});
    }
  });

  pi.on('resources_discover', async (event) => {
    try {
      await seedDefaultBuiltin(store).catch(() => {});
      const catalog = await loadCatalog(store, event.cwd ?? process.cwd(), scopeStore);
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
