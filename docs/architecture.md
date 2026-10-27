# 架构说明

## 目标

`action-hub` 是一个**库和数据模型**，不是守护进程，不是 Web 应用，也不是某个 harness 专属插件。

同一份标准 Skill 目录需要在所有适配器中可用，同时每个适配器保留自己的原生体验：

- DSH：Cordis 插件、Alt+A 面板、composer 插入、Skill provider。
- Pi：Pi 包、TUI 面板、`resources_discover`、编辑器插入。
- OMP：复用 Pi 适配器，通过 OMP 的 legacy Pi 兼容层加载；项目范围跟随 OMP session 目录。
- 其他 harness：使用各自的扩展点。

## 分层

```text
adapter（DSH / Pi / ...）
  ├─ harness 上下文：cwd、项目根、会话身份
  ├─ 原生 UI：面板、对话框、快捷键、主题、键位
  ├─ 插入：composer / editor / host prompt API
  └─ 注册：模型可见的 Skill 和 Command
            │
            ▼
core（本仓库）
  ├─ SKILL.md 库
  ├─ 共享状态 schema：模式、分组、全局分组、使用记录
  ├─ 项目范围 schema 与原子读写
  ├─ 可用性解析
  ├─ 搜索与排序
  ├─ 文件夹/ZIP 导入导出
  └─ 存储锁与原子写入
```

共享状态（Action、分组、全局分组）由 core 统一管理。**项目范围不进入共享库**：它由每个适配器按自己的 workspace 生命周期保存，再作为输入传给 core 的可用性解析。

任何适配器都不应该直接读写共享 `state.json`。所有共享状态的修改都经过 core，这样 DSH 和 Pi 才能安全共享同一份库。

## 存储归属

推荐默认结构：

```text
$ACTION_HUB_HOME/            # 默认 ~/.action-hub
  library/
  state.json                 # 共享：Action、分组、全局分组
  .lock

DSH 本地
  ~/.dsh/action-hub/workspaces/<workspaceId>.json

Pi 本地
  ~/.pi/agent/sessions/<encoded-cwd>/action-hub/scope.json

OMP 本地
  ~/.omp/agent/sessions/<encoded-cwd>/action-hub/scope.json
  （--profile 时在 ~/.omp/profiles/<profile>/agent/sessions）
```

适配器可以把 `ACTION_HUB_HOME` 指向某个 harness 专属目录，但共用默认目录能让用户在所有 harness 中使用同一份可移植库。

项目范围的归属规则：

- 它属于某个 harness 的工作区，而不是项目仓库；
- DSH 用稳定的 workspace ID 作为键；
- Pi / OMP 用当前 session 目录作为键；
- 两个 harness 的项目范围默认不共享；
- 删除工作区时，对应范围文件由适配器清理或随目录一起删除。

共享状态写入必须满足：

1. 由跨进程锁保护；
2. 在锁内完成读取—修改—写入；
3. 写入临时文件后原子重命名；
4. 写入完成后通过文件监听通知已打开的 UI。

项目范围文件由各适配器原子写入；它们不属于共享锁的临界区。

后续版本可以加入单调递增的 `revision`，用于检测并发编辑冲突。

## 可移植性边界

core 不能 import：

- Cordis / DSH 包；
- Pi 包；
- React 或 DOM；
- 终端 UI 库；
- harness 的 workspace registry。

harness 专属概念通过 `HarnessContext` 传入：

```ts
interface HarnessContext {
  cwd: string;
  projectRoot?: string;
  workspaceId?: string;
}
```

core 只暴露行为，不暴露展示方式。

## 非目标

- 运行共享 HTTP 服务。
- 打开独立浏览器窗口。
- 提供一套所有 harness 共用的通用 UI。
- 执行 Skill 脚本。Skill 内容是提示词数据；工具审批和沙箱仍由 harness 负责。
