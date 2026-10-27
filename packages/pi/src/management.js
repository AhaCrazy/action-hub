/**
 * Full management UI for Action Hub in Pi.
 *
 * The palette stays a fast keyboard overlay; this module exposes the rest of
 * the library operations through Pi's native dialogs and a small checkbox
 * overlay. It intentionally uses the same core and state as the DSH adapter.
 */
import path from 'node:path';

import { resolveProjectRoot, sortActions } from 'action-hub';
import { readResourcePreviews } from 'action-hub';

import { exportActions, importFromPath } from './import-export.js';
import { insertAction } from './insert.js';
import { ManagerDashboard } from './manager-dashboard.js';
import { MultiSelect } from './multi-select.js';

const BACK = '返回';

function notify(ctx, text, kind = 'info') {
  try {
    ctx.ui.notify(text, kind);
  } catch {
    /* non-TUI */
  }
}

function actionLabel(action) {
  const mode = action.mode === 'skill' ? 'Skill' : 'Command';
  return `${action.name}  [${mode}]  ${action.description}`;
}

function groupLabel(group) {
  return `${group.name}${group.global ? '（全局）' : ''}  [${group.id}]`;
}

async function pick(ctx, title, options) {
  const choice = await ctx.ui.select(title, options);
  return choice === undefined ? null : options.indexOf(choice);
}

async function askInput(ctx, title, placeholder = '') {
  const value = await ctx.ui.input(title, placeholder);
  if (value === undefined) return undefined;
  return value.trim();
}

async function pickChecklist(ctx, { title, items, selected }) {
  return ctx.ui.custom(
    (tui, theme, _keybindings, done) => new MultiSelect({
      tui,
      theme,
      title,
      items,
      initialSelected: selected,
      done,
    }),
    { overlay: true },
  );
}

async function loadAll(store) {
  const data = await store.read();
  return { state: data.state, actions: sortActions(data.actions) };
}

async function pickAction(ctx, store, title = '选择 Action') {
  const { actions } = await loadAll(store);
  if (actions.length === 0) {
    notify(ctx, '当前没有 Action。', 'info');
    return null;
  }
  const labels = actions.map(actionLabel);
  const choice = await ctx.ui.select(title, labels);
  if (choice === undefined) return null;
  return actions[labels.indexOf(choice)] ?? null;
}

async function pickGroups(ctx, store, title, selected = []) {
  const state = await store.readState();
  if (state.groups.length === 0) {
    notify(ctx, '当前没有分组。', 'info');
    return undefined;
  }
  return pickChecklist(ctx, {
    title,
    items: state.groups.map((group) => ({
      key: group.id,
      label: groupLabel(group),
      description: `包含 ${group.includes.length} 个子分组`,
    })),
    selected,
  });
}

async function pickActionNames(ctx, store, title, selected = []) {
  const { actions } = await loadAll(store);
  if (actions.length === 0) {
    notify(ctx, '当前没有 Action。', 'info');
    return undefined;
  }
  return pickChecklist(ctx, {
    title,
    items: actions.map((action) => ({
      key: action.name,
      label: action.name,
      description: action.description,
    })),
    selected,
  });
}

function parseTags(value) {
  return value.split(/[,，\s]+/u).map((tag) => tag.trim()).filter(Boolean);
}

async function pickMode(ctx, current = 'command') {
  const choice = await ctx.ui.select('选择模式', ['Command（仅用户调用）', 'Skill（模型可调用）']);
  if (choice === undefined) return undefined;
  return choice.startsWith('Skill') ? 'skill' : 'command';
}

async function createAction(ctx, store) {
  const name = await askInput(ctx, 'Action 名称（kebab-case）');
  if (!name) return;
  const description = await askInput(ctx, '一句话描述');
  if (!description) return;
  const prompt = await ctx.ui.editor('Action 正文');
  if (prompt === undefined || prompt.trim() === '') return;
  const mode = await pickMode(ctx);
  if (mode === undefined) return;
  const groups = await pickGroups(ctx, store, '选择所属分组', []);
  if (groups === undefined) return;
  try {
    await store.create({ name, description, prompt, mode, groups });
    notify(ctx, `已创建 ${name}`, 'info');
  } catch (error) {
    notify(ctx, `创建失败：${error instanceof Error ? error.message : String(error)}`, 'error');
  }
}

