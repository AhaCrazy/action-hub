# Codex 版 Action Hub

Codex 原生支持 Agent Skills。本适配器把共享 Action 同步成 Codex 原生 Skill 目录：

- **Skill 模式** → 项目 `.agents/skills/<name>/`，由 Codex 隐式或显式调用；
- **Command 模式** → 同样生成 Skill，但通过 `agents/openai.yaml` 设置 `allow_implicit_invocation: false`，只能由用户用 `$<name>` 或 `/skills` 主动调用。

这样既保留 Codex 原生 Skills 体验，又保留 Action Hub 的 Command 语义。

## 安装

当前未发布 npm，先从仓库使用：

```powershell
npm install
node .\packages\codex\bin\action-hub-codex.js status
```

也可以打包后全局安装：

```powershell
npm run pack:codex
npm install -g .\codex-action-hub-0.1.0.tgz
action-hub-codex status
```

## 使用

### 同步当前项目

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

同步完成后启动 Codex；Codex 会自动发现 `.agents/skills`。如果新 Skill 没出现，重启 Codex。

### 查看状态

```powershell
action-hub-codex status
```

### 清理

```powershell
action-hub-codex clean
```

只删除清单里记录的 Action Hub 生成物，不会删除用户自己的 Skills。

### 设置项目范围

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

分组和 Action 可以使用名称或 ID。

### 全局同步

```powershell
action-hub-codex sync --global
```

写入用户级 `~/.agents/skills`，只使用全局可用范围。项目级同步优先于全局同步。

## 工作流

```powershell
action-hub-codex sync
codex
```

修改 Action、分组或项目范围后，重新 sync 再启动 Codex。

## 限制

- Codex 没有 Pi / OMP 那种三栏 TUI 管理界面；
- 需要显式执行 `sync`，Codex 不会读取 Action Hub 的运行时范围；
- Skill 使用目录复制，不依赖 Windows symlink 权限；
- 生成目录会出现在项目的 `.agents/` 下，是否提交由团队决定。

## 内置 Action

Codex 适配器自带只读的 `action-import-assistant`，它是显式调用 Skill：

```text
$action-import-assistant
```

它不会自动触发，也不会写入共享库；卸载适配器后即消失。

