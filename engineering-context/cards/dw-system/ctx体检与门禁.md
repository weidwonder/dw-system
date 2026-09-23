# 业务域卡 — dw-system › ctx体检与门禁

## 职责
`ctx` 的两条把关命令：`lint-cards` 体检卡片体例与 cite、`probe` 跑 Frozen Probe Set 防腐门禁。查询侧（读取层、discover / get-card / 语义兜底）在 `cards/dw-system/ctx命令行.md`。

## 权威实现与对外接口

> 下表路径都在 `dw-system/skills/dw-code-facts/scripts/ctx/` 之下，cite 写全路径供 `lint-cards` 核对。

| 能力 / 入口 | 权威实现（cite） | 约束 |
|---|---|---|
| 卡片体检 | `dw-system/skills/dw-code-facts/scripts/ctx/src/lint.js#lintCards` | 七条规则：固定小节、体积（`dw-system/skills/dw-code-facts/scripts/ctx/src/lint.js#BUDGET`）、带日期的小节名、cite 能否解析、域名近似重复、registry 指针、陷阱项噪音。扫描面含 `cards/` 与 `dependencies/` 两棵树：事实卡复用 `dw-system/skills/dw-code-facts/scripts/ctx/src/lint.js#DOMAIN_REQUIRED` 与 `BUDGET.domain`（MUST NOT 新增第五张小节表或第二个体积常量）；有事实卡而无同名声明判 `sections\|dependencies/<名>\|缺依赖声明`（触发条件是「有事实卡」，空目录不判）；`domain-dup` 只在同一上游内比较。依赖侧**不**施加：`sections` 不检声明本身、`registry-pointer` 与 `dw-system/skills/dw-code-facts/scripts/ctx/src/lint.js#splitSuggestions` 不扩面。违规的稳定标识是 `<规则>\|<相对路径>\|<键>`。新增违规退出 1。 |
| 小节名的机器定义 | `dw-system/skills/dw-code-facts/scripts/ctx/src/lint.js#DOMAIN_REQUIRED` | 必备 / 可选小节名以 `lint.js` 的四个常量为准，依赖仓事实卡复用域卡那两张；`card-map.md`、`card-domain.md` 两份模板与 `代码事实纪律.md` §4.1 是同一份清单的人读形态，改名 MUST 三处同改。 |
| cite 规则的解析口径 | `dw-system/skills/dw-code-facts/scripts/ctx/src/lint.js#CITE_RE` | 只认反引号内的 `路径#符号` 与 `路径:行`，路径 MUST 带扩展名、符号里不能有空白。项目根取 `--dir` 所指目录的**父目录**，再加地图卡〈职责〉里 `> 根目录：` 声明的目录；声明 `外部` 的仓库整体跳过；依赖仓事实卡按 `origin` 汇合到**同一条** `dw-system/skills/dw-code-facts/scripts/ctx/src/lint.js#rootsOf` 返回 `null` 的分支整卡跳过，`dw-system/skills/dw-code-facts/scripts/ctx/src/lint.js#checkCites` 内 MUST NOT 另加提前返回。符号按字面子串检索。含 `【】` 的行与代码围栏不检。 |
| 基线 | `dw-system/skills/dw-code-facts/scripts/ctx/src/lint.js#BASELINE_FILE` | 只经 `--init-baseline` 从无到有（已存在则拒绝、退出 2）、经 `--prune-baseline` 变短；没有任何入口能往既有基线里加条目。基线文件损坏抛 `dw-system/skills/dw-code-facts/scripts/ctx/src/lint.js#BaselineError`，CLI 退出 2，不当成空基线。 |
| 读不出的卡 | `dw-system/skills/dw-code-facts/scripts/ctx/src/cards.js#unreadableCards` | `cards/` 与 `dependencies/` 两棵树各下探一层（四类文件都扫），返回路径以 `engineering-context/` 为根、带 `cards/` 或 `dependencies/` 前缀；`lint-cards` 直接拿它记 `unreadable`，MUST NOT 再拼一次前缀。`list-services` 的 ⚠ 行一并算入，文案仍写「card」。 |
| probe 题型 | `dw-system/skills/dw-code-facts/scripts/ctx/src/probe.js#answerProbe`、`dw-system/skills/dw-code-facts/scripts/ctx/src/probe.js#handoffKind` | A 类读 `loadAllCards` 与 registry（`capability-mapping`、`deprecated-trap`），因此依赖仓事实卡的〈陷阱项〉也可作 `deprecated-trap` 的证据；B 类读项目自身文件（`requirement-reachable`、`architecture-reachable`、`implementation-usable`、`rationale-traceable`、`authority-unique`），不依赖 context 层，类型名中英双写，项目根是 cwd。 |
| 权威面唯一 | `dw-system/skills/dw-code-facts/scripts/ctx/src/probe.js#checkAuthorityUnique` | 索引现行区里任意两份 `lifecycle` 为 `active`（或没写）的文档 MUST NOT 声明同一条 `authority_refs`；比对前去引号与反引号、折叠空白，`无` 不参与；现行区一篇文档都没链到判失败。 |
| probe 自检与判级 | `dw-system/skills/dw-code-facts/scripts/ctx/src/probe.js#selfCheck`、`dw-system/skills/dw-code-facts/scripts/ctx/src/probe.js#evaluateGate` | 真跑前植入必错样本，抓不到判 `GATE-BROKEN`，自检先于 `NO-PROBE` 判定。棘轮双向：基线外新增失败 RED、失败全在基线内 AMBER、基线里已不再失败的编号同样 RED；blocking 零容忍；加权通过率低于地板 RED。退出码：GREEN / AMBER → 0，其余 → 1。 |
| probe 的入口与模块路径 | `dw-system/skills/dw-code-facts/scripts/ctx/src/probe.js#entryDocs`、`dw-system/skills/dw-code-facts/scripts/ctx/src/probe.js#modulePathCandidates` | 入口文档是项目根 `README*.md` 与 `docs/index.md`，真相源 ≤2 跳可达（`dw-system/skills/dw-code-facts/scripts/ctx/src/probe.js#reachTruthSource`）。模块路径只从反引号片段与相对链接里抽，判据是白名单（`dw-system/skills/dw-code-facts/scripts/ctx/src/probe.js#PATH_EXT`）；抽不到任何路径判失败。 |
| 通过率历史 | `dw-system/skills/dw-code-facts/scripts/ctx/src/probe.js#writeHistory` | 写 `engineering-context/.index/`，是机器状态，由 init 生成的 `.gitignore` 忽略；`--minimal` 也 MUST 生成它。 |