async function editAction(ctx, store, action) {
  const patch = {};
  let current = action;
  for (;;) {
    const choice = await ctx.ui.select(`编辑 ${action.name}`, [
      '名称',
      '描述',
      '正文',
      '模式',
      '分组',
      '分类',
      '标签',
      '参数提示',
      '固定/取消固定',
      '保存并返回',
      '返回不保存',
    ]);
    if (choice === undefined || choice === '返回不保存') return;
    if (choice === '保存并返回') {
      if (Object.keys(patch).length === 0) return;
      try {
        current = await store.update(action.id, patch);
        notify(ctx, `已保存 ${current.name}`, 'info');
      } catch (error) {
        notify(ctx, `保存失败：${error instanceof Error ? error.message : String(error)}`, 'error');
      }
      return;
    }
    if (choice === '名称') {
      const value = await askInput(ctx, '新名称（kebab-case）', current.name);
      if (value === undefined) continue;
      if (value === '') continue;
      patch.name = value;
      current = { ...current, name: value };
    } else if (choice === '描述') {
      const value = await askInput(ctx, '新描述（留空保持不变）', current.description);
      if (value === undefined || value === '') continue;
      patch.description = value;
      current = { ...current, description: value };
    } else if (choice === '正文') {
      const value = await ctx.ui.editor('编辑正文', current.prompt);
      if (value === undefined || value.trim() === '') continue;
      patch.prompt = value;
      current = { ...current, prompt: value };
    } else if (choice === '模式') {
      const mode = await pickMode(ctx, current.mode);
      if (mode === undefined) continue;
      patch.mode = mode;
      current = { ...current, mode };
    } else if (choice === '分组') {
      const groups = await pickGroups(ctx, store, `为 ${current.name} 选择分组`, current.groups);
      if (groups === undefined) continue;
      patch.groups = groups;
      current = { ...current, groups };
    } else if (choice === '分类') {
      const value = await askInput(ctx, '分类（留空保持不变）', current.category ?? '');
      if (value === undefined) continue;
      patch.category = value;
      current = { ...current, category: value };
    } else if (choice === '标签') {
      const value = await askInput(ctx, '标签，用空格或逗号分隔（留空保持不变）', (current.tags ?? []).join(' '));
      if (value === undefined) continue;
      patch.tags = parseTags(value);
      current = { ...current, tags: patch.tags };
    } else if (choice === '参数提示') {
      const value = await askInput(ctx, '参数提示（可留空）', current.argsHint ?? '');
      if (value === undefined) continue;
      patch.argsHint = value;
      current = { ...current, argsHint: value };
    } else if (choice === '固定/取消固定') {
      patch.pinned = !current.pinned;
      current = { ...current, pinned: patch.pinned };
      notify(ctx, patch.pinned ? '已固定' : '已取消固定', 'info');
    }
  }
}

