---
lifecycle: active
superseded_by: ''
archived: ''
last_confirmed: '2026-09-02'
authority_refs:
  - 'AI-LLM-overlay.md §AI 契约清单 的「可观测性」项：每次推理必记字段清单'
  - 'AI-LLM-overlay.md §Agentic 应用 分工表：哪些关注点归 agentic-principle、哪些归本 overlay'
  - '测试资产纪律.md §2：真实输入固化为测试资产的来源与去重规则'
  - '步骤-8-10-测试.md Step 8「优先用真实样本」条：真实输入来源的复述口径'
---

# Lean Change Spec（一页）— Agentic 调试模式与切片回放接线

- **Issue / 链接**：N/A（用户在本次对话直接提出四条原则，要求核对本体系是否已包含）
- **Owner**：weidwonder
- **写作进度**：Done
- **Triage 复核**：AI/LLM 行为？否 鉴权/安全/设备？否 跨服务/迁移/不可逆？borderline 指标/规则/对外承诺？borderline
  - borderline 说明（两问同一件事）：本次判据主体落在**伴生仓库** `agentic-principle`（新增 D12 维度），本仓库侧只是接线——改两处纪律正文 + 一处指针。跨仓部分已在该仓库独立完成（commit `6175f2f`），本仓库这一页的范围是**单仓、纯文档、可逆**；但它确实改变了已安装项目写 AI spec 的必写内容，属对外契约的语义变更，故兼容取舍与版本决定逐条送拍板，不自行处置。

## 改什么（现状 → 期望）

现状：用户提的四条原则里，前两条本体系已覆盖（每个 Task 的 TDD 五步 + 需求/验收双向追溯矩阵；Agent 节点的步骤级单测在 `agentic-principle` D11 且是红线），第三条只覆盖一半（有"每个节点 ≥1 典型/边界/异常 + 夹具落盘可重放"，但没规定夹具**来自真实运行切片**），第四条基本没有——调试模式与中间切片留存只在**排障时**被要求（"拿不到记录就补上"），设计期没有任何一维盯它，`AI-LLM-overlay.md` 的「可观测性」只记元数据（token / latency / verdict / outcome），不含输入输出快照。

期望：调试模式与单环节回放成为 Agentic 应用的**设计期地基项**；本仓库侧把运行期契约与测试资产两处接上，架构判据仍只给指针、不复述。

**本次功能需求**：

- FR-001 — `AI-LLM-overlay.md` §Agentic 应用 的分工表 MUST 把「调试模式、切片留存与单环节回放」明确列入归 `agentic-principle` 的那一格，使读者知道该去哪找判据。
- FR-002 — `AI-LLM-overlay.md` §AI 契约清单 的「可观测性」项 MUST 补上属于**运行期契约**的那一半：调试模式开启时留存本次推理的完整 request / response，默认关、写入时脱敏、有留存期；并指向 `agentic-principle` D12 取链路级判据。
- FR-003 — `测试资产纪律.md` §2 MUST 写明真实输入的一条来源是系统自身的运行切片：有切片的优先从切片取（脱敏后入库），手工构造只补切片覆盖不到的维度。
- FR-004 — `步骤-8-10-测试.md` Step 8 的「优先用真实样本」条 MUST 与 FR-003 同源表述，不各写一套。
- FR-005 — 版本 MUST 随本次契约变更 bump（`2.13.1` → `2.14.0`，拍板于 2026-09-02），且 MUST NOT 新建迁移指南——本次零手动动作（重装即可，不改标记块字段，不要求回填存量文档），按 CLAUDE.md §版本管理 的判据补一份"需要的动作：无"的指南正是它要挡的噪音。

## 为什么

"出事之后看不看得见"这件事，此前只在**已经出事**的路径上被要求。这有三个补不回来的窟窿：出问题的那一次现场已经没了，补上记录只能拿到下一次的；偶发问题等不到复现；补记录要改代码、发版、复现，从报障到第一份证据之间隔着一次上线，此前所有归因都是猜。

