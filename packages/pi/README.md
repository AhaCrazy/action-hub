# Pi 版 Action Hub

在 Pi 中使用共享 Action 库：同一个标准 Skill 可以当模型可调用的 Skill，也可以只作为用户主动调用的 Command。

## 安装

一条命令：

```powershell
pi install git:github.com/AhaCrazy/action-hub
```

安装后重启 Pi。

## 打开面板

```text
/ah
```

或按 `Alt+A`。

- 输入关键字搜索；`Alt+R` 切换正则搜索；
- `↑↓` 选择，`Enter` / `Tab` 插入，`Esc` 关闭；
- Command 会把展开后的提示词插入编辑器；
- Skill 会插入 Pi 原生 `/skill:<name>`。

## 管理

```text
/ah manage
```

或按 `Ctrl+Alt+A`。

管理界面是三栏布局：

```text
左：Action / 分组 / 项目 / 工具
中：当前分区的列表
右：选中项详情
```

常用操作：

- `← / →`：在左栏和中栏之间切换焦点；
- `↑↓`：移动；
- `Enter`：打开选中项或执行工具；
- `Tab`：插入当前 Action 到编辑器；
- `n`：新建 Action / 分组；
- `e`：编辑当前 Action（唯一编辑入口）；
- `d`：删除；
- `m`：切换 Command / Skill；
- `p`：固定/取消固定；
- `g`：设置分组；
- `f` 或 `/`：搜索；`Alt+R` 切换正则；
- `q` 或 `Esc`：关闭。

管理界面支持：

- **Action**：新建、编辑、删除；切换 Command/Skill；设置分组、参数提示、固定；查看资源文件；插入到编辑器。
- **分组**：新建、改名、删除；设为全局分组；设置成员 Action；设置包含的子分组。
- **项目范围**：只配置当前 Pi 工作目录；直接启用分组或 Action；屏蔽继承来的分组或 Action；修改项目显示名。
- **导入**：导入标准 Skill 目录或 ZIP，可选择导入为 Command 或 Skill。
- **导出**：导出全部 Action 或单个 Action 为 ZIP。
- **设置**：查看数据目录；设置新项目默认分组；重新加载 Pi 资源。

Action 库、分组和全局分组与 DSH 版共享；**项目范围不共享**，它跟随当前 Pi 工作目录。

## 第一次使用

新库默认只有一个全局 `Common` 分组，并自带只读的 `skill-import-assistant` Command，用于把提示词或 Skill 目录整理成标准 Agent Skill 后交给 `/ah import` 导入。

```text
/ah import C:\path\to\skill-folder
```

导入后 `/ah` 会同时显示内置导入助手和用户 Action。

## 其他命令

```text
/ah reload
/ah export
```

`/ah reload` 用于在外部修改后重新加载 Pi 资源。

## 数据

```text
C:\Users\<你>\.action-hub
  library\
  state.json
```

`state.json` 只保存共享的 Action 元数据、分组和全局分组。

项目范围保存在当前 Pi workdir 的 session 目录中：

```text
C:\Users\<你>\.pi\agent\sessions\<workdir>\action-hub\scope.json
```

同一个项目在 DSH 和 Pi 中的范围是独立的；删除该 Pi workdir 的 session 目录时，范围会一起删除。

## 平台差异

- Pi 没有 DSH 的侧边栏和 composer chip；Action 直接插入 Pi 编辑器。
- Pi 的 Skill 入口使用原生 `/skill:<name>`。
- 在管理界面修改模式、分组或项目范围后，退出管理界面会自动重新加载 Pi 资源；外部文件修改可用 `/ah reload`。