async function manageOneAction(ctx, store, action) {
  for (;;) {
    const choice = await ctx.ui.select(actionLabel(action), [
      '插入到编辑器',
      '编辑',
      '查看资源',
      '切换 Command / Skill',
      '设置分组',
      '固定/取消固定',
      '删除',
      BACK,
    ]);
    if (choice === undefined || choice === BACK) return;
    if (choice === '插入到编辑器') {
      let args = '';
      if (action.argsHint) args = await ctx.ui.input('Action 参数', `${action.argsHint}（可留空）`) ?? '';
      await insertAction(store, ctx, action, args);
      return;
    }
    if (choice === '查看资源') {
      const resources = await readResourcePreviews(action.dir);
      if (resources.length === 0) {
        notify(ctx, '这个 Action 没有额外资源文件。', 'info');
        return;
      }
      const labels = resources.map((resource) => `${resource.name} (${resource.bytes} B)`);
      const picked = await ctx.ui.select('资源文件', [...labels, BACK]);
      if (picked === undefined || picked === BACK) return;
      const resource = resources[labels.indexOf(picked)];
      if (resource === undefined) return;
      notify(ctx, resource.text === undefined ? `${resource.name}（二进制或大文件，请在文件系统中查看）` : resource.text, 'info');
      return;
    }
    if (choice === '编辑') {
      await editAction(ctx, store, action);
      return;
    }
    if (choice === '切换 Command / Skill') {
      try {
        await store.setMode(action.id, action.mode === 'skill' ? 'command' : 'skill');
        notify(ctx, '模式已切换；Skill 可见性变更后请 /ah reload。', 'info');
      } catch (error) {
        notify(ctx, `切换失败：${error instanceof Error ? error.message : String(error)}`, 'error');
      }
      return;
    }
    if (choice === '设置分组') {
      const groups = await pickGroups(ctx, store, `为 ${action.name} 选择分组`, action.groups);
      if (groups === undefined) return;
      try {
        await store.setActionGroups(action.id, groups);
        notify(ctx, '分组已更新', 'info');
      } catch (error) {
        notify(ctx, `保存失败：${error instanceof Error ? error.message : String(error)}`, 'error');
      }
      return;
    }
    if (choice === '固定/取消固定') {
      try {
        await store.update(action.id, { pinned: !action.pinned });
        notify(ctx, action.pinned ? '已取消固定' : '已固定', 'info');
      } catch (error) {
        notify(ctx, `保存失败：${error instanceof Error ? error.message : String(error)}`, 'error');
      }
      return;
    }
    if (choice === '删除') {
      if (!(await ctx.ui.confirm('删除 Action', `确定删除 ${action.name}？此操作不可恢复。`))) return;
      try {
        await store.remove(action.id);
        notify(ctx, `已删除 ${action.name}`, 'info');
      } catch (error) {
        notify(ctx, `删除失败：${error instanceof Error ? error.message : String(error)}`, 'error');
      }
      return;
    }
  }
}

async function manageCategories(ctx, store) {
  for (;;) {
    const { actions } = await loadAll(store);
    const categories = [...new Set(actions.map((action) => action.category).filter(Boolean))].sort();
    if (categories.length === 0) {
      notify(ctx, '当前没有分类。分类可以在编辑 Action 时设置。', 'info');
      return;
    }
    const choice = await ctx.ui.select('分类管理', [...categories, BACK]);
    if (choice === undefined || choice === BACK) return;
    const category = categories[categories.indexOf(choice)];
    if (category === undefined) continue;
    const action = await ctx.ui.select(`分类：${category}`, ['重命名分类', '清空分类', BACK]);
    if (action === undefined || action === BACK) continue;
    if (action === '重命名分类') {
      const value = await askInput(ctx, '新的分类名', category);
      if (value === undefined || value === '') continue;
      try {
        await store.renameCategory(category, value);
        notify(ctx, '分类已重命名', 'info');
      } catch (error) {
        notify(ctx, `重命名失败：${error instanceof Error ? error.message : String(error)}`, 'error');
      }
    } else if (action === '清空分类') {
      if (!(await ctx.ui.confirm('清空分类', `把 ${category} 从所有 Action 上移除？`))) continue;
      try {
        await store.deleteCategory(category);
        notify(ctx, '分类已清空', 'info');
      } catch (error) {
        notify(ctx, `操作失败：${error instanceof Error ? error.message : String(error)}`, 'error');
      }
    }
  }
}

async function showResources(ctx, action) {
  const resources = await readResourcePreviews(action.dir);
  if (resources.length === 0) {
    notify(ctx, '这个 Action 没有额外资源文件。', 'info');
    return;
  }
  const labels = resources.map((resource) => `${resource.name} (${resource.bytes} B)`);
  const picked = await ctx.ui.select('资源文件', [...labels, BACK]);
  if (picked === undefined || picked === BACK) return;
  const resource = resources[labels.indexOf(picked)];
  if (resource === undefined) return;
  notify(ctx, resource.text === undefined ? `${resource.name}（二进制或大文件，请在文件系统中查看）` : resource.text, 'info');
}

async function deleteAction(ctx, store, action) {
  if (!(await ctx.ui.confirm('删除 Action', `确定删除 ${action.name}？此操作不可恢复。`))) return;
  try {
    await store.remove(action.id);
    notify(ctx, `已删除 ${action.name}`, 'info');
  } catch (error) {
    notify(ctx, `删除失败：${error instanceof Error ? error.message : String(error)}`, 'error');
  }
}

