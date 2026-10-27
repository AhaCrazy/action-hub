# Pi 适配器设计

本机验证环境：`@earendil-works/pi-coding-agent@1.4.0`，TUI harness。

## 原生能力

| 能力 | Pi API |
| --- | --- |
| 命令 | `pi.registerCommand('ah', ...)` |
| 快捷键 | `pi.registerShortcut('alt+a', ...)` |
| 面板 | `ctx.ui.custom(...)` + `@earendil-works/pi-tui` |
| 插入 | `ctx.ui.pasteToEditor(text)` |
| Skill 发现 | `pi.on('resources_discover', ...)` → `skillPaths` |
| 设置界面 | 自定义 TUI 页面，或 `ctx.ui.select/input` |

## 映射关系

- **Skill 类型 Action** → 在 `resources_discover` 中返回它的目录；Pi 会把它放进模型目录，并提供 `/skill:<name>`。
- **Command 类型 Action** → 永不作为 Skill 返回；面板把渲染后的提示词插入编辑器。
- **面板** → 自定义 TUI overlay：搜索（子串 + 正则）、列表、预览、参数、Enter 插入。
- **项目范围** → 使用 `ctx.cwd` 或最近的 `.git` 根；全局分组对所有项目生效；项目级屏蔽使用共享状态。
- **管理** → 后续增加 `/ah manage` TUI 页面，处理分组、范围、导入导出和模式切换。修改 Skill 可见性后，需要调用 `ctx.reload()` 或提示用户。

## 包结构

```text
packages/pi/
  package.json        # pi manifest、pi-package keyword、peerDependencies
  extensions/         # 源码入口
  src/                # 面板和 catalog 源码
  dist/action-hub.js  # 发布用自包含 bundle（含 core）
```

安装方式：发布后使用 `pi install npm:pi-action-hub`，或从仓库根执行
`pi install git:github.com/AhaCrazy/action-hub`。Pi 在自己的进程内运行扩展；
没有服务、端口或浏览器窗口。

## Pi 1.4.0 的限制

- `ctx.ui.custom` 只在 TUI 模式可用；print/JSON 模式没有 UI。
- 命令和快捷键只在交互模式可用。
- Skill 在启动和 `/reload` 时发现；范围变化需要重新加载。
- 使用 Pi 的主题和 `KeybindingsManager`，不要硬编码颜色或终端按键处理。
- 扩展工厂里不要启动 watcher/timer；应在 `session_start` 启动，在 `session_shutdown` 清理。
