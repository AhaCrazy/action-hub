# DSH 版 Action Hub

Action Hub 是一个标准 Agent Skill 库：同一个 `SKILL.md` 目录可以作为模型自动发现的 **Skill**，也可以只作为用户主动调用的 **Command**。本文只说明 DSH 中的安装与功能。

## 一、安装说明

DSH Desktop 默认使用 `desktop` profile。

### 通过 DSH 插件页安装

1. 打开 DSH Desktop；
2. 左侧栏进入 **插件**；
3. 点击 **添加插件** 旁的箭头，选择 **安装第三方插件**；
4. 粘贴：

```text
https://github.com/AhaCrazy/action-hub/releases/latest/download/dsh-action-hub.tgz
```

5. 点击 **安装**，完成后重启 DSH。

### 通过命令行安装

```powershell
dsh plugin --profile desktop add https://github.com/AhaCrazy/action-hub/releases/latest/download/dsh-action-hub.tgz
```

如果 `dsh` 不在 PATH 中，使用 DSH 安装目录下的 CLI：

```powershell
& "<DSH 安装目录>\resources\runtime\cli\bin\dsh.cmd" `
  plugin --profile desktop add `
  https://github.com/AhaCrazy/action-hub/releases/latest/download/dsh-action-hub.tgz
```

### 升级

DSH 插件页对普通第三方插件通常需要先卸载再安装。命令行方式：

```powershell
dsh plugin --profile desktop remove dsh-action-hub
dsh plugin --profile desktop add https://github.com/AhaCrazy/action-hub/releases/latest/download/dsh-action-hub.tgz
```

### 卸载

```powershell
dsh plugin --profile desktop remove dsh-action-hub
```

### 验证

重启后打开 Action Hub 页面，或按 `Alt+A`。应能看到一个 `Common` 全局分组和内置的 `skill-import-assistant`。

## 二、功能说明

### Action 的两种模式

- **Skill**：进入 DSH 的 Skill provider，模型可以在任务匹配时自动发现和读取；
- **Command**：不进入模型目录，只能由用户从面板主动插入。

模式只影响调用方式，不改变 `SKILL.md` 文件本身。

### 面板

`Alt+A` 或输入框工具行按钮打开：

![DSH Action Hub 面板](../packages/dsh/assets/screenshots/01-palette.png)

- 按名称、描述、正文搜索；
- 输入框右侧 `.*` 或 `Alt+R` 切换正则搜索；
- 每行标记 `[Command]` 或 `[Skill]`；
- `Enter` / `Tab` 插入；
- `Ctrl/⌘ + Enter` 直接发送。

Command 插入行为：

- 无参数：插入引用 chip；
- 有参数：插入展开后的正文。

Skill：插入 Skill 引用，由 DSH 自行加载正文。

### 管理页面

`Ctrl+Alt+A` 或管理页进入：

![DSH Action Hub 管理页](../packages/dsh/assets/screenshots/02-library.png)

支持：

- 新建、编辑、删除标准 Skill；
- 切换 Command / Skill；
- 设置分组与全局分组；
- 配置“所有项目”或指定项目的可用范围；
- 导入文件夹或 ZIP；
- 导出单条 Action 或整库；
- 查看数据目录与使用记录。

### 分组

- 每个 Action 可以属于多个分组；
- 全局分组自动对所有 DSH 工作区生效；
- 非全局分组只在启用它的项目中生效；
- 项目可以额外屏蔽从全局继承的分组或 Action。

### 项目范围

项目范围属于 DSH 工作区，不属于某个仓库路径，也不写入共享库：

```text
C:\Users\<你>\.dsh\action-hub\workspaces\<workspace-id>.json
```

- 工作区改名不影响范围；
- 删除工作区后，对应范围文件会在后续刷新时清理；
- 同一个项目在 DSH、Pi、OMP 中的范围互相独立。

### 数据

共享 Action 库和状态：

```text
C:\Users\<你>\.action-hub
  library\
    <skill-name>\
      SKILL.md
  state.json
```

`SKILL.md` 是可移植内容；`state.json` 保存动作元数据、分组和全局分组，不进入导出包。

旧版插件数据在：

```text
C:\Users\<你>\.dsh\dsh-action-hub
```

如需沿用旧数据，把旧目录里的 `library` 和 `state.json` 复制到 `.action-hub`。旧的项目范围会在首次读取时迁移到 `.dsh\action-hub\workspaces`。

### 限制

- 只支持标准 `SKILL.md` 目录，不执行 Skill 内的脚本；
- 导入资源会随 Skill 目录一起保存；
- 新旧适配器使用同一个插件标识，只应保留一个。
