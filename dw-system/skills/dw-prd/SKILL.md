---
name: dw-prd
description: "AI 协助产出 PRD。当用户要写/生成 PRD、把需求或想法整理成产品需求文档、做需求立项、把脑子里的功能变更落成可评审的 PRD，或提到'帮我写个 PRD / 生成需求文档 / 把这个需求写成 PRD / 需求文档怎么写 / 梳理需求 / 把需求写清楚'，或用英文说 write a PRD、draft a PRD、product requirements document、requirements doc 时使用。已有 PRD 且要做技术设计 / Overview / spec / 写代码时不要用本 skill，用 dw-workflow（改 PRD 本身仍用本 skill）。采用批量提问（非一问一答）分批澄清目标/非目标/现状/边界/验收，按变更PRD·轻量Issue·整品PRD 三类模板成稿；涉及用户可见 UI 新增/调整时，必须参考现有 UI 样式并产出独立 HTML 高保真交互原型。产物可直接作为 dw-workflow Step 1 的输入。"
---

# dw-prd

把脑子里的需求 / 一段零散描述 / 一个 Issue，**批量澄清后**降解成一份结构完备、非目标够硬、验收可判定的 PRD。北极星形状是 brownfield 变更/功能 PRD（见 `assets/templates/change-prd.md`）。

本 skill 补 `dw-workflow` 的前置空缺：workflow 从"已有 PRD"起步，本 skill 负责**产出那份 PRD**。

**本 skill 不做**：技术方案与实现设计、Overview / 技术 spec、写代码，也不替用户拍板业务口径（只给推荐，决策权在用户）。这些是 `dw-workflow` 与用户各自的职责。按 RFC 2119 解释规范词。

## 目录结构（本 skill 自身）

```
references/
  00-prd生成流程.md      核心：分流 + 4 批提问（A 立项 / B 现状边界 / C 细节 / D 准出）+ 组稿
  prd写作纪律.md         非目标要硬 / 边界要显式 / 验收可判定 / 真相方向 / 无占位符
  业务语言纪律.md        对话、提问和 PRD 成稿只用业务语言
  UI原型纪律.md          UI 变更时参考现有样式并产出独立 HTML 高保真交互原型
  prd质量清单.md         成稿前自检 gate（对照骨架查完备）
  prd复核纪律.md         用户定稿后、落盘前的强制门：双轴子代理复核（自洽轴 / 冲突轴）
  collab/               【按 collaboration 字段二选一，必加载一份】
    solo.md             无其他人类协作方：你自己拍板，无评审会，开放问题成稿前自己逐条闭环
    team.md             有其他人类协作方：业务方拍业务口径与非目标，评审结论回写 PRD
assets/
  templates/            change-prd（主）/ lite-issue-prd / product-prd / requirements-module / todo / ui-prototype.html
                        ui-prototype-framework/（七份框架源文件，装配成容器的六个固定实现区；
                        structure.css 恒装配，components.css 只在 init --with-baseline 时追加）
  question-bank.md      分章节提问库，供组批
scripts/
  preview.mjs           原型工具：init/screen/slot 建原型、extract 取界面、check 自检、annotations 取批注、reply 回批注、
                        serve 起预览服务（页面批注自动写回该文件）；
                        跑法 node <skills 根>/dw-prd/scripts/preview.mjs <子命令>
                        （本 skill 不带 ctx —— 那个随 dw-code-facts 分发）
```

## 路由逻辑（每次调用先做这个）

