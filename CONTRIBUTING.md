# 开发与发布

面向维护者，不涉及普通用户安装。用户安装说明见 [README.md](README.md)。

## 仓库结构

```text
action-hub/
  packages/
    core/   action-hub      与 harness 无关的核心
    dsh/    dsh-action-hub  DSH bundle
    pi/     pi-action-hub   Pi 包
  docs/                      架构与适配器契约
```

两个发布包在构建时都会把 core 打进自己的 `dist`，因此对外只有：

- `dsh-action-hub`
- `pi-action-hub`

不需要单独发布 core npm 包。

## 开发环境

```bash
npm install
npm test
```

`npm test` 运行 core、DSH、Pi 三套测试。

单包测试：

```bash
npm run test:core
npm run test:dsh
npm run test:pi
```

## 构建

```bash
npm run build
```

构建内容：

- DSH：`packages/dsh/dist/index.js`、`packages/dsh/dist/builtin-actions/`、`client.js`
- Pi：`packages/pi/dist/action-hub.js`

构建产物已提交，普通用户从 Git 安装时不需要自己构建。

## 打包

```bash
npm run pack:pi
npm run pack:dsh
```

生成根目录下的 `.tgz` 发布产物。

## 本地安装测试

```powershell
# DSH，安装本地包目录
dsh plugin --profile desktop add E:\Data\Projs\action-hub\packages\dsh

# Pi，安装本地包目录
pi install E:\Data\Projs\action-hub\packages\pi
```

临时加载 Pi 扩展：

```powershell
pi -e .\packages\pi\dist\action-hub.js
```

## 发布

### Pi

```powershell
npm login
npm publish --workspace pi-action-hub --access public
```

### DSH

发布 `dsh-action-hub` 到 npm 或 DSH 插件市场，然后更新 release 产物。

### GitHub Release

用户文档中的 DSH 一条命令依赖这个固定资产名：

```text
dsh-action-hub.tgz
```

发布新版本时需要：

1. `npm run build`
2. `npm run pack:dsh`
3. 把 tarball 重命名/上传为 `dsh-action-hub.tgz`
4. 更新 release

Pi 用户直接使用 Git 安装，不依赖 release 资产。

## 设计文档

- [架构说明](docs/architecture.md)
- [适配器契约](docs/adapter-contract.md)
- [Pi 适配器设计](docs/pi-adapter.md)
- [DSH Web 客户端分片说明](packages/dsh/src/client/README.md)
