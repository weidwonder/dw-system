# Frozen Probe Set — 上下文层防腐检测题集

> 冻结、可自动打分、每个发布周期重跑的小评测集，专门检测 Engineering Context 是否**衰减**。与 Dogfooding（产品验证）互补——真实项目每次都变，不能当回归基线。
> 起步 40~50 题即可，随人工纠正不断补充（人工纠正 → 新 Probe 题 + card/registry 更新，闭环）。
> 种子题取自真实歧义案例，**有已知正确答案**。

## 题型与示例

| # | 题型 | 示例 | 期望答案 |
|---|---|---|---|
| 1 | Capability Mapping | 概念【背单词记录】→ 哪个 canonical service + 接口？ | 【权威服务/接口，并标出废弃替代】 |
| 2 | Deprecated / Intermediate Trap | 路由指向 V2，V1 是上次重构中间产物——V1 状态是？ | 【标为"中间产物，不可用"，既非旧亦非新】 |
| 3 | Version / Compatibility | 接口 X：05/29 发布前兼容、06/10 后不兼容——切点是？ | 【返回正确兼容窗口】 |
| 4 | Bugfix Context | 给 bug 描述与日志，定位调用链 | 【命中正确链路】 |
| 5 | Impact Radius | 给 diff，判断影响范围 | 【单模块/跨服务/跨仓】 |
| 6 | PRD-Spec Conflict | PRD 说"可复用" + 代码事实 | 【发现"假复用"冲突】 |

> 上表第 1、2 类已由 `ctx probe` 机器判定（类型列填 `capability-mapping` / `deprecated-trap`），3~6 类目前靠人工判。
> `capability-mapping` 的期望串写 `权威仓库 :: 权威实现`，registry 是**三列最小 schema**（没有"权威仓库"列）时只写 `权威实现` 即可；
> 此时仓库维度不存在、无从比对，门禁只判权威实现——**不会因为缺列而恒失败**，那种恒红只会污染棘轮基线。
> 下一节的四项零上下文交接检查同样是机器判定的。

## 零上下文交接检查（四项，机器可判定，`ctx probe` 已实现）

> 交接目标：**项目对任何接手者——人或 agent——都做到零上下文交接**，需求 / 架构 / 实现三层真相源都能从项目自身定位。
> 目标不可验证就等于没有，所以四项一律做成可脚本化的**可达性检查**，与上面的 context 层题型共用同一套
> `severity` / `weight` / `status` / `authority_refs` 与棘轮机制。

| 检查项 | 类型名（填进"类型"列） | 输入 | 期望 | 通过标准 |
|---|---|---|---|---|
| 需求真相源可达 | `requirement-reachable` | 需求真相源路径（`docs/REQUIREMENTS.md` 或 `README.md#需求`）| `≤2 跳` | 从入口文档沿链接 ≤2 跳到达 |
| 架构真相源可达 | `architecture-reachable` | 架构真相源路径（`docs/ARCHITECTURE.md` 或 `README.md#架构与边界`）| `≤2 跳` | 同上 |
| 实现真相源可用 | `implementation-usable` | 架构节（`README.md#架构与边界`）| `usable` | 模块路径无条件校验 + 探测到的每一位都要成立，见下 |
| 设计理由可追 | `rationale-traceable` | 索引路径（默认 `docs/index.md`）| `全部非空` | 索引**现行区**各 spec 的 `authority_refs` 均非空。**只统计路径里含 `spec/` 的 `.md`**——`plan/`、`report/` 与外链不计入；spec 放在别的目录（如 `docs/设计/`）会直接判 `NO-SPEC-LINK` |

**入口文档**：仓库根的 `README*.md` 与 `docs/index.md`（需求真相源"二选一即可"的判据见 `core/文档治理.md` §三层真相源）。两者都没有 → `NO-ENTRY-DOC`，判 FAIL——没有入口就谈不上交接。
**跳数**：入口文档本身算 0 跳，入口里的链接算 1 跳。期望串里写数字即改上限（不写按 ≤2 跳）。目标带 `#锚点` 时，该锚点必须对应文中一个标题，否则 `ANCHOR-MISSING`。

