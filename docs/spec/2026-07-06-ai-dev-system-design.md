---
date: '2026-07-06'
status: 'design-approved-pending-review'
documentRole: 'design-spec'
sourceOfTruth: true
lifecycle: active
last_confirmed: '2026-08-17'
authority_refs:
  - 'skill 的交付形态与目录结构：ai-dev-system/skills/<name>/{SKILL.md,references/,assets/,scripts/}'
  - 'references/ 的分层职责：core 常驻 + 按维度追加的分册'
  - 'skill 初始化把配置幂等写入目标项目 CLAUDE.md 与 AGENTS.md 标记块这一机制'
  - 'Engineering Context 的构成（方案 B）：capability-registry / cards / scenes / Frozen Probe Set / 新鲜度与棘轮'
  - '代码事实访问的交付形态：CLI（ctx）而非 MCP，及有意不实现的 MCP 方法清单'
  - 'ctx 的命令集合与跨平台硬约束（node:path / UTF-8 / 零第三方依赖）'
  - '安装形态：随项目安装为推荐路径 + 项目级禁用冲突插件（D10）'
---

> **现行性说明（2026-08-17）**：本文是体系的**设计真相源**，架构决策与理由仍现行。其中「个人 / 团队两档 mode」这一维度已在 2.0.0 被拆成**协作面**（显式字段）与**能力位**（运行时探测），下文相关小节已按新模型更新；决策表保留原始记录并逐条标注去向，取代口径见 `2026-08-16-项目真相源与context-tier重构-eng-spec.md`。

# 自有 AI 辅助开发体系 — 设计文档

> 本文档是"把一套上游参考体系（朋友公司的 AI 辅助开发体系，仅本地参考、不公开）裁剪并落地成我们自己的一套体系"这项工作的设计真相源。实现计划（coding plan）与后续产出物若与本文冲突，以本文为准；范围变更须先改本文。

## 1. 背景与目标

`orgin/` 目录是上游参考体系（仅本地参考，已被 `.gitignore` 忽略）。其核心不是那条 10 步流程（可迁移），而是**一层给 AI 供给"可信、新鲜、权威"代码事实的 Engineering Context 语义层 + 防腐机制**——这才是其"0 手工代码维护复杂项目"的秘密。

本项目把这套体系裁剪成适合我们的形态。**目标**：

1. 产出一个**内核常驻、外壳按需追加的 skill**（`ai-dev-workflow`），同时服务一个人的轻量项目与多人多仓的公司项目。（2.0.0 起：外壳按**协作面**与**能力位**两个正交维度追加，不再是"个人 / 团队"一个开关。）
2. skill 首次在某项目调用时**初始化一次**（只问协作面：除你之外还有没有人一起开发），把结论幂等写入该项目的 `CLAUDE.md` + `AGENTS.md`，之后每次调用直接读标记块，不再询问；项目有哪些代码事实资产**每次运行探测得出**，不问、不写进配置。
3. 项目具备**权威位**（已填写的 capability 登记表）时启用一层**轻量 Engineering Context**（方案 B：Codebase Card + capability 登记 + 新鲜度 + Frozen Probe Set），其代码事实访问以 **CLI（`ctx`）**而非 MCP 形态交付。
4. 全套 **Claude Code + Codex 通用**：内核为可移植 markdown，双入口（CLAUDE.md / AGENTS.md）。

## 2. 已确认的关键决策（来自交互澄清）

