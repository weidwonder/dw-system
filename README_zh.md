# ai-dev-system — 让 AI 交付变得可靠

[English](./README.md) | **中文**

![Node ≥20](https://img.shields.io/badge/Node-%E2%89%A520-brightgreen) ![零运行时依赖](https://img.shields.io/badge/dependencies-zero-blue) ![Claude Code · Codex](https://img.shields.io/badge/works%20with-Claude%20Code%20%C2%B7%20Codex-8A2BE2) ![跨平台](https://img.shields.io/badge/platform-macOS%20%C2%B7%20Linux%20%C2%B7%20Windows-lightgrey)

**你的 AI coding 工具栈里缺的那层方法论。** 让 AI coding 可靠的不是更用力的 prompt，而是工程化。ai-dev-system 把一个原始需求逐层降解成"**零上下文的 AI agent 也能可靠执行**"的任务——从 Triage 分流、顶层设计、技术 spec、coding plan，到编码与测试。

这不是白板上画出来的框架：它裁剪自一套在真实生产环境（**50~60 个 brownfield 仓库、双周高速迭代**）验证过的 AI 辅助开发体系，收敛为两个 **mode-aware 的 skill**，同时服务两种场景：

- **个人版**：一个人的轻量项目。默认走一页 Lean Spec、流程可跳步、决策沉淀进 memory。
- **团队版**：多人多项目（5~20 人、10~30 仓）。加上团队协作约定 + 一层轻量 **Engineering Context**（给 AI 供给"可信、新鲜、权威"的代码事实，避免它读错旧代码）。

**为什么选它：**

- 🎯 **一条命令装进任意项目**——Claude Code 与 Codex 同时安装，一次询问后自动路由个人版/团队版。
- 🧠 **Engineering Context 是真正的护城河**——能力登记表、每仓 Codebase Card、端到端场景蓝图、Frozen Probe Set 防腐门禁。每条事实带 cite（`path#anchor @确认时间`）；**无 cite 视为幻觉**。
- 🪶 **零运行时依赖**——纯 Node.js 标准库 + markdown。没有 build、没有 lockfile 漂移、没有需要伺候的东西。
- 🔒 **纪律是内建的，不是贴上去的**——每次改动强制 worktree 隔离、全部门禁通过才自动合并、用户沟通只用业务语言、RFC2119 spec 写作零占位符。
- ⚖️ **流程重量刚刚好**——4 问 Triage 把小改动分流到一页 Lean Spec，把真风险（AI 行为、安全、跨服务、不可逆、对外承诺）升级进完整流程。不搞仪式感。

> 核心信念：AI coding 能不能落地，秘密不在流程本身（谁都能抄），而在**能不能给 AI 一层可信赖的代码事实**。团队版正是为此而生。

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
└── ai-dev-system/
    └── skills/                 # 两个 skill（Claude Code + Codex 通用）
        ├── ai-prd/             # 产 PRD：批量提问 + 阶段化 elicitation
        │   ├── SKILL.md        # 入口：读 mode → PRD 类型分流 → 4 批提问
        │   ├── references/     # 生成流程 / 业务语言纪律 / 写作纪律 / 质量清单 / mode-*
        │   └── assets/         # 模板：change-prd（主）/ lite-issue-prd / product-prd
        └── ai-dev-workflow/    # 从已有 PRD 起步的主流程
            ├── SKILL.md        # 入口：读 mode → 路由；首次调用 → 初始化
            ├── references/
            │   ├── core/       # 共享内核：流程 / worktree / 用户沟通 / 写作 / AI overlay / 文档治理
            │   ├── personal/   # 个人薄外壳
            │   └── company/    # 团队外壳 + Engineering Context 设计
            ├── assets/         # 模板：spec / plan / test / config 注入片段 / card
            └── scripts/ctx/    # ctx CLI（Node.js，跨平台）：查代码事实，替代 MCP
```

> **两个 skill 的分工**：`ai-prd` 从零把需求做成 PRD → 产物作为 `ai-dev-workflow` Step 1 的输入 → workflow 继续做 Overview / Spec / Coding Plan / 测试。唤起 `ai-prd` 只需提到"帮我写 PRD / 生成需求文档 / 把这个需求写成 PRD"。

> **沟通边界**：所有用户沟通使用业务语言。大架构由用户确认；模块内设计通过业务问题取得约束；详细程序设计由 AI 与工程侧自主完成。`ai-prd` 的提问和成稿全部使用业务语言，不包含程序实现和技术选型。
>
> **开发隔离**：进入 `ai-dev-workflow` 后，任何文档或代码落盘前必须创建独立 Git worktree，Lean 小改动也不例外。全部工作和门禁完成后自动合并仓库主分支；失败时保留 worktree，不处理主工作树中的用户改动，也不绕过 PR、CI 或保护分支。

设计与实施文档见 `docs/spec/2026-07-06-ai-dev-system-design.md` 与 `docs/plan/2026-07-06-ai-dev-system.md`。

---

## 安装

**方式 A：npx 随项目安装（推荐）** — 在目标项目根目录运行下面一条命令。npx 从 GitHub 获取安装入口，安装器再从官方仓库的 `main` 分支获取技能包，同时装进目标项目的 `.claude/skills/`（Claude Code）和 `.agents/skills/`（Codex）。需要 Node.js 20+、npm 和 Git。

```bash
# 在目标项目根目录运行，macOS、Linux、Windows 通用：
npx --yes github:weidwonder/ai-dev-system .

# 先预演，不落盘：
npx --yes github:weidwonder/ai-dev-system . --dry-run

# 安装指定分支或标签，便于灰度和回滚：
npx --yes github:weidwonder/ai-dev-system . --ref=<分支或标签>
```

常用参数：`--shared` 把 Claude Code 项目配置提交给全仓共享；`--keep=<插件短名>` 保留指定冲突插件；`--no-plugins` 只装 skill；`--yes` 跳过安装器自身的交互确认。完整参数用 `npx --yes github:weidwonder/ai-dev-system --help` 查看。

> 命令前面的 `npx --yes` 只跳过 npm 下载确认，安装器仍会在修改项目之前询问一次。需要全自动安装时，在目标目录后再传一次：`npx --yes github:weidwonder/ai-dev-system . --yes`。

**方式 B：本地脚本安装（仓库维护与排障）**

```bash
# 已克隆本仓库时：
node /path/to/ai-dev-system/install.mjs .

# Windows 也可使用包装脚本：
#   \path\to\ai-dev-system\install.cmd .

# 仅在开发、测试本仓库未发布改动时使用本地源码：
node /path/to/ai-dev-system/install.mjs . --source-dir=/path/to/ai-dev-system
```

安装器会：

1. 从 GitHub 获取 `--repo` 对应仓库的 `--ref` 版本，并校验其中至少有一个有效 skill；下载或校验失败时不修改目标项目；
2. 复制该版本的**所有** skill（默认含 `ai-prd` + `ai-dev-workflow` 和 `ctx` CLI）→ `<项目>/.claude/skills/`，完成 Claude Code 项目级安装；
3. 复制同一批 skill → `<项目>/.agents/skills/`，完成 Codex 项目级安装；
4. 合并（不覆盖）Claude Code 的 `enabledPlugins`，在本项目把冲突插件设为 `false`；
5. 安装时让用户选择 Codex 冲突技能处理方式：默认写入项目 `AGENTS.md` 约束自动触发，也可明确选择通过 Codex CLI 全局卸载；若任一入口已有 workflow mode，同时补齐 `CLAUDE.md` 与 `AGENTS.md`。

| 插件 | 为什么与本流程冲突 |
|---|---|
| Claude Code `superpowers` | brainstorming 的 HARD-GATE + `using-superpowers` 强制前置，会截胡 Triage / 直接实现 |
| Claude Code `everything-claude-code` | plan/tdd/coding-standards 与本流程重叠 + SessionStart hook 注入 |
| Claude Code `oh-my-claudecode` | autopilot/ralph/ultrawork 等端到端引擎替代本流程 + agents-overlay hook |
| Claude Code `general-task` | SessionStart 注入 clarify→plan→execute + `using-general-task` 强制前置（默认也禁用，`--keep=general-task` 可保留）|
| Codex `superpowers@openai-api-curated` | 默认写入项目 `AGENTS.md` 约束自动触发；安装时明确选择后，也可通过 Codex CLI 全局卸载 |

> **为什么能只在本项目禁用**：Claude Code settings 优先级为 Managed > Local(`.claude/settings.local.json`) > Project(`.claude/settings.json`) > User(`~/.claude/settings.json`)，`enabledPlugins` 在所有 scope 均可设。项目级 `false` 覆盖用户级 `true`，于是这些插件**只在本项目关闭**。
>
> Codex 安装默认采用项目级 `AGENTS.md` 自动触发约束，不改用户级 `~/.codex/config.toml`，避免安装一个项目 skill 时影响其他项目。交互安装可明确选择全局卸载；自动化安装用 `--codex-conflicts=uninstall`，需要本机有 Codex CLI，且会影响所有项目。安装器会写后校验 `ai-dev-system:codex-conflicts`，并补齐缺失的 workflow mode 标记。
>
> ⚠ 两个前提：① 项目级 `.claude/settings.json` 首次打开会弹 **workspace trust** 对话框，信任后才生效；② settings / `AGENTS.md` 改动在**下次启动 Claude Code / Codex** 时生效，非当前会话。撤销只需删掉本项目 settings 里对应的 `false` 条目，或删掉 `AGENTS.md` 中的 `ai-dev-system:codex-conflicts` 标记块。

**方式 C：全局安装一次** — 所有项目共用，但冲突插件需你手动权衡（全局装则全局都在，可能与本流程相互干扰）。

```bash
cp -r ai-dev-system/skills/ai-prd ai-dev-system/skills/ai-dev-workflow ~/.claude/skills/
cp -r ai-dev-system/skills/ai-prd ai-dev-system/skills/ai-dev-workflow ~/.codex/skills/
```

之后在任意项目里唤起 skill（提到"AI 辅助开发 / 开发流程 / 生成 spec / coding plan / 需求澄清"即可触发），首次会做一次**初始化**：询问该项目用个人版还是团队版，把结论写进项目根的 `CLAUDE.md` 和 `AGENTS.md`，之后不再询问。

> **Codex 用户**：项目级 skill 安装在 `<项目>/.agents/skills/`，**用户级**则是 `~/.codex/skills/`（Codex 没有 `~/.agents/` 这个用户级入口，别装错）。Codex 读 `AGENTS.md`；初始化会同时写入 `AGENTS.md`，其中指明 mode、Engineering Context 位置与 `ctx` 用法；`ctx` CLI 可直接通过 shell 调用，跨工具通用。

> **文档目录**：spec 固定写 `docs/spec/`，plan 固定写 `docs/plan/`，report 固定写 `docs/report/`。不得生成工具命名目录或把交付物散放到项目根。

---

## 快速开始

### 个人项目
1. 在项目里唤起 skill → 选"个人版"。
2. 直接描述你的需求。AI 会先建立独立 worktree；小改动走一页 Lean Spec，大需求升级到完整流程。
3. 全部验证通过后自动合并主分支并清理 worktree，无需再次确认合并。

### 团队项目
1. 在项目里唤起 skill → 选"团队版"。
2. 首次建议初始化 Engineering Context：
   ```bash
   node <skill>/scripts/ctx/src/cli.js init
   ```
   生成 `engineering-context/` 骨架（capability-registry + cards + scenes + probe-set + glossary 模板），团队按指南逐步填充。
3. 之后开发时，AI 会为每个仓库建立独立 worktree，再用 `ctx discover "<意图>"` 找权威代码实体，而不是 grep 旧代码；每条事实带 cite 溯源。
4. 多仓全部就绪后，按依赖顺序走 PR、CI 和保护分支门禁并自动合并。

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