async function toggleMode(ctx, store, action) {
  try {
    await store.setMode(action.id, action.mode === 'skill' ? 'command' : 'skill');
    notify(ctx, '模式已切换；Skill 可见性变化后请 /ah reload。', 'info');
  } catch (error) {
    notify(ctx, `切换失败：${error instanceof Error ? error.message : String(error)}`, 'error');
  }
}

async function togglePin(ctx, store, action) {
  try {
    await store.update(action.id, { pinned: !action.pinned });
    notify(ctx, action.pinned ? '已取消固定' : '已固定', 'info');
  } catch (error) {
    notify(ctx, `保存失败：${error instanceof Error ? error.message : String(error)}`, 'error');
  }
}

async function setActionGroups(ctx, store, action) {
  const groups = await pickGroups(ctx, store, `为 ${action.name} 选择分组`, action.groups);
  if (groups === undefined) return;
  try {
    await store.setActionGroups(action.id, groups);
    notify(ctx, '分组已更新', 'info');
  } catch (error) {
    notify(ctx, `保存失败：${error instanceof Error ? error.message : String(error)}`, 'error');
  }
}

async function insertSelected(ctx, store, action) {
  let args = '';
  if (action.argsHint) args = await ctx.ui.input('Action 参数', `${action.argsHint}（可留空）`) ?? '';
  await insertAction(store, ctx, action, args);
}

async function createGroup(ctx, store) {
  const value = await askInput(ctx, '分组名');
  if (!value) return;
  try {
    await store.createGroup(value);
    notify(ctx, '分组已创建', 'info');
  } catch (error) {
    notify(ctx, `创建失败：${error instanceof Error ? error.message : String(error)}`, 'error');
  }
}

async function deleteGroup(ctx, store, group) {
  if (!(await ctx.ui.confirm('删除分组', `确定删除 ${group.name}？其中的成员会失去这个分组。`))) return;
  try {
    await store.deleteGroup(group.id);
    notify(ctx, '分组已删除', 'info');
  } catch (error) {
    notify(ctx, `删除失败：${error instanceof Error ? error.message : String(error)}`, 'error');
  }
}

export async function openManager(ctx, store, dataDir, scopeStore) {
  if (ctx.mode !== 'tui') {
    notify(ctx, 'Action Hub 管理界面只在 Pi 交互 TUI 模式可用。', 'warning');
    return;
  }
  let sectionId = 'actions';
  for (;;) {
    const data = await store.read();
    const cwd = ctx.cwd ?? process.cwd();
    const root = await resolveProjectRoot(cwd, []);
    const projectRoot = root ?? path.resolve(cwd);
    const scope = scopeStore === undefined ? null : await scopeStore.readForRoot(projectRoot);
    const dashboardData = {
      actions: sortActions(data.actions),
      state: data.state,
      projects: [{
        ...(scope ?? { groups: [], actions: [], excludeGroups: [], excludeActions: [] }),
        label: scope?.label || path.basename(projectRoot),
        path: projectRoot,
      }],
      dataDir,
      currentProjectRoot: projectRoot,
    };
    const result = await ctx.ui.custom(
      (tui, theme, _keybindings, done) => new ManagerDashboard({
        tui,
        theme,
        data: dashboardData,
        cwd,
        sectionId,
        done,
      }),
      { overlay: true, overlayOptions: { width: '94%', maxHeight: '88%' } },
    );
    if (result === undefined || result === null || result.kind === 'close') return;
    if (result.kind === 'new-action') {
      sectionId = 'actions';
      await createAction(ctx, store);
    } else if (result.kind === 'open-action') {
      sectionId = 'actions';
      await manageOneAction(ctx, store, result.action);
    } else if (result.kind === 'edit-action') {
      sectionId = 'actions';
      await editAction(ctx, store, result.action);
    } else if (result.kind === 'delete-action') {
      sectionId = 'actions';
      await deleteAction(ctx, store, result.action);
    } else if (result.kind === 'toggle-mode') {
      sectionId = 'actions';
      await toggleMode(ctx, store, result.action);
    } else if (result.kind === 'pin-action') {
      sectionId = 'actions';
      await togglePin(ctx, store, result.action);
    } else if (result.kind === 'groups-action') {
      sectionId = 'actions';
      await setActionGroups(ctx, store, result.action);
    } else if (result.kind === 'resources-action') {
      sectionId = 'actions';
      await showResources(ctx, result.action);
    } else if (result.kind === 'insert-action') {
      sectionId = 'actions';
      await insertSelected(ctx, store, result.action);
      return;
    } else if (result.kind === 'new-group') {
      sectionId = 'groups';
      await createGroup(ctx, store);
    } else if (result.kind === 'open-group') {
      sectionId = 'groups';
      await manageOneGroup(ctx, store, result.group);
    } else if (result.kind === 'delete-group') {
      sectionId = 'groups';
      await deleteGroup(ctx, store, result.group);
    } else if (result.kind === 'edit-project') {
      sectionId = 'projects';
      await editProjectScope(ctx, store, scopeStore, result.project.path);
    } else if (result.kind === 'tool') {
      sectionId = 'tools';
      if (result.tool === 'import') {
        const source = await ctx.ui.input('导入路径', '标准 Skill 目录或 ZIP 的绝对路径');
        if (source !== undefined && source.trim() !== '') await importFromPath(ctx, store, dataDir, source.trim());
      } else if (result.tool === 'export') {
        await exportActions(ctx, store, dataDir);
      } else if (result.tool === 'categories') {
        await manageCategories(ctx, store);
      } else if (result.tool === 'settings') {
        await manageSettings(ctx, store, dataDir);
      }
    }
  }
}