| # | 决策 | 结论 |
|---|---|---|
| D1 | 技术栈 | Web 全栈 / 后端服务 / AI-LLM / 数据脚本 **全覆盖** → 内核必须技术栈无关，AI/LLM 单独挂 overlay |
| D2 | 团队规模 | 中等团队 5–20 人、10–30 仓 → 需要轻量 context 层，非 origin 完整机器 |
| D3 | 工具链 | Claude Code + Codex 为主 → markdown 双入口，CLI 而非 MCP |
| D4 | 仓库现状 | 历史包袱重、文档差 → 这类仓库**必须**有 context 层（2.0.0 起：由项目是否具备权威位决定是否启用，与人数无关——单人维护的遗留系统同样适用）|
| D5 | context 层深度 | 直接上**方案 B**（含 MCP→改 CLI + Frozen Probe Set 防腐） |
| D6 | 交付形态 | **单个 skill**，分层结构收进 skill 的 `references/`（原为 core/personal/company 三层；2.0.0 起为 `core/` + `collab/` + `capability/`，见 §3）|
| D7 | 初始化 | 首次调用写入 CLAUDE.md/AGENTS.md，幂等，之后不再问（2.0.0 起只固化**协作面**，能力位改为每次运行探测，不进配置）|
| D8 | context 访问 | 做成 **CLI（`ctx`）**，不用 MCP；给设计 + 可运行骨架，其余写文档 |
| D9 | CLI 语言 | **Node.js**，必须跨平台（路径/shell/行尾） |
| D10 | 安装形态 + 冲突插件处理 | **改为「随项目安装」为推荐路径**：安装器 `install.mjs`（Node 跨平台）把 skill 复制进 `<项目>/.claude/skills/`，并在**项目级** settings 里把冲突插件设 `false`（覆盖用户级 `true`）→ **只在本项目禁用，全局不动**。默认写 gitignored 的 `.claude/settings.local.json`（仅影响本机），`--shared` 写 committed 的 `.claude/settings.json`（全仓共享）。冲突插件：`superpowers` / `everything-claude-code` / `oh-my-claudecode` / `general-task`（后者可 `--keep` 保留）。依据：Claude Code settings 优先级 Managed>Local>Project>User，`enabledPlugins` 全 scope 可设。前提：项目级 settings 首触发 workspace-trust 对话框；改动下次启动生效。**弃用**上一版「全局禁用冲突插件」方案。 |

## 3. 架构：单 skill，内核常驻 + 两个正交维度的分册

```
ai-dev-system/
├── README.md                          # 体系入口：定位、两个维度怎么理解、如何安装 skill
└── skills/
    └── ai-dev-workflow/               # ★ 唯一的 skill（Claude Code + Codex 通用）
        ├── SKILL.md                   # 入口：探测能力位 → 读协作面 → 加载；首次运行 → 初始化
        ├── references/
        │   ├── core/                  # 共享内核（tech-agnostic），无条件常驻
        │   │   ├── 00-流程总纲.md       # Triage 4 问 + 10 步 + 四道门，每步配 prompt
        │   │   ├── spec写作纪律.md       # 零上下文可动手 / RFC2119 / 无占位符
        │   │   └── AI-LLM-overlay.md     # AI 契约：prompt 版本化/输出校验/成本/eval 门
        │   ├── collab/                # 协作面（读标记块字段，必加载一份）
        │   │   ├── solo.md               # 无其他人类协作方：可跳步 / 你自己拍板 / 子代理当第二双眼睛
        │   │   └── team.md               # 有其他人类协作方：owner 对齐 / 评审会 / 业务方拍板 / PR 平台动作
        │   ├── capability/            # 能力位（运行时探测，可零篇、可多篇）
        │   │   ├── graph.md              # 图谱位：探测到 .codegraph/codegraph.db 时，结构检索走图谱
        │   │   ├── curated.md            # 权威位：探测到已填写的 capability-registry.md 时，ctx + cite 取权威口径
        │   │   └── context-engineering.md  # 方案 B 完整设计：card/registry/新鲜度/Probe/棘轮
        │   └── init-初始化.md          # 如何幂等写入 CLAUDE.md / AGENTS.md
        ├── assets/
        │   ├── templates/            # core 模板：lean-spec / overview / eng-spec / coding-plan / test-spec
        │   ├── config-snippets/     # 注入 CLAUDE.md 与 AGENTS.md 的片段（base 无条件 + collab-solo/collab-team 二选一）
        │   └── context-layer/       # 权威位资产：capability-registry 模板 + card 模板 + probe-set 模板
        └── scripts/
            └── ctx/                 # ★ CLI（替代 MCP）：Node.js 跨平台，可运行骨架
                ├── README.md            # 命令说明 + card/registry 格式约定
                ├── package.json         # 零运行时依赖，bin 指向 cli.js
                └── src/                 # discover / get-card / find-scenes / list-services / search-semantic / probe
```

