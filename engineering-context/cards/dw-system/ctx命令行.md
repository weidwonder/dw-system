# 业务域卡 — dw-system › ctx命令行

## 职责
代码事实层的**查询** CLI：读本地 `engineering-context/` 的卡片与 registry，按意图给出该读的卡与误用警告，并给出每条事实的 cite；零运行时依赖，Node ≥20，随 skill `dw-code-facts` 分发。体检与防腐门禁（`lint-cards` / `probe`）在 `cards/dw-system/ctx体检与门禁.md`。

## 权威实现与对外接口

> 下表路径都在 `dw-system/skills/dw-code-facts/scripts/ctx/` 之下，cite 写全路径供 `lint-cards` 核对。

| 能力 / 入口 | 权威实现（cite） | 约束 |
|---|---|---|
| 分层 | `dw-system/skills/dw-code-facts/scripts/ctx/src/cli.js#main` | `cards.js` 纯读取解析；`commands.js` 命令与匹配；`cli.js` 只管 argv、路由、人读与 `--json` 双输出；`semantic.js` 语义兜底；`probe.js` 防腐门禁；`lint.js` 卡片体检。`package.json` 的 `bin.ctx` 指向 `src/cli.js`。 |
| 收尾与退出码 | `dw-system/skills/dw-code-facts/scripts/ctx/src/cli.js#run` | 收尾 MUST 用 `process.exitCode`：`console.log` 写管道是异步的，立刻终止会丢掉未 flush 的部分，`ctx … --json \| jq` 拿到截断输出而退出码仍为 0。未接住的异常转成一句中文提示 + 退出 1，不出 Node 栈。用法错误退出 2（`dw-system/skills/dw-code-facts/scripts/ctx/src/cli.js#UsageError`）。 |
| `--dir` 的两种含义 | `dw-system/skills/dw-code-facts/scripts/ctx/src/cli.js#resolveCtxDir` | `ctx init --dir` 指**目标项目目录**；其余命令的 `--dir` 指 `engineering-context` 目录，且不改项目根——probe 的交接题型与 `lint-cards` 的 cite 解析都另有自己的项目根口径（见下）。 |
| 地图卡读取 | `dw-system/skills/dw-code-facts/scripts/ctx/src/cards.js#loadCards` | 只读 `cards/<repo>.md`，文件名即 service 名，按 `## 标题` 切段，带该仓域名清单 `domains`，并写死 `origin: 'product'`。读不出的卡跳过不抛栈，由 `dw-system/skills/dw-code-facts/scripts/ctx/src/cards.js#unreadableCards` 报出。 |
| 域卡读取 | `dw-system/skills/dw-code-facts/scripts/ctx/src/cards.js#loadDomainCards` | 读 `cards/<repo>/<域>.md`，目录名即 service 名、文件名即域名，写死 `origin: 'product'`。没有同名地图卡的目录同样读出来：缺地图卡由 `lint-cards` 报，读取层不吞。目录项跟随软链接判类型（`dw-system/skills/dw-code-facts/scripts/ctx/src/cards.js#isDir`），多仓项目靠它共享卡片。 |
| 检索范围 | `dw-system/skills/dw-code-facts/scripts/ctx/src/cards.js#loadAllCards` | `discover`、`search-semantic`、`probe` 读三类卡（产品地图卡 → 产品域卡 → 依赖仓事实卡），每项带 `origin`；`list-services` 只列地图卡（上游不是本项目的服务），域卡以 `domains` 挂在它名下。 |
| 依赖仓事实卡读取 | `dw-system/skills/dw-code-facts/scripts/ctx/src/cards.js#loadDependencyCards` | 读 `dependencies/<上游名>/<域>.md`，目录名即上游名、文件名即域名，写死 `origin: 'dependency'`；形状与域卡一致，复用 `dw-system/skills/dw-code-facts/scripts/ctx/src/cards.js#isDir` 与同一套遍历，只下探一层——递归会让域名与路径失去唯一解。 |
| 依赖声明读取 | `dw-system/skills/dw-code-facts/scripts/ctx/src/cards.js#loadDependencies`、`dw-system/skills/dw-code-facts/scripts/ctx/src/cards.js#dependencyFreshness` | 读 `dependencies/*.md`（按文件名忽略 `README.md`，大小写不敏感），返回 `upstream` / `path` / `sections` / `raw`。它**不是卡对象**（无 `origin` / `domain`），MUST NOT 混进 `loadAllCards`——会让〈用到的部分〉表被 `discover` 当卡片正文计分。确认日期先取「确认时间」行、取不到才退回全文第一个日期：声明没有〈确认〉小节，套 `cardFreshness` 会取到头部形似日期的版本串。 |
| 确认日期 | `dw-system/skills/dw-code-facts/scripts/ctx/src/cards.js#cardFreshness` | 取〈确认〉小节 → 旧模板的〈Freshness / Provenance〉小节 → 全文第一个日期；都抽不到就是 `dw-system/skills/dw-code-facts/scripts/ctx/src/cards.js#UNDECLARED_FRESHNESS`，不假定新鲜。 |
| registry 解析 | `dw-system/skills/dw-code-facts/scripts/ctx/src/cards.js#loadRegistry`、`dw-system/skills/dw-code-facts/scripts/ctx/src/cards.js#REGISTRY_FIELDS` | 文件里**所有**首列表头是 `Capability` 或含「能力」的表都解析并合并；列按表头名映射、不按列序；最小三列，缺列留空不报错；表头下一行不是分隔行则整张表被忽略；含 `【】` 的占位行不算已登记（`dw-system/skills/dw-code-facts/scripts/ctx/src/cards.js#isRegistryPlaceholder`）。 |
| 空结果的诊断 | `dw-system/skills/dw-code-facts/scripts/ctx/src/cards.js#diagnoseRegistry`、`dw-system/skills/dw-code-facts/scripts/ctx/src/cli.js#REGISTRY_EMPTY_HINT` | "读不出数据行"分七种原因各配一句修复动作；`--dir` 写错与"registry 还没填"MUST 输出不同的话，并写出解析后的绝对路径（`dw-system/skills/dw-code-facts/scripts/ctx/src/cli.js#ctxDirMissingHint`）。`--json` 同样带 `diagnosis`；只用于提示，不参与路由判定。 |
| 权威冲突 | `dw-system/skills/dw-code-facts/scripts/ctx/src/cards.js#registryConflicts` | 同一能力登记了互相矛盾的权威实现时报冲突。比较键只看**权威实现**列：仅"权威仓库列一个填了一个没填"不算冲突。`discover` 只对本次命中的能力报冲突。 |
| cite 生成 | `dw-system/skills/dw-code-facts/scripts/ctx/src/cards.js#makeCite` | cite = path + anchor + 确认时间。 |
| 来源标记 | `dw-system/skills/dw-code-facts/scripts/ctx/src/commands.js#originTag` | 依赖仓卡片的人读输出一律带 `[依赖] ` 前缀（discover 行、semantic 行、out-of-scope 行、`dw-system/skills/dw-code-facts/scripts/ctx/src/commands.js#cardLabel`），`--json` 透传 `origin`。三处共用本函数，MUST NOT 各拼一次前缀。判据只读 `origin`，MUST NOT 按路径子串或名字猜。 |
| discover | `dw-system/skills/dw-code-facts/scripts/ctx/src/commands.js#discover` | 结果分两路：registry 直接命中的能力条目、卡片命中；一张卡都没有也能用。registry 的「权威仓库」与地图卡文件名**严格相等**才给该地图卡加权，写岔只是静默失去加权；域卡与依赖仓事实卡只按自己的正文计分。命中卡的〈陷阱项〉逐行变成 out-of-scope 警告；cite 锚点指向命中段落。 |
| get-card | `dw-system/skills/dw-code-facts/scripts/ctx/src/commands.js#getCard` | 四级查找、**顺序写死产品仓在前**：`cards/<名>/<域>.md` → `dependencies/<名>/<域>.md` → 地图卡同名 `## ` 小节 → 声明同名 `## ` 小节；MUST NOT 让调用方传参调整。不给域时有地图卡返回它（另有同名声明则带 `alsoDependency` 并提示一行），无产品卡而有声明则返回声明全文。四处都没有时 MUST NOT 发 cite（`cite: null`、`missing`、`available` 覆盖四处且依赖侧标 `[依赖]`），CLI 退出 1。返回对象**不加** `origin`：cite 路径已以 `dependencies/` 开头。 |
| find-scenes / list-services | `dw-system/skills/dw-code-facts/scripts/ctx/src/commands.js#findScenes`、`dw-system/skills/dw-code-facts/scripts/ctx/src/commands.js#listServices` | `find-scenes` 排除 `scenes/README.md`（几乎必命中），缺目录返回空数组；`list-services` 也列出没有卡的 registry 能力，但不列依赖仓事实卡。 |
| init | `dw-system/skills/dw-code-facts/scripts/ctx/src/commands.js#initScaffold` | 默认生成整套骨架，已存在的文件不覆盖（`dw-system/skills/dw-code-facts/scripts/ctx/src/commands.js#writeIfAbsent`）；`--minimal` 只生成 registry 与 `.gitignore`。初始化一律跑完整形态。 |
| 语义兜底 | `dw-system/skills/dw-code-facts/scripts/ctx/src/semantic.js#searchSemantic` | 字符 bigram 余弦相似 + 可选 `synonyms.md`（`dw-system/skills/dw-code-facts/scripts/ctx/src/semantic.js#expandQuery`）；结果带 freshness、cite、权威标记与 `origin`；`--as-of` 启用过期降权（标 stale 并 ×0.5）。它是 `discover` 未命中时的兜底，不是第一入口。 |

