---
name: ai-prd
description: "AI 协助产出 PRD。当用户要写/生成 PRD、把需求或想法整理成产品需求文档、做需求立项、把脑子里的功能变更落成可评审的 PRD，或提到'帮我写个 PRD / 生成需求文档 / 把这个需求写成 PRD / 需求文档怎么写'时使用。采用批量提问（非一问一答）分批澄清目标/非目标/现状/边界/验收，按变更PRD·轻量Issue·整品PRD 三类模板成稿。产物可直接作为 ai-dev-workflow Step 1 的输入。"
---

# ai-prd

把脑子里的需求 / 一段零散描述 / 一个 Issue，**批量澄清后**降解成一份结构完备、非目标够硬、验收可判定的 PRD。北极星形状是 brownfield 变更/功能 PRD（见 `assets/templates/change-prd.md`）。

本 skill 补 `ai-dev-workflow` 的前置空缺：workflow 从"已有 PRD"起步，本 skill 负责**产出那份 PRD**。

## 目录结构（本 skill 自身）

```
references/
  00-prd生成流程.md      核心：分流 + 4 批提问（A 立项 / B 现状边界 / C 细节 / D 准出）+ 组稿
  prd写作纪律.md         非目标要硬 / 边界要显式 / 验收可判定 / 真相方向 / 无占位符
  业务语言纪律.md        对话、提问和 PRD 成稿只用业务语言
  prd质量清单.md         成稿前自检 gate（对照骨架查完备）
  mode-personal.md      个人薄外壳（可裁到最短）
  mode-team.md          团队外壳（现状接 ctx、评审、doc 治理落位）
assets/
  templates/            change-prd（主）/ lite-issue-prd / product-prd
  question-bank.md      分章节提问库，供组批
```

## 路由逻辑（每次调用先做这个）

```
1. 读当前项目根 CLAUDE.md（优先）或 AGENTS.md 的标记块：
   <!-- ai-dev-workflow:start --> … mode="personal|team" … <!-- ai-dev-workflow:end -->
   - 有 → 读出 mode。
   - 无 → 本会话临时问一次 mode（个人版/团队版），但【不写文件】
     （初始化写入是 ai-dev-workflow 的职责，本 skill 不抢）。

2. 加载 references/00-prd生成流程.md + prd写作纪律.md + 业务语言纪律.md，再按 mode 加载对应外壳：
   - personal → references/mode-personal.md
   - team     → references/mode-team.md

3. 分流选模板（尽量从已有材料判定，不打扰用户）：
   - 小改动 / 单点 Issue → assets/templates/lite-issue-prd.md
   - brownfield 变更 / 新功能 → assets/templates/change-prd.md（默认）
   - 整品 / 从 0 定义产品 → assets/templates/product-prd.md（对齐 doc-governance）

4. 按 00-prd生成流程.md 的【4 批提问】驱动：一次抛一批，用户答完起草该批章节；
   只有对回复有疑问或有缺口时才再批量追问，否则直接进下一批。

5. 组稿：按模板拼装 → 跑 prd质量清单.md → 写入 docs/spec/ →
   团队版更新 docs/index.md → 提示可接 ai-dev-workflow 做 Overview/Spec。
```

## 关键纪律（每次都遵守）

- **批量提问，不一问一答**：每批一次抛全，减少轮次。判据见 `references/00-prd生成流程.md`。
- **非目标必须硬**：没有非目标的 PRD 不准成稿。
- **边界必须显式**：brownfield 场景必须写"不改的线上逻辑"。
- **验收可判定**：禁止"提升体验"这类不可勾验表述，用 RFC2119。
- **真相方向（团队版）**：现状以代码为准，用 `ctx discover`/`get-card` 取事实并附 cite；**不得把意图/愿景写成现状**（呼应 ai-dev-workflow 的 context-engineering §3）。
- **无占位符成稿**：交付前 `【】` 必须清零。
- **全程只用业务语言**：对话、问题和 PRD 成稿不得要求用户理解程序实现；技术事实必须先翻译成业务事实。遵循 `references/业务语言纪律.md`。

## 何时用哪个模板

见 `references/00-prd生成流程.md` 的分流表；模板都在 `assets/templates/` 下。
