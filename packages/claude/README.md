# Claude Code 版 Action Hub

Claude Code 没有 Pi / DSH 那种自定义 TUI 或进程内 JS 扩展 API。本适配器把共享 Action 同步成 Claude Code 原生组件：

- **Skill 模式** → `.claude/skills/<name>/`，Claude Code 自动发现；
- **Command 模式** → `.claude/commands/ah/<name>.md`，以 `/ah:<name>` 调用。

同步是显式的：修改 Action、分组或项目范围后运行一次 `action-hub-claude sync`，再启动 Claude Code。

## 安装

当前未发布 npm，先从本仓库使用：

```powershell
npm install
node .\packages\claude\bin\action-hub-claude.js status
```

也可以打包后全局安装：

```powershell
npm run pack:claude
npm install -g .\claude-action-hub-0.1.0.tgz
action-hub-claude status
```

## 使用

### 同步当前项目

```powershell
action-hub-claude sync
```

会写入当前项目根的：

```text
.claude/
  skills/<skill-name>/       # Skill Action
  commands/ah/<name>.md      # Command Action，调用 /ah:<name>
  action-hub/generated.json  # 生成清单
  action-hub/scope.json      # 可选项目范围
```

只同步当前项目范围可用的 Action；没有 `scope.json` 时使用默认分组 / 全局分组。

### 查看状态

```powershell
action-hub-claude status
```

显示项目根、可用 Action 数量、已生成数量和范围状态。

### 清理

```powershell
action-hub-claude clean
```

只删除清单里记录的 Action Hub 生成物，不会删除用户自己的 Skills 或 Commands。

### 设置项目范围

```powershell
action-hub-claude scope --groups Common --actions my-action
```

也支持：

```text
--exclude-groups
--exclude-actions
--label
--clear
```

分组和 Action 可以使用名称或 ID。

### 全局同步

```powershell
action-hub-claude sync --global
```

写入 `~/.claude/skills` 和 `~/.claude/commands/ah`，只使用全局可用范围。项目级同步优先于全局同步。

## 工作流

```powershell
# 在 Action Hub 所在项目/工作区
action-hub-claude sync

# 再启动 Claude Code
claude
```

`sync` 是幂等的；重复运行会替换 Action Hub 生成物，并清理已经不可用的项。

## 限制

- 不支持 Pi / OMP 那种三栏 TUI 管理界面；
- 不支持运行时自动发现新 Action，需要执行一次 `sync`；
- 生成目录会出现在项目的 `.claude/` 下，建议把 `.claude/action-hub/` 加入版本控制，或按团队习惯忽略；
- Skill 使用目录复制，不依赖 Windows symlink 权限。