## 陷阱项

> 每行一条"这样写会悄悄坏掉"。

- 在 probe 的期望串里写 `repo :: api` 而 registry 是三列最小表 — 仓库维度不存在，这道题恒失败并污染棘轮基线；此时期望串只写权威实现。
- 把 probe 的模块路径判据改成"点号后若干位字母数字"的启发式 — 架构节里的 `path.join` 会被当成路径，好题变永久红点；白名单漏掉真实路径则门禁恒绿。两头都 MUST 以白名单为准，README 里 MUST NOT 抄第二份。
- 把 probe 全绿读成"文档还准" — 它只验可达性、`authority_refs` 非空与不重复，不读正文。
- 重写已有的 lint 基线文件来让体检转绿 — 等于把新违规一笔勾销；基线只许经 `--prune-baseline` 变短。
- 在〈陷阱项〉里写"这个还在用、不是陷阱"一类的澄清 — `ctx` 把本节逐行当成误用警告，澄清会变成假警告；`trap-noise` 按固定词表判红，引导语一律放进 `>` 引用块。
- 在 `checkCites` 里为依赖仓事实卡另加一条提前返回 — 于是有两处各自可能漂移的 cite 豁免判据，漂移方向是「本该校验的被放过」；豁免只有 `rootsOf` 返回 `null` 这一条路径。
- 域名取成另一个域名的前缀（较短者 ≥4 个字符）— `domain-dup` 判红；两个这样的域名也让人分不清一条事实该进哪张卡。

## 测试入口
在仓库根跑 `node --test test/ctx-domain-cards.test.mjs test/ctx-dependency-cards.test.mjs test/ctx-probe.test.mjs`：域卡读取与 `lint-cards` 七条规则、基线三态、`authority-unique` 在第一份；依赖仓事实卡的六条体检规则与 cite 豁免的成对样本在第二份；探针题型与判级在第三份。

## 确认
2026-09-22｜来源：`dw-system/skills/dw-code-facts/scripts/ctx/src/lint.js` 全文、`dw-system/skills/dw-code-facts/scripts/ctx/src/probe.js` 的 `answerProbe` / `selfCheck` / `evaluateGate` / `checkAuthorityUnique` / `entryDocs`、`dw-system/skills/dw-code-facts/scripts/ctx/src/cli.js` 的 `lint-cards` 与 `probe` 分支，`dw-system/skills/dw-code-facts/scripts/ctx/README.md` 的 §lint-cards 与 §probe
