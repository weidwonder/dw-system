# ai-dev-system — 我们自己的 AI 辅助开发体系

把一个需求，逐层降解成"零上下文的 AI agent 也能可靠执行"的任务——从 Triage 分流、顶层设计、技术 spec、coding plan，到编码与测试。

本体系裁剪自一套在真实生产环境（50~60 个 brownfield 仓库、双周高速迭代）验证过的 AI 辅助开发体系，收敛为**一个 mode-aware 的 skill**，同时服务两种场景：

- **个人版**：一个人的轻量项目。默认走一页 Lean Spec、流程可跳步、决策沉淀进 memory。
- **团队版**：多人多项目（5~20 人、10~30 仓）。加上团队协作约定 + 一层轻量 **Engineering Context**（给 AI 供给"可信、新鲜、权威"的代码事实，避免它读错旧代码）。

> 核心信念：AI coding 能不能落地，秘密不在流程本身（谁都能抄），而在**能不能给 AI 一层可信赖的代码事实**。团队版正是为此而生。

---

## 组成

```
.                               # 仓库根
├── install.mjs                 # 安装器（跨平台，直接 ./install.mjs 运行）
├── install.cmd                 # Windows 包装
├── docs/                       # 设计 / 实施文档
└── ai-dev-system/
    └── skills/                 # 两个 skill（Claude Code + Codex 通用）
        ├── ai-prd/             # 产 PRD：批量提问 + 阶段化 elicitation
        │   ├── SKILL.md        # 入口：读 mode → PRD 类型分流 → 4 批提问
        │   ├── references/     # 生成流程 / 写作纪律 / 质量清单 / mode-*
        │   └── assets/         # 模板：change-prd（主）/ lite-issue-prd / product-prd
        └── ai-dev-workflow/    # 从已有 PRD 起步的主流程
            ├── SKILL.md        # 入口：读 mode → 路由；首次调用 → 初始化
            ├── references/
            │   ├── core/       # 共享内核（技术栈无关）：流程总纲 / 写作纪律 / AI overlay
            │   ├── personal/   # 个人薄外壳
            │   └── company/    # 团队外壳 + Engineering Context 设计
            ├── assets/         # 模板：spec / plan / test / config 注入片段 / card
            └── scripts/ctx/    # ctx CLI（Node.js，跨平台）：查代码事实，替代 MCP
```

> **两个 skill 的分工**：`ai-prd` 从零把需求做成 PRD → 产物作为 `ai-dev-workflow` Step 1 的输入 → workflow 继续做 Overview / Spec / Coding Plan / 测试。唤起 `ai-prd` 只需提到"帮我写 PRD / 生成需求文档 / 把这个需求写成 PRD"。

设计与实施文档见 `docs/superpowers/specs/2026-07-06-ai-dev-system-design.md` 与 `docs/superpowers/plans/2026-07-06-ai-dev-system.md`。

---

## 安装

**方式 A：随项目安装（推荐）** — 用安装器装进目标项目的 `.claude/skills/`，并在**本项目**级配置里禁用或约束与本流程冲突的 Claude Code / Codex 插件或技能开关（只影响本项目，全局其他项目不受影响）。

```bash
# 在目标项目根目录下运行（需已装 node，ctx CLI 也用它）
#   macOS / Linux —— install.mjs 带 shebang，直接跑不用写 node：
/path/to/ai-dev-system/install.mjs .
#   任意平台的等价写法：
node /path/to/ai-dev-system/install.mjs .
#   Windows（cmd / PowerShell）：
#   \path\to\ai-dev-system\install.cmd .

#   --dry-run           先预演，不落盘
#   --shared            Claude Code 禁用写进 .claude/settings.json（提交进 git，全仓协作者共享）
#                       默认写 .claude/settings.local.json（gitignored，仅影响你）
#   --keep=<插件短名>    保留某个插件不禁用（可多次）
#   --no-plugins        只装 skill，不动任何冲突插件/技能设置或 AGENTS.md 约束
#   --yes               跳过交互确认
```

