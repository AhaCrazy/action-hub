# 架构说明

## 目标

`action-hub` 是一个**库和数据模型**，不是守护进程，不是 Web 应用，也不是某个 harness 专属插件。

同一份标准 Skill 目录需要在所有适配器中可用，同时每个适配器保留自己的原生体验：

- DSH：Cordis 插件、Alt+A 面板、composer 插入、Skill provider。
- Pi：Pi 包、TUI 面板、`resources_discover`、编辑器插入。
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
  ├─ 状态 schema：模式、分组、范围、屏蔽、使用记录
  ├─ 可用性解析
  ├─ 搜索与排序
  ├─ 文件夹/ZIP 导入导出
  └─ 存储锁与原子写入
```

任何适配器都不应该直接读写 `state.json`。所有修改都经过 core，这样 DSH 和 Pi 才能安全共享同一份库。

## 存储归属

推荐默认结构：

```text
$ACTION_HUB_HOME/            # 默认 ~/.action-hub
  library/
  state.json
  .lock
```

适配器可以把 `ACTION_HUB_HOME` 指向某个 harness 专属目录，但共用默认目录能让用户在所有 harness 中使用同一份可移植库。

写入必须满足：

1. 由跨进程锁保护；
2. 在锁内完成读取—修改—写入；
3. 写入临时文件后原子重命名；
4. 写入完成后通过文件监听通知已打开的 UI。

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
