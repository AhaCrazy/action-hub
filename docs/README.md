# Action Hub 文档

本目录按 harness 拆分用户文档，并保留架构与适配器契约给维护者。

## 用户文档

| 文档 | 内容 |
| --- | --- |
| [DSH](dsh.md) | DSH 插件页 / CLI 安装、面板、管理页、项目范围、数据 |
| [Pi](pi.md) | Pi 安装、面板、管理界面、项目范围、Skill 发现 |
| [OMP](omp.md) | OMP 安装、`Alt+Shift+A`、Agent Hub 冲突、profile 范围 |

每个 harness 文档都包含两部分：

1. 安装说明
2. 功能说明

## 开发者文档

| 文档 | 内容 |
| --- | --- |
| [架构说明](architecture.md) | 分层、存储归属、可移植性边界 |
| [适配器契约](adapter-contract.md) | Skill / Command 投影、项目范围、重载规则 |
| [Pi / OMP 适配器设计](pi-adapter.md) | 原生能力、OMP 兼容、包结构、限制 |

## 环境要求

| Harness | 验证版本 | 入口 |
| --- | --- | --- |
| DSH | DSH Desktop 当前版本，默认 `desktop` profile | 插件页或 `dsh plugin` |
| Pi | `@earendil-works/pi-coding-agent@1.4.0` | `pi install` |
| OMP | `omp@18.1.16` | `omp plugin install` |

Node.js 要求见根 `package.json`：`>=20`。OMP 使用自己的运行时，不依赖 Node 全局包。

## 公共概念

- **Action**：一个标准 Agent Skill 目录（`SKILL.md` + 可选资源）。
- **Skill**：Action 进入宿主模型目录，模型可按任务自动发现。
- **Command**：Action 不进入模型目录，只由用户从面板主动插入。
- **分组**：Action 的集合；全局分组对所有工作区生效。
- **项目范围**：某个 harness 工作区启用的分组 / Action，以及屏蔽项。

共享库：

```text
$ACTION_HUB_HOME（默认 ~/.action-hub）
  library/
  state.json
```

项目范围由各 harness 本地保存：

```text
DSH:  ~/.dsh/action-hub/workspaces/<workspace-id>.json
Pi:   ~/.pi/agent/sessions/<workdir>/action-hub/scope.json
OMP:  ~/.omp/agent/sessions/<workdir>/action-hub/scope.json
```

## 公共 FAQ

### 安装后没有 `/ah`

- 确认安装命令成功；
- 重启 harness；
- Pi：`/ah`、`Alt+A`、`Ctrl+Alt+A`；
- OMP：`/ah` 或 `Alt+Shift+A`；`Alt+A` 是 OMP 内置的 Agent Hub；
- DSH：确认没有旧版 Action Hub 同时启用。

### OMP 按 `Alt+A` 打开的是 Agent Hub

这是 OMP 自带界面。Action Hub 使用：

```text
/ah
Alt+Shift+A
```

管理界面使用 `Ctrl+Alt+A`。

### 面板是空的

- 新库默认没有用户 Action，先导入标准 Skill 目录；
- 检查当前工作区项目范围是否屏蔽了所有分组 / Action；
- 检查管理界面的“数据目录”是否与其他 harness 一致；
- 检查搜索词或正则是否过滤掉了所有项。

### 升级后没有变化

- Pi：`pi update --extensions`，仍不生效则 remove + install；
- OMP：`omp plugin install ... --force`，然后重启；
- DSH：先卸载再安装，然后重启。

### Skill 与原生 Skill 重名

Pi / OMP 会先发现自己的 Skill 目录，再加载 Action Hub 的 Skill。同名时先发现者胜出，Action Hub 的同名 Skill 通常会被丢弃。建议使用唯一名称。

### 项目范围看起来不对

- 项目范围不跨 harness 共享；
- Pi / OMP 的范围跟随当前 session 目录，OMP profile 会改变目录；
- DSH 的范围跟随 workspace ID，不是仓库路径。

## 文档维护

- 改安装命令、快捷键、数据路径、项目范围行为时，同步更新对应 harness 文档、包 README 和 Release 说明；
- 新增 harness 时，先写 `docs/<harness>.md`，再更新本索引、根 README 和 `docs/architecture.md`；
- 用户文档默认中文；代码和内部设计文档可以使用英文术语。
