# 业务域卡 — dw-system › skill文档

## 职责
记录 `dw-system/skills/` 各份 skill 文档里"哪一处是某条判据的家、别处只许指过去"，以及守着这些复述处的机器闸；判据本身不进本卡，它们的家就是 skill 文档。

## 权威实现与对外接口

> cite 的 `#` 后面是该文件里一个稳定的小节用词，供 `lint-cards` 按字面核对。

| 判据 / 清单 | 家（cite） | 约束 |
|---|---|---|
| 贯穿门总表与计数词 `五道门` | `dw-system/skills/dw-workflow/references/00-流程总纲.md#五道门` | 贯穿门清单与"一共几道"的唯一定义处；三道条件门（红回路 / 不可逆 / 大架构）在总表之后逐条声明。别处要引用 MUST 指名引用**具体那一道门**的小节，MUST NOT 引用总表——总表的小节名字面就含受检计数词。 |
| 兼容取舍确认门、spec 过稿门的判据 | `dw-system/skills/dw-workflow/references/确认门.md#过稿门` | 总纲总表只给触发时机与指针，判据在这里。spec 过稿门的四个子节（摆什么给拍板人 / 怎么算过了这道门 / 跳过本门只有一条通路 / 结论 MUST 当场留痕）是各处引用的锚点，改名要查引用方。 |
| 工作区隔离门、完成与自动合并门的判据 | `dw-system/skills/dw-worktree/references/worktree开发纪律.md#工作区隔离门` | 两道门的判据归 skill `dw-worktree`，总纲只留指针。 |
| 代码评审门的判据 | `dw-system/skills/dw-review-gate/references/评审门禁.md#门禁` | 派几个、跑哪几条轴、积压怎么登记都归 skill `dw-review-gate`；轴集合按对象面推导，定义在 `dw-system/skills/dw-review-gate/references/评审轴.md#评审轴`。 |
| 大架构判据 | `dw-system/skills/dw-workflow/references/用户沟通纪律.md#主干路` | 判据与正反例的权威定义；总纲 MUST NOT 复述。落地位置在 `dw-system/skills/dw-workflow/references/步骤-1-7-设计与实现.md#大架构确认门`，Lean 侧在 `dw-system/skills/dw-workflow/references/路径-lean.md#顺序`。 |
| 计数词机器闸 | `test/counter-word.test.mjs#CHECKED_WORDS` | 遍历整棵 `dw-system/skills/`，按**字面子串**匹配，MUST NOT 改成分词或模糊正则——小节名式的指名引用靠"不含受检子串"才不被误伤。每个计数词只有 `authority` 指的那一份文件可以写；`authority: null` 的词全仓零出现。豁免只在 `test/counter-word-exempt.mjs#EXEMPT_DIRS`：`config-snippets/` 被注入目标项目，读它的 AI 不一定加载了 skill，指名引用在那一刻兑现不了。 |
| 贯穿门同步闸 | `test/gate-sync.test.mjs#MUST_RESTATE` | 门名从总纲现场解析；核对两件事：总表每个门名在 Lean 一页 `## 顺序` 里字面在场、总表行数与标题计数词一致。只查在不在场，全绿 MUST NOT 读成各处描述都正确。 |
| 规范句单一归属闸 | `test/single-home-lib.mjs#findDuplicates` | 含 MUST / SHOULD 的句子归一化后出现在两个以上 skill 文件即判红；确需就地重复的关键一句登记在 `test/single-home.allow.json#sentence`（句子 / 文件 / 理由三项齐全）。白名单里已不再重复的条目同样判红。只抓逐字重复，换了措辞的重复展开由评审门查。 |
| 规范文本体积上限 | `test/doc-budgets.json#classes` | 各规范文本体积上限的**唯一**定义处，别处 MUST NOT 再写一份数字。超限的处置顺序是先把来历搬回它的家、再拆细，MUST NOT 为过线丢命题。 |
| 交叉引用有效性闸 | `test/cross-reference.test.mjs#交叉引用` | skill 文档跨文件互指的小节 MUST 真实存在；被指小节改名或删除时引用方不会自己报错，靠这条闸判红。 |
| 文档命名 | `dw-system/skills/dw-doc-governance/references/文档治理.md#默认命名` | 按次产出的 spec / plan / report 文件名以 `YYYY-MM-DD-` 开头；例外是常青档、两份索引、两个固定账本与 `docs/requirements/` 下的一级子模块，清单只在该节。项目可以在前缀之上更严格，MUST NOT 豁免前缀，目录不可改变。 |
| 文档生命周期与索引门控 | `dw-system/skills/dw-doc-governance/references/文档生命周期.md#lifecycle` | `lifecycle` / `superseded_by` / `authority_refs` 等字段与索引分层的家。同一条 `authority_refs` MUST NOT 被两份 `lifecycle: active` 的文档同时声明，由 `ctx probe` 的 `authority-unique` 题型机检。 |
| 索引完整性机器闸 | `test/doc-index.test.mjs#collectDocs` | 递归子目录；`active` 的文档 MUST 在 `docs/index.md`，归档态的 MUST 在 `docs/index-archive.md` 且不在现行索引；断链判红；缺 `lifecycle` 字段单独报一条。按**文件路径**匹配，不按标题文字。 |
| UI 原型的产出纪律 | `dw-system/skills/dw-prd/references/UI原型纪律.md#批注框架` | 原型的产出、结构、自检、批注框架、写回路径与风格归属（§8.3：外观层默认不装配）的权威判据；`preview.mjs` 的注释与 `ui-prototype-framework/README.md` 只指过去。工具侧的事实在 `cards/dw-system/原型工具.md`。 |
| 卡片体例 | `dw-system/skills/dw-code-facts/references/代码事实纪律.md#补一张卡片的最小形态` | 三类卡（地图卡 / 域卡 / 依赖仓事实卡）写什么、只写现状、只记判断的家；小节名的机器定义在 `lint.js`（见 `cards/dw-system/ctx体检与门禁.md`）。 |
| 注入目标项目的标记块正文 | `dw-system/skills/dw-workflow/assets/config-snippets/base.md#dw-workflow:start` | `base.md` + `collab-solo.md` / `collab-team.md` 是标记块正文的唯一来源，由安装器与 skill 初始化取用；组装规则在 `cards/dw-system/标记块与旧版迁移.md`。 |

