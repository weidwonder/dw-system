---
name: ai-prd
description: "AI 协助产出 PRD。当用户要写/生成 PRD、把需求或想法整理成产品需求文档、做需求立项、把脑子里的功能变更落成可评审的 PRD，或提到'帮我写个 PRD / 生成需求文档 / 把这个需求写成 PRD / 需求文档怎么写'时使用。已有 PRD、要做技术设计/Overview/spec/写代码时不要用本 skill，用 ai-dev-workflow。采用批量提问（非一问一答）分批澄清目标/非目标/现状/边界/验收，按变更PRD·轻量Issue·整品PRD 三类模板成稿；涉及用户可见 UI 新增/调整时，必须参考现有 UI 样式并产出独立 HTML 高保真交互原型。产物可直接作为 ai-dev-workflow Step 1 的输入。"
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
  UI原型纪律.md          UI 变更时参考现有样式并产出独立 HTML 高保真交互原型
  prd质量清单.md         成稿前自检 gate（对照骨架查完备）
  mode-personal.md      个人薄外壳（可裁到最短）
  mode-team.md          团队外壳（现状接 ctx、评审、doc 治理落位）
assets/
  templates/            change-prd（主）/ lite-issue-prd / product-prd / ui-prototype.html
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
   （是否加载 UI 原型纪律见第 3 步的 UI 判定，不在此处决定。）

3. 分流选模板（尽量从已有材料判定，不打扰用户）：
   - 小改动 / 单点 Issue → assets/templates/lite-issue-prd.md
   - brownfield 变更 / 新功能 → assets/templates/change-prd.md（默认）
   - 整品 / 从 0 定义产品 → assets/templates/product-prd.md（整品 PRD 作为唯一真相源落 `docs/` 根，见组稿）
   - UI 判定（就在此处初判，批 A/B 的回复到手后复判）：需求会新增/调整用户可见页面、组件、
     入口、状态、信息层级或交互路径 → 立即加载 references/UI原型纪律.md，并把"现有界面样式依据"
     并入批 B 一起问（不要拖到组稿才补做原型）。初判拿不准时默认按"涉及 UI"处理，
     等批 A 回复后再否定；不改结构与交互的纯文案改动豁免。

4. 按 00-prd生成流程.md 的【4 批提问】驱动：一次抛一批，用户答完起草该批章节；
   组批时读 assets/question-bank.md 取各批问法；
   只有对回复有疑问或有缺口时才再批量追问，否则直接进下一批。
   每批先过【提问三纪律】（事实自己查只问决策 / 每问附推荐答案 / 依赖分层同层批量）；
   需求高度模糊时先走【盘问模式】收敛方向，再回批量流程。

5. 组稿：按模板拼装；涉及 UI 时先/同步产出独立 HTML 高保真交互原型 → 跑 prd质量清单.md → 写入 docs/spec/ →
   团队版更新 docs/index.md（PRD 与原型都要进索引；索引只放现行口径，归档进 docs/index-archive.md）→
   提示可接 ai-dev-workflow 做 Overview/Spec，并说明 PRD 与 UI 原型一并作为其 Step 1 的输入。
```

## 关键纪律（每次都遵守）

- **批量提问，不一问一答**：每批一次抛全，减少轮次；问题间有依赖时拆层推进（依赖分层，同层批量）。判据见 `references/00-prd生成流程.md` §提问三纪律。
- **事实自己查，只把决策抛给用户**：能从材料/代码（团队版 ctx+cite）查到的事实不许问，先查清写成草稿让用户确认；提问清单里只留需要用户拍板的决策。
- **每问尽量附推荐答案**：有材料/代码依据必附（推荐 + 一句理由，业务语言），依据不足给典型候选，完全无依据的开放题显式说"无推荐"——禁止编造推荐；决策权仍在用户，未回复不算确认。
- **需求高度模糊先盘问后批量**：方向未定时进盘问模式（小批深挖、挑战含糊保证、逼出隐含假设），收敛出一句话结论与非目标后立即回批量流程。见 `references/00-prd生成流程.md` §盘问模式。
- **非目标必须硬**：没有非目标的 PRD 不准成稿。
- **边界必须显式**：brownfield 场景必须写"不改的线上逻辑"。
- **验收可判定**：禁止"提升体验"这类不可勾验表述，用 RFC2119。
- **真相方向（团队版）**：现状以代码为准，用 `ctx discover`/`get-card` 取事实并附 cite；**不得把意图/愿景写成现状**（呼应 ai-dev-workflow 的 context-engineering §3）。
- **无占位符成稿**：交付前 `【】` 必须清零。
- **全程只用业务语言**：对话、问题和 PRD 成稿不得要求用户理解程序实现；技术事实必须先翻译成业务事实。遵循 `references/业务语言纪律.md`。
- **UI 变更必须出 HTML 高保真交互原型**：新增/调整用户可见界面时（纯文案改动豁免），**先自查项目里的设计 token / 组件库 / 同类现有页面**取样式依据，查不到才向用户要材料；产出可离线打开的单文件 HTML（零外链、零 CDN），不得用 Markdown 冒充原型文件，不得把面向 PM 的解释画在用户界面里。原型与 PRD 一并作为 `ai-dev-workflow` 的输入。遵循 `references/UI原型纪律.md`。

## 何时用哪个模板

见 `references/00-prd生成流程.md` 的分流表；模板都在 `assets/templates/` 下。
