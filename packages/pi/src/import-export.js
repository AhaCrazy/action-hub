import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  applyFolderPlan,
  applyZipPlan,
  exportZipBuffer,
  previewFolder,
  previewZipBuffer,
} from 'action-hub';

function notify(ctx, text, kind = 'info') {
  try {
    ctx.ui.notify(text, kind);
  } catch {
    /* non-TUI */
  }
}

async function readPlan(ctx, store, dataDir, target) {
  const stat = await fs.stat(target).catch(() => undefined);
  if (stat === undefined) throw new Error(`路径不存在：${target}`);
  if (stat.isDirectory()) {
    return { kind: 'folder', preview: await previewFolder(store, dataDir, target) };
  }
  const buffer = await fs.readFile(target);
  return { kind: 'zip', preview: await previewZipBuffer(store, dataDir, buffer), buffer };
}

export async function importFromPath(ctx, store, dataDir, source) {
  if (ctx.mode !== 'tui') {
    notify(ctx, '导入功能只在 Pi 交互 TUI 模式可用。', 'warning');
    return;
  }
  const target = path.resolve(ctx.cwd ?? process.cwd(), source);
  const { kind, preview, buffer } = await readPlan(ctx, store, dataDir, target);
  const summary = preview.summary;
  const confirmed = await ctx.ui.confirm(
    '导入 Action',
    `共 ${summary.total} 项：新增 ${summary.new}，重复 ${summary.duplicate}，更新 ${summary.update}，冲突 ${summary.conflict}。`,
  );
  if (!confirmed) return;

  const mode = await ctx.ui.select('新增 Action 的导入方式', ['Command（仅用户调用）', 'Skill（模型可调用）']);
  const createMode = mode === undefined ? undefined : mode.startsWith('Skill') ? 'create-skill' : 'create-command';
  if (createMode === undefined) return;
  const update = summary.update > 0
    ? await ctx.ui.confirm('更新已有 Action', `检测到 ${summary.update} 个已有 Action，是否用导入内容更新？`)
    : false;

  const decisions = preview.items.map((item) => {
    if (item.status === 'new') return { key: item.key, mode: createMode };
    if (item.status === 'update' && update) return { key: item.key, mode: 'update' };
    return { key: item.key, mode: 'skip' };
  });

  const result = kind === 'folder'
    ? await applyFolderPlan(store, dataDir, target, decisions, [])
    : await applyZipPlan(store, dataDir, buffer, decisions, []);
  notify(ctx, `导入完成：新增 ${result.imported}，更新 ${result.updated}，跳过 ${result.skipped}，冲突 ${result.conflicts}。`, 'info');
  await ctx.reload();
}

export async function exportActions(ctx, store, dataDir) {
  if (ctx.mode !== 'tui') {
    notify(ctx, '导出功能只在 Pi 交互 TUI 模式可用。', 'warning');
    return;
  }
  const { actions } = await store.read();
  if (actions.length === 0) {
    notify(ctx, '当前没有可导出的 Action。', 'info');
    return;
  }
  const scope = await ctx.ui.select('导出范围', ['全部 Action', '选择一个 Action']);
  let selection;
  if (scope === undefined) return;
  if (scope.startsWith('选择')) {
    const labels = actions.map((action) => `${action.name} — ${action.description}`);
    const choice = await ctx.ui.select('选择要导出的 Action', labels);
    if (choice === undefined) return;
    const action = actions[labels.indexOf(choice)];
    if (action === undefined) return;
    selection = [action.id];
  }
  const defaultPath = path.join(ctx.cwd ?? process.cwd(), selection === undefined ? 'action-hub.zip' : `${selection[0]}.zip`);
  const raw = await ctx.ui.input('导出路径', defaultPath);
  if (raw === undefined || raw.trim() === '') return;
  const target = path.resolve(ctx.cwd ?? process.cwd(), raw.trim());
  const exists = await fs.stat(target).then(() => true).catch(() => false);
  if (exists && !(await ctx.ui.confirm('覆盖文件', `${target} 已存在，是否覆盖？`))) return;
  const exported = await exportZipBuffer(store, dataDir, selection);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, exported.buffer);
  notify(ctx, `已导出 ${exported.count} 个 Action 到 ${target}`, 'info');
}