async function manageOneGroup(ctx, store, group) {
  for (;;) {
    const choice = await ctx.ui.select(groupLabel(group), [
      '改名',
      '设置全局分组',
      '设置成员 Action',
      '设置包含的子分组',
      '删除分组',
      BACK,
    ]);
    if (choice === undefined || choice === BACK) return;
    if (choice === '改名') {
      const value = await askInput(ctx, '新分组名', group.name);
      if (value === undefined || value === '') continue;
      try {
        await store.renameGroup(group.id, value);
        notify(ctx, '分组已改名', 'info');
      } catch (error) {
        notify(ctx, `改名失败：${error instanceof Error ? error.message : String(error)}`, 'error');
      }
      return;
    }
    if (choice === '设置全局分组') {
      const next = !group.global;
      if (!(await ctx.ui.confirm('全局分组', next ? `让 ${group.name} 在所有项目可用？` : `取消 ${group.name} 的全局状态？`))) return;
      try {
        await store.setGroupGlobal(group.id, next);
        notify(ctx, next ? '已设为全局分组' : '已取消全局分组', 'info');
      } catch (error) {
        notify(ctx, `保存失败：${error instanceof Error ? error.message : String(error)}`, 'error');
      }
      return;
    }
    if (choice === '设置成员 Action') {
      const data = await store.read();
      const members = data.actions.filter((action) => (action.groups ?? []).includes(group.id)).map((action) => action.name);
      const names = await pickActionNames(ctx, store, `选择 ${group.name} 的成员`, members);
      if (names === undefined) return;
      try {
        await store.setGroupActions(group.id, names);
        notify(ctx, '成员已更新', 'info');
      } catch (error) {
        notify(ctx, `保存失败：${error instanceof Error ? error.message : String(error)}`, 'error');
      }
      return;
    }
    if (choice === '设置包含的子分组') {
      const state = await store.readState();
      const items = state.groups.filter((entry) => entry.id !== group.id);
      if (items.length === 0) {
        notify(ctx, '没有其他分组可包含。', 'info');
        return;
      }
      const ids = await pickChecklist(ctx, {
        title: `选择 ${group.name} 包含的子分组`,
        items: items.map((entry) => ({ key: entry.id, label: groupLabel(entry) })),
        selected: group.includes ?? [],
      });
      if (ids === undefined) return;
      try {
        await store.setGroupIncludes(group.id, ids);
        notify(ctx, '子分组已更新', 'info');
      } catch (error) {
        notify(ctx, `保存失败：${error instanceof Error ? error.message : String(error)}`, 'error');
      }
      return;
    }
    if (choice === '删除分组') {
      if (!(await ctx.ui.confirm('删除分组', `确定删除 ${group.name}？其中的成员会失去这个分组。`))) return;
      try {
        await store.deleteGroup(group.id);
        notify(ctx, '分组已删除', 'info');
      } catch (error) {
        notify(ctx, `删除失败：${error instanceof Error ? error.message : String(error)}`, 'error');
      }
      return;
    }
  }
}

