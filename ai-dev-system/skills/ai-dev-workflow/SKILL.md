---
name: ai-dev-workflow
description: "AI 辅助开发主流程。当用户要做需求落地、AI 辅助开发、澄清已有 PRD、顶层架构 Overview、技术 spec、coding plan、拆任务、测试方案，或提到'开发流程/怎么用 AI 把需求做成代码/技术设计'时使用。编码完成后的代码评审（规范/忠实/残留三轴子代理评审）、清理被取代的旧逻辑、决定是否向后兼容、把真实数据固化成测试用例、补端到端用例或维护测试覆盖度台账时同样使用。从零产出一份新 PRD 时不要用本 skill，用 ai-prd（本 skill 从已有 PRD 起步，其产物即本 skill Step 1 的输入）。首次在某项目调用会初始化 mode（个人版/团队版）并写入 CLAUDE.md 与 AGENTS.md，之后按已记录的 mode 路由。用户要求扫描/体检项目的 ai-dev 体系、检查项目里的 rules/skills/agents 是否与本流程冲突时也使用。团队版会用 ctx CLI 查 Engineering Context 而非 grep 旧代码。"
---

# ai-dev-workflow

把一个需求，逐层降解成"零上下文的 AI agent 也能可靠执行"的任务。本 skill 是 **mode-aware** 的：同一套内核（core），根据项目是「个人版」还是「团队版」加载不同外壳。

> **触发提示**：自动触发不总是稳定。若发现某一步没走本流程，直接在 prompt 里**点名 skill / 步骤**（如"用 ai-dev-workflow 的 Step 2 出 Overview""按 eng-spec 模板写"），比依赖关键词更可靠。

## 目录结构（本 skill 自身）

```
references/
  core/
    00-流程总纲.md       【常驻·骨架】Triage 分流 + 四道门 + 步骤索引
    路径-lean.md         【分流后】Lean 一页走完（Triage 四问全否时读这份）
    步骤-1-7-设计与实现.md 【分流后】完整流程 Step 1–7 细节
    步骤-8-10-测试.md     【阶段切换】完整流程 Step 8–10 细节，过完评审门再读
    worktree开发纪律.md  独立 worktree 全程开发 + 完成后自动合并主分支
    spec写作纪律.md      零上下文可动手 / RFC2119 / 无占位符
    AI-LLM-overlay.md    含 AI/LLM 时叠加的 AI 契约清单
    文档治理.md          spec / plan / report 的唯一输出目录与命名
    用户沟通纪律.md      业务语言 + 大架构确认 + 详细设计自主决策
    bug诊断纪律.md       红回路优先：先造能变红的复现命令，再谈假设
    代码评审纪律.md      编码后强制子代理三轴评审 + 替换清单（旧逻辑登记与核销）
    测试资产纪律.md      长链路端到端 + 真实输入固化 + 覆盖度台账
    上下文卫生.md        聪明区决策 / 交接不硬撑 / 编码任务零上下文起步
  personal/
    mode-personal.md     个人薄外壳：默认一页 spec、可跳步、memory 约定
  company/
    mode-team.md         团队外壳：评审/owner/PR/文档治理/context 层用法
    context-engineering.md  Engineering Context 完整设计
  init-初始化.md         如何幂等写入 CLAUDE.md/AGENTS.md
  环境冲突扫描.md        初始化/体系扫描时检查项目自带 rules/skills/agents 的工作方式冲突
assets/
  templates/           lean-change-spec / overview / eng-spec / coding-plan / test-spec / test-coverage
  config-snippets/     注入 CLAUDE.md 与 AGENTS.md 的片段（personal / team）
  context-layer/       capability-registry / card / scene-blueprint / probe-set / glossary 模板
scripts/ctx/           ctx CLI（Node.js，跨平台）：查代码事实
```

## 路由逻辑（每次调用先做这个）