## 陷阱项

> 每行一条"这样写会悄悄坏掉"。

- 用 `process.exit()` 收尾 — 管道下 stdout 被截断而退出码正常，CI 拿到"截断后的合法前缀"；改用 `process.exitCode`。
- 把 `registryConflicts` 的比较键拼成 `repo :: api` — 同一行留在三列表与十列表两处、只差"权威仓库"列时会被报成权威层自相矛盾。
- 把 `no-dir` 与 `no-file` 两种诊断合报 — `--dir` 打错字时的输出与"registry 还没填过"一字不差且都退出 0，使用者据此判定"本项目没有卡片层"。
- 段落不存在时照样发一条 cite — 指向不存在锚点的 cite 比没有 cite 更糟，它让幻觉带着出处进 spec。
- 给同仓的每张域卡都加 registry 权重 — 同仓域卡吃到同一份加权，排序分不出哪个域真正相关；加权只给地图卡。
- 按路径子串或名字关键词推断一张卡是不是依赖仓的 — 换个目录名就静默失效；`origin` MUST 只由三个读取函数按各自的具名目录显式赋值，调用方只读不写。
- 把依赖声明混进 `loadAllCards` — 它的〈用到的部分〉表会被 `discover` 当成卡片正文计分，把「我们调了它哪些接口」这类本项目事实错报成外部依赖的事实。
- 把 `ctx` 的 `package.json` 里的 `version` 当成 `ctx` 的版本号 — 它不单独发布，版本就是分发包版本，看 `dw-system.version`。

## 测试入口
在仓库根跑 `node --test test/ctx-*.test.mjs`：`test/ctx-cards.test.mjs`（解析与诊断）、`test/ctx-cli.test.mjs`（全部命令与退出码）、`test/ctx-semantic.test.mjs`；依赖仓事实卡的读取层、`get-card` 四级查找与来源标记在 `test/ctx-dependency-cards.test.mjs`；fixtures 在 `test/fixtures/ctx-engineering-context/`。

## 确认
2026-09-22｜来源：`dw-system/skills/dw-code-facts/scripts/ctx/` 的 `src/cards.js` 读取层全文、`src/commands.js` 的 `getCard` / `discover` / `originTag` / `initScaffold`、`src/lint.js` 全文、`src/cli.js` 的 `get-card` 分支与两条人读行、`src/semantic.js` 的 `searchSemantic`，`README.md` 的 §card 格式约定与 §lint-cards，以及 `test/ctx-dependency-cards.test.mjs` 的用例清单
