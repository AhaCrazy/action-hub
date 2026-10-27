# Action Hub

一套可移植的 Action 库，在 DSH、Pi 和 OMP 中提供原生使用体验。

**Action** 就是一个标准 Agent Skill 目录：`SKILL.md` 加可选资源文件。同一个目录可以作为模型可调用的 **Skill**，也可以只作为用户主动调用的 **Command**。分组和全局分组保存在共享状态中；项目范围跟随各自 harness 的工作区，不写进 Skill 文件。

每个 harness 的完整说明（安装 + 功能）：

| Harness | 文档 |
| --- | --- |
| DSH | [docs/dsh.md](docs/dsh.md) |
| Pi | [docs/pi.md](docs/pi.md) |
| OMP | [docs/omp.md](docs/omp.md) |

## 安装

### DSH

DSH Desktop 默认 profile 是 `desktop`。一条命令安装：

```powershell
dsh plugin --profile desktop add https://github.com/AhaCrazy/action-hub/releases/latest/download/dsh-action-hub.tgz
```

如果 `dsh` 不在 PATH 中，使用 DSH 安装目录下的 CLI：

```powershell
& "<DSH 安装目录>\resources\runtime\cli\bin\dsh.cmd" `
  plugin --profile desktop add `
  https://github.com/AhaCrazy/action-hub/releases/latest/download/dsh-action-hub.tgz
```

如果你使用的是别的 profile，把 `desktop` 换成对应名称。

安装完成后重启 DSH，打开 Action Hub 页面，或按 `Alt+A`。

### Pi

一条命令安装：

```powershell
pi install git:github.com/AhaCrazy/action-hub
```

安装完成后重启 Pi，输入：

```text
/ah
```

或按 `Alt+A`。

### OMP

OMP 使用自己的插件安装器，同时兼容本包的 `pi`/`omp` manifest：

```powershell
omp plugin install git:github.com/AhaCrazy/action-hub
```

安装完成后重启 OMP，输入 `/ah`，或按 `Alt+A`。

## 第一次使用

新库默认是空的，只有一个全局 `Common` 分组。

- DSH：在 Action Hub 页面里导入一个标准 Skill 目录；
- Pi / OMP：使用 `/ah import <目录路径>` 导入。

导入后即可在面板里搜索、选择和插入 Action。

## 升级

重新执行安装命令即可：

```powershell
# DSH
dsh plugin --profile desktop add https://github.com/AhaCrazy/action-hub/releases/latest/download/dsh-action-hub.tgz

# Pi
pi install git:github.com/AhaCrazy/action-hub

# OMP
omp plugin install git:github.com/AhaCrazy/action-hub --force
```

## 卸载

```powershell
# DSH
dsh plugin --profile desktop remove dsh-action-hub

# Pi
pi remove git:github.com/AhaCrazy/action-hub

# OMP
omp plugin uninstall action-hub-workspace
```

## 数据

DSH、Pi 和 OMP 默认共用 Action 库、分组和全局分组：

```text
C:\Users\<你>\.action-hub
  library\
    <skill-name>\
      SKILL.md
  state.json
```

`SKILL.md` 是可移植的 Skill 内容；`state.json` 保存共享的分组、全局分组和使用记录，不会进入导出包。

**项目范围不共享**，它跟随各自 harness 的工作区：

```text
DSH:
C:\Users\<你>\.dsh\action-hub\workspaces\<workspace-id>.json

Pi:
C:\Users\<你>\.pi\agent\sessions\<workdir>\action-hub\scope.json

OMP:
C:\Users\<你>\.omp\agent\sessions\<workdir>\action-hub\scope.json
（使用 --profile 时位于 .omp\profiles\<profile>\agent\sessions）
```

项目范围使用当前 harness 实际的 session 目录，所以 Pi、OMP 各自跟随自己的工作区；同一个项目在 DSH、Pi、OMP 中可以有不同范围。删除对应工作区时，范围文件也会一起清理。

旧版 DSH 插件的数据在：

```text
C:\Users\<你>\.dsh\dsh-action-hub
```

想沿用旧数据，需要把旧目录里的 `library` 和 `state.json` 复制到 `.action-hub`，或者在 DSH 配置里把 `dataDir` 指向旧目录。旧的项目范围会在 DSH 首次读取时迁移到 `.dsh\action-hub\workspaces`。

## 常见问题

### 安装后没有 `/ah` 或 Alt+A 没反应

- 确认安装命令执行成功；
- 重启对应的 harness；
- 检查 DSH 是否还有旧版 Action Hub 同时启用。新旧适配器使用相同的插件标识，应该只保留一个。

### `pi install npm:pi-action-hub` 报 404

npm 包还没有发布。请使用本文档里的 Git 或 release 安装命令。

### DSH 安装后入口可见但没有 Action

这是正常的首次状态，先导入一个标准 Skill 目录。

## 支持范围

- DSH：原生 Web UI、`Alt+A`、composer 插入、项目范围、Skill provider。
- Pi：原生 TUI 面板、`Alt+A`、`Ctrl+Alt+A` 管理界面、编辑器插入、Action/分组/项目范围/导入导出管理、`resources_discover`。
- OMP：通过 Pi 兼容层加载同一扩展，提供相同的 `/ah`、TUI 面板、编辑器插入、项目范围和 `resources_discover`；项目范围跟随 OMP 实际 session 目录。
- 其他 harness：可基于同一套核心继续增加适配器。

## 开发

开发、构建和发布说明见 [CONTRIBUTING.md](CONTRIBUTING.md)。
