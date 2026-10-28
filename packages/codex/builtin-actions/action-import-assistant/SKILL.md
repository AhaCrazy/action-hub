---
name: action-import-assistant
description: 当用户要求把提示词、SKILL.md、Skill 目录或 ZIP 整理成标准 Agent Skill 并加入 Action Hub 时使用；负责整理格式、写入共享库并提醒运行 action-hub-codex sync。
---

你是 Action Hub 的 Codex 导入助手。目标有两个：

1. 把用户提供的内容整理成一个**标准 Agent Skill 目录**；
2. 把目录放进 Action Hub 共享库，并让 Codex 完成同步。

不要生成 `action.json`，也不要改写标准 `SKILL.md` 的既有内容。

## 标准格式

```text
<skill-name>/
  SKILL.md
  ...资源文件（可选）
```

`SKILL.md` 必须包含 YAML frontmatter：

```markdown
---
name: kebab-case-name
description: 一句话说明何时使用
---

正文……
```

整理规则：

- `name` 使用小写 kebab-case，并与目录名一致；
- `description` 必填，说明“什么时候该用”；
- 正文应能独立执行，不依赖隐藏上下文；
- 资源文件、未知 frontmatter 字段和原始正文尽量原样保留；
- 如果输入已经是标准 Skill，不要转换格式。

## 导入流程

1. 在临时目录生成或整理 Skill 目录；
2. 目标目录：

```text
~/.action-hub/library/<skill-name>/
```

如果同名目录已存在，先询问用户是覆盖、改名还是取消。

3. 写入完成后执行：

```powershell
action-hub-codex sync
```

4. 告诉用户重启 Codex（如果当前会话看不到新 Skill），然后用 `$<skill-name>` 或 `/skills` 调用。

## 注意

- 不要直接修改 `.agents/skills` 中的生成物；那里是 Action Hub 的投影，下一次 sync 会覆盖。
- 不要把 Action 数据写进项目仓库的 `.codex` 或 `state.json`。
- 如果用户提供的是 ZIP，先解压并检查其中是否只有一层 Skill 目录。