安装器会：① 复制 `skills/` 下**所有** skill（`ai-prd` + `ai-dev-workflow`，含 `ctx` CLI）→ `<项目>/.claude/skills/`；② 合并（不覆盖）项目级配置，在本项目处理下列冲突插件/技能：

| 插件 | 为什么与本流程冲突 |
|---|---|
| Claude Code `superpowers` | brainstorming 的 HARD-GATE + `using-superpowers` 强制前置，会截胡 Triage / 直接实现 |
| Claude Code `everything-claude-code` | plan/tdd/coding-standards 与本流程重叠 + SessionStart hook 注入 |
| Claude Code `oh-my-claudecode` | autopilot/ralph/ultrawork 等端到端引擎替代本流程 + agents-overlay hook |
| Claude Code `general-task` | SessionStart 注入 clarify→plan→execute + `using-general-task` 强制前置（默认也禁用，`--keep=general-task` 可保留）|
| Codex `superpowers@openai-api-curated` | Codex 0.142.5 暂无可验证的项目级 plugin `enabled=false`；安装器写入项目 `AGENTS.md` 标记块，要求不要自动加载或主动触发 `superpowers:`，除非用户当前对话明确要求 |

> **为什么能只在本项目禁用**：Claude Code settings 优先级为 Managed > Local(`.claude/settings.local.json`) > Project(`.claude/settings.json`) > User(`~/.claude/settings.json`)，`enabledPlugins` 在所有 scope 均可设。项目级 `false` 覆盖用户级 `true`，于是这些插件**只在本项目关闭**。
>
> Codex 当前插件配置只从用户级 `~/.codex/config.toml` 的顶层 `[plugins]` 读取；源码中的 `ProjectConfig` 当前只支持 `trust_level`。因此安装器**不会**生成无效的项目根 `.codex/config.toml`，而是写入项目 `AGENTS.md` 的 `ai-dev-system:codex-conflicts` 标记块来约束自动触发行为。
>
> ⚠ 两个前提：① 项目级 `.claude/settings.json` 首次打开会弹 **workspace trust** 对话框，信任后才生效；② settings / `AGENTS.md` 改动在**下次启动 Claude Code / Codex** 时生效，非当前会话。撤销只需删掉本项目 settings 里对应的 `false` 条目，或删掉 `AGENTS.md` 中的 `ai-dev-system:codex-conflicts` 标记块。

**方式 B：全局安装一次** — 所有项目共用，但冲突插件需你手动权衡（全局装则全局都在，可能与本流程相互干扰）。

```bash
cp -r ai-dev-system/skills/ai-prd ai-dev-system/skills/ai-dev-workflow ~/.claude/skills/
```

之后在任意项目里唤起 skill（提到"AI 辅助开发 / 开发流程 / 生成 spec / coding plan / 需求澄清"即可触发），首次会做一次**初始化**：询问该项目用个人版还是团队版，把结论写进项目根的 `CLAUDE.md` 和 `AGENTS.md`，之后不再询问。

> **Codex 用户**：Codex 读 `AGENTS.md`。初始化会同时写入 `AGENTS.md`，其中指明 mode、Engineering Context 位置与 `ctx` 用法；`ctx` CLI 可直接通过 shell 调用，跨工具通用。

---

## 快速开始

### 个人项目
1. 在项目里唤起 skill → 选"个人版"。
2. 直接描述你的需求。小改动会走一页 Lean Spec 直接实现；大需求才升级到完整流程。

### 团队项目
1. 在项目里唤起 skill → 选"团队版"。
2. 首次建议初始化 Engineering Context：
   ```bash
   node <skill>/scripts/ctx/src/cli.js init
   ```
   生成 `engineering-context/` 骨架（capability-registry + cards + probe-set 模板），团队按指南逐步填充。
3. 之后开发时，AI 会先用 `ctx discover "<意图>"` 找权威代码实体，而不是 grep 旧代码；每条事实带 cite 溯源。

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
