/**
 * Native Pi TUI palette for Action Hub.
 *
 * Uses Pi's theme and terminal components. It opens as a temporary overlay; no
 * DOM, browser, server, or second renderer is involved.
 */
import { Key, matchesKey, truncateToWidth, visibleWidth } from '@earendil-works/pi-tui';

const MAX_ROWS = 12;

function compileMatcher(query, regex) {
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

export class ActionPalette {
  constructor({ tui, theme, actions, groups = [], done, initialQuery = '' }) {
    this.tui = tui;
    this.theme = theme;
    this.actions = actions;
    this.groups = groups;
    this.done = done;
    this.query = initialQuery;
    this.cursor = initialQuery.length;
    this.selected = 0;
    this.regex = false;
    this.focused = false;
  }

  get matches() {
    const matches = compileMatcher(this.query, this.regex);
    return this.actions.filter((action) => this.searchText(action).split('\n').some(matches));
  }

  searchText(action) {
    const groups = new Map(this.groups.map((group) => [group.id, group.name]));
    return [
      action.name,
      action.description ?? '',
      ...(action.groups ?? []).map((id) => groups.get(id) ?? id),
    ].join(' ');
  }

  get current() {
    return this.matches[this.selected] ?? null;
  }

  handleInput(data) {
    if (matchesKey(data, Key.escape)) {
      this.done(undefined);
      return;
    }
    if (matchesKey(data, Key.up)) {
      this.selected = Math.max(0, this.selected - 1);
      this.tui.requestRender();
      return;
    }
    if (matchesKey(data, Key.down)) {
      this.selected = Math.min(this.matches.length - 1, this.selected + 1);
      this.tui.requestRender();
      return;
    }
    if (matchesKey(data, 'alt+r')) {
      this.regex = !this.regex;
      this.selected = 0;
      this.tui.requestRender();
      return;
    }
    if (matchesKey(data, Key.return) || matchesKey(data, 'tab')) {
      const action = this.current;
      if (action !== null) this.done(action);
      return;
    }
    if (matchesKey(data, Key.backspace) || data === '\u007f') {
      if (this.cursor > 0) {
        this.query = this.query.slice(0, this.cursor - 1) + this.query.slice(this.cursor);
        this.cursor -= 1;
        this.selected = 0;
        this.tui.requestRender();
      }
      return;
    }
    if (matchesKey(data, Key.left)) {
      this.cursor = Math.max(0, this.cursor - 1);
      this.tui.requestRender();
      return;
    }
    if (matchesKey(data, Key.right)) {
      this.cursor = Math.min(this.query.length, this.cursor + 1);
      this.tui.requestRender();
      return;
    }
    if (data.length === 1 && data.charCodeAt(0) >= 32) {
      this.query = this.query.slice(0, this.cursor) + data + this.query.slice(this.cursor);
      this.cursor += 1;
      this.selected = 0;
      this.tui.requestRender();
    }
  }

  invalidate() {}

  dispose() {}

  render(width) {
    const theme = this.theme;
    const paint = (color, value) => (typeof theme?.fg === 'function' ? theme.fg(color, value) : value);
    const inner = Math.max(40, Math.min(width, 88) - 2);
    const row = (value) => paint('border', '│') + padRight(value, inner) + paint('border', '│');
    const header = `${paint('accent', ' Action Hub ')}${paint('dim', '  /ah  ·  Alt+A')}`;
    const lines = [paint('border', `╭${'─'.repeat(inner)}╮`), row(` ${header}`)];

    const cursor = this.cursor < this.query.length
      ? `${this.query.slice(0, this.cursor)}${paint('accent', '▌')}${this.query.slice(this.cursor + 1)}`
      : `${this.query}${paint('accent', '▌')}`;
    lines.push(row(` ${paint('dim', '搜索:')} ${cursor}${this.regex ? paint('warning', '  .*') : ''}`));
    lines.push(row(''));

    const matches = this.matches;
    if (matches.length === 0) {
      lines.push(row(` ${paint('dim', this.query.trim() === '' ? '还没有 Action。使用 /ah import <路径> 导入。' : '没有匹配的 Action。')}`));
    } else {
      const groupNames = new Map(this.groups.map((group) => [group.id, group.name]));
      const start = Math.max(0, Math.min(this.selected - Math.floor(MAX_ROWS / 2), matches.length - MAX_ROWS));
      for (let index = start; index < Math.min(matches.length, start + MAX_ROWS); index += 1) {
        const action = matches[index];
        const active = index === this.selected;
        const marker = active ? paint('accent', '❯') : ' ';
        const mode = action.mode === 'skill' ? paint('success', '[Skill]') : paint('dim', '[Cmd]  ');
        const name = active ? paint('accent', action.name) : action.name;
        const badges = [
          action.pinned ? '★' : '',
          ...(action.groups ?? []).map((id) => groupNames.get(id)).filter(Boolean),
        ].filter(Boolean).join(' ');
        const details = truncateToWidth(` ${action.description ?? ''}`, Math.max(8, inner - 24 - badges.length));
        lines.push(row(` ${marker} ${mode} ${name} ${badges ? paint('warning', badges) : ''} ${paint('dim', details)}`));
      }
      if (matches.length > MAX_ROWS) {
        lines.push(row(` ${paint('dim', `${this.selected + 1}/${matches.length}`)}`));
      }
    }

    const current = this.current;
    if (current !== null) {
      lines.push(row(''));
      lines.push(row(` ${paint('dim', (current.description ?? '').slice(0, inner - 3))}`));
      if (current.argsHint) lines.push(row(` ${paint('dim', `参数: ${current.argsHint}`)}`));
    }

    lines.push(row(` ${paint('dim', '↑↓ 选择   Enter/Tab 插入   Esc 关闭   Alt+R 正则   /ah manage 管理')}`));
    lines.push(paint('border', `╰${'─'.repeat(inner)}╯`));
    return lines;
  }
}