## 陷阱项

> 每行一条"这个不该再用"或"这样写会悄悄坏掉"。

- 计数词 `四道门` 已废弃 — 贯穿门是五道；旧值与新值同受计数词闸管辖，别处残留一处就是一条按旧数字执行的路径。`dw-system/migrations/` 历史指南里的旧表述是记账，不改。
- 计数词 `四轴` 已废弃 — 轴集合按每次改动触碰的对象面推导，没有固定数目；这个词全仓零出现，没有任何文件有资格写它。改成指名引用 `评审轴.md` 的小节。
- 字段名 `status` 不可用于文档生命周期 — 它已被"写作进度"与 PRD 的自由文本状态占用；生命周期字段是 `lifecycle`。
- `dw-workflow/references/core/` 与 `references/capability/` 这两个旧目录已移除 — 文档治理类判据在 skill `dw-doc-governance`，评审类在 `dw-review-gate`，工作区类在 `dw-worktree`，代码事实类在 `dw-code-facts`，bug 诊断在 `dw-bug-diagnosis`，其余在 `dw-workflow/references/` 根下。
- 引用 `§五道门` 总表来指某一道门 — 引用串本身含受检子串，计数词闸判红；引用方要的是某一道门的判据，指名引用那道门的小节。
- 让贯穿门同步闸对 `路径-lean.md` 退回全文匹配 — 同一个门名在别的小节也出现，全文匹配对"`## 顺序` 表漏了一行"恒绿；切段锚点找不到时 MUST 判红而不是回退。
- 在两份 `lifecycle: active` 的文档里声明同一条 `authority_refs` — 同一权威面有了两个家，改一处另一处不会报错地过期。
- 靠放宽词表或扩大豁免清单让计数词闸转绿 — 自检 MUST 用"往非豁免文件写回一个受检词 → 判红"的方式做。

## 测试入口
`test/counter-word.test.mjs`、`test/gate-sync.test.mjs`、`test/doc-index.test.mjs`、`test/cross-reference.test.mjs`、`test/single-home.test.mjs`、`test/doc-budgets.test.mjs`、`test/rule-destinations.test.mjs`（含规范词的小节不得无声消失）；都在仓库根跑，不随 skill 分发。

## 确认
2026-09-22｜来源：`代码事实纪律.md` §4.1 的三类卡表、`00-流程总纲.md` 的〈五道门〉一节、`确认门.md` 与 `worktree开发纪律.md` 的小节表、`文档治理.md`〈默认命名〉、`文档生命周期.md`〈生命周期位〉、`UI原型纪律.md` 的小节表，以及 `test/counter-word.test.mjs` / `test/counter-word-exempt.mjs` / `test/gate-sync.test.mjs` / `test/doc-index.test.mjs` 、`test/single-home.test.mjs`、`test/doc-budgets.test.mjs`、`test/cross-reference.test.mjs`、`test/rule-destinations.test.mjs` 的文件头与常量