```
1. 读当前项目根 CLAUDE.md（优先）或 AGENTS.md 的标记块，只取【协作面】：
   <!-- dw-workflow:start --> … collaboration="solo|team" … <!-- dw-workflow:end -->
   - 块内 collaboration="solo" 或 "team" → 按它取协作面。
   - 块内 collaboration 是其它取值（非法值）→ 按 "solo" 继续出稿，并一句话告知用户该取值
     非法、可去 dw-workflow 侧修正；**MUST NOT 中止**本次 PRD 任务（本 skill 不写文件，
     中止只会把用户卡在改配置上）。
   - 没有这个名字的标记块（别的名字的块不算）→ 按 collaboration="solo" 走，并在收尾汇报里一句话说明本次按 solo 出稿（项目里没有 dw-workflow 配置）。
   - 以上分支一律【不问用户配置怎么写、不写文件、不主动推动配置迁移】；上面两处
     **一句话告知**是仅有的例外，各只说一次（见 §关键纪律 → 只读项目配置）。

2. 加载 references/00-prd生成流程.md + prd写作纪律.md + 业务语言纪律.md，
   再按协作面加载一份分册（必加载一份）：
   - solo → references/collab/solo.md
   - team → references/collab/team.md
   现状事实**从哪取不看协作面、不看项目大小，只有一条路径**：先查 `engineering-context/`
   卡片（`ctx find-scenes` → `discover` → `get-card`，命中的事实带 cite），卡片没覆盖到的
   模块才读源码（结论带 `文件:行`），并把这些模块在 PRD 里标出来交给下游补卡。
   **本 skill 只探测一件事：项目根下 `.codegraph/codegraph.db` 是否存在**——存在则读源码时
   走【代码图谱】定位，不存在就把重探索外包给子代理。它只影响"怎么读源码"，
   **MUST NOT 用它决定要不要查卡片**。`engineering-context/` 不参与探测：它是必备资产，
   骨架由姊妹 skill `dw-workflow` 初始化时建，registry 只有 `【】` 占位行是**正常起步状态**。
   **取证顺序、读源码的定位方式与标注原文的完整定义只在**
   `00-prd生成流程.md` §批 B → 现状怎么取证，此处不复述；纪律见 `prd写作纪律.md` §4。
   （是否加载 UI 原型纪律见第 3 步的 UI 判定，不在此处决定。）

3. 分流选模板（尽量从已有材料判定，不打扰用户）：
   - 小改动或单点 Issue，且 Triage 4 项全否 → assets/templates/lite-issue-prd.md
     （Triage 任一为是 → 升级到 change-prd.md；判定问题见 00-prd生成流程.md §分流）
   - brownfield 变更 / 新功能 → assets/templates/change-prd.md（默认）
   - 整品 / 从 0 定义产品 → assets/templates/product-prd.md（整品 PRD 作为唯一真相源落 `docs/` 根，见组稿；拆子模块用 assets/templates/requirements-module.md，尚未实现的内容去 assets/templates/todo.md）
   - UI 判定（就在此处初判，批 A/B 的回复到手后复判）：需求会新增/调整用户可见页面、组件、
     入口、状态、信息层级或交互路径 → 立即加载 references/UI原型纪律.md，并把"现有界面样式依据"
     并入批 B 一起问（不要拖到组稿才补问样式依据）。初判拿不准时默认按"涉及 UI"处理，
     等批 A 回复后再否定；不改结构与交互的纯文案改动豁免。

4. 按 00-prd生成流程.md 的【4 批提问】驱动：一次抛一批，用户答完起草该批章节；
   组批时读 assets/question-bank.md 取各批问法；
   每批有明确的**退出条件**（写在 00-prd生成流程.md 各批小节末尾），逐项勾验全过才进下一批；
   任一不过 → 只就不过的那几点再批量追问一次，否则直接进下一批；
   追问一次仍闭不上的点转成显式「开放问题」进下一批，但批 A 的一句话结论 / 做完的标志 /
   非目标是硬产出，MUST NOT 转开放问题，MUST 转【盘问模式】（判据见 00-prd生成流程.md §4 批提问）。
   缺口判据取【并集】：assets/question-bank.md §追问触发 是【追问触发】判据（每条带批次标签
   [A]/[B]/[C]/[D]/[组稿]，另有 [组稿·复核后] 子类、勾验时机推迟到复核门跑完之后；
   勾验某批时只看标记为该批的条目），各批退出条件是【准出】判据；
   任一命中或任一项不过都 MUST 就该点追问，MUST NOT 自行另立标准，也 MUST NOT 因为某项
   在 §追问触发 里没有对应条目就放行。退出条件按所选模板判适用，矩阵见
   prd质量清单.md §完备性 的【三类模板 × 必备节】。
   每批先过【提问三纪律】（事实自己查只问决策 / 每问附推荐答案 / 依赖分层同层批量）；
   需求高度模糊时先走【盘问模式】收敛方向，再回批量流程。

5. 组稿：按模板拼装；涉及 UI 时在此产出独立 HTML 高保真交互原型（批 C 只出 UI Prototype
   Brief，全流程只在组稿第 2 步生成原型文件）→ 跑 prd质量清单.md →
   【用户过稿门 · MUST】把 PRD 与（涉及 UI 时）原型交给用户读，请他提修改意见；意见逐条落稿
   或明确回"不改 + 一句话理由"，改完回本门再过，直到用户定稿。**用户定稿前 MUST NOT 派复核
   子代理**——复核报告只对某一版稿子有效，用户随后的意见会让它整份作废。原型此刻仍未落盘，
   MUST 以预览副本给用户打开（项目外位置），MUST NOT 写进 docs/；预览服务 MUST 由你后台起、
   也由你在派复核子代理之前停（node <skills 根>/dw-prd/scripts/preview.mjs <预览副本>，
   批注自动写回文件、用户零操作，MUST NOT 让用户自己起停），并告诉用户可直接在原型上批注；
   收意见时 MUST 用 preview.mjs annotations 取回**三类 + 回复**，与口头意见合并逐条处理，
   处理完的每条批注 MUST 用 preview.mjs reply 追加 AI 回复
   （见 `UI原型纪律.md` §7.3/§7.4）。"怎样算定稿"用的是落盘确认门
   那三条判据（见 `00-prd生成流程.md` §组稿 第 4 步）→
   【复核门 · MUST】加载 references/prd复核纪律.md，派子代理跑双轴复核（自洽轴 / 冲突轴；
   change/product 派 2 个并行，lite-issue 派 1 个跑精简版）；P0/P1 逐条走**三个出口**之一，
   MUST NOT 悬空——AI 能补的当场改稿；事实层面错了的（现状失实等）回流到对应那一批重取证；
   需用户拍板的（与现有系统的冲突）并入下一步回述清单，MUST NOT 自己替用户选。
   判据是"事实错了回去补，取舍待定才给用户"（见 `prd复核纪律.md` §严重度与处置）→
   【落盘确认门 · MUST】把关键取舍、非目标、验收口径（涉及 UI 时另加原型覆盖范围与样式依据）
   连同复核门交上来的待拍板条目回述给用户，达成共识后才写文件；未确认 MUST NOT 落盘
   （PRD 与 HTML 原型同受此门约束）；并 MUST 逐条列出用户定稿之后稿子被改了什么。
   复核门既无待拍板条目、也无实质性改稿时，本门退化为一句话告知直接落盘，MUST NOT 要用户
   点第二次头（见 `00-prd生成流程.md` §组稿 第 6 步）→
   写入 docs/spec/ →
   项目已有 docs/index.md 时更新它（PRD 与原型都要进索引；索引只放现行口径，归档进 docs/index-archive.md；
   项目没有索引就不为此临时造一个）→
   提示可接 dw-workflow 做 Overview/Spec，并说明 PRD 与 UI 原型一并作为其 Step 1 的输入。
```