**"实现真相源可用"的三项是叠加，不是互斥**（能力位是探测结果，不是配置）：

| 检查项 | 何时校验 | 判定 | 失败样子 |
|---|---|---|---|
| 架构节列出的模块路径**均存在** | **无条件**，有没有能力位都查 | 路径逐个存在 | `模块路径：缺失 src/x.js` |
| 图谱位（`.codegraph/codegraph.db` 存在）| 探测到该位时追加 | 索引可查询（文件非空）| `图谱位：… 为空，索引不可查询` |
| 权威位（`ctx list-services` 非空）| 探测到该位时追加**一条说明性 note**（`权威位：N 条`）| **不参与 pass/fail** | 探测口径本身就是「非空」，没有独立判定空间；只剩模板占位行 = 未启用权威位，连 note 也不加 |

**模块路径那一项 MUST NOT 因为「已经有能力位了」就跳过**——三行 registry 不该让实现层门禁永久变绿。参与 pass/fail 的是**模块路径 + 图谱位（若探测到）**两项，两项都要过；权威位那行只追加说明性 note。

**架构节的写法要求（对所有项目生效，不只直读）**：模块路径要写成**反引号代码片段**（`` `src/word/record.js` ``）或**相对链接**，且**含目录分隔 `/`** 或以常见源码/文档扩展名结尾，才会被计入。
一个字都抽不到会判 `架构节未列出任何模块路径` 而不是放行——**零条目算通过就是假门禁**。同理，索引现行区一篇 spec 都没链到时判 `NO-SPEC-LINK`。
反过来也要注意：架构小节里用反引号写 `path.join`、`os.tmpdir`、`process.env` 这类 **API 名**不会被误当成路径（判据是白名单，不是「点号后几位字母」），放心写。
无扩展名的真实路径（`Makefile`、`Dockerfile`、`.env.example`、`go.mod`）**也在白名单里**，同样会被计入。完整两份白名单以 `scripts/ctx/src/probe.js` 的 `PATH_EXT` 与 `BARE_PATH_NAME` 为准。

**`authority_refs` 非空的判据**：frontmatter 里该字段有至少一条实义条目；空值、模板占位（含 `【】`）、`TBD` / `待填` 均视为未填。归档区（标题含"归档"/"archive"）链到的文档不参与判定——它们按 `文档治理.md` 不再代表现行口径。排除范围**按标题层级**算：`## 归档` 下的 `### 2026 Q1` 仍在归档区内，只有同级或更高级标题才解除，所以归档区可以放心按季度分子标题。

示例（可直接抄进自己项目的探针表）：

| # | 类型 | 输入 | 期望 | severity | weight | status | authority_refs |
|---|---|---|---|---|---|---|---|
| 41 | requirement-reachable | docs/index.md | ≤2 跳 | blocking | 1 | | README.md 的入口链接结构 |
| 42 | architecture-reachable | README.md#架构与边界 | ≤2 跳 | blocking | 1 | | README.md#架构与边界 |
| 43 | implementation-usable | README.md#架构与边界 | usable | scored | 2 | | 架构节列出的模块路径 |
| 44 | rationale-traceable | docs/index.md | 全部非空 | scored | 2 | | docs/index.md 现行区条目 |

## 探针字段 schema（每题除"输入/期望"外，登记以下元字段）

`ctx probe` 已按下列元字段分级打分（不填按默认 `scored`/1/空）；在探针表加同名列即可生效：

| 字段 | 取值 | 用途 |
|---|---|---|
| `severity` | `blocking` / `scored`（默认）| `blocking`=零容忍（如废弃陷阱被当 canonical），一错即门禁 RED、基线不可豁免；`scored`=计入加权通过率 |
| `weight` | 数值（默认 1）| `scored` 题的权重；加权通过率不得低于地板（CLI 默认 0.9，低于即 RED），且相对上期的衰减会被报告 |
| `status` | 空（默认）/ `needs-reconfirm` / `quarantined` | 非空即**暂不计分**：`needs-reconfirm`=权威面已变、待重认；`quarantined`=已退役。门禁报告会列出待重认题数 |
| `authority_refs` | 指向依赖的权威面（card/registry 的 path#anchor）| 这题的"已知正确答案"是从哪条权威事实来的——自防腐的锚（见下）。当前仅登记用，自动联动见下 |

