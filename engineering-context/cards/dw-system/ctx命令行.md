# 业务域卡 — dw-system › ctx命令行

## 职责
代码事实层的查询与体检 CLI：读本地 `engineering-context/` 的卡片与 registry，按意图给出该读的卡与误用警告，体检卡片体例，并跑防腐门禁；零运行时依赖，Node ≥20，随 skill `dw-code-facts` 分发。

## 权威实现与对外接口

> 下表路径都在 `dw-system/skills/dw-code-facts/scripts/ctx/` 之下，cite 写全路径供 `lint-cards` 核对。

| 能力 / 入口 | 权威实现（cite） | 约束 |
|---|---|---|
| 分层 | `dw-system/skills/dw-code-facts/scripts/ctx/src/cli.js#main` | `cards.js` 纯读取解析；`commands.js` 命令与匹配；`cli.js` 只管 argv、路由、人读与 `--json` 双输出；`semantic.js` 语义兜底；`probe.js` 防腐门禁；`lint.js` 卡片体检。`package.json` 的 `bin.ctx` 指向 `src/cli.js`。 |
| 收尾与退出码 | `dw-system/skills/dw-code-facts/scripts/ctx/src/cli.js#run` | 收尾 MUST 用 `process.exitCode`：`console.log` 写管道是异步的，立刻终止进程会丢掉未 flush 的部分，`ctx … --json \| jq` 拿到截断输出而退出码仍为 0。未接住的异常转成一句中文提示 + 退出 1，不出 Node 栈——栈会被 agent 读成"ctx 坏了"而退回裸 grep。用法错误退出 2（`dw-system/skills/dw-code-facts/scripts/ctx/src/cli.js#UsageError`）。 |
| `--dir` 的两种含义 | `dw-system/skills/dw-code-facts/scripts/ctx/src/cli.js#resolveCtxDir` | `ctx init --dir` 指**目标项目目录**；其余命令的 `--dir` 指 `engineering-context` 目录，且不改项目根——probe 的交接题型与 `lint-cards` 的 cite 解析都另有自己的项目根口径（见下）。 |
| 地图卡读取 | `dw-system/skills/dw-code-facts/scripts/ctx/src/cards.js#loadCards` | 只读 `cards/<repo>.md`，文件名即 service 名，按 `## 标题` 切段，并带上该仓的域名清单 `domains`。读不出的卡跳过不抛栈，由 `dw-system/skills/dw-code-facts/scripts/ctx/src/cards.js#unreadableCards` 报出——不报的话"这张卡读不出来"会被看成"这个仓没登记"。 |
| 域卡读取 | `dw-system/skills/dw-code-facts/scripts/ctx/src/cards.js#loadDomainCards` | 读 `cards/<repo>/<域>.md`，目录名即 service 名、文件名即域名。没有同名地图卡的目录同样读出来：缺地图卡由 `lint-cards` 报，读取层不吞。 |
| 检索范围 | `dw-system/skills/dw-code-facts/scripts/ctx/src/cards.js#loadAllCards` | `discover`、`search-semantic`、`probe` 读地图卡 + 域卡；`list-services` 只列地图卡，域卡以 `domains` 挂在它名下。 |
| 确认日期 | `dw-system/skills/dw-code-facts/scripts/ctx/src/cards.js#cardFreshness` | 取〈确认〉小节 → 旧模板的〈Freshness / Provenance〉小节 → 全文第一个日期；都抽不到就是 `dw-system/skills/dw-code-facts/scripts/ctx/src/cards.js#UNDECLARED_FRESHNESS`，不假定新鲜。 |
| registry 解析 | `dw-system/skills/dw-code-facts/scripts/ctx/src/cards.js#loadRegistry`、`dw-system/skills/dw-code-facts/scripts/ctx/src/cards.js#REGISTRY_FIELDS` | 文件里**所有**首列表头是 `Capability` 或含「能力」的表都解析并合并；列按表头名映射、不按列序；最小合法形态三列，缺列留空不报错；表头下一行不是分隔行则整张表被忽略；含 `【】` 的占位行不算已登记（`dw-system/skills/dw-code-facts/scripts/ctx/src/cards.js#isRegistryPlaceholder`）。 |
| 空结果的诊断 | `dw-system/skills/dw-code-facts/scripts/ctx/src/cards.js#diagnoseRegistry`、`dw-system/skills/dw-code-facts/scripts/ctx/src/cli.js#REGISTRY_EMPTY_HINT` | "读不出数据行"分七种原因各配一句修复动作；`--dir` 写错与"registry 还没填"MUST 输出不同的话，并写出解析后的绝对路径（`dw-system/skills/dw-code-facts/scripts/ctx/src/cli.js#ctxDirMissingHint`）。`--json` 同样带 `diagnosis`。只用于提示，不参与任何路由判定。 |
| 权威冲突 | `dw-system/skills/dw-code-facts/scripts/ctx/src/cards.js#registryConflicts` | 同一能力登记了互相矛盾的权威实现时报冲突。比较键只看**权威实现**列：仅"权威仓库列一个填了一个没填"不算冲突，误报会训练人忽略这条告警。`discover` 只对本次命中的能力报冲突。 |
| cite 生成 | `dw-system/skills/dw-code-facts/scripts/ctx/src/cards.js#makeCite` | cite = path + anchor + 确认时间。 |
| discover | `dw-system/skills/dw-code-facts/scripts/ctx/src/commands.js#discover` | 结果分两路：registry 直接命中的能力条目、卡片命中；一张卡都没有也能用。registry 的「权威仓库」与地图卡文件名**严格相等**才给该地图卡加权，写岔不报错、只是静默失去加权；域卡只按自己的正文计分。命中卡的〈陷阱项〉逐行变成 out-of-scope 警告；cite 锚点指向命中段落。 |
| get-card | `dw-system/skills/dw-code-facts/scripts/ctx/src/commands.js#getCard` | 给了域先读域卡文件，没有才读地图卡里的同名 `## ` 小节。两处都没有时 MUST NOT 发 cite（`cite: null`、`missing`、`available` 同时列域卡与地图卡小节），CLI 退出 1。 |
| find-scenes / list-services | `dw-system/skills/dw-code-facts/scripts/ctx/src/commands.js#findScenes`、`dw-system/skills/dw-code-facts/scripts/ctx/src/commands.js#listServices` | `find-scenes` 排除 `scenes/README.md`（它汇集各场景关键词，几乎必命中），缺目录返回空数组；`list-services` 也列出没有卡的 registry 能力。 |
| init | `dw-system/skills/dw-code-facts/scripts/ctx/src/commands.js#initScaffold` | 默认生成整套骨架，已存在的文件不覆盖（`dw-system/skills/dw-code-facts/scripts/ctx/src/commands.js#writeIfAbsent`）；`--minimal` 只生成 registry 与 `.gitignore`。初始化一律跑完整形态，`--minimal` 留给"手工先落几行 registry"。 |
| 语义兜底 | `dw-system/skills/dw-code-facts/scripts/ctx/src/semantic.js#searchSemantic` | 字符 bigram 余弦相似 + 可选 `synonyms.md`（`dw-system/skills/dw-code-facts/scripts/ctx/src/semantic.js#expandQuery`）；结果带 freshness、cite、权威标记；`--as-of` 启用过期降权（标 stale 并 ×0.5）。它是 `discover` 未命中时的兜底，不是第一入口。 |
| 卡片体检 | `dw-system/skills/dw-code-facts/scripts/ctx/src/lint.js#lintCards` | 七条规则：固定小节、体积（`dw-system/skills/dw-code-facts/scripts/ctx/src/lint.js#BUDGET`）、带日期的小节名、cite 能否解析、域名近似重复、registry 指针、陷阱项噪音。违规的稳定标识是 `<规则>\|<相对路径>\|<键>`。新增违规退出 1。 |
| 小节名的机器定义 | `dw-system/skills/dw-code-facts/scripts/ctx/src/lint.js#DOMAIN_REQUIRED` | 两种卡的必备 / 可选小节名以 `lint.js` 的四个常量为准；`assets/context-layer/card-map.md`、`card-domain.md` 两份模板与 `代码事实纪律.md` §4.1 是同一份清单的人读形态，改名 MUST 三处同改。 |
| cite 规则的解析口径 | `dw-system/skills/dw-code-facts/scripts/ctx/src/lint.js#CITE_RE` | 只认反引号内的 `路径#符号` 与 `路径:行`，路径 MUST 带扩展名、符号里不能有空白。项目根取 `--dir` 所指目录的**父目录**，再加地图卡〈职责〉里 `> 根目录：` 声明的目录；声明 `外部` 的仓库整体跳过。符号按字面子串检索。含 `【】` 的行与代码围栏不检。 |
| 基线 | `dw-system/skills/dw-code-facts/scripts/ctx/src/lint.js#BASELINE_FILE` | 只经 `--init-baseline` 从无到有（已存在则拒绝、退出 2）、经 `--prune-baseline` 变短；没有任何入口能往既有基线里加条目——否则"新违规判红"可以靠改基线绕过。 |
| probe 题型 | `dw-system/skills/dw-code-facts/scripts/ctx/src/probe.js#answerProbe`、`dw-system/skills/dw-code-facts/scripts/ctx/src/probe.js#handoffKind` | A 类读 cards / registry（`capability-mapping`、`deprecated-trap`）；B 类读项目自身文件（`requirement-reachable`、`architecture-reachable`、`implementation-usable`、`rationale-traceable`、`authority-unique`），不依赖 context 层，类型名中英双写。B 类的项目根是 cwd。 |
| 权威面唯一 | `dw-system/skills/dw-code-facts/scripts/ctx/src/probe.js#checkAuthorityUnique` | 索引现行区里任意两份 `lifecycle` 为 `active`（或没写）的文档 MUST NOT 声明同一条 `authority_refs`；比对前去引号与反引号、折叠空白，`无` 不参与；现行区一篇文档都没链到判失败。 |
| probe 自检与判级 | `dw-system/skills/dw-code-facts/scripts/ctx/src/probe.js#selfCheck`、`dw-system/skills/dw-code-facts/scripts/ctx/src/probe.js#evaluateGate` | 真跑前植入必错样本，抓不到判 `GATE-BROKEN`，且自检先于 `NO-PROBE` 判定。棘轮双向：基线外新增失败 RED、失败全在基线内 AMBER、基线里已不再失败的编号同样 RED；blocking 探针零容忍；加权通过率低于地板 RED。退出码：GREEN / AMBER → 0，其余 → 1。 |
| probe 的入口与模块路径 | `dw-system/skills/dw-code-facts/scripts/ctx/src/probe.js#entryDocs`、`dw-system/skills/dw-code-facts/scripts/ctx/src/probe.js#modulePathCandidates` | 入口文档是项目根 `README*.md` 与 `docs/index.md`，真相源 ≤2 跳可达（`dw-system/skills/dw-code-facts/scripts/ctx/src/probe.js#reachTruthSource`）。模块路径只从反引号片段与相对链接里抽，判据是白名单（`dw-system/skills/dw-code-facts/scripts/ctx/src/probe.js#PATH_EXT`、`dw-system/skills/dw-code-facts/scripts/ctx/src/probe.js#BARE_PATH_NAME`）；抽不到任何路径判失败。 |
| 通过率历史 | `dw-system/skills/dw-code-facts/scripts/ctx/src/probe.js#writeHistory` | 写 `engineering-context/.index/`，是机器状态，由 init 生成的 `.gitignore` 忽略；`--minimal` 也 MUST 生成这份 `.gitignore`。 |

