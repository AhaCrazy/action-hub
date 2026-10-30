# Pi 版 Action Hub

Action Hub 是一个标准 Agent Skill 库：同一个 `SKILL.md` 目录可以作为模型自动发现的 **Skill**，也可以只作为用户主动调用的 **Command**。本文只说明 Pi 中的安装与功能。当前验证环境：`@earendil-works/pi-coding-agent@1.4.0`。

## 一、安装说明

### 安装

npm：

```powershell
pi install npm:pi-action-hub
```

或从 GitHub：

```powershell
pi install git:github.com/AhaCrazy/action-hub
```

安装后重启 Pi。

### 更新

npm：

```powershell
pi install npm:pi-action-hub
```

GitHub：

```powershell
pi install git:github.com/AhaCrazy/action-hub
```

如果更新没有生效：

```powershell
pi remove npm:pi-action-hub
pi install npm:pi-action-hub
```

或：

```powershell
pi remove git:github.com/AhaCrazy/action-hub
pi install git:github.com/AhaCrazy/action-hub
```

### 卸载

npm：

```powershell
pi remove npm:pi-action-hub
```

或 GitHub：

```powershell
pi remove git:github.com/AhaCrazy/action-hub
```

### 验证

重启后输入：

```text
/ah
```

应能看到 Action 面板；按 `Alt+A` 也可以打开。

## 二、功能说明

### Action 的两种模式

- **Skill**：通过 `resources_discover` 交给 Pi，模型在系统提示词中看到名称和描述，可按需读取 `SKILL.md`；
- **Command**：不进入模型目录，只能由用户从面板插入展开后的提示词。

Skill 也可以由用户主动调用：

```text
/skill:<name>
```

### 面板

```text
/ah
```

或按 `Alt+A`。

- 输入关键字搜索；
- `Alt+R` 切换正则搜索；
- `↑↓` 选择；
- `Enter` / `Tab` 插入；
- `Esc` 关闭；
- Command 把展开后的提示词插入编辑器；
- Skill 插入 Pi 原生 `/skill:<name>`。

### 管理界面

```text
/ah manage
```

或按 `Ctrl+Alt+A`。

三栏布局：

```text
左：Action / 分组 / 项目 / 工具
中：当前分区列表
右：选中项详情
```

当前焦点栏的标题前显示 `▶`，非焦点栏内容变暗。

常用按键：

| 按键 | 作用 |
| --- | --- |
| `←` / `→` | 切换左栏和中栏焦点 |
| `↑` / `↓` | 移动选中项 |
| `Enter` | 打开选中项；Action 的打开菜单中包含编辑 |
| `Tab` | 插入当前 Action |
| `n` | 新建 Action / 分组 |
| `d` | 删除 |
| `m` | 切换 Command / Skill |
| `p` | 固定 / 取消固定 |
| `g` | 设置分组 |
| `f` 或 `/` | 搜索 |
| `Alt+R` | 切换正则搜索 |
| `Esc` | 关闭 |

管理界面支持：

- **Action**：打开后编辑、删除、切换模式、设置分组、固定、查看资源文件、插入；
- **分组**：新建、改名、删除、设为全局、设置成员与子分组；
- **项目范围**：只配置当前 Pi 工作目录；直接启用或屏蔽分组/Action；修改项目显示名；
- **导入**：导入标准 Skill 目录或 ZIP，可选择导入为 Command 或 Skill；
- **导出**：导出全部或单个 Action 的 ZIP；
- **设置**：数据目录、新项目默认分组、重新加载 Pi 资源。

### 项目范围

项目范围保存在当前 Pi session 存储目录下；子目录名由项目根编码（最近的已登记工作区或 `.git` 祖先；没有则使用 cwd）：

```text
C:\Users\<你>\.pi\agent\sessions\<encoded-project-root>\action-hub\scope.json
```

- 每个项目根独立；
- 同一项目根的多个 Pi 会话共享范围；
- 删除对应 session 子目录时，范围文件一起删除；
- 同一个项目在 DSH、Pi、OMP 中的范围互相独立。

### Skill 自动发现与重载

- Pi 在启动、切换会话或 reload 时调用 `resources_discover`；
- 只有 Skill 模式的 Action 会进入模型可见列表；
- Command 永远不进入模型目录；
- 修改模式、分组或项目范围后，退出管理界面会自动重新加载；
- 如果编辑器里已有草稿或当前上下文无法自动重载，会提示执行 `/ah reload`。

### 与 Pi 原生 Skill 重名

Pi 还会发现自己的 Skill，例如：

```text
~/.pi/agent/skills
.pi/skills
~/.claude/skills
.claude/skills
~/.agents/skills
.agents/skills
```

同名 Skill 按 Pi 的加载顺序去重，先发现者胜出；Action Hub 的同名 Skill 通常会被丢弃。建议 Action Hub 中的 Skill 使用唯一名称。

### 数据

共享 Action 库和状态与 DSH、OMP 共用：

```text
C:\Users\<你>\.action-hub
  library\
  state.json
```

### 内置内容

新库默认只有一个全局 `Common` 分组，并自带只读的 `action-import-assistant` Command，用于把提示词或 Skill 目录整理成标准 Agent Skill：

```text
/ah import C:\path\to\skill-folder
```

### 其他命令

```text
/ah reload
/ah export
/ah import <路径>
```

### 限制

- `ctx.ui.custom` 只在 Pi 交互 TUI 模式可用；
- 命令和快捷键只在交互模式可用；
- 只支持标准 `SKILL.md` 目录，不执行 Skill 内的脚本。

