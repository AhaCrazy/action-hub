# Action Hub

一套可移植的 Action 库，在每个 harness 中提供原生使用体验。

**Action** 就是一个标准 Agent Skill 目录：`SKILL.md` 加可选资源文件。同一个目录既可以作为模型可调用的 **Skill**，也可以只作为用户主动调用的 **Command**。分组、全局分组、项目范围和项目级屏蔽都保存在本地状态里，不写进可移植的 Skill 文档。

本仓库采用 monorepo 结构：

```text
packages/
  core/   action-hub       与 harness 无关的通用库和状态模型
  dsh/    dsh-action-hub   DSH Cordis 适配器（原生 Web UI、Alt+A）
  pi/     pi-action-hub    Pi 包（原生 TUI 面板、Alt+A）
docs/     架构与适配器契约
```

core 刻意不依赖 Cordis、DSH、Pi、React 或终端 UI。每个适配器只负责 harness 原生的 UI、快捷键、插入方式、项目识别和 Skill 注册。

## 开发

```bash
npm install
npm test
```

`npm test` 会依次运行 core、DSH 适配器和 Pi 适配器的测试。

适配器目前通过 workspace 内的 `file:../core` 链接共享核心，等 API 稳定后仍然可以分别发布为独立 npm 包。

## 包说明

- [`packages/core`](packages/core) — 库、`state.json`、分组、范围、搜索、导入导出。
- [`packages/dsh`](packages/dsh) — DSH 插件（Cordis）。
- [`packages/pi`](packages/pi) — Pi 包。

## 数据目录

所有适配器默认使用同一份数据：

```text
$ACTION_HUB_HOME/            # 默认 ~/.action-hub
  library/<skill-name>/
    SKILL.md
  state.json
```

`SKILL.md` 是可移植产物；`state.json` 只是本地元数据，不会写入导出包。

core 的写入使用跨进程锁和原子替换 `state.json`，因此 DSH 进程和 Pi 进程可以安全共享同一份库。

## 文档

- [架构说明](docs/architecture.md)
- [适配器契约](docs/adapter-contract.md)
- [Pi 适配器设计](docs/pi-adapter.md)

## 状态

仓库刚完成合并。包边界和存储 schema 已经足够稳定，可以先用于验证；公共 API 尚未冻结。
