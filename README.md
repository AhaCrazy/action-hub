# Action Hub

一套可移植的 Action 库，在 DSH、Pi 和 OMP 中提供原生使用体验。

**Action** 就是一个标准 Agent Skill 目录：`SKILL.md` 加可选资源文件。同一个目录可以作为模型可调用的 **Skill**，也可以只作为用户主动调用的 **Command**。分组和全局分组保存在共享状态中；项目范围跟随各自 harness 的工作区，不写进 Skill 文件。

## 文档

| 文档 | 内容 |
| --- | --- |
| [docs/dsh.md](docs/dsh.md) | DSH 安装与功能 |
| [docs/pi.md](docs/pi.md) | Pi 安装与功能 |
| [docs/omp.md](docs/omp.md) | OMP 安装与功能 |
| [docs/README.md](docs/README.md) | 文档索引、环境要求与公共 FAQ |
| [docs/architecture.md](docs/architecture.md) | 架构与存储归属 |
| [docs/adapter-contract.md](docs/adapter-contract.md) | 适配器契约 |

当前验证环境：

| Harness | 验证版本 |
| --- | --- |
| DSH | DSH Desktop 当前版本，默认 `desktop` profile |
| Pi | `@earendil-works/pi-coding-agent@1.4.0` |
| OMP | `omp@18.1.16` |

## 安装

### DSH

#### 方式一：DSH 插件页（推荐）

1. 打开 DSH Desktop；
2. 左侧栏进入 **插件**；
3. 点击 **添加插件** 旁的箭头，选择 **安装第三方插件**；
4. 粘贴：

```text
https://github.com/AhaCrazy/action-hub/releases/latest/download/dsh-action-hub.tgz
```

5. 点击 **安装**，完成后重启 DSH。

#### 方式二：命令行

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

```powershell
pi install git:github.com/AhaCrazy/action-hub
```

安装完成后重启 Pi，输入：

```text
/ah
```

或按 `Alt+A`。

### OMP

OMP 使用自己的插件安装器，同时兼容本包的 `pi` / `omp` manifest：

```powershell
omp plugin install git:github.com/AhaCrazy/action-hub
```

安装完成后重启 OMP，输入 `/ah`，或按 `Alt+Shift+A`。

OMP 默认把 `Alt+A` 绑定给内置 Agent Hub，所以 Action Hub 使用 `Alt+Shift+A` 作为面板快捷键。

更完整的安装与排查见 [docs/omp.md](docs/omp.md)。

## 第一次使用

新库默认只有一个全局 `Common` 分组，并自带只读的 `skill-import-assistant` Command，用于把提示词或 Skill 目录整理成标准 Agent Skill。

- DSH：在 Action Hub 页面里导入一个标准 Skill 目录；
- Pi / OMP：使用 `/ah import <目录路径>` 导入。

导入后即可在面板里搜索、选择和插入 Action。

## 升级

### DSH

DSH 插件页通常需要先卸载再安装；命令行方式：

```powershell
dsh plugin --profile desktop remove dsh-action-hub
dsh plugin --profile desktop add https://github.com/AhaCrazy/action-hub/releases/latest/download/dsh-action-hub.tgz
```

### Pi

```powershell
pi install git:github.com/AhaCrazy/action-hub
```

如果更新没有生效：

```powershell
pi remove git:github.com/AhaCrazy/action-hub
pi install git:github.com/AhaCrazy/action-hub
```

### OMP

```powershell
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
C:\Users\<你>\.pi\agent\sessions\<encoded-project-root>\action-hub\scope.json

OMP:
C:\Users\<你>\.omp\agent\sessions\<encoded-project-root>\action-hub\scope.json
（使用 --profile 时位于 .omp\profiles\<profile>\agent\sessions）
```

项目范围保存在当前 harness 的 session 存储目录下，子目录名由项目根编码（最近的已登记工作区或 `.git` 祖先；没有则使用 cwd）。因此 Pi、OMP 各自跟随自己的工作区；同一个项目在 DSH、Pi、OMP 中可以有不同范围。删除对应 session 子目录时，范围文件也会一起清理。

旧版 DSH 插件的数据在：

```text
C:\Users\<你>\.dsh\dsh-action-hub
```

想沿用旧数据，需要把旧目录里的 `library` 和 `state.json` 复制到 `.action-hub`，或者在 DSH 配置里把 `dataDir` 指向旧目录。旧的项目范围会在 DSH 首次读取时迁移到 `.dsh\action-hub\workspaces`。

## 常见问题

### 安装后没有 `/ah` 或快捷键没反应

- 确认安装命令执行成功；
- 重启对应的 harness；
- Pi：`/ah`、`Alt+A`、`Ctrl+Alt+A`；
- OMP：`/ah` 或 `Alt+Shift+A`；`Alt+A` 是 OMP 内置的 Agent Hub；
- DSH：检查是否还有旧版 Action Hub 同时启用。新旧适配器使用相同的插件标识，只应保留一个。

### OMP 按 `Alt+A` 打开的是 Agent Hub

这是 OMP 自带界面，不是 Action Hub。使用 `/ah` 或 `Alt+Shift+A`。

### 面板是空的

- 新库默认没有用户 Action，先导入一个标准 Skill 目录；
- 检查当前工作区的项目范围是否屏蔽了所有分组 / Action；
- 检查管理界面显示的“数据目录”是否和另一个 harness 一致；
- 检查搜索词或正则是否过滤掉了所有项。

### DSH 安装后入口可见但没有 Action

这是正常的首次状态，先导入一个标准 Skill 目录。

### `pi install npm:pi-action-hub` 报 404

npm 包还没有发布。请使用本文档里的 Git 安装命令。

### 升级后行为没有变化

- Pi：先 `pi update --extensions`，仍不生效则 remove + install；
- OMP：`omp plugin install ... --force` 后重启；
- DSH：先卸载再安装，然后重启。

## 支持范围

- DSH：原生 Web UI、`Alt+A`、composer 插入、项目范围、Skill provider。
- Pi：原生 TUI 面板、`Alt+A`、`Ctrl+Alt+A` 管理界面、编辑器插入、Action / 分组 / 项目范围 / 导入导出管理、`resources_discover`。
- OMP：通过 Pi 兼容层加载同一扩展，提供 `/ah`、`Alt+Shift+A`、`Ctrl+Alt+A`、编辑器插入、项目范围和 `resources_discover`；项目范围使用 OMP session 存储根 + 项目根编码。
- 其他 harness：可基于同一套核心继续增加适配器。

## 开发

开发、构建和发布说明见 [CONTRIBUTING.md](CONTRIBUTING.md)。