用户提的第四条原则正是把它前移到设计期。第三条（切片当用例）是它的直接红利：真实流量的不规整（多余空格、异常编码、超长字段、缺失键）是手工构造永远想不到的，而做了 D12 之后这些输入本来就躺在切片里，不取白不取。

## 具体改动点

**本仓库（本次范围）**：

- `ai-dev-system/skills/ai-dev-workflow/references/core/AI-LLM-overlay.md` 分工表第一行 — 加「调试模式、切片留存与单环节回放」（FR-001）。
- 同文件 §AI 契约清单 「可观测性」项 — 补调试模式切片的运行期契约与指针（FR-002）。
- `ai-dev-system/skills/ai-dev-workflow/references/core/测试资产纪律.md` §2 — 新增"来源：运行切片"一条（FR-003）。
- `ai-dev-system/skills/ai-dev-workflow/references/core/步骤-8-10-测试.md` Step 8 第 2 条 — 同源补半句（FR-004）。
- `ai-dev-system/VERSION` — bump（FR-005，待拍板）。
- `docs/index.md` — 登记本 spec。

**伴生仓库 `agentic-principle`（已完成，已推送：`main` = `6175f2f`，annotated tag `v0.8.0`，2026-09-02）**：新增 D12「可观测与回放」维度与 `references/runtime/observability.md`，并同步 SKILL.md 维度矩阵 / 约束 17 / 失败处理 / 按需引用 / 验证清单 / 案例、testing.md（节点口径含程序段、夹具首选切片）、design-doc-template.md（批次 13 + 骨架 §16）、verification.md、review-mode.md、incremental.md、debug-mode.md、scan_agent.py（D12 探针）与两份 README。

## 影响范围 / 不做什么

- 影响：含 AI 的 spec 多一项必写内容（可观测性项内的调试模式契约）；Agentic 项目的评审门 E 轴会因伴生 skill 升级而多查一维（D12）。
- **不做**：不把 D12 的判据搬进本仓库（`agentic-principle` 是外部伴生技能，CLAUDE.md 明令禁止搬运，两边只用指针互引）。
- **不做**：不改代码评审门的轴数与轴定义——D12 由 E 轴（agent 架构轴）随伴生 skill 一并覆盖，本仓库的四条轴不动。
- **不做**：不动 `assets/config-snippets/`（注入目标项目的声明与本次无关，agentic 条目仍只指向伴生 skill）。
- **不做**：不新建迁移指南（判据见 FR-005）。
- 关键 NFR：无。纯文档改动，无新增依赖与运行时行为。
- 既有系统清单：`AI-LLM-overlay.md` §Agentic 应用 分工表与 §AI 契约清单（`AI-LLM-overlay.md:26,90,92`）、`测试资产纪律.md` §2 目录与命名两节（`测试资产纪律.md:31-64`）、`步骤-8-10-测试.md` Step 8 的三件事清单（`步骤-8-10-测试.md:19-22`）、`代码评审纪律.md` 的 E 轴（只读不改）、`install.mjs` 的 `COMPANION_SKILLS`（只读不改）。全部来自本次直接读过的源文件。
- 本次补的卡片：无需新补 —— 本次只读了 skill 的 markdown 判据文件，未读任何未建卡的代码模块（`install.mjs` 的伴生同步链路已由并行分支 `chore/companion-repo-rename` 补进 `engineering-context/cards/ai-dev-system.md`）。

## 兼容取舍（用户拍板，定稿前必填）

- **含 AI 的 spec 多一项必写内容（可观测性项里的调试模式切片契约）** —— 谁在依赖：所有已装本体系、正在写 AI spec 的项目 —— 用户决定：**不兼容**（新 spec 一律照新口径写）—— 确认于 2026-09-02
- **存量 AI spec 是否要求回填这一项** —— 谁在依赖：已按旧口径写完 spec 的项目 —— 用户决定：**不回填** —— 它是新建 spec 的地板，不追溯；存量 spec 下次大改时自然带上 —— 确认于 2026-09-02
- **本次是否 bump VERSION** —— 谁在依赖：所有跑安装器的人 —— 用户决定：**bump 2.14.0** —— 契约语义变了；零手动动作，不建迁移指南 —— 确认于 2026-09-02

