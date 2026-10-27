# Claude Code 版 Action Hub

Action Hub 是一个标准 Agent Skill 库。Claude Code 没有 Pi / DSH 那种自定义 TUI 或进程内 JS 扩展 API，本适配器把共享 Action 同步成 Claude Code 原生组件：

- **Skill 模式** → `.claude/skills/<name>/`，Claude Code 自动发现；
- **Command 模式** → `.claude/commands/ah/<name>.md`，以 `/ah:<name>` 调用。

当前验证目标：Claude Code 原生 `skills/` 与 `commands/` 目录约定。

## 一、安装说明

### 从本仓库安装

```powershell
npm install
node .\packages\claude\bin\action-hub-claude.js status
```

### 从 release 资产安装

```powershell
npm install -g https://github.com/AhaCrazy/action-hub/releases/latest/download/claude-action-hub.tgz
action-hub-claude status
```

### 验证

```powershell
action-hub-claude status
```

应输出项目根、可用 Action 数量和 Claude Code 目标目录。

### 更新

重新安装 release 资产，或在仓库内重新执行 `npm install` / `npm run pack:claude`。

## 二、功能说明

### 同步

```powershell
action-hub-claude sync
```

写入当前项目根：

```text
.claude/
  skills/<skill-name>/       # Skill Action
  commands/ah/<name>.md      # Command Action，调用 /ah:<name>
  action-hub/generated.json  # 生成清单
  action-hub/scope.json      # 可选项目范围
```

同步完成后启动 Claude Code。Claude Code 会按原生机制发现这些 Skills 和 Commands。

### Action 的两种模式

- **Skill**：复制为原生 Skill，Claude Code 可以按描述自动发现和读取；
- **Command**：生成原生 Slash Command，例如 `command-beta` 生成 `/ah:command-beta`；参数通过 `$ARGUMENTS` 传入。

Command 文件的 frontmatter 包含 `description` 和 `argument-hint`；资源型 Action 会在正文末尾附带资源目录。

### 项目范围

项目范围保存在：

```text
<项目根>/.claude/action-hub/scope.json
```

用 CLI 写入：

```powershell
action-hub-claude scope --groups Common --actions my-action
```

支持：

```text
--exclude-groups
--exclude-actions
--label
--clear
```

没有 `scope.json` 时使用默认分组和全局分组。

### 状态与清理

```powershell
action-hub-claude status
action-hub-claude clean
```

`clean` 只删除 `generated.json` 中记录的生成物；用户自己的 Skills 或 Commands 不会被删除。

### 全局同步

```powershell
action-hub-claude sync --global
```

写入用户级 `~/.claude/skills` 和 `~/.claude/commands/ah`，只使用全局可用范围。项目级同步优先于全局同步。

### 推荐工作流

```powershell
action-hub-claude sync
claude
```

修改 Action、分组或项目范围后，需要重新 sync，再重启 Claude Code 会话。

### 安全边界

- 不覆盖用户已有的同名 Skill 或 Command，冲突会以警告跳过；
- 只清理清单中记录的生成物；
- 使用目录复制，不依赖 Windows symlink 权限；
- 不执行 Skill 内的脚本。

### 限制

- 没有 Pi / OMP 的三栏 TUI 管理界面；
- 没有运行时自动发现，需要显式 `sync`；
- 生成目录会出现在项目的 `.claude/` 下，是否提交由团队决定。
