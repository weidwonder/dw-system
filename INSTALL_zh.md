# 安装 dw-system

[English](./INSTALL.md) | **中文** · 返回 [README](./README_zh.md)

本页讲安装器会对你的机器和项目做什么。安装命令与常用选项见 [README › 安装选项](./README_zh.md#安装选项)；全部选项运行 `npx --yes git+https://github.com/weidwonder/dw-system.git --help` 查看。

**前置条件**：Node.js 20+、npm 与 Git；Claude Code、Codex 至少装一个。

---

## 项目级安装

在目标项目根目录运行：

```bash
npx --yes git+https://github.com/weidwonder/dw-system.git .
```

安装器先打印计划，改动任何东西之前问你一次（`--yes` 跳过这一问）。之后按顺序：

1. **取源并校验。** 从 GitHub 下载 `--repo` 仓库的 `--ref` 版本，校验其中至少有一个合法 skill。下载或校验失败时不修改目标项目，并以非零退出码结束。
2. **复制 skill。** 该版本的全部 skill——八个 `dw-*` skill，`ctx` CLI 随 `dw-code-facts`、原型工具随 `dw-prd`——连同版本戳复制到 `<项目>/.claude/skills/`（Claude Code）与 `<项目>/.agents/skills/`（Codex）。从 3.0 之前的安装升级时，先删除旧名字的 skill 目录与版本戳，并把旧标记块改写成新名字，你配置过的字段逐字带入。跨过需要手动动作的版本升级时，打印这些版本的迁移指南。
3. **更新 `.gitignore`。** 追加一个幂等标记块，忽略已安装的 skill 目录、版本戳和本地 codegraph 索引 `.codegraph/`。同时问一次 `docs/` 与 `engineering-context/` 要不要提交进 git：
   - 默认（直接回车）是**不提交**：两个目录一并写进这个标记块。
   - 选**提交**则一个字节都不动这两个目录。
   - 答案以注释行记在标记块里，重装直接沿用、不再询问。
   - `--yes` 与非交互终端（CI、无人值守的 npx）取同一个默认值"不提交"。
   - `.gitignore` 里已经有你自己写的这两个目录的忽略规则时，既不发问，也不接管这些规则。
   - `--docs-in-git=yes|no` 优先于以上全部，也是事后改主意的入口。
4. **只在本项目禁用冲突的 Claude Code 插件。** 把 `false` 合并进 `enabledPlugins`，不覆盖其他键。默认写 `.claude/settings.local.json`（gitignored，只影响你）；加 `--shared` 写 `.claude/settings.json`（提交进 git，影响所有克隆这个仓库的人）。见 [冲突插件](#冲突插件)。
5. **处理冲突的 Codex skill。** 默认在项目的 `AGENTS.md` 写入 `dw-system:codex-conflicts` 约束块，阻止它在本项目自动触发。交互安装时可以改选通过 Codex CLI 全局卸载；自动化场景用 `--codex-conflicts=uninstall`。
6. **同步入口文件。** `CLAUDE.md` 或 `AGENTS.md` 任一已有 `dw-workflow` 标记块时，两个入口按它对齐（以 `CLAUDE.md` 为准）。在**原本就存在**的入口文件最顶部写入一个幂等提示块（"动手前先加载 `dw-workflow`"）；由这一步新建的入口文件只写标记块。
7. **安装伴生 skill。** `agentic-principle` 与 `skill-principle` 装进用户级的 `~/.claude/skills/` 与 `~/.codex/skills/`，所有项目共用一份。每次运行都比对远端版本，本地更旧才更新。本地是符号链接或 git 工作区时只报告、不覆盖。拉取失败降级为警告。用 `--no-companions` 跳过；用 `--companion-repo=<name>=<url>` 把某个伴生 skill 指向别的仓库。
8. **把 `ctx` 链接成全局命令。** 在 `<项目>/.claude/skills/dw-code-facts/scripts/ctx` 下执行 `npm link`，再实际运行 `ctx --help` 验证。链接失败——没有写权限、npm 全局 bin 不在 PATH、PATH 上已有别人的 `ctx`——只降级为警告，并打印兜底调用方式 `node <skill>/scripts/ctx/src/cli.js <命令>`。别人的 `ctx` 绝不覆盖。Windows 上换项目重装时，全局命令目录里还留着上次那份 `ctx`，`npm link` 会报 `EEXIST`；安装器先判断那个文件是不是本体系的，是就用 `npm link --force` 覆盖，判不出归属就什么都不动，只打印该文件路径与删除方式。用 `--no-ctx-link` 跳过。
9. **保持 [codegraph](https://github.com/colbymchenry/codegraph) 最新并给项目建索引。** 缺失时执行 `npm install -g @colbymchenry/codegraph`，过期时执行 `codegraph upgrade`；随后接线到你的 agent（默认只接本项目；`--codegraph-location=global` 接所有项目），`.codegraph/` 不存在时用 `codegraph init` 建索引。Codex 没有项目级 MCP 配置，项目级接线跳过 Codex 并打印手动的全局命令。这一段任何失败都只降级为警告；用 `--no-codegraph` 整段跳过。

第 7–9 步在项目文件写完之后执行，它们失败不会撤销已完成的 skill 安装。

---

## 全局安装

```bash
npx --yes git+https://github.com/weidwonder/dw-system.git --global
npx --yes git+https://github.com/weidwonder/dw-system.git --global --dry-run
```

一次装进 `~/.claude/skills/`（Claude Code）与 `~/.codex/skills/`（Codex），本机所有项目共用。不接目标目录，不碰任何项目文件：`CLAUDE.md` / `AGENTS.md` 的标记块留到你第一次在某个项目里唤起 skill 时再写。

- 冲突插件改为**从本机卸载**，而不是按项目禁用：Claude Code 只卸 user scope 的安装，Codex 卸 `superpowers`。`--keep=<短名>` 保留某一个，`--no-plugins` 跳过这一步；`claude` / `codex` 不在 PATH 时打印手动命令。
- 全局 `ctx` 命令链接到用户级那份。codegraph 全局接线，但不建任何索引——要建索引就在项目根运行 `codegraph init`。
- 只对项目有意义的参数一律报错：目标目录、`--shared`、`--docs-in-git`、`--codex-conflicts`、`--codegraph-location=local`。
- 已经装在项目里的副本保持原样。两份并存时 Claude Code / Codex 加载哪一份由工具决定，所以只留一份。

要全机共用就用 `--global`，不要手工拷贝 skill 目录：手工拷贝不写版本戳，以后升级看不到迁移指南，也跳过了冲突插件处理与 `ctx` 链接。

---

## 从本地克隆安装

用于维护本仓库或排查问题：

```bash
# 已经克隆了本仓库时：
node /path/to/dw-system/install.mjs .

# Windows 也可以用包装脚本：
#   \path\to\dw-system\install.cmd .

# 仅用于开发、测试本仓库尚未发布的改动：
node /path/to/dw-system/install.mjs . --source-dir=/path/to/dw-system
```

---

## 冲突插件

| 插件 | 为什么与本流程冲突 |
|---|---|
| Claude Code `superpowers` | brainstorming HARD-GATE + `using-superpowers` 强制前置会截胡 Triage / 直接实现 |
| Claude Code `everything-claude-code` | plan/tdd/coding-standards 重叠 + SessionStart hook 注入 |
| Claude Code `oh-my-claudecode` | autopilot/ralph/ultrawork 端到端引擎替代本流程 + agents-overlay hook |
| Claude Code `general-task` | SessionStart 注入 clarify→plan→execute + `using-general-task` 强制前置（`--keep=general-task` 保留） |
| Codex `superpowers@openai-api-curated` | 默认在本项目 `AGENTS.md` 写自动触发约束；显式选择时可通过 Codex CLI 全局卸载 |

**为什么只在本项目禁用就够**：Claude Code 的设置优先级是 Managed > Local（`.claude/settings.local.json`）> Project（`.claude/settings.json`）> User（`~/.claude/settings.json`），`enabledPlugins` 在每一层都生效。项目级的 `false` 覆盖用户级的 `true`，所以这些插件**只在本项目**被关掉。Codex 默认也是同样的思路：在项目的 `AGENTS.md` 写约束，而不是改 `~/.codex/config.toml`。全局卸载需要 Codex CLI，并影响当前用户的所有项目。

---

## 装完之后

- **重启** Claude Code / Codex：settings 与 `AGENTS.md` 的改动在下一个会话生效，不是当前会话。打开项目时 Claude Code 若弹出 **workspace trust** 对话框，信任之后项目配置才生效。
- **首次在项目里唤起** skill 会做一次初始化：只问一个问题——这个项目除你之外还有没有人一起开发——并在同一批里给出做完的改动本地直接合并还是走 PR 的建议请你拍板，结论写进 `CLAUDE.md` 与 `AGENTS.md`。要不要维护代码事实层**不问**（它是必备的，在任务 worktree 里直接建骨架）；项目有没有代码图谱索引**也不问**（每次运行探测得出）。
- **Codex 用户**：项目级 skill 在 `<项目>/.agents/skills/`；用户级位置是 `~/.codex/skills/`（Codex 没有 `~/.agents/` 这个用户级目录，别装错）。Codex 读 `AGENTS.md`，初始化会与 `CLAUDE.md` 一起写它。`ctx` 是普通的 shell 命令，两个工具里用法一样。
- **文档目录**：spec 写进 `docs/spec/`，plan 写进 `docs/plan/`，report 写进 `docs/report/`——不建工具命名的目录，不把交付物散放在项目根。

---

## 撤销插件处理

- **Claude Code 插件**：删掉安装器在 `.claude/settings.local.json`（用了 `--shared` 则是 `.claude/settings.json`）的 `enabledPlugins` 下加的那些 `false` 条目。
- **Codex 约束**：删掉 `AGENTS.md` 里的 `dw-system:codex-conflicts` 标记块。
