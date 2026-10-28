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

除非宿主强制要求，不要把 Skill 复制到 harness 专属目录。Action 目录本身就是一个合法的标准 Skill 根目录。Codex 例外：它只扫描 `.agents/skills`，因此适配器必须把选中的 Action 复制到该项目目录，并维护生成清单。

## Command 投影

Command 是**仅用户可见**的提示词模板，默认绝不能注册成模型工具。

选中后，渲染提示词并交给宿主：

- DSH：插入引用 chip 或展开后的提示词；
- Pi / OMP：`ctx.ui.pasteToEditor(rendered)`；
- Codex：生成只允许显式调用的 Skill（`agents/openai.yaml` 中 `policy.allow_implicit_invocation: false`）；
- 其他宿主：使用等价的插入 API。

从面板选中的 Skill 也可以插入宿主原生的 Skill 调用（Pi / OMP 上是 `/skill:name`），让宿主自行加载正文。

## 项目范围

项目范围由适配器拥有，不属于共享 `state.json`。core 只提供 `normalizeProjectScope`、`readProjectScope`、`writeProjectScope` 等 schema/原子读写辅助。

适配器应该：

- 用自己稳定的工作区标识保存范围：
  - DSH：workspace ID；
  - Pi / OMP：当前 session 存储根；项目根编码作为子目录；
  - Codex：项目根下的 `.codex/action-hub/scope.json`；
- 在宿主工作区创建/删除时同步创建/清理范围文件；
- 传入最具体的已知根目录（cwd、workspace 或仓库根）；
- 没有匹配项目时回退到全局分组；
- 绝不把 A harness 的项目范围自动应用到 B harness；
- 绝不把路径相同当作跨 harness 的项目身份。

## OMP 兼容

OMP 不新增独立适配器包，而是复用 Pi 适配器：

- 包同时声明 `pi` 和 `omp` manifest；
- OMP 的 legacy Pi 兼容层负责映射 `@earendil-works/pi-*` 导入；
- 项目范围必须从 `ctx.sessionManager.getSessionDir()` 取得实际 session 存储根，不能硬编码 `~/.pi`；子目录键由项目根编码；
- OMP 的 `Alt+A` 属于内置 Agent Hub，适配器应提供不冲突的面板入口（当前为 `/ah` 与 `Alt+Shift+A`）。

## 重新加载行为

DSH 的 Skill provider 可以在进程内刷新。Pi 只在启动或 reload 时发现 Skill；如果管理操作改变了 Skill 可见性，适配器应在退出管理界面时调用 `ctx.reload()`，或在无法自动 reload 的上下文提示用户执行 `/ah reload`。OMP 18.1.x 的主会话不触发 `resources_discover`，适配器在扩展加载时把 Skill 模式投影到 `<项目>/.omp/skills`，并在 session_start / 管理界面退出时刷新投影；当前会话未刷新时重启 OMP。

Codex 没有进程内扩展 API；`action-hub-codex sync` 生成 `.agents/skills`，Codex 自动检测 Skill 变化，未出现时重启 Codex。
