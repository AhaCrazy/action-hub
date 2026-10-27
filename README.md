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

开发态通过 workspace 内的 `file:../core` 链接共享核心；对外发布时，两个适配器会把 core 打进各自的 `dist`，成为两个自包含的安装包。

## 两个发布包

这个仓库对外提供两个独立的安装产物：

```text
pi-action-hub     Pi 包
dsh-action-hub    DSH bundle
```

两个包都自带 core，运行时不需要额外安装 `action-hub` 包。

### 构建与打包

```bash
npm run build
npm run pack:pi
npm run pack:dsh
```

生成：

```text
pi-action-hub-0.1.0.tgz
dsh-action-hub-0.1.0.tgz
```

### Pi 安装

```powershell
pi install npm:pi-action-hub
```

或者直接从本仓库的 Git 根安装：

```powershell
pi install git:github.com/AhaCrazy/action-hub
```

### DSH 安装

在 DSH 插件管理器中安装 `packages/dsh` 目录，或安装发布后的 `dsh-action-hub` bundle。

本地构建后也可以直接安装目录：

```text
E:\Data\Projs\action-hub\packages\dsh
```

## 包说明

- [`packages/core`](packages/core) — 库、`state.json`、分组、范围、搜索、导入导出。
- [`packages/dsh`](packages/dsh) — DSH bundle，构建产物在 `dist/`。
- [`packages/pi`](packages/pi) — Pi 包，构建产物在 `dist/`。

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