```
1. 读当前项目根的 CLAUDE.md（优先）或 AGENTS.md，查找 mode 标记块：
   <!-- ai-dev-workflow:start --> … mode="personal|team" … <!-- ai-dev-workflow:end -->

2a. 若【没有】标记块 → 进入【初始化】（见 references/init-初始化.md）：
     - 先按 references/环境冲突扫描.md 扫描项目自带的 .claude/、.agents/ 下
       rules/skills/agents 是否与本体系工作方式冲突（自动完成，不问用户）。
     - 询问用户：这个项目用「个人版」还是「团队版」？（只问这一次）
       若扫出冲突，冲突决断（逐项 移除/修改/保留 + 建议）与 mode 询问同一批抛出。
     - 按选择，把 assets/config-snippets/{personal|team}.md 幂等注入
       项目根的 CLAUDE.md 和 AGENTS.md（都要写，兼容 Claude Code + Codex）。
     - 若团队版：提示用 `ctx init` 初始化 engineering-context/ 目录。
     - 然后继续第 3 步。

2b. 若【有】标记块 → 读出 mode，不再询问；若另一文件缺失或无标记块，幂等补齐同一 mode 块。

2c. 若用户显式要求"扫描/体检项目的 ai-dev 体系" → 单独执行 references/环境冲突扫描.md
    （已有 mode 时不重问 mode），冲突逐项交用户决断后按其选择处置。

3. 【常驻】加载 core 六篇：00-流程总纲 / worktree开发纪律 / spec写作纪律 /
   文档治理 / 用户沟通纪律 / 上下文卫生。再按 mode 加载对应外壳：
     - personal → references/personal/mode-personal.md
     - team     → references/company/mode-team.md（+ 需要时 context-engineering.md）
   【此时不要读流程分册】——分流之后才知道该读哪一份。

4. 按 00-流程总纲.md 驱动：先过 worktree 工作区隔离门，再做 Triage 分流，
   然后【按分流结果】只加载对应分册：
     - 四问全否 → references/core/路径-lean.md（一页走完，不读另两册）
     - 任一为是 → references/core/步骤-1-7-设计与实现.md
                  过完代码评审门后，再加载 references/core/步骤-8-10-测试.md

5. 另四篇 core 按需分阶段读，各读所需小节即可：
     - AI-LLM-overlay.md：需求含 AI/LLM 功能、Step 4 要叠加 AI 契约时。
       其中判定为 **Agentic 应用**（模型自主规划 / 直接调工具 / 未过闸门就改状态 /
       记忆跨会话影响决策）时，MUST 另行加载**独立 skill `agentic-principle`**
       做架构选型与提示词设计——两者内容互不搬运，见该 overlay §Agentic 应用。
     - bug诊断纪律.md：任务是修 bug / 查回归 / 解释异常行为时（动手改代码前）。
     - 代码评审纪律.md：**改产品代码的任务基本都要读，分两次**——写 spec 时读
       §替换清单（登记），编码完成派评审子代理时读 §三轴与 §子代理 prompt 模板。
     - 测试资产纪律.md：进入 Step 8–10、用户提供了真实数据或凭证、bug 修复归档时。
```

## 关键纪律

**底线（任何任务、任何时刻）**——判据都在对应 reference 里，这里只作提醒：

- **不问第二次 mode**：初始化后固化在 CLAUDE.md/AGENTS.md，除非用户显式要求切换。
- **开发全程隔离并自动归并**：任何文档或代码落盘前进入、并**全程使用独立 worktree**（目录从 CLAUDE.md/AGENTS.md 标记块读，默认 `./.worktrees/`）；门禁全过后自动合并主分支，失败保留现场不绕过保护分支。→ `core/worktree开发纪律.md`
- **用户沟通只用业务语言**：大架构由用户确认，模块内设计只问业务问题，详细程序设计自主完成。→ `core/用户沟通纪律.md`
- **文档只写标准目录**：spec→`docs/spec/`、plan→`docs/plan/`、report→`docs/report/`。→ `core/文档治理.md`
- **写到零上下文也能动手**：RFC2119、无占位符、事实带来源。→ `core/spec写作纪律.md`
- **上下文卫生**：方向性决策在聪明区内完成，逼近上限就交接，重探索外包子代理。→ `core/上下文卫生.md`
- **团队版禁止 grep 旧代码找权威实体**：先 `ctx discover`/`find-scenes` 再读 card，事实必须附 cite，无 cite 视为幻觉。→ `company/mode-team.md`

**按阶段触发的门（命中就必须过，Lean 也不豁免）**：

| 何时 | 必须做什么 | 判据 |
|---|---|---|
| 改代码前（bug 类）| 先查修复历史，再造"能变红、确定性、快、可自跑"的复现命令；无回路不许提假设、不许改代码 | `core/bug诊断纪律.md` |
| 写 spec 时（含 AI/LLM）| 在基础 spec 上叠加 AI 契约 | `core/AI-LLM-overlay.md` |
| 需求是 **Agentic 应用** | **MUST 加载独立 skill `agentic-principle`**：spec 设计、开发参考、评审增派 agent 架构轴。它的内容不并入本 skill，缺失时告知用户并把架构选型标"待补" | `core/AI-LLM-overlay.md` §Agentic 应用 |
| spec 定稿前 | **兼容取舍交用户逐条拍板**，AI 不得默认兼容；无变更也要显式声明 | 总纲 §兼容取舍确认门 |
| 写 spec + 编码时 | 登记**替换清单**，被取代的旧逻辑当场删，保留项须带理由与到期日 | `core/代码评审纪律.md` §替换清单 |
| 编码完成后 | **派子代理跑三轴评审**（完整 3 个 / Lean 1 个），P0/P1 修完才过门 | `core/代码评审纪律.md` |
| 测试阶段 | 长链路必须端到端且断言中间产物；真实输入固化复用；未覆盖场景挂账 | `core/测试资产纪律.md` |

## 何时用哪个模板

见 `references/core/00-流程总纲.md` §完整流程步骤索引 的"对应模板"列，模板都在 `assets/templates/` 下。