## 过稿记录（拍板人表态，开始实现前必填）

- 2026-09-02｜已定稿｜兼容取舍三项与版本决定同一批送拍板，拍板人逐条选定（不回填 / bump 2.14.0 / 伴生仓库改动直接推 main），据此定稿进入实现。

## 替换清单（本次淘汰了什么）

| 被取代物 | 类型 | 取代者 | 处置 | 保留理由 + 到期日 |
|---|---|---|---|---|
| 无 | — | — | — | — |

> 伴生仓库侧同样无淘汰项：D12 是新增维度，debug-mode.md 的"拿不到记录就补上"仍然保留——它从"唯一做法"降为"D12 缺失时的止血"，语义收窄但条款仍在场。

## 验收标准（可判定，含边界/失败用例）

- [ ] AC-001 `AI-LLM-overlay.md` 分工表第一行含「调试模式」「切片」「回放」三个词，且该文件全文 MUST NOT 出现切片字段清单、开关粒度、回放比对口径等 D12 判据正文（只给指针）—— 满足：FR-001
- [ ] AC-002 `AI-LLM-overlay.md` 「可观测性」项含三样东西：**可开启调试模式的要求**（留存本次推理的完整 request/response、生产默认关、写入时脱敏、定留存期）、**指向 `agentic-principle` D12 的指针**、以及**非 Agentic AI 功能读不到 D12 时的兜底地板**；且 MUST NOT 逐条列切片字段或开关粒度（与 AC-001 的全文禁令一致——两条 AC MUST NOT 互相打架）—— 满足：FR-002
- [ ] AC-003 `测试资产纪律.md` §2 与 `步骤-8-10-测试.md` Step 8 两处都写到"有切片优先取切片、脱敏后入库、手工构造只补切片覆盖不到的维度"，且表述同源（后者是前者的指针式复述，不另立判据）—— 满足：FR-003、FR-004
- [ ] AC-004 边界：伴生 skill **不在场**时本次改动不产生断链——overlay 里新增的指针与既有的"它不在场时"段落一致，读者被引向同一处兜底说明 —— 满足：FR-001、FR-002
- [ ] AC-005 失败用例：`node --test test/*.test.mjs` 全绿；特别是 `wording-redline.test.mjs`（本次只增不减规范词）、`counter-word.test.mjs`（本次未引入受检计数词）、`doc-index.test.mjs`（本 spec 已收录进 `docs/index.md` 且文件名带日期前缀）—— 满足：FR-001–FR-005
- [ ] AC-006 `ai-dev-system/migrations/` 下 MUST NOT 出现 `2.14.0.md`；`installer-migration.test.mjs` 仍绿（该断言 2.5.0 起已是条件式）—— 满足：FR-005

## 如何验证

- [ ] `node --test test/*.test.mjs` —— 预期全绿（改动前先跑一次留基线）
- [ ] `grep -n "调试模式\|切片\|回放" ai-dev-system/skills/ai-dev-workflow/references/core/AI-LLM-overlay.md` —— 预期只在分工表与可观测性项两处出现，且无判据正文
- [ ] 回归检查点：`grep -rn "agentic-principle" ai-dev-system/skills/ai-dev-workflow/references/core/AI-LLM-overlay.md` —— 指针仍指向伴生 skill，未被本次新增内容顶替
- [ ] **代码评审门**：先按 `references/core/代码评审纪律.md` §门禁 判对象面算出轴集合，再派 1 个子代理跑 §评审轴 的精简版，报告逐轴分节写，P0/P1 修完才算过门。子代理 prompt 必须点名加载 ai-dev-workflow skill。Lean 也不豁免这道门。

## 回滚方式

`git revert` 本次合并提交即可（纯文档，无状态、无迁移）。伴生仓库侧独立回滚：`git revert 6175f2f`，两边互不阻塞——本仓库只持有指针，指针指向的维度暂时不存在时，读者落到 overlay 既有的"它不在场时"兜底段。