async function manageGroups(ctx, store) {
  for (;;) {
    const state = await store.readState();
    const labels = state.groups.map(groupLabel);
    const choice = await ctx.ui.select('管理分组', ['新建分组', ...labels, BACK]);
    if (choice === undefined || choice === BACK) return;
    if (choice === '新建分组') {
      const value = await askInput(ctx, '分组名');
      if (!value) continue;
      try {
        await store.createGroup(value);
        notify(ctx, '分组已创建', 'info');
      } catch (error) {
        notify(ctx, `创建失败：${error instanceof Error ? error.message : String(error)}`, 'error');
      }
      continue;
    }
    const index = labels.indexOf(choice);
    if (index >= 0) await manageOneGroup(ctx, store, state.groups[index]);
  }
}

async function editProjectScope(ctx, store, scopeStore, projectPath) {
  const existing = scopeStore === undefined ? null : await scopeStore.readForRoot(projectPath);
  let profile = {
    label: existing?.label || path.basename(projectPath),
    groups: existing?.groups ?? [],
    actions: existing?.actions ?? [],
    excludeGroups: existing?.excludeGroups ?? [],
    excludeActions: existing?.excludeActions ?? [],
  };
  for (;;) {
    const choice = await ctx.ui.select(`项目范围：${profile.label}`, [
      '启用分组',
      '启用单个 Action',
      '屏蔽分组',
      '屏蔽 Action',
      '修改项目名称',
      '保存',
      BACK,
    ]);
    if (choice === undefined || choice === BACK) return;
    if (choice === '保存') {
      try {
        if (scopeStore === undefined) throw new Error('项目范围存储不可用');
        await scopeStore.writeForRoot(projectPath, profile);
        notify(ctx, '项目范围已保存（仅当前 Pi 工作目录）', 'info');
      } catch (error) {
        notify(ctx, `保存失败：${error instanceof Error ? error.message : String(error)}`, 'error');
      }
      return;
    }
    if (choice === '修改项目名称') {
      const value = await askInput(ctx, '项目显示名称', profile.label);
      if (value === undefined || value === '') continue;
      profile = { ...profile, label: value };
      continue;
    }
    if (choice === '启用分组') {
      const groups = await pickGroups(ctx, store, '直接启用的分组', profile.groups);
      if (groups !== undefined) profile = { ...profile, groups };
      continue;
    }
    if (choice === '启用单个 Action') {
      const actions = await pickActionNames(ctx, store, '直接启用的 Action', profile.actions);
      if (actions !== undefined) profile = { ...profile, actions };
      continue;
    }
    if (choice === '屏蔽分组') {
      const groups = await pickGroups(ctx, store, '从继承中屏蔽的分组', profile.excludeGroups);
      if (groups !== undefined) profile = { ...profile, excludeGroups: groups };
      continue;
    }
    if (choice === '屏蔽 Action') {
      const actions = await pickActionNames(ctx, store, '屏蔽的 Action', profile.excludeActions);
      if (actions !== undefined) profile = { ...profile, excludeActions: actions };
      continue;
    }
  }
}

async function manageSettings(ctx, store, dataDir) {
  for (;;) {
    const state = await store.readState();
    const defaultGroup = state.groups.find((group) => group.id === (state.defaultGroup ?? ''));
    const choice = await ctx.ui.select('设置', [
      `数据目录：${dataDir}`,
      `新项目默认分组：${defaultGroup?.name ?? '未设置'}`,
      '选择新项目默认分组',
      '重新加载 Pi 资源',
      BACK,
    ]);
    if (choice === undefined || choice === BACK) return;
    if (choice === '选择新项目默认分组') {
      const groups = await pickGroups(ctx, store, '选择新项目默认分组', defaultGroup ? [defaultGroup.id] : []);
      if (groups === undefined) continue;
      if (groups.length !== 1) {
        notify(ctx, '请选择一个分组。', 'warning');
        continue;
      }
      try {
        await store.setDefaultGroup(groups[0]);
        notify(ctx, '默认分组已更新', 'info');
      } catch (error) {
        notify(ctx, `保存失败：${error instanceof Error ? error.message : String(error)}`, 'error');
      }
      continue;
    }
    if (choice === '重新加载 Pi 资源') {
      await ctx.reload();
      return;
    }
  }
}