## 陷阱项

> 每行一条"这样写会悄悄坏掉"。

- 用 `process.exit()` 收尾 — 管道下 stdout 被截断而退出码正常，CI 拿到"截断后的合法前缀"；改用 `process.exitCode`。
- 把 `registryConflicts` 的比较键拼成 `repo :: api` — 同一行留在三列表与十列表两处、只差"权威仓库"列时会被报成权威层自相矛盾。
- 把 `no-dir` 与 `no-file` 两种诊断合报 — `--dir` 打错字时的输出与"registry 还没填过"一字不差且都退出 0，使用者据此判定"本项目没有卡片层"。
- 段落不存在时照样发一条 cite — 指向不存在锚点的 cite 比没有 cite 更糟，它让幻觉带着出处进 spec。
- 给同仓的每张域卡都加 registry 权重 — 同仓域卡吃到同一份加权，排序分不出哪个域真正相关；加权只给地图卡。
- 在 probe 的期望串里写 `repo :: api` 而 registry 是三列最小表 — 仓库维度不存在，这道题恒失败并污染棘轮基线；此时期望串只写权威实现。
- 把 probe 的模块路径判据改成"点号后若干位字母数字"的启发式 — 架构节里的 `path.join`、`process.env` 会被当成路径，好题变永久红点；白名单漏掉真实路径则让门禁恒绿，两头都 MUST 以白名单为准且 README 里 MUST NOT 抄第二份。
- 把 probe 全绿读成"文档还准" — 它只验可达性、`authority_refs` 非空与不重复，不读正文。
- 重写已有的 lint 基线文件来让体检转绿 — 等于把新违规一笔勾销；基线只许经 `--prune-baseline` 变短。
- 在〈陷阱项〉里写"这个还在用、不是陷阱"一类的澄清 — `ctx` 把本节逐行当成误用警告，澄清的话会变成假警告；`trap-noise` 规则按固定词表判红，引导语一律放进 `>` 引用块。
- 域名取成另一个域名的前缀（较短者 ≥4 个字符）— `domain-dup` 判红；两个这样的域名也让人分不清一条事实该进哪张卡。
- 把 `ctx` 的 `package.json` 里的 `version` 当成 `ctx` 的版本号 — 它不单独发布，版本就是分发包版本，看 skill 目录旁的 `dw-system.version`。

## 测试入口
在仓库根跑 `node --test test/ctx-*.test.mjs`：`test/ctx-cards.test.mjs`（解析与诊断）、`test/ctx-cli.test.mjs`（全部命令与退出码）、`test/ctx-domain-cards.test.mjs`（域卡读取、`lint-cards` 七条规则与基线、`authority-unique`）、`test/ctx-semantic.test.mjs`、`test/ctx-probe.test.mjs`；fixtures 在 `test/fixtures/ctx-engineering-context/`。

## 确认
2026-09-17｜来源：`dw-system/skills/dw-code-facts/scripts/ctx/` 的 `src/lint.js` 全文、`src/cards.js` 的读取与 registry 段、`src/commands.js` 的 `discover` / `getCard` / `listServices` / `initScaffold`、`src/cli.js` 的 `HELP` / `lint-cards` 分支 / `run`、`src/probe.js` 的 `checkAuthorityUnique`，`README.md`，以及 `test/ctx-domain-cards.test.mjs` 的用例清单