**分层职责**：
- **core**：任何项目、任何技术栈都加载。流程骨架 + 四道门 + 写作纪律 + AI overlay，以及原先散在两个外壳里、其实对谁都成立的约定（六条"不裁剪"护栏、按边界拆 spec、PR 粒度、文档治理与准出结算）。
- **collab/**：只放**因为有没有别人一起干而不同**的事（owner 对齐、评审会、兼容由谁拍板、PR 平台动作）。
- **capability/**：只放**因为项目攒了什么家底而不同**的事（怎么取代码事实、分流默认倾向）。两位正交，任一可单独启用。

## 4. SKILL.md 的路由逻辑

```
调用 ai-dev-workflow：
  1. 【探测】看项目现在有哪些代码事实资产（存在性检查 + 一次小文件读取）：
       - engineering-context/capability-registry.md 有真实数据行 → 权威位
       - .codegraph/codegraph.db 存在                              → 图谱位
       - 都没有 → 直读（无附加能力位），代码事实靠子代理外包重探索
  2. 【读标记块】当前项目 CLAUDE.md（优先）或 AGENTS.md 里的
       <!-- ai-dev-workflow:start --> … collaboration="solo|team" … <!-- ai-dev-workflow:end -->
  2a. 无标记块 → 进入【初始化】：先跑环境冲突扫描，再只问一个问题（协作面）
        + 一条待拍板的 merge-gate 建议，按 init-初始化.md 幂等写入 CLAUDE.md + AGENTS.md。能力位不问。
  2b. 只有旧版留下的 mode 字段 → 只据它推协作面（team → team+pr，其余 → solo+direct），
        一句话告知并回写；MUST NOT 由旧值推出任何能力位。
  3. 【加载】core 常驻 + collab/<协作面>.md（必选一份）+ capability/ 命中的分册（可零篇）
  4. 按 core/00-流程总纲.md 驱动：先过 worktree 隔离门，再 Triage 分流，走对应深度的流程
```

**两步互不推导**：MUST NOT 从协作字段推能力位，也 MUST NOT 从资产推协作面。判据是"探测得出来的不设字段，探测不出来的才设字段"——资产会随项目长大而变，写进配置就会漂移；"有没有别人一起干"文件系统里没有，只能问一次并固化。

**幂等**：初始化用注释包裹标记块（`<!-- ai-dev-workflow:start -->` … `<!-- ai-dev-workflow:end -->`），重复调用只更新块内内容，不重复追加。

## 5. 初始化写入内容

标记块由 `assets/config-snippets/base.md`（无条件）+ `collab-{solo,team}.md`（按协作面二选一）拼装，字段行只在 `base.md`（示意）：

```
<!-- ai-dev-workflow:start -->
> **本项目采用 ai-dev-workflow**
> (mode="team" collaboration="solo" merge-gate="direct" worktree-dir="./.worktrees/")
>
> - 唤起 skill 时按本块字段路由；项目有哪些代码事实资产由 skill 每次运行探测得出，MUST NOT 写死在本块里。
> - 文档目录固定：spec → docs/spec/，plan → docs/plan/，report → docs/report/。
> - 任何文档或代码落盘前 MUST 先建立独立 worktree；编码完成后 MUST 过代码评审门；AI MUST NOT 默认向后兼容。
> - 本项目若存在已填写的 engineering-context/capability-registry.md，查权威实现 MUST 先用 `ctx`、每条事实附 cite，MUST NOT grep 旧代码。
> - （协作面片段追加：solo → 兼容由你拍板、不等人；team → owner 对齐、业务方拍板、PR 动作）
<!-- ai-dev-workflow:end -->
```

`mode="team"` 是**墓碑字段**：新 skill 完全忽略，留着只为让尚未升级的旧 skill 不硬失败，`3.0.0` 移除。

## 6. Engineering Context 层（方案 B，即权威位）

落地为项目内 `engineering-context/` 目录 + `ctx` CLI。

| 组件 | 交付程度 | 说明 |
|---|---|---|
| `capability-registry.md` | **模板 + 指南** | 产品能力 → 权威仓库/接口/owner/freshness（人工确认）|
| `cards/<repo>.md` | **模板 + 生成指南** | 每仓一张 Codebase Card；事实以代码 diff 为准，PRD 仅作 scope |
| `ctx` CLI | **可运行骨架** | discover / get-card / find-scenes / list-services，读本地 markdown card |
| embedding 语义检索 | **文档设计** | `ctx search-semantic` 预留接口，骨架先不接 embedding |
| Frozen Probe Set | **模板 + 文档** | 40–50 题冻结题集 + 门禁自检（plant 已知坏样本）的设计与种子题模板 |
| 新鲜度触发 / 棘轮 | **文档** | 按"权威面"而非变更大小触发；棘轮清单只许变短 |

**真相方向铁律**（写进 context-engineering.md）：card 的事实以合入后源码为准，PRD/Spec 仅作扫描范围约束 + 业务语境；禁止从 PRD 生成 card 事实。

### 6.1 演进路线（从骨架到完整）

> 2026-07-18 自 skill 的 `references/capability/context-engineering.md`（当时在 `references/company/`）§8 迁入（规划叙事不属于 runtime 文档）；skill 内保留 §7「本轮交付程度」表告知哪些能力当前可用。

1. **现在**：`ctx init` 建目录 → 团队填 capability-registry + 高频仓 card → 开发时用 `ctx discover`；`ctx search-semantic` 做兜底；`ctx probe`（含门禁自检 + 棘轮 + 衰减报告）已可跑。发布后手动刷卡。
2. **下一步**：把 40~50 题 Probe Set 填实，`ctx probe --json` 接进 CI 发布门禁；card 生成脚本化（code diff 为真相）。
3. **成熟后**：按权威面自动触发重扫（绑发布周期，hotfix 人工研判）；`search-semantic` 换 embedding 后端（保持"结果带 freshness + 权威标记"契约）。

## 7. ctx CLI 设计（Node.js 跨平台）

**命令**（骨架实现读本地 `engineering-context/cards/*.md` 与 `capability-registry.md`）：

| 命令 | 作用 | 骨架是否实现 |
|---|---|---|
| `ctx discover "<意图>"` | 意图 → 应加载的 card/scene 清单 + out-of-scope 警告 | ✅ 关键词匹配版 |
| `ctx get-card <repo> [domain]` | 取某仓 card（可定位段落）| ✅ |
| `ctx find-scenes <keywords>` | 端到端业务场景蓝图 | ✅ 若有 scenes/ |
| `ctx list-services` | 列出已登记仓库/能力 | ✅ |
| `ctx search-semantic "<query>"` | 语义检索 | ⏳ 预留，文档给设计 |
| `ctx probe` | 跑 Frozen Probe Set + 门禁自检 | ⏳ 预留，文档给设计 |

**跨平台要求**：用 `path` 处理路径分隔符，不硬编码 `/`；不依赖 `bash`-only 语法；`package.json` 零运行时依赖（仅 Node 标准库）；`bin` 用 `#!/usr/bin/env node` 且 `package.json` 声明 bin，Windows 下经 npm 生成 `.cmd` shim；输出 UTF-8。每条事实输出附 `cite`（path + anchor + 最近确认时间）。

## 8. 范围（本轮生成什么）

**本轮产出**：
- 完整 `README.md` + `SKILL.md`
- `references/` 全部 markdown（当时的分层：core 3 篇 + personal 1 篇 + company 2 篇 + init 1 篇；2.0.0 起改为 core / collab / capability，见 §3）
- `assets/` 全部模板（templates 5 份 + config-snippets 2 份 + context-layer 3 份）
- `scripts/ctx/` 可运行骨架（package.json + cli.js + 各命令读本地 card，含一份最小样例 card 供自测）

**本轮不产出（写进文档留待后续）**：
- embedding 语义检索的实际实现
- Probe Set 门禁的自动化 CI 接入
- 真实业务的 capability-registry / cards 内容（这是团队自己按指南填的）

## 9. 非目标

- 不复刻 origin 的专有基建排障手册（贴其具体基建，非通用内容）。
- 不实现完整 MCP server。
- 不替团队填写真实 card / registry 内容。
- 不引入需要 `npm install` 第三方依赖的重实现（骨架零依赖）。
- **不随包分发完整的 Agent 平台重型骨架**（Agent 能力扩展/平台核心类 eng-spec 指南全量、平台基线清单）：高度贴具体平台，超出"技术栈无关内核"定位。只在 `AI-LLM-overlay.md` 给平台无关的最小 agent 契约（判定边界 + 自主级别/审批闸门 + 继承声明 + 缺口清单）；平台核心改造参照使用方团队自有的重型规范。（2026-07-14 补记，对齐审计后确认为有意裁剪）
- **不随包分发 Agentic / Agent 能力扩展产品 PRD 的整套模板**：`ai-prd` 分流表只声明边界，指引使用方参照其团队自有的 Agentic 产品 PRD 规范。
- **不实现 MCP 的 `list_changes`/`get_readme`/`find_skills`/`info`**：MCP→ctx 有意改形态（D3/D8）。跨会话变更感知改用 `git diff engineering-context/`（`references/capability/curated.md` §7 新鲜度纪律）。

> **源头仍在演进**：本体系裁剪自持续更新的上游，回灌基线与机制见 `docs/spec/2026-07-14-源头对齐基线与回灌机制.md`。

## 10. 开放问题（已定案）

- O1（已定，后经 D10 修订）：**先在当前目录 `ai-dev-system/skills/ai-dev-workflow/` 构建**；~~最终以全局安装为主用法~~ → 改为**以「随项目安装」（`install.mjs`）为推荐路径**，同时项目级禁用冲突插件（见 D10）；全局安装保留为可选方式。README 说明两种方式。
- O2（已定）：**需要 `ctx init` 子命令**，一行生成 `engineering-context/` 目录骨架（registry/card/probe 模板），降低团队上手摩擦。
