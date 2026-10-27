/**
 * Split-window management UI for Pi.
 *
 * Left: sections. Middle: filtered item list. Right: selected item details.
 * Actions that need text input or confirmation are handed back to the host via
 * `done`, so this component stays synchronous and testable.
 */
import { Key, matchesKey, truncateToWidth, visibleWidth } from '@earendil-works/pi-tui';

const HEIGHT = 18;

function matcherFor(query, regex) {
  const text = query.trim();
  if (text === '') return () => true;
  if (!regex) {
    const needle = text.toLowerCase();
    return (value) => String(value ?? '').toLowerCase().includes(needle);
  }
  try {
    const pattern = new RegExp(text, 'i');
    return (value) => pattern.test(String(value ?? ''));
  } catch {
    return () => false;
  }
}

function padRight(value, width) {
  return value + ' '.repeat(Math.max(0, width - visibleWidth(value)));
}

function fit(value, width) {
  return truncateToWidth(String(value ?? ''), width);
}

export class ManagerDashboard {
  constructor({ tui, theme, data, cwd, sectionId = 'actions', done }) {
    this.tui = tui;
    this.theme = theme;
    this.data = data;
    this.cwd = cwd;
    this.done = done;
    this.sectionId = sectionId;
    this.focus = 'middle';
    this.selected = 0;
    this.query = '';
    this.search = false;
    this.regex = false;
    this.focused = false;
  }

  get actions() {
    return this.data.actions;
  }

  get groups() {
    return this.data.state.groups;
  }

  get projects() {
    const projects = Array.isArray(this.data.projects) ? this.data.projects : [];
    const root = this.data.currentProjectRoot;
    if (root === undefined || root === '') return projects;
    const key = String(root).toLowerCase();
    if (projects.some((project) => String(project.path).toLowerCase() === key)) return projects;
    return [...projects, { label: '当前项目（未登记）', path: root, groups: [], actions: [], excludeGroups: [], excludeActions: [] }];
  }

  get sections() {
    return [
      { id: 'actions', label: 'Action', count: this.actions.length },
      { id: 'groups', label: '分组', count: this.groups.length },
      { id: 'projects', label: '项目', count: this.projects.length },
      { id: 'tools', label: '工具', count: 4 },
    ];
  }

  get items() {
    if (this.sectionId === 'actions') return this.actions;
    if (this.sectionId === 'groups') return this.groups;
    if (this.sectionId === 'projects') return this.projects;
    return [
      { key: 'import', name: '导入 Action', description: '从标准 Skill 目录或 ZIP 导入' },
      { key: 'export', name: '导出 Action', description: '导出全部或单个 Action 为 ZIP' },
      { key: 'categories', name: '分类管理', description: '重命名或清空分类' },
      { key: 'settings', name: '设置', description: '数据目录、默认分组、重新加载' },
    ];
  }

  get filteredItems() {
    const matches = matcherFor(this.query, this.regex);
    return this.items.filter((item) => matches([
      item.name,
      item.description,
      item.category,
      ...(item.tags ?? []),
    ].filter(Boolean).join(' ')));
  }

  get currentItem() {
    return this.filteredItems[this.selected] ?? null;
  }

  setSection(id) {
    this.sectionId = id;
    this.selected = 0;
    this.query = '';
    this.search = false;
    this.tui.requestRender();
  }

