# 适配器契约

适配器是薄薄一层 harness 专属包：嵌入 `action-hub`，把 harness 的原生能力翻译成 core 调用。

## 必备能力

```ts
type HarnessCapabilities = {
  skills: boolean;          // 能否暴露模型可见的 Skill
  commands: boolean;        // 是否有用户主动调用的提示词插入入口
  nativePalette: boolean;   // 能否渲染自定义选择面板
  composerInsertion: boolean;
  projectContext: boolean;  // 能否提供有意义的 cwd/项目根
};
```

适配器可以只支持其中一部分能力。只有 Command 能力的 harness 可以把所有 Action 都暴露成命令；只有 Skill 能力的 harness 只能暴露 Skill 模式的 Action。

## 生命周期

```ts
interface HarnessAdapter {
  id: string;
  capabilities: HarnessCapabilities;
  context(): HarnessContext;
  register?(): Promise<void>;
  dispose?(): Promise<void>;
}
```

适配器负责：

- 快捷键、命令名和菜单注册；
- 面板渲染；
- 编辑器/composer 插入；
- 模型可见 Skill 的注册；
- 设置项的放置位置。

适配器不负责：

- `SKILL.md` 解析；
- 分组/范围解析；
- 导入导出；
- 状态文件结构或直接写入。

## Skill 投影

对于每次 `resources_discover`（Pi）或 provider list（DSH）：

1. 从 `cwd` 解析项目根；
2. 从 core 加载 Action；
3. 选出 `mode === 'skill'` 且 `actionAvailable(...)` 为真的 Action；
4. 暴露每个选中 Action 的真实目录。

除非宿主强制要求，不要把 Skill 复制到 harness 专属目录。Action 目录本身就是一个合法的标准 Skill 根目录。

## Command 投影

Command 是**仅用户可见**的提示词模板，默认绝不能注册成模型工具。

选中后，渲染提示词并交给宿主：

- DSH：插入引用 chip 或展开后的提示词；
- Pi：`ctx.ui.pasteToEditor(rendered)`；
- 其他宿主：使用等价的插入 API。

从面板选中的 Skill 也可以插入宿主原生的 Skill 调用（Pi 上是 `/skill:name`），让宿主自行加载正文。

## 项目范围

项目范围由适配器拥有，不属于共享 `state.json`。core 只提供 `normalizeProjectScope`、`readProjectScope`、`writeProjectScope` 等 schema/原子读写辅助。

适配器应该：

- 用自己稳定的工作区标识保存范围：
  - DSH：workspace ID；
  - Pi / OMP：当前 session 目录；
- 在宿主工作区创建/删除时同步创建/清理范围文件；
- 传入最具体的已知根目录（cwd、workspace 或仓库根）；
- 没有匹配项目时回退到全局分组；
- 绝不把 A harness 的项目范围自动应用到 B harness；
- 绝不把路径相同当作跨 harness 的项目身份。

## 重新加载行为

DSH 的 Skill provider 可以在进程内刷新。Pi / OMP 只在启动或 reload 时发现 Skill；如果管理操作改变了 Skill 可见性，适配器应在退出管理界面时调用 `ctx.reload()`，或在无法自动 reload 的上下文提示用户执行 `/ah reload`。
