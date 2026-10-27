/**
 * Reusable checkbox list for Pi TUI management screens.
 *
 * Supports a filtered query, regex mode, and space-to-toggle selection.
 */
import { Key, matchesKey, truncateToWidth, visibleWidth } from '@earendil-works/pi-tui';

const MAX_ROWS = 14;

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

export class MultiSelect {
  constructor({ tui, theme, title, items, initialSelected = [], done }) {
    this.tui = tui;
    this.theme = theme;
    this.title = title;
    this.items = items;
    this.selected = new Set(initialSelected);
    this.done = done;
    this.query = '';
    this.cursor = 0;
    this.index = 0;
    this.regex = false;
    this.focused = false;
  }

  get filtered() {
    const matches = matcherFor(this.query, this.regex);
    return this.items.filter((item) => matches(`${item.label} ${item.description ?? ''}`));
  }

  get current() {
    return this.filtered[this.index] ?? null;
  }

  handleInput(data) {
    if (matchesKey(data, Key.escape)) {
      this.done(undefined);
      return;
    }
    if (matchesKey(data, Key.up)) {
      this.index = Math.max(0, this.index - 1);
      this.tui.requestRender();
      return;
    }
    if (matchesKey(data, Key.down)) {
      this.index = Math.min(this.filtered.length - 1, this.index + 1);
      this.tui.requestRender();
      return;
    }
    if (matchesKey(data, 'alt+r')) {
      this.regex = !this.regex;
      this.index = 0;
      this.tui.requestRender();
      return;
    }
    if (matchesKey(data, Key.return)) {
      this.done([...this.selected]);
      return;
    }
    if (matchesKey(data, Key.space) || data === ' ') {
      const item = this.current;
      if (item !== null) {
        if (this.selected.has(item.key)) this.selected.delete(item.key);
        else this.selected.add(item.key);
        this.tui.requestRender();
      }
      return;
    }
    if (matchesKey(data, Key.backspace) || data === '\u007f') {
      if (this.cursor > 0) {
        this.query = this.query.slice(0, this.cursor - 1) + this.query.slice(this.cursor);
        this.cursor -= 1;
        this.index = 0;
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
      this.index = 0;
      this.tui.requestRender();
    }
  }

  invalidate() {}

  dispose() {}

  render(width) {
    const theme = this.theme;
    const paint = (color, value) => (typeof theme?.fg === 'function' ? theme.fg(color, value) : value);
    const inner = Math.max(44, Math.min(width, 88) - 2);
    const row = (value) => paint('border', '│') + padRight(value, inner) + paint('border', '│');
    const currentText = this.cursor < this.query.length
      ? `${this.query.slice(0, this.cursor)}${paint('accent', '▌')}${this.query.slice(this.cursor + 1)}`
      : `${this.query}${paint('accent', '▌')}`;
    const lines = [paint('border', `╭${'─'.repeat(inner)}╮`), row(` ${paint('accent', ` ${this.title} `)}`), row('')];
    lines.push(row(` ${paint('dim', '搜索:')} ${currentText}${this.regex ? paint('warning', '  .*') : ''}`));
    lines.push(row(''));

    const filtered = this.filtered;
    if (filtered.length === 0) {
      lines.push(row(` ${paint('dim', '没有匹配项')}`));
    } else {
      const start = Math.max(0, Math.min(this.index - Math.floor(MAX_ROWS / 2), filtered.length - MAX_ROWS));
      for (let offset = start; offset < Math.min(filtered.length, start + MAX_ROWS); offset += 1) {
        const item = filtered[offset];
        const active = offset === this.index;
        const checked = this.selected.has(item.key);
        const marker = active ? paint('accent', '❯') : ' ';
        const box = checked ? paint('success', '[x]') : paint('dim', '[ ]');
        const label = active ? paint('accent', item.label) : item.label;
        const description = truncateToWidth(` ${item.description ?? ''}`, Math.max(8, inner - 24));
        lines.push(row(` ${marker} ${box} ${label} ${paint('dim', description)}`));
      }
      if (filtered.length > MAX_ROWS) {
        lines.push(row(` ${paint('dim', `${this.index + 1}/${filtered.length}`)}`));
      }
    }

    lines.push(row(''));
    lines.push(row(` ${paint('dim', `已选 ${this.selected.size} 项 · 空格勾选 · Enter 完成 · Esc 取消 · Alt+R 正则`)}`));
    lines.push(paint('border', `╰${'─'.repeat(inner)}╯`));
    return lines;
  }
}