## 探针自防腐（authority_refs 与 needs-reconfirm）★ 别拿过期真相打分

探针的"已知正确答案"本身也是一种权威事实，会随代码演进过期。**拿过期真相打分，比没有评测更糟**——它会绿着脸掩盖上下文已经腐化的事实。所以探针集必须和 `context-engineering.md §5` 的**权威面触发**共用同一套刷新机制：

- 每题用 `authority_refs` 挂到它依赖的权威面（某接口签名 / 废弃标记 / 路由版本）。
- 当被挂的权威面发生变更（card/registry 刷新），把对应探针的 `status` 置为 **`needs-reconfirm`**：**暂不计入通过率**，等人重新确认它的"已知正确答案"是否还成立。（置位目前由刷新流程/人工执行；按 `authority_refs` 自动置位需接 CI hook，属后续工作。）
- 确认后恢复计分；确认发现该题已不再有意义则 **`quarantined`** 退役，并连同 card 一起更新。
- 门禁报告要显式列出 `needs-reconfirm` 的题数——一堆待重认的探针 = 评测可信度在下降，和衰减同等重要。

## 门禁自检（防"永远全绿"的假门禁）

每次跑全量探针**之前**，先注入一个已知必然失败的合成样本，断言门禁能抓到；抓不到 → 门禁失效，流水线红。

```
runProbeGate():
  plantKnownStaleEntity()        # 构造一个必然该被判错的样本（如把废弃接口标成 canonical）
  assert gate(sample) == FAIL    # 抓不到 → 门禁自身报废，先修门禁
  return gate(realProbeSet)      # 自检通过才跑真实探针
```

交接题型也进自检：题集里有交接题型时，额外植入**两道**必错样本：一道指向必然不存在的真相源的可达性题，一道 `implementation-usable`（后者是「三项叠加」语义的保险——只校验能力位那几项、漏掉模块路径时它会失败）。
它只依赖项目文件、不依赖 card/registry，所以**没有 context 层的直读项目也有真门禁**——
但反过来，题集里没有交接题型且 context 层为空时判据不变，仍是 `GATE-BROKEN`，不得放水。

## 运行节奏
- 只在 **CI 发布 / 里程碑节点**运行，**不进 coding agent 的每轮 loop**。
- `ctx probe` 已可运行：机器可判题型（context 层的 capability-mapping / deprecated-trap，零上下文交接的 requirement-reachable / architecture-reachable / implementation-usable / rationale-traceable）+ 门禁自检 + 棘轮 + 衰减报告，`--json` 退出码供 CI 门禁（见 `scripts/ctx/README.md`）。"按权威面自动触发重扫"的 CI hook 仍待接。
- 交接题型读的是**项目自身文件**，按 `ctx probe` 的运行目录（cwd）当项目根；`--dir` 只改 `engineering-context` 的位置，不改项目根。

## 基线（棘轮）
> 已知、暂时容忍的失败项（按 # 列）。规则：**只许变短**——基线外新增失败即 RED；基线内已修复也 RED（强制删除该条）。
> 编号 MUST **独立成行**：`- 12` / `* #12` / `1. 12` / `- [ ] 12` / `` - `12` `` / 表格首列 `| 12 |` 都认。
> 夹在句子里的编号（`- 探针 #3：容忍到 2026-09`）**不认**，会被单独警告——那种写法一旦被漏读就是假 RED。
> 复核记录照常写，行内的日期与 issue 号不会被误当编号：
> `> 2026-08-16 复核：暂时容忍 #1，见 issue 4321。`

（空）

## 判级与退出码
| verdict | 退出码 | 说明 |
|---|---|---|
| `GREEN` / `AMBER` | 0 | AMBER = 失败全落在基线内 |
| `RED` | 1 | 新增失败 / blocking 失败 / 通过率低于地板 / 基线有冗余 |
| `GATE-BROKEN` | 1 | 自检没抓住植入的必错样本，拒绝出具结论 |
| `NO-PROBE` | 1 | 一道**未暂停**的探针都没跑——"没有题目所以全绿"是假门禁 |
