---
name: ai-prd
description: "AI 协助产出 PRD。当用户要写/生成 PRD、把需求或想法整理成产品需求文档、做需求立项、把脑子里的功能变更落成可评审的 PRD，或提到'帮我写个 PRD / 生成需求文档 / 把这个需求写成 PRD / 需求文档怎么写 / 梳理需求 / 把需求写清楚'，或用英文说 write a PRD、draft a PRD、product requirements document、requirements doc 时使用。已有 PRD、要做技术设计/Overview/spec/写代码时不要用本 skill，用 ai-dev-workflow。采用批量提问（非一问一答）分批澄清目标/非目标/现状/边界/验收，按变更PRD·轻量Issue·整品PRD 三类模板成稿；涉及用户可见 UI 新增/调整时，必须参考现有 UI 样式并产出独立 HTML 高保真交互原型。产物可直接作为 ai-dev-workflow Step 1 的输入。"
---

# ai-prd

把脑子里的需求 / 一段零散描述 / 一个 Issue，**批量澄清后**降解成一份结构完备、非目标够硬、验收可判定的 PRD。北极星形状是 brownfield 变更/功能 PRD（见 `assets/templates/change-prd.md`）。

本 skill 补 `ai-dev-workflow` 的前置空缺：workflow 从"已有 PRD"起步，本 skill 负责**产出那份 PRD**。

**本 skill 不做**：技术方案与实现设计、Overview / 技术 spec、写代码，也不替用户拍板业务口径（只给推荐，决策权在用户）。这些是 `ai-dev-workflow` 与用户各自的职责。

## 目录结构（本 skill 自身）

```
references/
  00-prd生成流程.md      核心：分流 + 4 批提问（A 立项 / B 现状边界 / C 细节 / D 准出）+ 组稿
  prd写作纪律.md         非目标要硬 / 边界要显式 / 验收可判定 / 真相方向 / 无占位符
  业务语言纪律.md        对话、提问和 PRD 成稿只用业务语言
  UI原型纪律.md          UI 变更时参考现有样式并产出独立 HTML 高保真交互原型
  prd质量清单.md         成稿前自检 gate（对照骨架查完备）
  collab/               【按 collaboration 字段二选一，必加载一份】
    solo.md             无其他人类协作方：你自己拍板，无评审会，开放问题成稿前自己逐条闭环
    team.md             有其他人类协作方：业务方拍业务口径与非目标，评审结论回写 PRD
assets/
  templates/            change-prd（主）/ lite-issue-prd / product-prd / ui-prototype.html
  question-bank.md      分章节提问库，供组批
```

## 路由逻辑（每次调用先做这个）

```
1. 读当前项目根 CLAUDE.md（优先）或 AGENTS.md 的标记块，只取【协作面】：
   <!-- ai-dev-workflow:start --> … collaboration="solo|team" … <!-- ai-dev-workflow:end -->
   - 块内有 collaboration → 按它取协作面。
   - 块里只有旧版安装留下的 mode 字段 → 按【与姊妹 skill 完全相同的只读推断】取协作面：
     旧值为 team → 按 collaboration="team"；其余旧值 → 按 "solo"。
     MUST NOT 自行另立一套推断（例如"旧字段一律当 solo"）——同一个项目会被两个 skill
     判成不同协作面：ai-prd 按 solo 出 PRD（自己拍板、无评审会），ai-dev-workflow 按 team
     跑流程（要业务方拍口径），而这正是每个存量 1.x 团队项目升级后必经的状态。
     判据与姊妹 skill 的 `SKILL.md` 步骤 2b 同源，冲突时以姊妹 skill 为准。
   - 没有标记块 → 按 collaboration="solo" 走。
   - 以上两种情况都【不问用户、不写文件、不提示迁移】——写配置与旧值迁移是
     ai-dev-workflow 的职责，本 skill 不抢（它不写文件，保证不了"只提示一次"）。
     **只读推断不需要写任何文件**，所以"不写配置"MUST NOT 被读成"不能推断"。

2. 加载 references/00-prd生成流程.md + prd写作纪律.md + 业务语言纪律.md，
   再按协作面加载一份分册（必加载一份）：
   - solo → references/collab/solo.md
   - team → references/collab/team.md
   现状事实**从哪取不看协作面，只看项目自己有没有已登记的权威能力清单**：
   `engineering-context/capability-registry.md` 存在**且**除模板注释与表头外至少有一行不含 `【】`
   占位的真实数据行 → 走 ctx 路径（ctx + cite）；否则直接走读代码核实路径（读代码核实 + 现状节标注）。
   **MUST NOT 用"`ctx` 命令跑不跑得通"或"有没有 `engineering-context/` 目录"当判据**——安装器
   把 ctx 链接成全局命令，任何装过本体系的项目都跑得通；`ctx init` 生成的 registry 只有占位行。
   即使走了 ctx 路径，discover/find-scenes 对本次意图零命中时 MUST 就地降级到读代码核实路径。
   （判据、降级与标注原文的**完整定义只在** `00-prd生成流程.md` §批 B → 现状怎么取证，此处是摘要；
   纪律见 `prd写作纪律.md` §4。）
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
   每批有明确的**退出条件**（写在 00-prd生成流程.md 各批小节末尾），逐项勾验全过才进下一批；
   任一不过 → 只就不过的那几点再批量追问一次，否则直接进下一批。
   判定"还有没有缺口"的权威判据是 assets/question-bank.md §追问触发，四批共用，MUST NOT 自行另立标准。
   每批先过【提问三纪律】（事实自己查只问决策 / 每问附推荐答案 / 依赖分层同层批量）；
   需求高度模糊时先走【盘问模式】收敛方向，再回批量流程。

5. 组稿：按模板拼装；涉及 UI 时先/同步产出独立 HTML 高保真交互原型 → 跑 prd质量清单.md →
   【落盘确认门 · MUST】把关键取舍、非目标、验收口径（涉及 UI 时另加原型覆盖范围与样式依据）
   回述给用户，达成共识后才写文件；未确认 MUST NOT 落盘
   （见 `00-prd生成流程.md` §组稿 第 4 条）→
   写入 docs/spec/ →
   项目已有 docs/index.md 时更新它（PRD 与原型都要进索引；索引只放现行口径，归档进 docs/index-archive.md；
   项目没有索引就不为此临时造一个）→
   提示可接 ai-dev-workflow 做 Overview/Spec，并说明 PRD 与 UI 原型一并作为其 Step 1 的输入。
```

