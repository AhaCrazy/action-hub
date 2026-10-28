import { createStore, defaultDataDir } from 'action-hub';

import {
  cleanProject,
  status,
  syncProject,
  writeScopeFromNames,
} from './sync.js';

const COMMANDS = new Set(['sync', 'clean', 'status', 'scope']);

function parse(argv) {
  const args = Array.isArray(argv) ? [...argv] : [];
  const command = COMMANDS.has(args[0]) ? args.shift() : 'sync';
  const options = { command };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('-')) throw new Error(`未知参数：${arg}`);
    if (arg === '--global') options.global = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--clear') options.clear = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--cwd') options.cwd = args[++index];
    else if (arg === '--data') options.dataDir = args[++index];
    else if (arg === '--label') options.label = args[++index];
    else if (arg === '--groups') options.groups = args[++index];
    else if (arg === '--actions') options.actions = args[++index];
    else if (arg === '--exclude-groups') options.excludeGroups = args[++index];
    else if (arg === '--exclude-actions') options.excludeActions = args[++index];
    else throw new Error(`未知参数：${arg}`);
  }
  if (options.cwd === undefined) options.cwd = process.cwd();
  if (options.dataDir === undefined) options.dataDir = defaultDataDir();
  return options;
}

function print(value, options) {
  if (options.json) console.log(JSON.stringify(value, null, 2));
  else console.log(value);
}

async function run(options) {
  if (options.help === true) {
    console.log(`用法：
  action-hub-codex sync [--cwd <路径>] [--global] [--dry-run] [--json]
  action-hub-codex clean [--cwd <路径>] [--global]
  action-hub-codex status [--cwd <路径>] [--global] [--json]
  action-hub-codex scope [--cwd <路径>] [--groups <名称,...>] [--actions <名称,...>]
                           [--exclude-groups <名称,...>] [--exclude-actions <名称,...>]
                           [--label <名称>] [--clear]

通用参数：--data <Action Hub 数据目录>`);
    return;
  }
  const cwd = options.cwd;
  const store = createStore({ dataDir: options.dataDir });
  if (options.command === 'sync') {
    const result = await syncProject(store, cwd, options);
    const lines = [
      `Codex 目标：${result.agentsRoot}`,
      `项目根：${result.root}`,
      result.dryRun ? `将同步：${result.added} 个 Action` : `已同步：${result.added} 个 Action，移除：${result.removed} 个`,
      `项目范围：${result.scope === null ? '未配置（使用默认分组/全局分组）' : '已配置'}`,
    ];
    for (const warning of result.warnings) lines.push(`警告：${warning}`);
    print(options.json ? { agentsRoot: result.agentsRoot, root: result.root, added: result.added, removed: result.removed, warnings: result.warnings, items: result.items } : lines.join('\n'), options);
    return;
  }
  if (options.command === 'clean') {
    const result = await cleanProject(cwd, options);
    print(options.json ? result : `已清理 ${result.removed} 个生成项：${result.agentsRoot}`, options);
    return;
  }
  if (options.command === 'status') {
    const result = await status(cwd, { ...options, store });
    const lines = [
      `Codex 目标：${result.agentsRoot}`,
      `项目根：${result.root}`,
      `可用 Action：${result.actions.length}`,
      `已生成：${result.generated}`,
      `项目范围：${result.scope === null ? '未配置' : '已配置'}`,
    ];
    print(options.json ? { agentsRoot: result.agentsRoot, root: result.root, actions: result.actions.length, generated: result.generated, scope: result.scope === null ? null : result.scope, items: result.items } : lines.join('\n'), options);
    return;
  }
  if (options.command === 'scope') {
    if (options.clear === true) {
      const result = await writeScopeFromNames(store, cwd, {
        ...options,
        groups: [],
        actions: [],
        excludeGroups: [],
        excludeActions: [],
      });
      print(options.json ? result : `已清空项目范围：${result.root}`, options);
      return;
    }
    const result = await writeScopeFromNames(store, cwd, options);
    print(options.json ? result : `已写入项目范围：${result.root}`, options);
    return;
  }
  throw new Error(`未知命令：${options.command}`);
}

export async function main(argv) {
  await run(parse(argv));
}
