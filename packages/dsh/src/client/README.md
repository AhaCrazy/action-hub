# Web 客户端分片

`client.js` 是生成文件：DSH 只加载一个
`window.__ModuleLoader__.load({ id, factory })` bundle，factory 里只能
`require('react')`。为了让文件保持较小，factory 主体被拆成多个有序分片，共享同一个作用域：

| 文件 | 职责 |
| --- | --- |
| `00-header.js` | loader 包装、常量、`React.createElement` |
| `10-css.js` | 注入样式表 |
| `20-i18n.js` | 中英文词典 |
| `30-helpers.js` | 纯辅助函数：提示词展开、引用、搜索、排序 |
| `40-stores.js` | hub API store、偏好设置 |
| `50-shortcuts.js` | 快捷键绑定、注册表胶水、全局按键监听 |
| `55-reference-source.js` | `/` 引用来源、Action chip、标记匹配 |
| `60-ui.js` | 图标和基础组件 |
| `70-page.js` | 库列表行和资源树 |
| `75-dialogs.js` | 编辑、导入、导出对话框 |
| `76-library-view.js` | 库页面外壳、筛选、排序控件 |
| `80-palette.js` | Spotlight 面板 |
| `85-session.js` | 面板状态、会话桥接、composer 触发 |
| `90-settings.js` | 设置页 |
| `99-apply.js` | Cordis `apply`、注册、公共返回值 |

修改行为所在的最小分片，然后重新生成：

```sh
npm run build
```

需要迭代时保持 watcher 运行：

```sh
npm run dev
```

`npm test` 会通过 `pretest` 自动构建。不要直接编辑 `client.js`，它会被覆盖。
