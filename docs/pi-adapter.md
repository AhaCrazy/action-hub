# Pi / OMP 适配器设计

本机验证环境：`@earendil-works/pi-coding-agent@1.4.0` 与 `omp@18.1.16`，TUI harness。

## 原生能力

| 能力 | Pi / OMP API |
| --- | --- |
| 命令 | `pi.registerCommand('ah', ...)` |
| 快捷键 | `pi.registerShortcut('alt+a', ...)` |
| 面板 | `ctx.ui.custom(...)` + `pi-tui` |
| 插入 | `ctx.ui.pasteToEditor(text)` |
| Skill 发现 | `pi.on('resources_discover', ...)` → `skillPaths` |
| 设置界面 | 自定义 TUI 页面，或 `ctx.ui.select/input` |

## 映射关系

- **Skill 类型 Action** → 在 `resources_discover` 中返回它的目录；Pi 会把它放进模型目录，并提供 `/skill:<name>`。
- **Command 类型 Action** → 永不作为 Skill 返回；面板把渲染后的提示词插入编辑器。
- **面板** → 自定义 TUI overlay：搜索（子串 + 正则）、列表、预览、Enter 插入。
- **项目范围** → 按当前 harness 的实际 session 存储根保存：`<sessionDir>/<encoded-project-root>/action-hub/scope.json`。项目根取最近的已登记工作区或 `.git` 祖先，没有则取 cwd。Pi 默认在 `~/.pi/agent/sessions`，OMP 默认在 `~/.omp/agent/sessions`（profile 在 `~/.omp/profiles/<profile>/agent/sessions`）；删除该 session 子目录会一起删除范围。
- **管理** → `/ah manage` 与 `Ctrl+Alt+A` 打开 TUI 管理界面，覆盖 Action、分组、项目范围、导入导出和设置。通过 `/ah manage` 进入时使用原生 reload；快捷键入口会尝试通过编辑器提交 `/ah reload` 自动重载，编辑器有草稿或提交失败时提示手动执行 `/ah reload`。

## OMP 兼容

- 包同时声明 `pi` 和 `omp` manifest；OMP 的插件加载器接受 `pkg.omp || pkg.pi`。
- OMP 的 `legacy-pi-compat` 会把 `@earendil-works/pi-*` 导入映射到 `@oh-my-pi/pi-*`。
- 项目范围不硬编码 `~/.pi`，而是在 `session_start` / 命令上下文里读取 `ctx.sessionManager.getSessionDir()`，因此能跟随 OMP 的默认目录、`--session-dir` 和 `--profile`。
- 安装：`omp plugin install git:github.com/AhaCrazy/action-hub`。

## 包结构

```text
packages/pi/
  package.json        # pi / omp manifest、pi-package keyword、peerDependencies
  extensions/         # 源码入口
  src/                # 面板、管理界面、catalog、导入导出
  dist/action-hub.js  # 发布用自包含 bundle（含 core）
```

安装方式：npm 包尚未发布，当前使用 `pi install git:github.com/AhaCrazy/action-hub`；OMP 使用
`omp plugin install git:github.com/AhaCrazy/action-hub`。Pi / OMP 在自己的进程内运行扩展；
没有服务、端口或浏览器窗口。

## Pi 1.4.0 / OMP 18.x 的限制

- `ctx.ui.custom` 只在 TUI 模式可用；print/JSON 模式没有 UI。
- 命令和快捷键只在交互模式可用。
- Skill 在启动、`/ah reload` 或管理界面退出后的自动加载时发现。
- 使用 Pi / OMP 的主题和 `KeybindingsManager`，不要硬编码颜色或终端按键处理。
- 扩展工厂里不要启动 watcher/timer；应在 `session_start` 启动，在 `session_shutdown` 清理。
- OMP 的 `Alt+A` 已被内置 Agent Hub 占用，Action Hub 使用 `/ah` 或 `Alt+Shift+A`。
