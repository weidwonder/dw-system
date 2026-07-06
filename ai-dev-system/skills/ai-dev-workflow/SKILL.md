---
name: ai-dev-workflow
description: "AI 辅助开发主流程。当用户要做需求落地、AI 辅助开发、生成/澄清 PRD、顶层架构 Overview、技术 spec、coding plan、拆任务、测试方案，或提到'开发流程/怎么用 AI 把需求做成代码/需求澄清/技术设计'时使用。首次在某项目调用会初始化 mode（个人版/团队版）并写入 CLAUDE.md 与 AGENTS.md，之后按已记录的 mode 路由。团队版会用 ctx CLI 查 Engineering Context 而非 grep 旧代码。"
---

# ai-dev-workflow

把一个需求，逐层降解成"零上下文的 AI agent 也能可靠执行"的任务。本 skill 是 **mode-aware** 的：同一套内核（core），根据项目是「个人版」还是「团队版」加载不同外壳。

## 目录结构（本 skill 自身）

```
references/
  core/                共享内核（任何 mode 都加载）
    00-流程总纲.md       Triage 分流 + 10 步流程，每步配 prompt 和模板
    spec写作纪律.md      零上下文可动手 / RFC2119 / 无占位符
    AI-LLM-overlay.md    含 AI/LLM 时叠加的 AI 契约清单
  personal/
    mode-personal.md     个人薄外壳：默认一页 spec、可跳步、memory 约定
  company/
    mode-team.md         团队外壳：评审/owner/PR/文档治理/context 层用法
    context-engineering.md  Engineering Context 完整设计（方案 B）
  init-初始化.md         如何幂等写入 CLAUDE.md/AGENTS.md
assets/
  templates/           lean-change-spec / overview / eng-spec / coding-plan / test-spec
  config-snippets/     注入 CLAUDE.md 与 AGENTS.md 的片段（personal / team）
  context-layer/       capability-registry / card / probe-set 模板
scripts/ctx/           ctx CLI（Node.js，跨平台）：查代码事实
```

## 路由逻辑（每次调用先做这个）

```
1. 读当前项目根的 CLAUDE.md（优先）或 AGENTS.md，查找 mode 标记块：
   <!-- ai-dev-workflow:start --> … mode="personal|team" … <!-- ai-dev-workflow:end -->

2a. 若【没有】标记块 → 进入【初始化】（见 references/init-初始化.md）：
     - 询问用户：这个项目用「个人版」还是「团队版」？（只问这一次）
     - 按选择，把 assets/config-snippets/{personal|team}.md 幂等注入
       项目根的 CLAUDE.md 和 AGENTS.md（都要写，兼容 Claude Code + Codex）。
     - 若团队版：提示用 `ctx init` 初始化 engineering-context/ 目录。
     - 然后继续第 3 步。

2b. 若【有】标记块 → 读出 mode，不再询问。

3. 加载 core（全部三篇），再按 mode 加载对应外壳：
     - personal → references/personal/mode-personal.md
     - team     → references/company/mode-team.md（+ 需要时 context-engineering.md）

4. 按 references/core/00-流程总纲.md 驱动：
     - 先做 Triage 分流（4 个判定问题）。
     - 个人版：4 否走一页 Lean Spec 直接实现；大需求才升级。
     - 团队版：按 10 步走；跨仓需求先出 Overview；查代码事实用 `ctx`，事实带 cite。
```

## 关键纪律（提醒每次都遵守）

- **不问第二次 mode**：初始化后 mode 固化在 CLAUDE.md/AGENTS.md，除非用户显式要求切换。
- **团队版禁止 grep 旧代码找权威实体**：先 `ctx discover "<意图>"`，再按结果读 card；每条来自 card 的接口/字段/topic 必须附 cite（path + anchor + 最近确认时间），无 cite 视为幻觉。
- **写文档写到零上下文也能动手**：遵循 references/core/spec写作纪律.md。
- **含 AI/LLM 功能时叠加 overlay**：模型参与功能行为（生成/总结/分类/检索/OCR/ASR/固定 prompt 流程）时，在基础 spec 上叠加 references/core/AI-LLM-overlay.md 的 AI 契约。

## 何时用哪个模板

见 references/core/00-流程总纲.md 的每步"对应模板"列，模板都在 assets/templates/ 下。
