# Pi / OMP 版 Action Hub

在 Pi 或 OMP 中使用共享 Action 库：同一个标准 Skill 可以当模型可调用的 Skill，也可以只作为用户主动调用的 Command。

完整安装与功能说明：[Pi](https://github.com/AhaCrazy/action-hub/blob/main/docs/pi.md) · [OMP](https://github.com/AhaCrazy/action-hub/blob/main/docs/omp.md)。

## 安装

Pi：

```powershell
pi install git:github.com/AhaCrazy/action-hub
```

OMP：

```powershell
omp plugin install git:github.com/AhaCrazy/action-hub
```

安装后重启对应的 harness。

OMP 更新与卸载：

```powershell
omp plugin install git:github.com/AhaCrazy/action-hub --force
omp plugin uninstall action-hub-workspace
```

OMP 插件包名是 `action-hub-workspace`；推荐使用 Git 安装，Pi 的 release `.tgz` 不是官方 OMP 路径。

## 打开面板

```text
/ah
```

或按 `Alt+A`（OMP 使用 `Alt+Shift+A`，因为 `Alt+A` 被 OMP 的 Agent Hub 占用）。

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

当前焦点栏的标题前显示 `▶`，非焦点栏内容变暗。

常用操作：

- `← / →`：在左栏和中栏之间切换焦点；
- `↑↓`：移动；
- `Enter`：打开选中项；Action 的打开菜单中包含编辑；
- `Tab`：插入当前 Action 到编辑器；
- `n`：新建 Action / 分组；
- `d`：删除；
- `m`：切换 Command / Skill；
- `p`：固定/取消固定；
- `g`：设置分组；
- `f` 或 `/`：搜索；`Alt+R` 切换正则；
- `Esc`：关闭。

管理界面支持：

- **Action**：通过 `Enter` 打开菜单后编辑、删除、切换 Command/Skill、设置分组、参数提示、固定、查看资源文件、插入到编辑器。
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

项目范围保存在当前 harness 的 session 存储目录中，子目录名由项目根编码（最近的已登记工作区或 `.git` 祖先；没有则使用 cwd）：

```text
Pi:
C:\Users\<你>\.pi\agent\sessions\<encoded-project-root>\action-hub\scope.json

OMP:
C:\Users\<你>\.omp\agent\sessions\<encoded-project-root>\action-hub\scope.json
```

使用 OMP profile 时，范围位于：

```text
C:\Users\<你>\.omp\profiles\<profile>\agent\sessions\<encoded-project-root>\action-hub\scope.json
```

项目范围使用当前 session 的存储根 + 项目根编码，因此在 Pi、OMP 以及 OMP profile 之间各自独立；删除对应 session 子目录时，范围会一起删除。

## 平台差异

- Pi / OMP 没有 DSH 的侧边栏和 composer chip；Action 直接插入编辑器。
- Pi / OMP 的 Skill 入口使用原生 `/skill:<name>`。
- 修改模式、分组或项目范围后，退出管理界面会自动重新加载资源；如果编辑器里已有草稿或当前上下文无法提交 reload 命令，会提示执行 `/ah reload`。外部文件修改也可用 `/ah reload`。
- OMP 的 `Alt+A` 属于内置 Agent Hub；Action 面板使用 `/ah` 或 `Alt+Shift+A`。
- 管理界面的当前焦点栏标题前显示 `▶`，非焦点栏内容变暗。
