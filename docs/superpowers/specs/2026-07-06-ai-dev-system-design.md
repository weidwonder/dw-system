---
date: '2026-07-06'
status: 'design-approved-pending-review'
documentRole: 'design-spec'
sourceOfTruth: true
---

# 自有 AI 辅助开发体系 — 设计文档

> 本文档是"把朋友公司（上游公司）的 AI 辅助开发体系，裁剪并落地成我们自己的一套体系"这项工作的设计真相源。实现计划（coding plan）与后续产出物若与本文冲突，以本文为准；范围变更须先改本文。

## 1. 背景与目标

`orgin/` 目录是上游公司的 AI 辅助开发体系。其核心不是那条 10 步流程（可迁移），而是**一层给 AI 供给"可信、新鲜、权威"代码事实的 Engineering Context 语义层 + 防腐机制**——这才是他们"0 手工代码维护复杂项目"的秘密。

本项目把这套体系裁剪成适合我们的形态。**目标**：

1. 产出一个**单一的、mode-aware 的 skill**（`ai-dev-workflow`），同时服务两种场景：个人轻量项目、公司多人多项目。
2. skill 首次在某项目调用时**初始化一次**（问"个人版/团队版"，把结论与配置幂等写入该项目的 `CLAUDE.md` + `AGENTS.md`），之后每次调用直接读 mode，不再询问。
3. 团队版包含一层**轻量 Engineering Context**（方案 B：Codebase Card + capability 登记 + 新鲜度 + Frozen Probe Set），其代码事实访问以 **CLI（`ctx`）**而非 MCP 形态交付。
4. 全套 **Claude Code + Codex 通用**：内核为可移植 markdown，双入口（CLAUDE.md / AGENTS.md）。

## 2. 已确认的关键决策（来自交互澄清）

| # | 决策 | 结论 |
|---|---|---|
| D1 | 技术栈 | Web 全栈 / 后端服务 / AI-LLM / 数据脚本 **全覆盖** → 内核必须技术栈无关，AI/LLM 单独挂 overlay |
| D2 | 团队规模 | 中等团队 5–20 人、10–30 仓 → 需要轻量 context 层，非 origin 完整机器 |
| D3 | 工具链 | Claude Code + Codex 为主 → markdown 双入口，CLI 而非 MCP |
| D4 | 仓库现状 | 历史包袱重、文档差 → 团队版**必须**有 context 层 |
| D5 | context 层深度 | 直接上**方案 B**（含 MCP→改 CLI + Frozen Probe Set 防腐） |
| D6 | 交付形态 | **单个 skill**，core/personal/company 三层结构收进 skill 的 references/ |
| D7 | mode 初始化 | 首次调用写入 CLAUDE.md/AGENTS.md，幂等，之后不再问 |
| D8 | context 访问 | 做成 **CLI（`ctx`）**，不用 MCP；给设计 + 可运行骨架，其余写文档 |
| D9 | CLI 语言 | **Node.js**，必须跨平台（路径/shell/行尾） |

## 3. 架构：单 skill，内含 core / personal / company 三层

```
ai-dev-system/
├── README.md                          # 体系入口：定位、两种 mode 怎么选、如何安装 skill
└── skills/
    └── ai-dev-workflow/               # ★ 唯一的 skill（Claude Code + Codex 通用）
        ├── SKILL.md                   # 入口：读 mode → 路由；首次运行 → 初始化
        ├── references/
        │   ├── core/                  # 共享内核（tech-agnostic）
        │   │   ├── 00-流程总纲.md       # Triage 4 问 + 10 步（可裁剪），每步配 prompt
        │   │   ├── spec写作纪律.md       # 零上下文可动手 / RFC2119 / 无占位符
        │   │   └── AI-LLM-overlay.md     # AI 契约：prompt 版本化/输出校验/成本/eval 门
        │   ├── personal/              # 个人薄外壳
        │   │   └── mode-personal.md      # 默认走一页 spec / 可跳步 / 个人 memory 约定
        │   ├── company/              # 公司中等外壳
        │   │   ├── mode-team.md          # 评审会 / owner / PR / 谁澄清什么 / 文档治理
        │   │   └── context-engineering.md  # 方案 B 完整设计：card/registry/新鲜度/Probe/棘轮
        │   └── init-初始化.md          # 如何幂等写入 CLAUDE.md / AGENTS.md
        ├── assets/
        │   ├── templates/            # core 模板：lean-spec / overview / eng-spec / coding-plan / test-spec
        │   ├── config-snippets/     # 注入 CLAUDE.md 与 AGENTS.md 的片段（personal / team 各一）
        │   └── context-layer/       # company：capability-registry 模板 + card 模板 + probe-set 模板
        └── scripts/
            └── ctx/                 # ★ CLI（替代 MCP）：Node.js 跨平台，可运行骨架
                ├── README.md            # 命令说明 + 未实现部分（embedding/probe 门禁）的设计
                ├── package.json         # 零运行时依赖，bin 指向 cli.js
                └── src/                 # discover / get-card / find-scenes / list-services 读本地 card
```