## 关键纪律（每次都遵守）

- **只读项目配置，MUST NOT 写配置**：本 skill 读 `CLAUDE.md` / `AGENTS.md` 标记块只为取协作面，**MUST NOT 写入或修改标记块、MUST NOT 向用户提问"这个项目怎么配"、MUST NOT 提示配置迁移**。写配置与旧标记块迁移都是 `ai-dev-workflow` 的职责——它写文件，能保证"只提示一次"；本 skill 不写文件，抢过来做就会每次唤起都提示一遍。读到没有标记块或只有旧字段时，按路由第 1 步**只读推断**协作面（旧 `mode="team"` → team，其余 → solo），静默继续——推断不落盘，因此不违反本条。
- **批量提问，不一问一答**：每批一次抛全，减少轮次；问题间有依赖时拆层推进（依赖分层，同层批量）。判据见 `references/00-prd生成流程.md` §提问三纪律。
- **事实自己查，只把决策抛给用户**：能从材料/代码（按 `00-prd生成流程.md` §批 B 判据走 ctx 路径或读代码核实路径）查到的事实不许问，先查清写成草稿让用户确认；提问清单里只留需要用户拍板的决策。
- **每问尽量附推荐答案**：有材料/代码依据必附（推荐 + 一句理由，业务语言），依据不足给典型候选，完全无依据的开放题显式说"无推荐"——禁止编造推荐；决策权仍在用户，未回复不算确认。
- **需求高度模糊先盘问后批量**：方向未定时进盘问模式（小批深挖、挑战含糊保证、逼出隐含假设），收敛出一句话结论与非目标后立即回批量流程。见 `references/00-prd生成流程.md` §盘问模式。
- **非目标必须硬**：没有非目标的 PRD 不准成稿。
- **边界必须显式**：brownfield 场景必须写"不改的线上逻辑"。
- **验收可判定**：禁止"提升体验"这类不可勾验表述，用 RFC2119。
- **真相方向**：现状以代码为准——走 ctx 路径时用 `ctx discover`/`get-card` 取事实并附 cite，走读代码核实路径（判据不成立或 ctx 零命中降级）时读代码核实并在现状节照抄规定的标注原文；**无 card 依据的 cite 视为幻觉，MUST NOT 编造**；**不得把意图/愿景写成现状**（呼应 ai-dev-workflow 的 `references/capability/context-engineering.md` §3）。
- **无占位符成稿**：交付前 `【】` 必须清零。
- **落盘确认门**：跑完 `prd质量清单.md` 后 MUST 先把关键取舍、非目标、验收口径（涉及 UI 时另加原型覆盖范围与样式依据）回述给用户，达成共识才写文件；**未确认 MUST NOT 落盘**。"怎样算确认了"与用户不回复时的处置，判据只在 `references/00-prd生成流程.md` §组稿 第 4 条定义。
- **全程只用业务语言**：对话、问题和 PRD 成稿不得要求用户理解程序实现；技术事实必须先翻译成业务事实。遵循 `references/业务语言纪律.md`。
- **UI 变更必须出 HTML 高保真交互原型**：新增/调整用户可见界面时（纯文案改动豁免），**先自查项目里的设计 token / 组件库 / 同类现有页面**取样式依据，查不到才向用户要材料；产出可离线打开的单文件 HTML（零外链、零 CDN），不得用 Markdown 冒充原型文件，不得把面向 PM 的解释画在用户界面里。原型与 PRD 一并作为 `ai-dev-workflow` 的输入。遵循 `references/UI原型纪律.md`。

## 何时用哪个模板

见 `references/00-prd生成流程.md` 的分流表；模板都在 `assets/templates/` 下。
