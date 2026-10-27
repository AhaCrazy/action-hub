# action-hub 核心

与 harness 无关的可移植 **Action** 库核心：

- **Skill**：标准 `SKILL.md` 目录，可被 harness 暴露给模型。
- **Command**：同一个标准目录，作为用户主动调用的提示词模板。
- 分组、全局分组、项目范围 schema 与项目级显式屏蔽。
- 搜索、导入导出、使用记录和带版本号的本地状态文件。

本包是共享核心。DSH、Pi、OMP、Claude Code 以及其他 harness 的集成都作为适配器存在，各自提供原生 UI、快捷键和插入方式。OMP 复用 Pi 适配器，不单独发布包。

## 状态

从已验证的 `dsh-action-hub` 核心中抽离而来。存储格式和公共 API 仍在稳定过程中，暂不要把它当作已正式发布的稳定包。

## 目录

```text
src/
  store.js          # 库与共享状态、分组、模式、搜索数据
  project-scope.js  # harness 本地项目范围的 schema 与原子读写
  availability.js   # 项目/全局/屏蔽解析
  scope.js          # 项目根和路径匹配
  skill-doc.js      # SKILL.md 解析与写入
  resources.js      # Skill 内的资源文件
  bundle.js         # 文件夹/ZIP 导入导出
  zip.js            # 确定性的 ZIP 编解码
  index.js          # 公共导出
tests/              # Node 测试
```

## 数据

```text
$ACTION_HUB_HOME/            # 默认 ~/.action-hub
  library/<skill-name>/
    SKILL.md
    ...资源文件
  state.json                 # 模式 / 分组 / 全局分组 / 使用记录（共享）
```

`SKILL.md` 是唯一的可移植产物；`state.json` 是共享本地元数据，不会进入导出包。项目范围不放在 `state.json`，而是由适配器按 harness 工作区保存在自己的目录中，并通过 `project-scope.js` 的辅助函数读写。

新数据目录会默认创建一个全局 **Common** 分组。内置 Action 由适配器提供，不硬编码进 core。

写入使用跨进程锁和原子替换 `state.json`，因此 DSH、Pi、OMP 和 Claude Code 可以共用同一个 `ACTION_HUB_HOME`，不会互相覆盖。

## 开发

```bash
npm install
npm test
```

## 适配器

- DSH：[`../dsh`](../dsh) — Cordis 插件，提供原生 Web UI、Alt+A 面板、composer chip 和 Skill provider。
- Pi：[`../pi`](../pi) — Pi 包，提供原生 TUI 面板和 `resources_discover`。
- OMP：通过 OMP 的 legacy Pi 兼容层加载 [`../pi`](../pi)，不新增独立包；项目范围使用 OMP session 存储根 + 项目根编码。
- Claude Code：[`../claude`](../claude) — 同步 CLI，把 Action 生成为原生 `skills/` 和 `/ah:<name>` commands。

开发态 DSH / Pi 适配器都通过 `file:../core` 链接本核心；发布构建会把本核心打进各自的
`dist`，因此对外有 `pi-action-hub`、`dsh-action-hub` 和 `claude-action-hub` 三个安装包，
不需要单独发布 core npm 包。OMP 从仓库根安装（插件名 `action-hub-workspace`），使用 Git 安装。

参见 [../../docs/architecture.md](../../docs/architecture.md) 和
[../../docs/adapter-contract.md](../../docs/adapter-contract.md)。
