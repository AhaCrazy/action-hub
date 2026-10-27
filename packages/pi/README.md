# Pi 版 action-hub

共享核心 [`../core`](../core) 的 Pi 适配器。

- `/ah` 或 `Alt+A` 打开原生 Pi TUI 面板；
- Command 类型的 Action 会把渲染后的提示词插入 Pi 编辑器；
- Skill 类型的 Action 会插入 `/skill:<name>`，由 Pi 原生加载 Skill；
- `resources_discover` 只暴露当前项目可用的 Skill；
- `/ah import <path>` 导入标准 Skill 文件夹或 ZIP；
- `/ah reload` 在外部修改后重新加载 Pi 资源。

不启动服务、不打开浏览器、不占用端口，也没有额外进程。扩展直接运行在 Pi 进程内。

## 安装

发布后：

```powershell
pi install npm:pi-action-hub
```

也可以直接使用本仓库的 Git 根安装：

```powershell
pi install git:github.com/AhaCrazy/action-hub
```

或者构建出 tarball 后本地安装：

```powershell
npm run pack:pi
pi install ./pi-action-hub-0.1.0.tgz
```

Pi 包运行时自包含，不需要额外安装 `action-hub` 核心包。

## 本地开发

```bash
cd ../..
npm install
npm run build --workspace pi-action-hub
pi -e ./packages/pi/dist/action-hub.js
```

`pi -e` 只让本次 Pi 启动加载该扩展。持久安装本地包：

```powershell
cd E:\Data\Projs\action-hub
pi install ./packages/pi
```

进入会话后：

```text
/ah
/ah import C:\path\to\skill-folder
```

Pi 版仍在早期阶段；分组和项目范围的完整管理界面暂时交给共享状态，后续可以补成 TUI 管理页。

## 数据

适配器使用 core 的默认目录：

```text
$ACTION_HUB_HOME/   # 默认 ~/.action-hub
  library/
  state.json
```

它和 DSH 适配器共享同一份库，因此两个 harness 看到相同的 Action 和范围配置。
