---
name: ai-dev-workflow
description: "AI 辅助开发主流程。当用户要做需求落地、AI 辅助开发、澄清已有 PRD、顶层架构 Overview、技术 spec、coding plan、拆任务、测试方案，或提到'开发流程/怎么用 AI 把需求做成代码/技术设计'时使用。从零产出一份新 PRD 时不要用本 skill，用 ai-prd（本 skill 从已有 PRD 起步，其产物即本 skill Step 1 的输入）。首次在某项目调用会初始化 mode（个人版/团队版）并写入 CLAUDE.md 与 AGENTS.md，之后按已记录的 mode 路由。用户要求扫描/体检项目的 ai-dev 体系、检查项目里的 rules/skills/agents 是否与本流程冲突时也使用。团队版会用 ctx CLI 查 Engineering Context 而非 grep 旧代码。"
---

# ai-dev-workflow

把一个需求，逐层降解成"零上下文的 AI agent 也能可靠执行"的任务。本 skill 是 **mode-aware** 的：同一套内核（core），根据项目是「个人版」还是「团队版」加载不同外壳。

> **触发提示**：自动触发不总是稳定。若发现某一步没走本流程，直接在 prompt 里**点名 skill / 步骤**（如"用 ai-dev-workflow 的 Step 2 出 Overview""按 eng-spec 模板写"），比依赖关键词更可靠。

## 目录结构（本 skill 自身）

```
references/
  core/                共享内核（任何 mode 都加载）
    00-流程总纲.md       Triage 分流 + 10 步流程，每步配 prompt 和模板
    worktree开发纪律.md  独立 worktree 全程开发 + 完成后自动合并主分支
    spec写作纪律.md      零上下文可动手 / RFC2119 / 无占位符
    AI-LLM-overlay.md    含 AI/LLM 时叠加的 AI 契约清单
    文档治理.md          spec / plan / report 的唯一输出目录与命名
    用户沟通纪律.md      业务语言 + 大架构确认 + 详细设计自主决策
    bug诊断纪律.md       红回路优先：先造能变红的复现命令，再谈假设
    上下文卫生.md        聪明区决策 / 交接不硬撑 / 编码任务零上下文起步
  personal/
    mode-personal.md     个人薄外壳：默认一页 spec、可跳步、memory 约定
  company/
    mode-team.md         团队外壳：评审/owner/PR/文档治理/context 层用法
    context-engineering.md  Engineering Context 完整设计
  init-初始化.md         如何幂等写入 CLAUDE.md/AGENTS.md
  环境冲突扫描.md        初始化/体系扫描时检查项目自带 rules/skills/agents 的工作方式冲突
assets/
  templates/           lean-change-spec / overview / eng-spec / coding-plan / test-spec
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

3. 加载 core 常驻六篇（00-流程总纲 / worktree开发纪律 / spec写作纪律 /
   文档治理 / 用户沟通纪律 / 上下文卫生），再按 mode 加载对应外壳：
     - personal → references/personal/mode-personal.md
     - team     → references/company/mode-team.md（+ 需要时 context-engineering.md）
   另两篇 core 按条件加载：
     - AI-LLM-overlay.md：仅当需求含 AI/LLM 功能、Step 4 需叠加 AI 契约时读。
     - bug诊断纪律.md：仅当任务是修 bug / 查回归 / 解释异常行为时读。

4. 按 references/core/00-流程总纲.md 驱动：
     - 路由完成后先过 worktree 工作区隔离门，再做 Triage 分流（4 个判定问题）。
     - 个人版：4 否走一页 Lean Spec 直接实现；大需求才升级。
     - 团队版：按 10 步走；跨仓需求先出 Overview；查代码事实用 `ctx`，事实带 cite。
```

## 关键纪律（提醒每次都遵守）

- **不问第二次 mode**：初始化后 mode 固化在 CLAUDE.md/AGENTS.md，除非用户显式要求切换。
- **团队版禁止 grep 旧代码找权威实体**：先 `ctx discover "<意图>"`，再按结果读 card；每条来自 card 的接口/字段/topic 必须附 cite（path + anchor + 最近确认时间），无 cite 视为幻觉。
- **写文档写到零上下文也能动手**：遵循 references/core/spec写作纪律.md。
- **含 AI/LLM 功能时叠加 overlay**：模型参与功能行为（生成/总结/分类/检索/OCR/ASR/固定 prompt 流程）时，在基础 spec 上叠加 references/core/AI-LLM-overlay.md 的 AI 契约。
- **文档只写入标准目录**：spec 写 `docs/spec/`，plan 写 `docs/plan/`，report 写 `docs/report/`；不得写项目根或工具命名目录。遵循 `references/core/文档治理.md`。
- **用户沟通只用业务语言**：大架构必须由用户确认；模块内设计只通过业务问题取约束；详细程序设计由 AI 自主完成，无需用户确认。遵循 `references/core/用户沟通纪律.md`。
- **bug 类任务先过红回路门**：修 bug / 查回归 / 解释异常行为前，先查 `docs/report/bug修复历史.md` 有无重复问题，再构造"能变红、确定性、快、可自跑"的复现命令；回路不存在不许提假设、不许改代码；修复后按固定格式归档进该历史文件并记修复版本。遵循 `references/core/bug诊断纪律.md`。
- **上下文卫生**：方向性决策（澄清/Overview/spec/plan）在聪明区内完成；逼近上限写交接文档开新会话，不硬撑；编码任务零上下文起步，重探索交子 agent。遵循 `references/core/上下文卫生.md`。
- **开发全程隔离并自动归并**：任何文档或代码落盘前进入独立 worktree，Lean 与完整流程都不得绕过；全程使用独立 worktree，全部完成并通过门禁后自动合并主分支，无需再次询问。失败时保留现场，不得绕过保护分支或处理用户未提交改动。遵循 `references/core/worktree开发纪律.md`。
- **worktree 目录位置从 CLAUDE.md/AGENTS.md 标记块读取**：默认 `./.worktrees/`（初始化时随 mode 片段写入），每次创建前都读该设置，不凭空自定义；用户显式要求改到别处时先更新标记块再创建。

## 何时用哪个模板

见 references/core/00-流程总纲.md 的每步"对应模板"列，模板都在 assets/templates/ 下。