## 关键纪律（每次都遵守）

- **只读项目配置，MUST NOT 写配置**：本 skill 读 `CLAUDE.md` / `AGENTS.md` 标记块只为取协作面，**MUST NOT 写入或修改标记块、MUST NOT 向用户提问"这个项目怎么配"、MUST NOT 主动推动配置迁移**。写配置与配置迁移都是 `dw-workflow` 与安装器的职责——它们写文件，能保证"只提示一次"；本 skill 不写文件，抢过来做就会每次唤起都提示一遍。读不到 `dw-workflow` 标记块时按路由第 1 步以 solo 继续，MUST NOT 从别的名字的块里推断协作面——两处各推一套会让同一个项目被判成不同协作面。仅有的两处一句话告知（协作字段取值非法 / 项目里没有 dw-workflow 配置）见路由第 1 步：它们说的是**本次是怎么跑的**，不是"你该去改配置了"——**同一次对话里各只说一次**，MUST NOT 反复提、MUST NOT 因此中止任务，更 MUST NOT 借它展开成迁移指引。
- **批量提问，不一问一答**：每批一次抛全，减少轮次；问题间有依赖时拆层推进（依赖分层，同层批量）。判据见 `references/00-prd生成流程.md` §提问三纪律。
- **事实自己查，只把决策抛给用户**：能从材料/代码（按 `00-prd生成流程.md` §批 B 的取证顺序：先查卡片，卡片没覆盖再读源码）查到的事实不许问，先查清写成草稿让用户确认；提问清单里只留需要用户拍板的决策。
- **每问尽量附推荐答案**：有材料/代码依据必附（推荐 + 一句理由，业务语言），依据不足给典型候选，完全无依据的开放题显式说"无推荐"——禁止编造推荐；决策权仍在用户，未回复不算确认。
- **需求高度模糊先盘问后批量**：方向未定时进盘问模式（小批深挖、挑战含糊保证、逼出隐含假设），收敛出一句话结论与非目标后立即回批量流程。见 `references/00-prd生成流程.md` §盘问模式。
- **非目标必须硬**：没有非目标的 PRD 不准成稿。
- **「以后想做」不进 PRD，进 `docs/TODO.md`**（与走哪个模板无关）：非目标写的是**当前边界**（本次及可预见的将来都不做）；**这次不做、以后想做的 MUST 写进 `docs/TODO.md` 的〈想做的功能〉**（模板 `assets/templates/todo.md`），**MUST NOT 塞进非目标**——那会把「还没做」记成「故意不做」，且随本 PRD 归档一起消失。够格判据（只收会改变用户可感知行为、会新增或去掉一个功能、会动模块边界的条目）与章节四类闭集见 `<skills 根>/dw-doc-governance/references/文档治理.md` §TODO 出口。
- **边界必须显式**：brownfield 场景必须写"不改的线上逻辑"。
- **验收可判定**：禁止"提升体验"这类不可勾验表述，用 RFC2119。
- **真相方向**：现状以代码为准——卡片命中时用 `ctx discover`/`get-card` 取事实并附 cite，卡片没覆盖时读源码核实、条目带 `文件:行` 并在现状节照抄规定的标注原文；**无 card 依据的 cite 视为幻觉，MUST NOT 编造**；**不得把意图/愿景写成现状**，**MUST NOT 从 PRD 生成 card 事实**——PRD 只做 scope 约束与业务语境补充，补卡由 `dw-workflow` 回到源码做（呼应 `<skills 根>/dw-code-facts/references/代码事实纪律.md` §9；`<skills 根>` 的定义见 `00-prd生成流程.md` §批 B → 现状怎么取证，此处不复述）。
- **无占位符成稿**：交付前 `【】` 必须清零。
- **用户过稿门**：跑完 `prd质量清单.md` 后 MUST 先把 PRD 与（涉及 UI 时）原型交给用户读并提意见，**用户定稿了才往下走**——**MUST NOT 一出稿就自动派复核子代理**。本门收的是**用户的意图**，参照物与落盘确认门（复核后的待拍板冲突）不同，两者 **MUST NOT 互相顶替**。用户每条意见 MUST 逐条落稿或明确回"不改 + 一句话理由"，MUST NOT 默默忽略；改动碰到骨架时 MUST 重跑质量清单受影响项再回本门。原型此刻未落盘，MUST 以预览副本交付（项目外位置），**MUST NOT 写进 `docs/`**。"怎样算定稿"与用户不回复时的处置，判据只在 `references/00-prd生成流程.md` §组稿 第 4 步定义（与落盘确认门共用同一套三条判据）。
- **复核门**：用户在过稿门定稿之后、落盘确认门之前 MUST 派子代理跑双轴复核（**自洽轴**查 PRD 内部有没有互相打架、**冲突轴**查与现有系统的功能/约束冲突），判据与 prompt 模板在 `references/prd复核纪律.md`。它与质量清单**不重叠**：清单的参照物是模板骨架（节缺没缺），复核的参照物是 PRD 自身与现有系统。**MUST NOT 由主会话自己顶替**——现状节本就是主会话查的，自己验自己等于没验；**MUST NOT 因协作面而裁剪**。冲突轴每条冲突 MUST 带出处（卡片 cite 或 `文件:行`），无出处视为幻觉；**查不到 MUST NOT 报成冲突**（那只意味着卡片还没建，处置是读源码）。结论逐条走该文件 §严重度与处置 定义的**三个出口**之一，MUST NOT 悬空。
- **落盘确认门**：跑完复核门后 MUST 先把关键取舍、非目标、验收口径（涉及 UI 时另加原型覆盖范围与样式依据）**连同复核门交上来的待拍板冲突**回述给用户，并 MUST 逐条列出**用户定稿之后稿子被改了什么**（用户定的是复核前那一版），达成共识才写文件；**未确认 MUST NOT 落盘**。复核门既没有待拍板条目、也没有实质性改稿时，本门 MUST 退化为一句话告知并直接落盘，**MUST NOT 把同一份稿子再摆一遍要用户点第二次头**。"怎样算确认了"与用户不回复时的处置，判据只在 `references/00-prd生成流程.md` §组稿 第 6 步定义。
- **全程只用业务语言**：对话、问题和 PRD 成稿不得要求用户理解程序实现；技术事实必须先翻译成业务事实。遵循 `references/业务语言纪律.md`。
- **UI 变更必须出 HTML 高保真交互原型**：新增/调整用户可见界面时（纯文案改动豁免），**先自查项目里的设计 token / 组件库 / 同类现有页面**取样式依据，查不到才向用户要材料；产出可离线打开的单文件 HTML（零外链、零 CDN），不得用 Markdown 冒充原型文件，不得把面向 PM 的解释画在用户界面里。原型与 PRD 一并作为 `dw-workflow` 的输入。遵循 `references/UI原型纪律.md`。

   - **原型批注框架**：原型 MUST 由 `scripts/preview.mjs` 的 `init` / `screen` / `slot` 三条命令建出，再只填 `UI原型纪律.md` §8.1 的具名插槽；容器自带设计系统、图标库与批注层，**MUST NOT 手工复制容器再逐行替换**，也 **MUST NOT 为动手而通读容器**——它刻意不含示例内容（范例会锚定产出），要填的信息全在 §8。对某个元素的说明写成该元素上的 `data-anno`（待拍板项加 `data-anno-kind="question"`）悬浮气泡，**MUST NOT 画进屏幕**；用户的意见由页面工具栏写进批注块，AI 用 `preview.mjs reply` 在每条下面追加 AI 回复。**取批注只有一个入口**：`preview.mjs annotations <原型文件>`，它一次给出**三类 + 回复**：用户逐元素批注、全局反馈、AI 侧 `data-anno` 说明，以及用户对说明的回复，**MUST NOT 通读整份 HTML 去找**。工具整体跑不起来时才降级为直读 `ANNOTATIONS:BEGIN … END` 那一段，MUST NOT 因此跳过批注。判据在 `references/UI原型纪律.md` §7、§8。

## 何时用哪个模板

见 `references/00-prd生成流程.md` 的分流表；模板都在 `assets/templates/` 下。
