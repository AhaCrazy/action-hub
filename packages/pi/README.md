# Pi 版 Action Hub

在 Pi 中使用共享 Action 库：同一个标准 Skill 可以当模型可调用的 Skill，也可以只作为用户主动调用的 Command。

## 安装

一条命令：

```powershell
pi install git:github.com/AhaCrazy/action-hub
```

安装后重启 Pi。

## 使用

```text
/ah
```

或按 `Alt+A` 打开 Action 面板。

选中 Command 后，提示词会插入 Pi 编辑器；选中 Skill 后，会插入 Pi 原生的 `/skill:<name>`。

## 第一次使用

新库默认是空的。先导入一个标准 Skill 目录：

```text
/ah import C:\path\to\skill-folder
```

之后 `/ah` 才会出现可选择的 Action。

## 其他命令

```text
/ah reload
```

在外部修改了 Action 后，用它重新加载 Pi 资源。

## 数据

```text
C:\Users\<你>\.action-hub
  library\
  state.json
```

和 DSH 版共享同一份库。

## 注意

- 扩展运行在 Pi 进程内，不启动服务、不打开浏览器、不占用端口。
- `pi -e` 只是临时加载，重启后失效。
- 分组和项目范围的完整管理界面仍在完善中；当前可以先通过共享状态或 DSH 端管理。
