# dw-system — 让 AI 交付变得可靠

[English](./README.md) | **中文**

![Node ≥20](https://img.shields.io/badge/Node-%E2%89%A520-brightgreen) ![零运行时依赖](https://img.shields.io/badge/dependencies-zero-blue) ![Claude Code · Codex](https://img.shields.io/badge/works%20with-Claude%20Code%20%C2%B7%20Codex-8A2BE2) ![跨平台](https://img.shields.io/badge/platform-macOS%20%C2%B7%20Linux%20%C2%B7%20Windows-lightgrey)

**你的 AI coding 工具栈里缺的那层方法论。** 让 AI coding 可靠的不是更用力的 prompt，而是工程化。dw-system 把一个原始需求逐层降解成"**零上下文的 AI agent 也能可靠执行**"的任务——从 Triage 分流、顶层设计、技术 spec、coding plan，到编码与测试。

这不是白板上画出来的框架：它裁剪自一套在真实生产环境（**50~60 个 brownfield 仓库、双周高速迭代**）验证过的 AI 辅助开发体系，收敛为两个 skill。

装了它的项目**一律**维护同一层**必备地基**：`engineering-context/` 代码事实层（能力登记表 + 每仓一张事实卡）。不分项目大小、不分人数、没有开关——初始化时建骨架，之后的规矩只有一句：**要用某个模块的事实就先查卡片；没有卡片就读源码，读完当场把卡片补上**，随本次分支一起提交，不顺延。

在这层地基之上，只有两件事**可变**：

- **协作面**（问一次，写进配置）——这个项目除你之外还有没有人一起开发。决定要不要对齐 owner、开评审会、走 PR，以及兼容取舍由谁拍板。
- **代码图谱**（每次运行探测，不问也不写配置）——项目有没有建本地代码图谱索引。它只是**检索加速面**（回答"找得到吗"：符号、调用链、影响面），不改变任何流程判据；没有它就把重探索外包给子代理。

**为什么没有"这个项目要不要建资产"这道选择题**：任何分档判据都滞后于项目的实际风险。一个人维护的十万行遗留系统恰恰一张卡片都没有——于是被判成"没有资产 → 走最短流程 → 直接 grep 旧代码"，而那正是这套体系最初要消灭的失败模式。卡片是地基，不是升级项。

**为什么选它：**

- 🎯 **一条命令装进任意项目**——Claude Code 与 Codex 同时安装，只问一个问题（有没有人和你一起开发）；代码事实层由体系自己建骨架，没有"档次"要你选。
- 🧠 **Engineering Context 是真正的护城河**——能力登记表、每仓 Codebase Card、端到端场景蓝图、Frozen Probe Set 防腐门禁。每条事实带 cite（`path#anchor @确认时间`）；**无 cite 视为幻觉**。
- 🪶 **零运行时依赖**——纯 Node.js 标准库 + markdown。没有 build、没有 lockfile 漂移、没有需要伺候的东西。
- 🔒 **纪律是内建的，不是贴上去的**——每次改动强制 worktree 隔离、全部门禁通过才自动合并、用户沟通只用业务语言、RFC2119 spec 写作零占位符。
- ⚖️ **流程重量刚刚好**——4 问 Triage 把小改动分流到一页 Lean Spec，把真风险（AI 行为、安全、跨服务、不可逆、对外承诺）升级进完整流程。不搞仪式感。

> 核心信念：AI coding 能不能落地，秘密不在流程本身（谁都能抄），而在**能不能给 AI 一层可信赖的代码事实**。代码事实层之所以是必备项，正是为此——而它跟你有几个同事无关。

---

## 组成

```
.                               # 仓库根
├── package.json                # npx GitHub 命令入口
├── install.mjs                 # 安装器（从 GitHub 获取指定版本，跨平台）
├── install.cmd                 # Windows 包装
├── docs/
│   ├── spec/                  # PRD / Requirements / Overview / Spec / 设计 / 契约
│   ├── plan/                  # Coding Plan / 实施计划 / 迁移计划
│   └── report/                # 执行 / 验证 / 测试 / 审计报告
└── dw-system/
    └── skills/                 # 两个 skill（Claude Code + Codex 通用）
        ├── dw-prd/             # 产 PRD：批量提问 + 阶段化 elicitation
        │   ├── SKILL.md        # 入口：读协作面 → PRD 类型分流 → 4 批提问
        │   ├── references/     # 生成流程 / 业务语言纪律 / 写作纪律 / UI 原型纪律 / 质量清单 / 复核纪律
        │   │   └── collab/     # solo.md / team.md（按协作面二选一）
        │   └── assets/         # 模板：change-prd（主）/ lite-issue-prd / product-prd
        └── dw-workflow/    # 从已有 PRD 起步的主流程
            ├── SKILL.md        # 入口：探测代码图谱 → 读协作面 → 加载；首次调用 → 初始化
            ├── references/
            │   ├── core/       # 共享内核：流程 / 代码事实 / worktree / 用户沟通 / 写作 / AI overlay / 文档治理
            │   ├── collab/     # solo.md / team.md（按协作面二选一，必加载一份）
            │   └── capability/ # graph.md（探测到代码图谱索引时才加载，可零篇）
            ├── assets/         # 模板：spec / plan / test / config 注入片段 / card
            └── scripts/ctx/    # ctx CLI（Node.js，跨平台）：查代码事实，替代 MCP
```

> **两个 skill 的分工**：`dw-prd` 从零把需求做成 PRD → 产物作为 `dw-workflow` Step 1 的输入 → workflow 继续做 Overview / Spec / Coding Plan / 测试。唤起 `dw-prd` 只需提到"帮我写 PRD / 生成需求文档 / 把这个需求写成 PRD"。

> **沟通边界**：所有用户沟通使用业务语言。大架构由用户确认；模块内设计通过业务问题取得约束；详细程序设计由 AI 与工程侧自主完成。`dw-prd` 的提问和成稿全部使用业务语言，不包含程序实现和技术选型。
>
> **开发隔离**：进入 `dw-workflow` 后，任何文档或代码落盘前必须创建独立 Git worktree，Lean 小改动也不例外。全部工作和门禁完成后自动合并仓库主分支；失败时保留 worktree，不处理主工作树中的用户改动，也不绕过 PR、CI 或保护分支。

设计与实施文档见 `docs/spec/2026-07-06-ai-dev-system-design.md` 与 `docs/plan/2026-07-06-ai-dev-system.md`。

---

## 安装

**方式 A：npx 随项目安装（推荐）** — 在目标项目根目录运行下面一条命令。npx 从 GitHub 获取安装入口，安装器再从官方仓库获取**与它自身版本一致**的技能包，同时装进目标项目的 `.claude/skills/`（Claude Code）和 `.agents/skills/`（Codex）。需要 Node.js 20+、npm 和 Git。

```bash
# 在目标项目根目录运行，macOS、Linux、Windows 通用：
npx --yes git+https://github.com/weidwonder/dw-system.git .

# 先预演，不落盘：
npx --yes git+https://github.com/weidwonder/dw-system.git . --dry-run

# 端到端锁定一个发布版本：安装入口与技能源取同一个 tag
npx --yes git+https://github.com/weidwonder/dw-system.git#v2.4.0 . --ref=v2.4.0

# 想跟随开发分支：
npx --yes git+https://github.com/weidwonder/dw-system.git . --ref=main
```

> 请用 `git+https://` 形式，别用 `github:weidwonder/dw-system` 简写。简写会让 npm 去下载 GitHub 的 codeload tarball，部分环境（已知 Windows + npm 12）会拿到 404；`git+https://` 走 `git clone`，绕开该路径。

安装器的默认 `--ref` 就是它自带的 `dw-system/VERSION` 对应的 tag，因此 npx 包版本与装进项目的技能版本始终一致。显式传了 `--ref` 而该版本取不到时，安装器直接以非零退出码失败，不会悄悄换成别的版本装进去。

常用参数：`--shared` 把 Claude Code 项目配置提交给全仓共享；`--keep=<插件短名>` 保留指定冲突插件；`--no-plugins` 只装 skill；`--yes` 跳过安装器自身的交互确认；`--docs-in-git=yes|no` 直接指定 `docs/` 与 `engineering-context/` 是否提交进 git（不传则交互问一次，默认 `no`）；`--no-codegraph` 跳过 codegraph 那一段；`--codegraph-location=global` 把 codegraph 接到所有项目而不只是本项目。完整参数用 `npx --yes git+https://github.com/weidwonder/dw-system.git --help` 查看。

> 命令前面的 `npx --yes` 只跳过 npm 下载确认，安装器仍会在修改项目之前询问一次。需要全自动安装时，在目标目录后再传一次：`npx --yes git+https://github.com/weidwonder/dw-system.git . --yes`。

**方式 B：本地脚本安装（仓库维护与排障）**

```bash
# 已克隆本仓库时：
node /path/to/dw-system/install.mjs .

# Windows 也可使用包装脚本：
#   \path\to\dw-system\install.cmd .

# 仅在开发、测试本仓库未发布改动时使用本地源码：
node /path/to/dw-system/install.mjs . --source-dir=/path/to/dw-system
```

安装器会：

1. 从 GitHub 获取 `--repo` 对应仓库的 `--ref` 版本，并校验其中至少有一个有效 skill；下载或校验失败时不修改目标项目；
2. 复制该版本的**所有** skill（默认含 `dw-prd` + `dw-workflow` 和 `ctx` CLI）→ `<项目>/.claude/skills/`，完成 Claude Code 项目级安装；
3. 复制同一批 skill → `<项目>/.agents/skills/`，完成 Codex 项目级安装；
4. 在目标项目 `.gitignore` 幂等追加一个标记块，逐条忽略已安装的 skill 目录与版本 stamp；同时**问一次** `docs/` 与 `engineering-context/` 要不要提交进 git——**默认（回车）是不提交**，就把这两个目录一并写进同一个标记块；答"提交"则一个字节都不动它们。答案以一行注释记在块内，重装直接沿用、**不再询问**。`--yes` 与非交互终端（CI、npx 自动安装）取同一个默认值 `no` 一次落定；`.gitignore` 里已有你自己写的这两个目录的忽略规则时既不发问、也不接管它们。`--docs-in-git=yes|no` 优先于以上全部，也是事后改主意的入口；
5. 合并（不覆盖）Claude Code 的 `enabledPlugins`，在本项目把冲突插件设为 `false`；
6. 安装时让用户选择 Codex 冲突技能处理方式：默认写入项目 `AGENTS.md` 约束自动触发，也可明确选择通过 Codex CLI 全局卸载；若任一入口已有 workflow 标记块，同时补齐 `CLAUDE.md` 与 `AGENTS.md`；
7. 把 skill 自带的 `ctx` CLI 链接成**全局 `ctx` 命令**（在 `<项目>/.claude/skills/dw-workflow/scripts/ctx` 下 `npm link`），并实跑 `ctx --help` 验证真的可用。链接失败（无写权限、npm 全局 bin 不在 PATH、PATH 上已有**别人的**同名 `ctx`）只降级为警告，并打印 `node <skill>/scripts/ctx/src/cli.js <命令>` 兜底调用方式。Windows 上换项目重装时 `npm link` 会因全局命令目录里还留着上次那个 `ctx` 而报 `EEXIST`：安装器会先确认那个文件确实是本体系留下的，确认了才 `npm link --force` 覆盖成本次这份；判不出归属就一个字节都不动，只打印文件路径与删除方式——CLI 本体已随 skill 落盘，**命令找不到不等于 ctx 不可用**。`--no-ctx-link` 可跳过；
8. 保持 [codegraph](https://github.com/colbymchenry/codegraph)（本地代码知识图谱 CLI）为最新——没装就 `npm install -g @colbymchenry/codegraph`，有新版就 `codegraph upgrade`——随后接线到 agent（默认 `--location=local`，只影响本项目），并在 `.codegraph/` 不存在时用 `codegraph init` 给本仓库建索引。这一段任何失败只降级为警告；`--no-codegraph` 可整段跳过。Codex CLI 没有项目级 MCP 配置，项目级接线会跳过它，安装器会打印手动全局接线命令。

| 插件 | 为什么与本流程冲突 |
|---|---|
| Claude Code `superpowers` | brainstorming 的 HARD-GATE + `using-superpowers` 强制前置，会截胡 Triage / 直接实现 |
| Claude Code `everything-claude-code` | plan/tdd/coding-standards 与本流程重叠 + SessionStart hook 注入 |
| Claude Code `oh-my-claudecode` | autopilot/ralph/ultrawork 等端到端引擎替代本流程 + agents-overlay hook |
| Claude Code `general-task` | SessionStart 注入 clarify→plan→execute + `using-general-task` 强制前置（默认也禁用，`--keep=general-task` 可保留）|
| Codex `superpowers@openai-api-curated` | 默认写入项目 `AGENTS.md` 约束自动触发；安装时明确选择后，也可通过 Codex CLI 全局卸载 |

> **为什么能只在本项目禁用**：Claude Code settings 优先级为 Managed > Local(`.claude/settings.local.json`) > Project(`.claude/settings.json`) > User(`~/.claude/settings.json`)，`enabledPlugins` 在所有 scope 均可设。项目级 `false` 覆盖用户级 `true`，于是这些插件**只在本项目关闭**。
>
> Codex 安装默认采用项目级 `AGENTS.md` 自动触发约束，不改用户级 `~/.codex/config.toml`，避免安装一个项目 skill 时影响其他项目。交互安装可明确选择全局卸载；自动化安装用 `--codex-conflicts=uninstall`，需要本机有 Codex CLI，且会影响所有项目。安装器会写后校验 `dw-system:codex-conflicts`，并补齐缺失的 workflow 标记块。
>
> ⚠ 两个前提：① 项目级 `.claude/settings.json` 首次打开会弹 **workspace trust** 对话框，信任后才生效；② settings / `AGENTS.md` 改动在**下次启动 Claude Code / Codex** 时生效，非当前会话。撤销只需删掉本项目 settings 里对应的 `false` 条目，或删掉 `AGENTS.md` 中的 `dw-system:codex-conflicts` 标记块。

**方式 C：全局安装一次** — 所有项目共用，但冲突插件需你手动权衡（全局装则全局都在，可能与本流程相互干扰）。

```bash
cp -r dw-system/skills/dw-prd dw-system/skills/dw-workflow ~/.claude/skills/
cp -r dw-system/skills/dw-prd dw-system/skills/dw-workflow ~/.codex/skills/
```

之后在任意项目里唤起 skill（提到"AI 辅助开发 / 开发流程 / 生成 spec / coding plan / 需求澄清"即可触发），首次会做一次**初始化**：只问一个问题——**这个项目除你之外还有其他人一起开发吗**——把结论写进项目根的 `CLAUDE.md` 和 `AGENTS.md`，之后不再询问。要不要维护代码事实层**不问**——它是必备的，初始化会在任务 worktree 里直接建好骨架；项目有没有代码图谱索引**也不问**，每次运行探测得出。

> **Codex 用户**：项目级 skill 安装在 `<项目>/.agents/skills/`，**用户级**则是 `~/.codex/skills/`（Codex 没有 `~/.agents/` 这个用户级入口，别装错）。Codex 读 `AGENTS.md`；初始化会同时写入 `AGENTS.md`，其中指明协作面、合并方式与 `ctx` 用法；`ctx` CLI 可直接通过 shell 调用，跨工具通用。

> **文档目录**：spec 固定写 `docs/spec/`，plan 固定写 `docs/plan/`，report 固定写 `docs/report/`。不得生成工具命名目录或把交付物散放到项目根。

---

## 快速开始

### 一个人开发
1. 在项目里唤起 skill → 回答"只有我一个人"。
2. 直接描述你的需求。AI 会先建立独立 worktree；小改动走一页 Lean Spec，大需求升级到完整流程。
3. 全部验证通过后自动合并主分支并清理 worktree，无需再次确认合并。

> 一个人**不等于**可以跳过代码事实层。它一样要建：初始化时建 `engineering-context/` 骨架，卡片在干活过程中边用边补。"同一能力两处实现、改错了那处"跟有几个人无关。

### 有人一起开发
1. 在项目里唤起 skill → 回答"有其他人"，并确认合并方式（本地直接合并 / 推 PR 走平台）。
2. 之后开发时，AI 会为每个仓库建立独立 worktree，跨 ≥3 仓的需求先出 Overview 再开评审会，改别人的仓库前先对齐 owner。
3. 多仓全部就绪后，按依赖顺序走 PR、CI 和保护分支门禁并自动合并。

### 代码事实层（**必备：任何项目、任何规模、任何人数**）

这一层不由你按需决定要不要建，也不需要你判断"现在值不值得建"。首次唤起 skill 时，它会在任务 worktree 里直接建好整套骨架：

```bash
ctx init                                     # 能力登记表 + cards/ + scenes/ + probe-set + glossary + README
node <skill>/scripts/ctx/src/cli.js init     # 全局命令不可用时的等价兜底
```

骨架里只有模板占位、没有真实数据，这是**正常起步状态**，没人会为此告警。内容**边干活边补**：AI 用 `ctx discover "<意图>"` 找权威代码实体而不是 grep 旧代码，每条事实带 cite 溯源；碰到还没有卡片的模块，就读源码、**当场把卡片写上**并随本次分支提交——下一个零上下文 agent 不必再把同样的路重走一遍。

代价说在明处：在既有代码库上，**前几次任务会慢一点**（读源码 + 写卡片是实打实的工作量），之后越来越快，而且这件事不再需要你惦记。

本地**代码图谱**索引（安装器已自带这一段）是可选的另一半：它让"找得到"更快，但永远回答不了"该信哪一个"——那是卡片的职责。

---

## ctx CLI 速览

| 命令 | 作用 | 状态 |
|---|---|---|
| `ctx init` | 生成 engineering-context 目录骨架 | ✅ |
| `ctx discover "<意图>"` | 意图 → 应加载的 card 清单 + out-of-scope 警告 | ✅ |
| `ctx get-card <repo> [域]` | 取某仓 Codebase Card | ✅ |
| `ctx find-scenes <关键词>` | 端到端业务场景蓝图 | ✅ |
| `ctx list-services` | 列出已登记仓库/能力 | ✅ |
| `ctx search-semantic "<q>"` | discover 未命中时的语义兜底（本地向量相似） | ✅ |
| `ctx probe` | 跑 Frozen Probe Set 防腐门禁（自检 + 棘轮 + 衰减） | ✅ |