**三层职责**：
- **core**：任何 mode、任何技术栈都加载。流程骨架 + 写作纪律 + AI overlay。
- **personal**：单人默认。砍掉评审会/多仓协作，默认一页 spec，流程可跳步，强调个人 memory 沉淀。
- **company**：团队协作约定 + Engineering Context 层用法（含 `ctx` CLI）。

## 4. SKILL.md 的路由逻辑

```
调用 ai-dev-workflow：
  1. 读取当前项目 CLAUDE.md（或 AGENTS.md）中是否有 <ai-dev-workflow mode="..."> 标记
  2a. 无标记 → 进入【初始化】：
        - 询问用户：个人版 / 团队版？
        - 按 init-初始化.md 幂等写入 CLAUDE.md + AGENTS.md（mode + 关键指针）
        - 团队版额外提示：初始化 engineering-context/ 目录与 ctx CLI
  2b. 有标记 → 读出 mode，加载 core + 对应外壳（personal 或 company）
  3. 按 core/00-流程总纲.md 驱动：先 Triage 分流，再走对应深度的流程
```

**幂等**：初始化用注释包裹标记块（如 `<!-- ai-dev-workflow:start -->` … `<!-- ai-dev-workflow:end -->`），重复调用只更新块内内容，不重复追加。

## 5. mode 初始化写入内容

**个人版**注入 CLAUDE.md / AGENTS.md（示意）：
```
<!-- ai-dev-workflow:start -->
> 本项目采用 ai-dev-workflow【个人版】。
> 默认走轻量流程：小改动一页 Lean Change Spec 直接实现；大需求才走完整 Overview→Spec→Plan。
> 无需评审会 / 跨仓协作。个人决策沉淀进 memory。
<!-- ai-dev-workflow:end -->
```

**团队版**注入（示意）：
```
<!-- ai-dev-workflow:start -->
> 本项目采用 ai-dev-workflow【团队版】。
> Engineering Context 在 ./engineering-context/；查代码事实用 `ctx` CLI（discover/get-card/find-scenes），不要直接 grep 旧代码。
> 每条来自 card 的事实需附 cite。流程：Triage→Overview→Spec→Coding Plan→测试，跨仓需求先出 Overview。
> 协作约定见 团队协作约定；新鲜度与防腐见 context-engineering。
<!-- ai-dev-workflow:end -->
```

## 6. 团队版 Engineering Context 层（方案 B）

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
- `references/` 全部 markdown（core 3 篇 + personal 1 篇 + company 2 篇 + init 1 篇）
- `assets/` 全部模板（templates 5 份 + config-snippets 2 份 + context-layer 3 份）
- `scripts/ctx/` 可运行骨架（package.json + cli.js + 各命令读本地 card，含一份最小样例 card 供自测）

**本轮不产出（写进文档留待后续）**：
- embedding 语义检索的实际实现
- Probe Set 门禁的自动化 CI 接入
- 真实业务的 capability-registry / cards 内容（这是团队自己按指南填的）

## 9. 非目标

- 不复刻 origin 的 K8s/SLS/Nacos/CodeUp 基建排障手册（那是上游公司专有）。
- 不实现完整 MCP server。
- 不替团队填写真实 card / registry 内容。
- 不引入需要 `npm install` 第三方依赖的重实现（骨架零依赖）。

## 10. 开放问题（已定案）

- O1（已定）：**先在当前目录 `ai-dev-system/skills/ai-dev-workflow/` 构建**；最终以**全局安装一次**（`~/.claude/skills/`）为主用法，项目内只做初始化。README 说明两种安装方式。
- O2（已定）：**需要 `ctx init` 子命令**，一行生成 `engineering-context/` 目录骨架（registry/card/probe 模板），降低团队上手摩擦。