  handleInput(data) {
    if (matchesKey(data, 'alt+r')) {
      this.regex = !this.regex;
      this.tui.requestRender();
      return;
    }
    if (this.search) {
      if (matchesKey(data, Key.escape)) {
        this.query = '';
        this.search = false;
        this.selected = 0;
        this.tui.requestRender();
        return;
      }
      if (matchesKey(data, Key.return)) {
        this.search = false;
        this.tui.requestRender();
        return;
      }
      if (matchesKey(data, Key.backspace) || data === '\u007f') {
        this.query = this.query.slice(0, -1);
        this.selected = 0;
        this.tui.requestRender();
        return;
      }
      if (data.length === 1 && data.charCodeAt(0) >= 32) {
        this.query += data;
        this.selected = 0;
        this.tui.requestRender();
      }
      return;
    }
    if (matchesKey(data, Key.escape) || data === 'q') {
      this.done({ kind: 'close' });
      return;
    }
    if (matchesKey(data, Key.left)) {
      this.focus = 'left';
      this.tui.requestRender();
      return;
    }
    if (matchesKey(data, Key.right)) {
      this.focus = 'middle';
      this.tui.requestRender();
      return;
    }
    if (matchesKey(data, 'tab')) {
      if (this.focus === 'middle' && this.sectionId === 'actions') {
        const item = this.currentItem;
        if (item !== null) this.done({ kind: 'insert-action', action: item });
      }
      return;
    }
    if (data === '/' || data === 'f') {
      this.search = true;
      this.query = '';
      this.tui.requestRender();
      return;
    }
    if (matchesKey(data, Key.up)) {
      if (this.focus === 'left') {
        const index = this.sections.findIndex((section) => section.id === this.sectionId);
        this.setSection(this.sections[Math.max(0, index - 1)].id);
      } else {
        this.selected = Math.max(0, this.selected - 1);
        this.tui.requestRender();
      }
      return;
    }
    if (matchesKey(data, Key.down)) {
      if (this.focus === 'left') {
        const index = this.sections.findIndex((section) => section.id === this.sectionId);
        this.setSection(this.sections[Math.min(this.sections.length - 1, index + 1)].id);
      } else {
        this.selected = Math.min(this.filteredItems.length - 1, this.selected + 1);
        this.tui.requestRender();
      }
      return;
    }
    if (matchesKey(data, Key.return)) {
      if (this.focus === 'left') {
        this.focus = 'middle';
        this.tui.requestRender();
        return;
      }
      const item = this.currentItem;
      if (item === null) return;
      if (this.sectionId === 'actions') this.done({ kind: 'open-action', action: item });
      else if (this.sectionId === 'groups') this.done({ kind: 'open-group', group: item });
      else if (this.sectionId === 'projects') this.done({ kind: 'edit-project', project: item });
      else this.done({ kind: 'tool', tool: item.key });
      return;
    }
    if (this.focus !== 'middle') return;
    const item = this.currentItem;
    if (item === null) return;
    if (data === 'n' && this.sectionId === 'actions') this.done({ kind: 'new-action' });
    else if (data === 'n' && this.sectionId === 'groups') this.done({ kind: 'new-group' });
    else if (data === 'e' && this.sectionId === 'actions') this.done({ kind: 'edit-action', action: item });
    else if (data === 'e' && this.sectionId === 'groups') this.done({ kind: 'open-group', group: item });
    else if (data === 'e' && this.sectionId === 'projects') this.done({ kind: 'edit-project', project: item });
    else if (data === 'd' && this.sectionId === 'actions') this.done({ kind: 'delete-action', action: item });
    else if (data === 'd' && this.sectionId === 'groups') this.done({ kind: 'delete-group', group: item });
    else if (data === 'm' && this.sectionId === 'actions') this.done({ kind: 'toggle-mode', action: item });
    else if (data === 'p' && this.sectionId === 'actions') this.done({ kind: 'pin-action', action: item });
    else if (data === 'g' && this.sectionId === 'actions') this.done({ kind: 'groups-action', action: item });
    else if (data === 'r' && this.sectionId === 'actions') this.done({ kind: 'resources-action', action: item });
    else if (data === 'i' && this.sectionId === 'actions') this.done({ kind: 'insert-action', action: item });
  }

  invalidate() {}

  dispose() {}

  render(width) {
    const theme = this.theme;
    const paint = (color, value) => (typeof theme?.fg === 'function' ? theme.fg(color, value) : value);
    const outer = Math.max(72, Math.min(width, 118));
    const inner = outer - 2;
    const leftWidth = Math.min(20, Math.max(16, Math.floor(inner * 0.18)));
    const middleWidth = Math.min(42, Math.max(28, Math.floor(inner * 0.34)));
    const rightWidth = inner - leftWidth - middleWidth - 2;
    const top = paint('border', `╭${'─'.repeat(inner)}╮`);
    const separator = paint('border', `├${'─'.repeat(leftWidth)}┬${'─'.repeat(middleWidth)}┬${'─'.repeat(rightWidth)}┤`);
    const bottom = paint('border', `╰${'─'.repeat(leftWidth)}┴${'─'.repeat(middleWidth)}┴${'─'.repeat(rightWidth)}╯`);
    const title = ` Action Hub 管理  ${paint('dim', this.cwd)}`;
    const lines = [top, `${paint('border', '│')}${padRight(fit(title, inner), inner)}${paint('border', '│')}`, separator];

    const left = this.renderLeft(leftWidth);
    const middle = this.renderMiddle(middleWidth);
    const right = this.renderRight(rightWidth);
    for (let index = 0; index < HEIGHT; index += 1) {
      lines.push(`${paint('border', '│')}${padRight(left[index] ?? '', leftWidth)}${paint('border', '│')}${padRight(middle[index] ?? '', middleWidth)}${paint('border', '│')}${padRight(right[index] ?? '', rightWidth)}${paint('border', '│')}`);
    }
    lines.push(separator);
    const help = this.search
      ? '输入搜索 · Enter 结束搜索 · Esc 清空 · Alt+R 正则'
      : '←→ 切换栏 · ↑↓ 移动 · Enter 打开 · Tab 插入 · n 新建 · e 编辑 · d 删除 · m 模式 · p 固定 · g 分组 · f 搜索 · q 关闭';
    const helpLine = ` ${help}`;
    const fittedHelp = helpLine.length > inner ? `${helpLine.slice(0, Math.max(0, inner - 1))}…` : helpLine;
    lines.push(`${paint('border', '│')}${padRight(paint('dim', fittedHelp), inner)}${paint('border', '│')}`);
    lines.push(bottom);
    return lines;
  }

