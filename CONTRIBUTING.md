# 开发与发布

面向维护者，不涉及普通用户安装。用户安装与功能说明见：

- [DSH](docs/dsh.md)
- [Pi](docs/pi.md)
- [OMP](docs/omp.md)

## 仓库结构

```text
action-hub/
  packages/
    core/   action-hub      与 harness 无关的核心
    dsh/    dsh-action-hub  DSH bundle
    pi/     pi-action-hub   Pi 包（同时供 OMP 使用）
  docs/                      用户文档、架构与适配器契约
```

对外只有两个发布包：

- `dsh-action-hub`
- `pi-action-hub`

OMP 不单独发布包：它从仓库根安装，OMP 插件名是 `action-hub-workspace`，内部复用 `packages/pi` 适配器。两个发布包在构建时都会把 core 打进自己的 `dist`，因此不需要单独发布 core npm 包。

## 开发环境

```bash
npm install
npm test
```

`npm test` 运行：

- core 测试；
- DSH 测试；
- Pi 测试（包含 OMP 兼容所需的 session-scope 测试）。

单包测试：

```bash
npm run test:core
npm run test:dsh
npm run test:pi
```

文档改动不需要构建，但发布前仍应跑一次完整测试。

## 构建

```bash
npm run build
```

构建内容：

- DSH：`packages/dsh/dist/index.js`、`packages/dsh/dist/builtin-actions/`、`client.js`
- Pi / OMP：`packages/pi/dist/action-hub.js`

构建产物已提交，普通用户从 Git 安装时不需要自己构建。

## 打包

```bash
npm run pack:pi
npm run pack:dsh
```

生成根目录下的 `.tgz` 发布产物。发布前需要保留两个稳定别名：

```text
dsh-action-hub.tgz
pi-action-hub.tgz
```

版本化文件同时保留：

```text
dsh-action-hub-0.1.0.tgz
pi-action-hub-0.1.0.tgz
```

用户文档中的 DSH 一条命令依赖 `dsh-action-hub.tgz` 这个固定名称，不能用带版本号的文件替代。

## 本地安装测试

### DSH

```powershell
dsh plugin --profile desktop add .\packages\dsh
```

安装后重启 DSH，验证 Action Hub 页面和 `Alt+A`。

### Pi

```powershell
pi install .\packages\pi
```

临时加载 Pi 扩展：

```powershell
pi -e .\packages\pi\dist\action-hub.js
```

### OMP

OMP 在 Windows 上对本地路径安装会尝试创建 symlink，普通权限可能报 `EPERM`。优先用 Git 安装：

```powershell
omp plugin install git:github.com/AhaCrazy/action-hub
```

更新：

```powershell
omp plugin install git:github.com/AhaCrazy/action-hub --force
```

安装后重启 OMP，验证：

- `/ah` 能打开 Action 面板；
- `Alt+Shift+A` 能打开 Action 面板（OMP 的 `Alt+A` 属于 Agent Hub）；
- `Ctrl+Alt+A` 能打开管理界面；
- 项目范围写入 OMP 的 session 存储根 + 项目根编码，而不是 `~/.pi`。

## 发布

### Pi

```powershell
npm login
npm publish --workspace pi-action-hub --access public
```

### DSH

发布 `dsh-action-hub` 到 npm 或 DSH 插件市场属于可选渠道；用户安装只依赖 GitHub Release 的 `.tgz`。

### GitHub Release

发布新版本时需要：

1. `npm run build`
2. `npm run pack:pi`
3. `npm run pack:dsh`
4. 上传 4 个资产：
   - `dsh-action-hub.tgz`
   - `dsh-action-hub-<version>.tgz`
   - `pi-action-hub.tgz`
   - `pi-action-hub-<version>.tgz`
5. 更新 Release 说明。

稳定别名由版本化文件复制生成：

```powershell
Copy-Item pi-action-hub-0.1.0.tgz pi-action-hub.tgz
Copy-Item dsh-action-hub-0.1.0.tgz dsh-action-hub.tgz
```

发布后校验：

- 4 个资产的字节数与本地 `.tgz` 一致；
- `sha256` 与本地文件一致；
- `releases/latest/download/dsh-action-hub.tgz` 返回 200；
- 包内 README、`dist` 产物来自同一个 docs 冻结后的 commit。

当前没有 CI，发布与资产上传为手动流程。先冻结文档和代码，再执行 `build` / `pack`，避免包内 README 落后于 main。

Release 说明至少包含：

- 当前版本支持的 harness：DSH / Pi / OMP；
- 每种 harness 的安装入口；
- OMP 的 `Alt+Shift+A` 快捷键说明；
- 数据与项目范围的差异；
- 指向 `docs/dsh.md`、`docs/pi.md`、`docs/omp.md` 的链接；
- 破坏性变更或迁移说明（如有）。

## 文档维护

- 用户文档按 harness 拆分：`docs/dsh.md`、`docs/pi.md`、`docs/omp.md`；
- 每个 harness 文档至少包含“安装说明”和“功能说明”两部分；
- 根 README 只保留快速入口和公共概念，详细步骤放到对应 harness 文档；
- 修改安装命令、快捷键、数据路径或项目范围行为时，同步更新对应 harness 文档、包 README 和 Release 说明；
- 新增 harness 时，先补 `docs/<harness>.md`，再更新根 README、`docs/README.md` 和 `docs/architecture.md`。

## 设计文档

- [文档索引](docs/README.md)
- [架构说明](docs/architecture.md)
- [适配器契约](docs/adapter-contract.md)
- [Pi / OMP 适配器设计](docs/pi-adapter.md)
- [DSH Web 客户端分片说明](packages/dsh/src/client/README.md)
