# Codex 版 Action Hub

Action Hub 是一个标准 Agent Skill 库。Codex 原生支持 Agent Skills，本适配器把共享 Action 同步成 Codex 原生 Skill：

- **Skill 模式** → 项目 `.agents/skills/<name>/`，Codex 可以隐式或显式调用；
- **Command 模式** → 生成 Skill，并通过 `agents/openai.yaml` 设置 `allow_implicit_invocation: false`，只允许用户主动调用。

Codex 的自定义 prompts 已标记为废弃；本适配器不使用 `~/.codex/prompts`，而是统一使用 Agent Skills。

当前验证目标：Codex Agent Skills 的 `.agents/skills` 目录约定。

## 一、安装说明

### 从本仓库安装

```powershell
npm install
node .\packages\codex\bin\action-hub-codex.js status
```

### 从 release 资产安装

```powershell
npm install -g https://github.com/AhaCrazy/action-hub/releases/latest/download/codex-action-hub.tgz
action-hub-codex status
```

### 验证

```powershell
action-hub-codex status
```

应输出项目根、可用 Action 数量和 Codex 目标目录。

### 更新

重新安装 release 资产，或在仓库内重新执行 `npm install` / `npm run pack:codex`。

## 二、功能说明

### 同步

```powershell
action-hub-codex sync
```

写入当前项目根：

```text
.agents/
  skills/<name>/             # Skill / Command 生成物
  action-hub/generated.json  # 生成清单
.codex/
  action-hub/scope.json      # 可选项目范围
```

同步完成后启动 Codex。Codex 会自动扫描项目里的 `.agents/skills`；如果没有看到新 Skill，重启 Codex。

### Action 的两种模式

#### Skill

源目录被复制为原生 Skill：

```text
.agents/skills/<name>/SKILL.md
```

Codex 可以根据 `description` 隐式调用，也可以用 `$<name>` 或 `/skills` 显式调用。

#### Command

Command 也会生成 Skill，但额外写入：

```text
.agents/skills/<name>/agents/openai.yaml
```

内容包含：

```yaml
policy:
  allow_implicit_invocation: false
```

因此 Command 不会因用户普通请求被模型自动调用，只能由用户主动选择：

```text
$<name>
```

或通过 `/skills` 选择。

### 项目范围

项目范围保存在：

```text
<项目根>/.codex/action-hub/scope.json
```

用 CLI 写入：

```powershell
action-hub-codex scope --groups Common --actions my-action
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
action-hub-codex status
action-hub-codex clean
```

`clean` 只删除 `generated.json` 中记录的生成物；用户自己的 Skills 不会被删除。

### 全局同步

```powershell
action-hub-codex sync --global
```

写入用户级 `~/.agents/skills`，只使用全局可用范围。项目级同步优先于全局同步。

### 推荐工作流

```powershell
action-hub-codex sync
codex
```

修改 Action、分组或项目范围后，需要重新 sync，再启动 Codex。

### 安全边界

- 不覆盖用户已有的同名 Skill，冲突会以警告跳过；
- 只清理清单中记录的生成物；
- 使用目录复制，不依赖 Windows symlink 权限；
- 不执行 Skill 内的脚本。

### 限制

- 没有 Pi / OMP 的三栏 TUI 管理界面；
- 没有运行时自动发现，需要显式 `sync`；
- 生成目录会出现在项目的 `.agents/` 下，是否提交由团队决定。