  renderLeft(width) {
    const theme = this.theme;
    const paint = (color, value) => (typeof theme?.fg === 'function' ? theme.fg(color, value) : value);
    const out = [fit(' ' + paint('dim', '导航'), width - 1)];
    this.sections.forEach((section) => {
      const active = section.id === this.sectionId;
      const focused = active && this.focus === 'left';
      const marker = active ? paint('accent', focused ? '▸' : '•') : ' ';
      const label = active ? paint('accent', section.label) : section.label;
      out.push(fit(` ${marker} ${label} ${paint('dim', String(section.count))}`, width - 1));
    });
    out.push('');
    out.push(fit(' ' + paint('dim', '数据目录'), width - 1));
    const dir = String(this.data.dataDir ?? '').replace(/^.*[\\/]/u, '');
    out.push(paint('dim', fit(` ${dir}`, width - 1)));
    return out;
  }

  renderMiddle(width) {
    const theme = this.theme;
    const paint = (color, value) => (typeof theme?.fg === 'function' ? theme.fg(color, value) : value);
    const out = [` ${paint('dim', this.sectionId === 'actions' ? 'Actions' : this.sectionId === 'groups' ? '分组' : this.sectionId === 'projects' ? '项目' : '工具')}`];
    const queryLine = this.search
      ? `${paint('accent', '搜索:')} ${this.query}${paint('accent', '▌')}${this.regex ? paint('warning', ' .*') : ''}`
      : `${paint('dim', '搜索:')} ${this.query}${this.regex ? paint('warning', ' .*') : ''}  ${paint('dim', 'f 输入')}`;
    out.push(fit(queryLine, width - 2));
    out.push('');
    const items = this.filteredItems;
    if (items.length === 0) {
      out.push(` ${paint('dim', '没有匹配项')}`);
      return out;
    }
    const visible = Math.max(1, HEIGHT - 5);
    const start = Math.max(0, Math.min(this.selected - Math.floor(visible / 2), items.length - visible));
    for (let index = start; index < Math.min(items.length, start + visible); index += 1) {
      const item = items[index];
      const active = index === this.selected;
      const marker = active ? paint('accent', '❯') : ' ';
      const label = active ? paint('accent', item.name) : item.name;
      const mode = this.sectionId === 'actions'
        ? (item.mode === 'skill' ? paint('success', 'S') : paint('dim', 'C'))
        : this.sectionId === 'groups'
          ? (item.global ? paint('warning', 'G') : ' ')
          : ' ';
      out.push(fit(` ${marker}${mode} ${label}`, width - 1));
    }
    if (items.length > visible) out.push(` ${paint('dim', `${this.selected + 1}/${items.length}`)}`);
    return out;
  }

  renderRight(width) {
    const theme = this.theme;
    const paint = (color, value) => (typeof theme?.fg === 'function' ? theme.fg(color, value) : value);
    const out = [' ' + paint('dim', '详情')];
    const item = this.currentItem;
    if (item === null) {
      out.push(` ${paint('dim', '没有选中项')}`);
      return out;
    }
    const push = (label, value) => {
      out.push(fit(` ${paint('dim', `${label}:`)} ${value ?? ''}`, width - 1));
    };
    if (this.sectionId === 'actions') {
      push('名称', item.name);
      push('模式', item.mode === 'skill' ? 'Skill' : 'Command');
      push('描述', item.description);
      push('分类', item.category || '—');
      push('标签', (item.tags ?? []).join(', ') || '—');
      push('参数', item.argsHint || '—');
      push('固定', item.pinned ? '是' : '否');
      push('使用', String(item.usage?.count ?? 0));
      push('分组', (item.groups ?? []).join(', ') || '—');
      push('资源', String((item.resources ?? []).length));
    } else if (this.sectionId === 'groups') {
      push('名称', item.name);
      push('ID', item.id);
      push('全局', item.global ? '是' : '否');
      const names = new Map(this.groups.map((group) => [group.id, group.name]));
      push('包含', (item.includes ?? []).map((id) => names.get(id) ?? id).join(', ') || '—');
      const members = this.actions.filter((action) => (action.groups ?? []).includes(item.id)).map((action) => action.name);
      push('成员', members.join(', ') || '—');
    } else if (this.sectionId === 'projects') {
      push('名称', item.label);
      push('路径', item.path);
      const names = new Map(this.groups.map((group) => [group.id, group.name]));
      push('直接分组', (item.groups ?? []).map((id) => names.get(id) ?? id).join(', ') || '—');
      push('直接 Action', (item.actions ?? []).join(', ') || '—');
      push('屏蔽分组', (item.excludeGroups ?? []).map((id) => names.get(id) ?? id).join(', ') || '—');
      push('屏蔽 Action', (item.excludeActions ?? []).join(', ') || '—');
    } else {
      push('作用', item.description);
      push('提示', this.sectionId === 'tools' ? 'Enter 执行' : '');
    }
    return out;
  }
}
