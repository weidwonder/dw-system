---
lifecycle: active
superseded_by: ''
archived: ''
last_confirmed: '2026-09-22'
authority_refs:
  - '依赖仓事实卡的落点与文件名契约：engineering-context/dependencies/<上游名>/<域>.md'
  - 'dependencies/<上游名>.md 的职责集合：最小五项声明 + 业务域地图节'
  - 'ctx 读取层的卡片来源集合与 origin 标记（loadCards / loadDomainCards / loadDependencyCards / loadAllCards 的返回形状）'
  - 'ctx get-card 的查找顺序与 available 清单的来源标注'
  - 'ctx discover / search-semantic 结果里产品仓与依赖仓的区分标记（人读 [依赖] 前缀、--json 的 origin 字段）'
  - 'ctx lint-cards 对 dependencies/ 的扫描面：固定小节、体积、dated-heading、trap-noise、domain-dup、缺依赖声明、unreadable'
  - '依赖仓事实卡的 cite 豁免走「根目录：外部」同一分支'
  - '卡片体积上限的唯一定义处仍是 lint.js#BUDGET，依赖仓事实卡复用 BUDGET.domain'
---

# dw-system_技术 Spec — 依赖仓事实卡（`dependencies/<上游名>/<域>.md`）

> 本文规范词按 **RFC 2119** 解释：MUST / MUST NOT / SHOULD / SHOULD NOT / MAY 为规范性要求，其余为说明性文字。全文只声明这一次。
>
> 单仓库的详细技术规范：零上下文可动手、无占位符。
> **路径分工**：本文出现的文件路径与 `文件:行` 是**现状事实的锚点**（本次现读源码所得），不是实现指令；"改哪个文件、写什么代码"的落点归 coding plan 承载。

## 0. 阅读导引（MUST，前置）

- **一句话目的**：让"外部上游仓库的事实"在 `engineering-context/` 里有一个**与产品仓域卡同等待遇、但不和产品仓卡片平级摆放**的位置——`dependencies/<上游名>/<域>.md`——从而既能被 `ctx` 检索到、被逐行当误用警告读出来，又不会让读卡片的人把上游的事实误当成本项目的权威实现。

- **端到端场景**（覆盖主路径 + 关键异常）：
  1. **落卡**：aiudit_platform 读了 agent_fs 的向量库源码，得到"清理窗口 MUST NOT 为 0"这类只有读源码才知道的判断。它把这些事实写进 `engineering-context/dependencies/agent_fs/向量库.md`（四节：职责 / 权威实现与对外接口 / 陷阱项 / 确认），并在 `dependencies/agent_fs.md` 的〈业务域地图〉里登记一行"向量库 → 语义检索的存储层 → `dependencies/agent_fs/向量库.md`"。`dependencies/agent_fs.md` 的最小五项一字不动。
  2. **取用**：下一个零上下文 agent 要动索引流程，跑 `ctx discover "向量库 清理窗口"`，命中行写成 `• [依赖] agent_fs › 向量库 …`，out-of-scope 里出现"清理窗口 MUST NOT 为 0"这条陷阱。它一眼看出这是**外部依赖的事实**，不是本项目的实现，于是去改调用方而不是去改 agent_fs。
  3. **精确取**：`ctx get-card agent_fs 向量库` 直接返回那张事实卡全文并发 cite `dependencies/agent_fs/向量库.md#全文 @2026-09-03`。
  4. **入口唯一**：`ctx get-card agent_fs`（不给域）返回 `dependencies/agent_fs.md` 全文——最小五项 + 业务域地图都在那一份里，一个上游仍然只有一个入口文件。
  5. **异常：cite 指向不存在的文件**。事实卡里的 `packages/search/src/vector-store/store.ts#VectorStore` 在本项目里根本不存在（它是 agent_fs 的路径）。`ctx lint-cards` MUST 放过它，走的是既有的「根目录为外部」那一条分支，MUST NOT 新开第二条豁免。
  6. **异常：有事实卡目录、没有声明文件**。`dependencies/foo/` 下有卡而 `dependencies/foo.md` 不存在 → `ctx lint-cards` 判一条 `sections|dependencies/foo|缺依赖声明`，与产品仓"有域卡目录而缺地图卡"同一条规则名。

- **核心流程图**：

  ```mermaid
  flowchart TD
    A["engineering-context/"] --> B["cards/&lt;repo&gt;.md 地图卡"]
    A --> C["cards/&lt;repo&gt;/&lt;域&gt;.md 业务域卡"]
    A --> D["dependencies/&lt;上游名&gt;.md 依赖声明 + 业务域地图"]
    A --> E["dependencies/&lt;上游名&gt;/&lt;域&gt;.md 依赖仓事实卡"]
    B --> F["loadCards origin=product"]
    C --> G["loadDomainCards origin=product"]
    E --> H["loadDependencyCards origin=dependency"]
    F --> I["loadAllCards"]
    G --> I
    H --> I
    I --> J["discover / search-semantic / probe"]
    B --> K["getCard"]
    C --> K
    D --> K
    E --> K
    J --> L["输出按 origin 区分：人读 [依赖] 前缀、--json origin 字段"]
  ```

- **决策表**：

  | 输入 / 状态 | 条件 | 走向 / 处置 | 结果 |
  |---|---|---|---|
  | `ctx get-card <名>` | `cards/<名>.md` 存在 | 返回产品仓地图卡（现状不变） | 全文 + cite，退出 0 |
  | `ctx get-card <名>` | 无产品地图卡、无产品域卡，`dependencies/<名>.md` 存在 | 返回依赖声明全文 | 全文 + cite `dependencies/<名>.md#全文`，退出 0 |
  | `ctx get-card <名>` | 无产品地图卡，只有 `dependencies/<名>/` 下的事实卡 | 与产品侧"只有域卡没有地图卡"同一处置 | `cite: null` + `missing` + `available`，退出 1 |
  | `ctx get-card <名> <域>` | `cards/<名>/<域>.md` 存在 | 读产品域卡（现状不变） | 全文 + cite，退出 0 |
  | `ctx get-card <名> <域>` | 无产品域卡，`dependencies/<名>/<域>.md` 存在 | 读依赖仓事实卡 | 全文 + cite，退出 0 |
  | `ctx get-card <名> <域>` | 上两条都无，产品地图卡或依赖声明里有同名 `## 小节` | 读那个小节（产品侧优先） | 小节正文 + cite，退出 0 |
  | `ctx get-card <名> <域>` | 四处都没有 | 不发 cite | `missing` + 带来源标注的 `available`，退出 1 |
  | `ctx lint-cards` 遇到 `dependencies/<名>/<域>.md` | 任意 | 按业务域卡的四节 / 体积 / dated-heading / trap-noise / domain-dup 检 | 违规标识形如 `sections\|dependencies/<名>/<域>.md\|缺:陷阱项` |
  | `ctx lint-cards` 的 cite 规则遇到依赖仓事实卡 | 任意 | 与地图卡声明 `> 根目录：外部` 汇合到同一分支 | 整卡跳过 cite 校验 |

## 1. 范围

- **本仓库做什么**：给 `dw-system` 的 `dw-code-facts` skill 及其 `ctx` CLI 新增一个资产位——依赖仓事实卡 `engineering-context/dependencies/<上游名>/<域>.md`——并把读取层、`get-card`、`discover`、`search-semantic`、`lint-cards` 四条既有通路扩到这个位置；同时给 `dependencies/<上游名>.md` 加一节〈业务域地图〉，让一个上游仍然只有一个入口文件。

- **不做什么**（每条对应上面的一项"做"）：

  | 我们做 X | 我们不做 Y |
  |---|---|
  | 新增 `dependencies/<上游名>/<域>.md` 一个资产位 | 不为"将来可能还有别的资产位"抽象出通用的"卡片根目录列表"或插件式注册表——本次只有 `cards/` 与 `dependencies/` 两个具名来源 |
  | 依赖仓事实卡沿用业务域卡的四节与体积上限 | 不新增第四份模板文件；差异写进既有 `card-domain.md`（`dw-system/skills/dw-code-facts/assets/context-layer/card-domain.md:1-12`） |
  | 依赖仓事实卡进 `discover` / `search-semantic` / `probe` 的候选集 | 不进 `ctx list-services`：那条命令回答"本项目登记了哪些服务与能力"（`commands.js:238-244`），上游不是本项目的服务 |
  | 依赖仓事实卡的 cite 整卡跳过校验 | 不做"按路径归属分别校验"（同一张卡里本项目路径校验、上游路径跳过）——代价是依赖仓事实卡 MUST NOT 记本项目的调用点，调用点唯一的家是 `dependencies/<上游名>.md` 的〈用到的部分〉列（`assets/context-layer/dependency.md:15-18`） |
  | `dependencies/<上游名>.md` 新增〈业务域地图〉节 | 不把它改成地图卡的四节模板；`lint-cards` 的 `sections` 规则 MUST NOT 施加于依赖声明文件本身 |
  | `lint-cards` 判"有事实卡目录而无依赖声明文件" | 不判"某张事实卡没登记进〈业务域地图〉表"——产品侧也没有这条规则（`lint.js:167-171` 只判缺地图卡），两侧 MUST 保持对称 |
  | 检索输出区分产品仓与依赖仓 | 不对依赖仓卡片做分数惩罚或结果截断：标记已足够区分，降权会把真正相关的外部陷阱压到 top-N 之外 |
  | 体积上限复用 `BUDGET.domain` | 不新增任何体积数值常量，也不在新文档里再抄一遍数字 |
  | 事实卡进检索 | 不把依赖仓登记进 `capability-registry.md` 的「权威仓库」列：registry 回答"本项目的能力由谁权威实现"，`discover` 的 card 加权（`commands.js:91-93`）因此保持只对产品仓地图卡生效 |
  | 扩 `lint-cards` 的扫描面 | 不扩 `registry-pointer` 规则（`lint.js:131-133` 只认 `cards/….md`）：registry 不该指向依赖仓事实卡 |

- **依赖的上游 / 被依赖的下游**：本仓库（`dw-system`）无外部代码上游参与本次改动；下游是所有安装了本体系的目标项目（它们的 `engineering-context/` 由本 skill 的模板与 `ctx` 服务）。本次不升级任何上游版本，`engineering-context/dependencies/` 下无条目需要取交集。

### 既有系统清单（穷举不判断）

| 既有模块 / 机制 | 从哪知道它的（`文件:行`）| 本次可能怎么碰到 | 卡片补了吗 |
|---|---|---|---|
| `loadCards(ctxDir)` — 读 `cards/*.md` 地图卡，顺带把名下域名挂进 `domains` | `dw-system/skills/dw-code-facts/scripts/ctx/src/cards.js:74-85` | 返回值要多一个 `origin` 字段 | 已有卡片 `engineering-context/cards/dw-system/ctx命令行.md` |
| `loadDomainCards(ctxDir)` — 读 `cards/<repo>/<域>.md`，目录名即仓名、文件名即域名 | `scripts/ctx/src/cards.js:92-114` | 新增的 `loadDependencyCards` 按它的形状写；本函数加 `origin` | 同上 |
| `loadAllCards(ctxDir)` — 地图卡 + 域卡的平铺列表，是检索与 probe 的输入 | `scripts/ctx/src/cards.js:117-119` | 要把依赖仓事实卡并进来 | 同上 |
| `unreadableCards(ctxDir)` — 只扫 `cards/`，下探一层，供人读提示 | `scripts/ctx/src/cards.js:134-160` | 扫描面要扩到 `dependencies/` | 同上 |
| `cardFreshness(card)` — 〈确认〉小节 → 旧模板小节 → 全文第一个日期 | `scripts/ctx/src/cards.js:125-127` | 依赖声明文件没有〈确认〉小节，要按「确认时间」行取 | 同上 |
| `makeCite(cardPath, anchor, confirmedAt)` — `[cite: 路径#锚点 @日期]` | `scripts/ctx/src/cards.js:406-408` | 依赖仓事实卡的 cite 路径天然以 `dependencies/` 开头，无需改本函数 | 同上 |
| `readMarkdownDir(dir)` / `isDir(dir, e)` — 跟随符号链接判目录，读不出的文件跳过不抛 | `scripts/ctx/src/cards.js:35-62` | 新读取函数 MUST 复用，不另写一套遍历 | 同上 |
| `getCard(ctxDir, service, domain)` — 域卡文件优先、其次地图卡同名小节、两处都无则不发 cite | `scripts/ctx/src/commands.js:183-216` | 查找顺序要接上依赖仓两级 | 同上 |
| `discover(ctxDir, intent)` — 对 `loadAllCards` 全文计分，命中卡的〈陷阱项〉逐条进 out-of-scope | `scripts/ctx/src/commands.js:74-119` | 依赖仓事实卡随 `loadAllCards` 自动进候选；结果对象要带 `origin` | 同上 |
| `deprecationMarkers(card)` / `isProseLine(line)` — 抽〈陷阱项〉真实条目，跳过占位与说明行 | `scripts/ctx/src/commands.js:38-63` | 无需改：依赖仓事实卡的〈陷阱项〉节名与域卡相同 | 同上 |
| `cardLabel(card)` — 输出里指称一张卡，域卡写成 `仓库 › 域` | `scripts/ctx/src/commands.js:170-172` | 依赖仓卡要多一个前缀标记 | 同上 |
| discover 的 registry 加权：`card.domain ? [] : registry.filter(...)` | `scripts/ctx/src/commands.js:91-94` | 依赖仓事实卡都带 `domain`，天然不吃加权，本行不改 | 同上 |
| `listServices(ctxDir)` — 只列地图卡，域卡以 `domains` 挂在仓库下 | `scripts/ctx/src/commands.js:244-265` | 本次不改其返回集合；只有它打印的 `unreadableCards` 会因扫描面扩大而变长 | 同上 |
| `findScenes` 排除 `scenes/README.md` 的先例（索引文件不参与检索） | `scripts/ctx/src/commands.js:228` | `dependencies/README.md` 按同一条理由排除 | 同上 |
| `initScaffold` 建 `dependencies/` 目录并写 `DEPENDENCIES_README_STUB` | `scripts/ctx/src/commands.js:291-292`、`commands.js:429-453` | README 存根要提到新的事实卡位置 | 同上 |
| `searchSemantic` 的输入就是 `loadAllCards(ctxDir)` | `scripts/ctx/src/semantic.js:136` | 依赖仓事实卡自动进候选；结果对象要带 `origin` | 同上 |
| `BUDGET = { map: 8000, domain: 16000, registryCell: 300 }` | `scripts/ctx/src/lint.js:17` | 依赖仓事实卡复用 `BUDGET.domain`，本行不加字段 | 同上 |
| `MAP_REQUIRED` / `MAP_OPTIONAL` / `DOMAIN_REQUIRED` / `DOMAIN_OPTIONAL` 四张固定小节表 | `scripts/ctx/src/lint.js:12-15` | 依赖仓事实卡复用 `DOMAIN_REQUIRED` / `DOMAIN_OPTIONAL`，不新增第五张表 | 同上 |
| `declaredRoot(mapCard)` — 从地图卡〈职责〉里取 `> 根目录：<路径 \| 外部>` | `scripts/ctx/src/lint.js:64-68` | 依赖仓事实卡没有地图卡可查，要在同一处汇合 | 同上 |
| `rootsOf(service)` — `外部` 返回 `null`，否则给 `[项目根, 项目根/声明目录]` | `scripts/ctx/src/lint.js:149-153` | 签名要从 `service` 改成整张 card（要读 `origin`） | 同上 |
| `roots` 为 `null` 时整卡跳过 `checkCites` | `scripts/ctx/src/lint.js:164-165` | 这就是 cite 豁免的唯一实现点，依赖仓事实卡 MUST 复用它 | 同上 |
| `checkCites(card, roots)` — 路径存在 / `#符号` 可检索 / `:行` 不越界，占位行与围栏不检 | `scripts/ctx/src/lint.js:72-96` | 本函数不改 | 同上 |
| `sections\|cards/<service>\|缺地图卡` — 有域卡目录而无同名地图卡 | `scripts/ctx/src/lint.js:167-171` | 依赖侧按同一形态判"缺依赖声明" | 同上 |
| `violation(rule, file, key)` — 稳定标识 `<规则>\|<相对路径>\|<键>`，路径以 `engineering-context/` 为根、统一正斜杠 | `scripts/ctx/src/lint.js:19-23` | 依赖仓的违规路径以 `dependencies/` 开头，与 `cards/` 天然不撞 | 同上 |
| 基线机制：`cards-lint-baseline.json`，只经 `--init-baseline` 从无到有、`--prune-baseline` 变短，**没有任何入口能往既有基线里加条目** | `scripts/ctx/src/lint.js:4-5`、`lint.js:186-221` | 扫描面扩大会产生基线外新违规 → 存量项目判红 | 同上 |
| `splitSuggestions(ctxDir)` — 首次体检时给单文件卡的按域拆分建议 | `scripts/ctx/src/lint.js:238-247` | 本次不扩到依赖侧 | 同上 |
| `ctx probe` 的 A 类题型输入是 `loadAllCards(ctxDir)` | `scripts/ctx/src/cli.js:283` | 依赖仓事实卡的〈陷阱项〉随之可作 `deprecated-trap` 的证据与门禁自检样本 | 同上 |
| `get-card` CLI：`missing` 时不发 cite、退出 1；否则打印全文 + cite | `scripts/ctx/src/cli.js:205-224` | 输出形状不变，`available` 内容要带来源标注 | 同上 |
| discover / search-semantic 的人读行格式 | `scripts/ctx/src/cli.js:196`、`cli.js:276` | 要插入 `[依赖]` 前缀 | 同上 |
| `ctx` README §card 格式约定第一条（地图卡 / 域卡的落点与谁读它们） | `scripts/ctx/README.md:116` | 要补依赖仓事实卡一行 | 同上 |
| `ctx` README 的 `budget` 与 `cite` 规则行（含"声明 `> 根目录：外部` 的仓库跳过本规则"） | `scripts/ctx/README.md:214`、`README.md:216` | 要补依赖仓事实卡的口径 | 同上 |
| `ctx probe` 铁律 1「门禁自检」：把 card 废弃段里的一条实体谎称 canonical 作为必错样本 | `scripts/ctx/README.md:298` | 样本来源集合扩大 | 同上 |
| `代码事实纪律.md` §4.1 两种卡的表格与"新事实先找所属的域" | `dw-system/skills/dw-code-facts/references/代码事实纪律.md:79-87` | 要加第三行 | 同上 |
| `代码事实纪律.md` §4.2 体积上限一句（地图卡 8,000 / 域卡 16,000 / registry 单格 300） | `references/代码事实纪律.md:111` | 要说明依赖仓事实卡与域卡同上限 | 同上 |
| `代码事实纪律.md` §5 cite 纪律：`路径#符号` 为主，"源码不在本项目里的仓库声明 `> 根目录：外部`" | `references/代码事实纪律.md:116` | 要补依赖仓事实卡不必声明、按位置即豁免 | 同上 |
| `代码事实纪律.md` §10.2 依赖声明的最小五项、`<上游名>` 取名与 `/` → `__` 替换、"MUST NOT 造出子目录" | `references/代码事实纪律.md:175-187` | "MUST NOT 造出子目录"一句 MUST 改写——本次正是要造这一层子目录 | 同上 |
| `card-map.md` 模板：`> 根目录：…外部` 行、〈业务域地图〉三列表、〈上下游〉的下游指针句 | `assets/context-layer/card-map.md:16`、`card-map.md:25-27`、`card-map.md:44` | 〈业务域地图〉表的列形态被依赖声明复用 | 同上 |
| `card-domain.md` 模板：四节固定、上限 16,000、cite 形态要求 | `assets/context-layer/card-domain.md:6-7`、`card-domain.md:20` | 顶部要加"落在 `dependencies/` 下时的三点差异" | 同上 |
| `dependency.md` 模板：五项声明、`/` → `__`、〈用到的部分〉三列表 | `assets/context-layer/dependency.md:3-18` | 要加〈业务域地图〉节 | 同上 |
| `test/ctx-domain-cards.test.mjs` — 域卡读取 / 七条体检规则 / 基线三态 / 软链接 / 单文件卡的既有用例形态（`withProject` 构造临时项目） | `test/ctx-domain-cards.test.mjs:56-71`、`test/ctx-domain-cards.test.mjs:145-157`、`test/ctx-domain-cards.test.mjs:185-193` | 新测试照它的形态写 | 同上 |
| `test/doc-budgets.json` — 本仓库**规范文本**（`SKILL.md`、`references/**`、`CLAUDE.md`、索引行长）的体积上限清单 | `test/doc-budgets.json:1-67`、`test/doc-budgets.test.mjs:12` | 卡片体积上限不在其中；本次不改这份清单 | 同上 |
| `dw-system/skills/AGENTS.md:24` 明确"体积上限只在 `test/doc-budgets.json` 与 `ctx` 的 `lint.js`" | `dw-system/skills/AGENTS.md:24` | 这是"卡片上限住在 `lint.js`"的现行口径出处 | 同上 |
| 真实现场：`aiudit_platform` 的 `engineering-context/cards/agent_fs.md`（17,957 字节，非固定小节名）与 `engineering-context/dependencies/agent_fs.md`（7,935 字节，五项齐全），该项目**没有** `cards-lint-baseline.json` | `/Users/weidwonder/projects/aiudit_platform/engineering-context/cards/agent_fs.md:1`、`/Users/weidwonder/projects/aiudit_platform/engineering-context/dependencies/agent_fs.md:1` | 迁移样本；17,957 字节超出 `BUDGET.domain`，见 §8.1 | 已有卡片（该项目自己的） |

> 本次读了源码才搞清楚的模块，已全部落在本仓库既有卡片 `engineering-context/cards/dw-system/ctx命令行.md` 的覆盖范围内（该卡第 28 行已登记 `lint.js#lintCards` 与七条规则）。实现阶段改动 `ctx` 的权威面后，MUST 就地刷新那张卡并更新〈确认〉，随本次分支提交。

### 1.1 功能需求（MUST 编号）

| 编号 | 需求 |
|---|---|
| FR-001 | `engineering-context/` 新增资产位**依赖仓事实卡**，落点 `dependencies/<上游名>/<域>.md`：目录名即上游名、文件名即域名。`<上游名>` 的写法沿用既有依赖声明的取名规则（依赖清单文件里的包名 / 模块名，服务类上游取 registry 里的仓库名，含 `/` 的 npm scoped 包把 `/` 写成 `__`）。 |
| FR-002 | `dependencies/<上游名>.md` 保留最小五项声明不变，并新增一节〈业务域地图〉，列出该上游有哪几张事实卡（三列：业务域 / 一句话 / 事实卡路径）。它 MUST NOT 因此改用地图卡的四节模板，`lint-cards` 的 `sections` 规则 MUST NOT 施加于它。 |
| FR-003 | 读取层能读出依赖仓事实卡：新增 `loadDependencyCards(ctxDir)`，返回形状与 `loadDomainCards` 一致（`service` / `domain` / `path` / `sections` / `raw`），复用既有的目录遍历与符号链接处理，读不出的文件跳过不抛。 |
| FR-004 | 每张卡的返回对象带 `origin` 字段，闭集两值：`product`（来自 `cards/`）与 `dependency`（来自 `dependencies/`）。判定 MUST 来自读取函数的显式赋值，MUST NOT 由调用方按路径字符串或名字猜。 |
| FR-005 | `loadAllCards(ctxDir)` 的返回集合包含依赖仓事实卡，顺序为：产品地图卡 → 产品域卡 → 依赖仓事实卡。 |
| FR-006 | `ctx get-card <名>`（不给域）在本项目没有 `cards/<名>.md`、也没有 `cards/<名>/` 下任何域卡时，返回 `dependencies/<名>.md` 全文并发 cite。 |
| FR-007 | `ctx get-card <名> <域>` 的查找顺序为：`cards/<名>/<域>.md` → `dependencies/<名>/<域>.md` → `cards/<名>.md` 里的同名 `## 小节` → `dependencies/<名>.md` 里的同名 `## 小节`；四处皆无时不发 cite、退出 1。 |
| FR-008 | `get-card` 的 `missing` 分支返回的 `available` 清单同时覆盖上述四处来源，且逐项标出来源：依赖侧条目写成 `<名字>[依赖]`。 |
| FR-009 | `ctx discover` 的候选集包含依赖仓事实卡；命中的依赖仓事实卡，其〈陷阱项〉逐条进 out-of-scope，与产品域卡同等待遇。 |
| FR-010 | `ctx search-semantic` 的候选集包含依赖仓事实卡，逐 `## 段落` 分块、带 freshness 与 `authority` 标记，与产品卡同等待遇。 |
| FR-011 | `discover` 与 `search-semantic` 的结果 MUST 能区分产品仓与依赖仓：`--json` 每个结果对象带 `origin` 字段；人读输出在卡片名前加 `[依赖]` 前缀（产品仓无前缀）。out-of-scope 警告里的卡片指称同样带该前缀。 |
| FR-012 | `ctx lint-cards` 把依赖仓事实卡纳入这几条既有规则：`sections`（用域卡那套必备四节 + 三个可选节）、`budget`（复用域卡上限）、`dated-heading`、`trap-noise`、`domain-dup`（同一上游内比较）。 |
| FR-013 | `ctx lint-cards` 的 `cite` 规则对依赖仓事实卡整卡跳过，且 MUST 与地图卡声明 `> 根目录：外部` 汇合到同一条实现分支（`rootsOf` 返回 `null`），MUST NOT 新增第二条豁免路径。依赖声明文件与依赖仓事实卡都不需要写 `> 根目录：外部`。 |
| FR-014 | `ctx lint-cards` 在存在 `dependencies/<名>/` 目录而不存在 `dependencies/<名>.md` 时判一条违规，规则名沿用 `sections`，标识形如 `sections\|dependencies/<名>\|缺依赖声明`。 |
| FR-015 | `unreadableCards(ctxDir)` 的扫描面扩到 `dependencies/`：`dependencies/*.md`（声明文件）与 `dependencies/<名>/*.md`（事实卡）读不出时各记一条，路径以 `engineering-context/` 为根。 |
| FR-016 | `dependencies/README.md`（`ctx init` 生成的目录说明）MUST NOT 被当作依赖声明或事实卡入口：读取层按文件名忽略它（大小写不敏感），与 `findScenes` 忽略 `scenes/README.md` 同一条理由。 |
| FR-017 | 依赖声明的新鲜度取「确认时间」行的日期；取不到才退回"全文第一个日期"。由此发出的 cite 形如 `dependencies/<名>.md#全文 @YYYY-MM-DD`。 |
| FR-018 | 依赖仓事实卡的体积上限复用业务域卡的数值，MUST NOT 在代码里新增第二个体积常量，也 MUST NOT 在新增或改写的文档里再抄一遍数字（改写既有已抄数字的句子时保持原样，不扩散）。 |
| FR-019 | 文档与模板落点：`assets/context-layer/card-domain.md` 顶部加一段"落在 `dependencies/<上游名>/<域>.md` 时的三点差异"；`assets/context-layer/dependency.md` 加〈业务域地图〉节；`scripts/ctx/README.md` 的 §card 格式约定与 `lint-cards` 规则表补依赖仓口径；`references/代码事实纪律.md` §4.1 / §5 / §10.2 补依赖仓事实卡并改写"MUST NOT 造出子目录"一句；`commands.js` 的 `DEPENDENCIES_README_STUB` 同步。MUST NOT 新增第四份模板文件。 |
| FR-020 | 测试落在新文件 `test/ctx-dependency-cards.test.mjs`，形态照 `test/ctx-domain-cards.test.mjs`：每条新规则各配一个必红样本与一个必绿样本。 |

**编号规则（MUST）**：格式 `FR-###` / `AC-###`（前缀 + 三位零填充）；编号永不复用、永不重排，新增一律接最大号；删除的需求原地保留编号并把需求列改写成"**已撤销** —— 原因"；`FR-###` / `AC-###` 与 §6 的 `Invariant N:` 是两套独立编号。

## 2. 数据模型 / 数据结构

### 2.1 目录形态

```
engineering-context/
├── cards/
│   ├── <repo>.md                 地图卡（origin=product，四节 + 可选节，上限 BUDGET.map）
│   └── <repo>/<域>.md            业务域卡（origin=product，四节 + 可选节，上限 BUDGET.domain）
├── dependencies/
│   ├── README.md                 目录说明，不参与解析
│   ├── <上游名>.md                依赖声明：最小五项 + 〈业务域地图〉（不是卡，不受 sections 规则约束）
│   └── <上游名>/<域>.md           依赖仓事实卡（origin=dependency，四节 + 可选节，上限同域卡）
└── …
```

- **稳定标识**：一张卡的稳定标识是它相对 `engineering-context/` 的路径（统一正斜杠），`violation()` 与 `makeCite()` 都用它。`dependencies/` 前缀使依赖仓的违规与 cite 天然与 `cards/` 区分，基线里也不会撞。
- **归一化**：`<上游名>` 与 `<域>` 一律取**文件系统上的字面名**，MUST NOT 做大小写折叠或标点归一——`get-card` 的匹配是严格相等（`commands.js:184`、`commands.js:200`），归一化会让"写错名字"从可诊断的 `missing` 变成静默命中另一张卡。唯一的归一化发生在 `domain-dup` 规则内部（`lint.js:98` 的 `normName`），那里只用于报重复，不用于路由。

### 2.2 卡片对象（读取层返回形状）

| 字段 | 类型 | 地图卡 | 产品域卡 | 依赖仓事实卡 |
|---|---|---|---|---|
| `service` | string | `<repo>` | `<repo>` | `<上游名>` |
| `domain` | string \| 缺席 | 缺席 | `<域>` | `<域>` |
| `origin` | `'product'` \| `'dependency'` | `product` | `product` | `dependency` |
| `path` | string | `cards/<repo>.md` | `cards/<repo>/<域>.md` | `dependencies/<上游名>/<域>.md` |
| `sections` | Record<string,string> | 按 `## 标题` 切 | 同左 | 同左 |
| `raw` | string | 全文 | 全文 | 全文 |
| `domains` | string[] | 名下域名 | 缺席 | 缺席 |

- `origin` 是**显式声明**：由三个读取函数各自写死自己的值，调用方一律读这个字段做区分。MUST NOT 用"路径里有没有 `dependencies` 子串"或"名字里带不带某个字样"来判——那是启发式，换个目录名就静默失效。
- `domains` 只在地图卡上：依赖声明文件不是卡对象，它名下有哪几张事实卡写在它正文的〈业务域地图〉节里，由人维护，解析层不生成。

### 2.3 依赖声明文件（`dependencies/<上游名>.md`）的节

| 节 | 必备 | 内容 |
|---|---|---|
| （无标题的头部列表） | MUST | `- 上游与当前版本：…` / `- 确认时间：YYYY-MM-DD` |
| `## 用到的部分` | MUST | 三列表：接口名 / 调用点（`文件:行`）/ 注意事项（现状不变） |
| `## 业务域地图` | 有事实卡时 MUST，无事实卡时 MAY 整节删掉 | 三列表：业务域 / 一句话 / 事实卡（写成 `` `dependencies/<上游名>/<域>.md` ``） |

节名取〈业务域地图〉而不是另起一个名字：地图卡用的就是这个名字与这套三列（`assets/context-layer/card-map.md:25-27`），两处同名同形，读卡的人与写卡的人不必学第二套说法。

### 2.4 检索结果对象新增字段

`discover().cards[]`、`searchSemantic().results[]` 各新增：

| 字段 | 值域 | 说明 |
|---|---|---|
| `origin` | `'product'` \| `'dependency'` | 直接透传卡片对象的 `origin` |

`get-card` 的返回对象不新增字段：它的 `cite` 路径已经以 `dependencies/` 开头，调用方据此即知来源；再加一个字段属于同一事实的第二份表示。

## 3. 命令行为契约

> 下表只列**与现状不同**的行为。未列出的一律不变。

### 3.1 `ctx get-card <名> [域]`

| 场景 | 现状 | 本次 |
|---|---|---|
| 无域，有 `cards/<名>.md` | 返回地图卡全文 + cite，退出 0 | 不变。若同时存在 `dependencies/<名>.md`，在人读输出末尾追加一行提示 `（另有同名依赖声明：dependencies/<名>.md）`，`--json` 增加 `alsoDependency: true`；产品仓优先（见 §8.1 第 1 行） |
| 无域，无产品卡，有 `dependencies/<名>.md` | 报 `未找到服务 card：<名>`，退出 1 | 返回该声明全文 + cite `dependencies/<名>.md#全文 @<确认时间>`，退出 0 |
| 无域，无产品卡，无 `dependencies/<名>.md`，但有 `dependencies/<名>/` 下的事实卡 | 退出 1 | 与产品侧"只有域卡没有地图卡"同一处置（`commands.js:188-196`）：`cite: null`、`missing: true`、`available` 列出事实卡域名，退出 1 |
| 有域，命中 `cards/<名>/<域>.md` | 返回域卡 | 不变 |
| 有域，未命中产品域卡，命中 `dependencies/<名>/<域>.md` | 退出 1 或回落到地图卡小节 | 返回事实卡全文 + cite `dependencies/<名>/<域>.md#全文 @<确认时间>`，退出 0 |
| 有域，四处皆无 | `missing`，`available` = 产品域卡名 + 地图卡小节名 | `missing`，`available` = 产品域卡名 + `<事实卡域名>[依赖]` + 地图卡小节名 + `<声明小节名>[依赖]`，退出 1 |

**查找顺序固定为产品仓在前**（FR-007）。理由：卡片层回答"本项目该信哪个实现"，本项目自己的事实是第一顺位；依赖仓事实是"我调的那个东西是什么样"，是第二顺位。顺序写死在一个函数里，MUST NOT 让调用方传参调整。

### 3.2 `ctx discover "<意图>"`

- 候选集 = `loadAllCards()`，因而包含依赖仓事实卡（FR-009）。
- 计分逻辑不变（`commands.js:88-97`）：依赖仓事实卡都带 `domain`，按既有分支不吃 registry 加权。
- 人读每行格式：产品仓 `• <service>[ › <domain>]  (score N) — <why>`；依赖仓 `• [依赖] <service> › <domain>  (score N) — <why>`。
- out-of-scope 里的卡片指称：产品仓 `<service> › <domain>: …`；依赖仓 `[依赖] <service> › <domain>: …`。
- `--json`：`cards[]` 每项多 `origin`。

标记选 ASCII 方括号 `[依赖]` 而不是 emoji 或全角符号：这一行同时要被人读、被 agent 读、被 `grep` 过滤，也要在 Windows 控制台不变形（`ctx` 的跨平台口径见 `scripts/ctx/README.md:51-58`）。

### 3.3 `ctx search-semantic "<q>"`

- 候选集同上（FR-010）。分块、`authority` 判定、freshness 降权逻辑一律不变（`semantic.js:138-165`）。
- 人读每行：产品仓 `• <service>[/<domain>] › <section>  (score) [flags]`；依赖仓 `• [依赖] <service>/<domain> › <section>  (score) [flags]`。
- `--json`：`results[]` 每项多 `origin`。

### 3.4 `ctx lint-cards`

新增或扩大的检查：

| 规则 | 施加对象 | 判据 | 违规标识示例 |
|---|---|---|---|
| `sections` | 依赖仓事实卡 | 复用 `DOMAIN_REQUIRED` / `DOMAIN_OPTIONAL`（`lint.js:14-15`） | `sections\|dependencies/agent_fs/向量库.md\|缺:陷阱项` |
| `sections` | 依赖仓目录 | 有 `dependencies/<名>/` 而无 `dependencies/<名>.md` | `sections\|dependencies/agent_fs\|缺依赖声明` |
| `budget` | 依赖仓事实卡 | `Buffer.byteLength(raw,'utf8') > BUDGET.domain` | `budget\|dependencies/agent_fs/向量库.md\|` |
| `dated-heading` | 依赖仓事实卡 | 同域卡 | `dated-heading\|dependencies/agent_fs/向量库.md\|2026-08-20 修复` |
| `trap-noise` | 依赖仓事实卡 | 同域卡 | `trap-noise\|dependencies/agent_fs/向量库.md\|<行前 80 字>` |
| `domain-dup` | 同一上游内的事实卡域名 | 同产品仓（`lint.js:100-113`） | `domain-dup\|dependencies/agent_fs\|向量库~向量库历史` |
| `unreadable` | `dependencies/` 下读不出的 `.md` | 同 `cards/`（`lint.js:148`） | `unreadable\|dependencies/agent_fs/向量库.md\|` |
| `cite` | 依赖仓事实卡 | **整卡跳过**（`rootsOf` 返回 `null`） | 不产生 |

不施加的：`sections` 不检 `dependencies/<名>.md` 本身；`registry-pointer` 不扩到 `dependencies/`；`splitSuggestions` 不扩到依赖侧。

`--init-baseline` / `--prune-baseline` / 基线 JSON 损坏的处置一律不变（`lint.js:186-221`）。

### 3.5 不变的命令

`ctx init`（除 README 存根文案外不改生成物清单）、`ctx list-services`（返回集合不变，只有它打印的 `unreadableCards` 可能变长）、`ctx find-scenes`、`ctx probe` 的题型与判级规则。

## 4. 核心逻辑 / 流程

### 4.1 读取层（`cards.js`）

```
loadDependencyCards(ctxDir):
    depDir ← ctxDir/dependencies
    若 depDir 读不出 → 返回 []
    out ← []
    对 depDir 下每个条目 e：
        若 isDir(depDir, e) 为假 → 跳过          # 声明文件与 README 不是事实卡
        对 readMarkdownDir(depDir/e.name) 里每个 {name, raw}：
            out.push({
              service: e.name, domain: name, origin: 'dependency',
              path: 'dependencies/' + e.name + '/' + name + '.md',
              sections: splitSections(raw), raw
            })
    返回 out
```

- `isDir` / `readMarkdownDir` MUST 复用既有实现（`cards.js:35-62`）：跟随符号链接、读不出的文件跳过不抛——这两条对依赖侧同样成立，多仓共享依赖仓事实卡时会用到软链接。
- `loadCards` / `loadDomainCards` 各自在返回对象里加 `origin: 'product'`。
- `loadAllCards(ctxDir)` 改为 `[...loadCards, ...loadDomainCards, ...loadDependencyCards]`。

新增 `loadDependencies(ctxDir)`：读 `dependencies/*.md`（忽略 `README.md`，大小写不敏感），返回 `{ upstream, path, sections, raw }`，供 `getCard` 与 `lint` 使用。它**不是**卡对象（没有 `origin` / `domain`），MUST NOT 混进 `loadAllCards`——混进去意味着依赖声明的〈用到的部分〉表会被 `discover` 当成卡片正文计分，把"我们调了它哪些接口"这类本项目事实错报成外部依赖事实。

新增 `dependencyFreshness(raw)`：先取 `^-?\s*确认时间[:：]\s*(\d{4}-\d{2}-\d{2})`，取不到退回 `confirmedAtOf(raw)`（`cards.js:397-400`）。它服务 FR-017：依赖声明没有 `## 确认` 小节，`cardFreshness` 会落到"全文第一个日期"，而声明头部的「上游与当前版本」行可能带形似日期的版本串，取错就会发出一条日期错误的 cite。

### 4.2 `getCard`（`commands.js`）

```
getCard(ctxDir, name, domain):
    mapCard      ← loadCards(ctxDir) 中 service == name 者
    domainCards  ← loadDomainCards(ctxDir) 中 service == name 者
    depCards     ← loadDependencyCards(ctxDir) 中 service == name 者
    dep          ← loadDependencies(ctxDir) 中 upstream == name 者

    若 四者皆空 → 返回 null                      # CLI 打印"未找到服务 card"并退出 1

    若 未给 domain：
        若 mapCard 存在 → 返回 {content: mapCard.raw, cite: mapCard.path#全文 @cardFreshness,
                                alsoDependency: (dep 存在)}
        若 domainCards 为空且 dep 存在 → 返回 {content: dep.raw,
                                cite: dep.path#全文 @dependencyFreshness}
        否则 → 返回 missing，available = domainCards 域名 ∪ depCards 域名标 [依赖]
    # 给了 domain，按 §3.1 的四级顺序
    若 domainCards 中有 domain → 返回它
    若 depCards    中有 domain → 返回它
    若 mapCard.sections[domain] 存在 → 返回该小节，cite 指向地图卡
    若 dep.sections[domain] 存在 → 返回该小节，cite 指向 dep.path
    否则 → 返回 missing，available 按 §3.1 末行拼装
```

**设计自检**：本节没有引入新层或新配置项。新增的两个函数（`loadDependencyCards` / `loadDependencies`）各自服务 FR-003 与 FR-006，新增的一个字段（`origin`）服务 FR-004/FR-011；三者都指得到具体的 `FR-###`，都解决"依赖仓资料检索不到 / 区分不出"这一个问题。没有为"将来别的资产位"留抽象接口——YAGNI。

### 4.3 `lint`（`lint.js`）

```
lintCards(ctxDir):
    maps    ← loadCards(ctxDir)
    domains ← loadDomainCards(ctxDir)
    deps    ← loadDependencyCards(ctxDir)
    found   ← unreadableCards(ctxDir) 逐条转成 violation('unreadable', …)

    rootsOf(card):                                 # 签名从 service 改成整张 card
        若 card.origin == 'dependency' → 返回 null # 与 `> 根目录：外部` 同一分支
        declared ← declaredRoot(maps 中 service == card.service 者)
        若 declared == '外部' → 返回 null
        …其余不变

    maps    逐张：checkSections(MAP_REQUIRED, MAP_OPTIONAL)；raw > BUDGET.map → budget
    domains 逐张：checkSections(DOMAIN_REQUIRED, DOMAIN_OPTIONAL)；raw > BUDGET.domain → budget
    deps    逐张：checkSections(DOMAIN_REQUIRED, DOMAIN_OPTIONAL)；raw > BUDGET.domain → budget
    [...maps, ...domains, ...deps] 逐张：checkDatedHeadings + checkTrapNoise
                                        roots ← rootsOf(card)；roots 非 null 才 checkCites
    产品仓：有域卡目录而无地图卡 → sections|cards/<service>|缺地图卡（不变）
            同仓域名近似重复 → domain-dup（不变）
    依赖仓：deps 的每个 service，dependencies/<service>.md 不存在
                                → sections|dependencies/<service>|缺依赖声明
            同一上游内域名近似重复 → domain-dup|dependencies/<service>|…
    checkRegistry(ctxDir)（不变）
```

`unreadableCards(ctxDir)` 的扫描函数已经是"给定目录 + 前缀 + 是否下探一层"的形态（`lint.js:138-157`），扩面的做法是对 `dependencies/` 再调一次同一个 `scan`，前缀写 `dependencies/`。MUST NOT 复制第二份遍历实现。

**cite 豁免为什么复用 `rootsOf` 返回 `null` 这一条分支**：现行实现里，"这张卡的源码不在本项目里"这件事只有一个表达——`rootsOf` 给不出根目录（`lint.js:150-152`），于是 `checkCites` 整卡不跑（`lint.js:164-165`）。地图卡的 `> 根目录：外部` 是把这个状态**显式声明**出来的一种写法；依赖仓事实卡则由它所在的目录契约直接蕴含同一状态（`dependencies/` 按定义装的就是外部上游，见 `references/代码事实纪律.md:175`）。两者在 `rootsOf` 里汇合成同一个 `null`，下游只有一条豁免路径。若改成在 `checkCites` 里另加一个 `if (card.origin === 'dependency') return []`，就有了两处各自可能漂移的豁免判据——那正是 DRY 要挡住的。

### 4.4 输出层（`commands.js` / `cli.js`）

`cardLabel(card)` 改为：

```
cardLabel(card):
    base ← card.domain ? `${card.service} › ${card.domain}` : card.service
    返回 card.origin == 'dependency' ? `[依赖] ${base}` : base
```

`cli.js` 的 discover 行（`cli.js:196`）与 semantic 行（`cli.js:276`）改为走同一个标记函数，MUST NOT 在三处各拼一次前缀字符串。

### 4.5 体积上限的单点

依赖仓事实卡的上限就是 `BUDGET.domain`（`lint.js:17`），**不新增字段、不新增常量**（FR-018）。本仓库里卡片体积上限的唯一定义处是 `lint.js:17`，这与 `dw-system/skills/AGENTS.md:24` 的现行口径一致（该行写明"体积上限只在 `test/doc-budgets.json` 与 `ctx` 的 `lint.js`"）；`test/doc-budgets.json` 管的是本仓库**规范文本**（`SKILL.md`、`references/**`、`CLAUDE.md`、索引行长，见 `test/doc-budgets.json:1-67` 与 `test/doc-budgets.test.mjs:12`），不含卡片。因此本次 MUST NOT 改 `test/doc-budgets.json` 的卡片相关条目——它没有这类条目。

新增与改写的文档里，依赖仓事实卡的上限 MUST 写成"与业务域卡同一个数值（`ctx lint-cards` 把守）"，MUST NOT 再抄一遍数字：既有已抄数字的三处（`scripts/ctx/README.md:214`、`references/代码事实纪律.md:111`、`assets/context-layer/card-domain.md:6`）保持原样，不扩散第四处。

## 5. 错误处理 / 降级 / 失败模型

| 失败分类 | 恢复行为 | 说明 |
|---|---|---|
| `dependencies/` 目录不存在 | `loadDependencyCards` 与 `loadDependencies` 返回 `[]` | 与 `cards/` 不存在同一处置（`cards.js:76`、`cards.js:95-98`）；起步态的项目不该因此报错 |
| 单张事实卡读不出（权限 / 编码 / 坏软链） | 读取层静默跳过，`lint-cards` 记一条 `unreadable`，`ctx list-services` 的 ⚠ 行列出它 | 静默跳过而不报的后果是"这张卡读不出来"被读成"这个上游没登记" |
| `dependencies/<名>/` 存在但空 | 不产生任何卡；若 `dependencies/<名>.md` 也不存在，不判 `缺依赖声明`（该规则以"有事实卡"为触发条件） | 空目录是常见的 git 残留，判红是噪音 |
| `dependencies/<名>.md` 缺〈业务域地图〉节而目录下有卡 | 不判违规 | 见 §1 不做什么：产品侧也不判"域没登记进业务域地图表" |
| 依赖声明取不到确认时间 | cite 写 `@未声明新鲜度`（`cards.js:391`），人读输出附既有的未声明提示 | MUST NOT 假定新鲜 |
| 同一名字既是产品仓又是依赖名 | 见 §8.1 第 1 行，默认产品仓优先并在输出里提示另一侧存在 | 不静默吞掉另一侧 |

**读取层的总原则不变**：读失败 MUST NOT 冒泡成 Node 栈（`cards.js:64-70` 已写明理由——agent 见到 `ctx` 崩了就直接退回裸 grep）。新增的两个读取函数 MUST 照此写。

## 6. 安全 / 鉴权 / 配置 / 不变量

- **信任边界**：`ctx` 只读本地 `engineering-context/` 下的 markdown，不发网络请求、不执行卡片内容。新增的扫描面是同一个目录树下的兄弟目录，不扩大信任边界。
- **路径遍历**：`loadDependencyCards` 只下探**一层**（与 `loadDomainCards` 同深度），MUST NOT 递归——递归会把 `dependencies/<名>/<子目录>/x.md` 也当成事实卡，而域名与路径的对应关系就此失去唯一解。
- **密钥**：本次不引入任何配置项或凭证。
- **安全不变量**：

  ```
  Invariant 1: 一张卡的 origin 只由读取函数按它所在的具名目录赋值。
  - 强制机制：origin 只在 loadCards / loadDomainCards / loadDependencyCards 三处被写入，
    调用方一律只读不写；测试断言三个函数的返回值 origin 分别恒为 product / product / dependency。
  - 违反时：判红。按路径子串或名字关键词推断 origin 属于启发式判定，换个目录名即静默失效。
  ```

  ```
  Invariant 2: cite 校验的豁免只有一条路径——rootsOf 返回 null。
  - 强制机制：checkCites 内部 MUST NOT 出现任何按 origin 或路径前缀的提前返回；
    测试断言"依赖仓事实卡里指向不存在文件的 cite 不判违规"与
    "产品域卡里同样的 cite 判违规"同时成立。
  - 违反时：判红。两条豁免路径必然漂移，且漂移的方向是"本该校验的被放过"。
  ```

## 7. 可观测性

`ctx` 是一次性 CLI，没有常驻日志或指标。本次的可观测面只有三处输出契约：

- **人读输出**：依赖仓卡片一律带 `[依赖]` 前缀（`discover` 命中行、`search-semantic` 命中行、out-of-scope 行、`get-card` 的 `available` 清单）。前缀是固定字面量，MUST NOT 随语言或终端变化。
- **`--json`**：`discover.cards[].origin`、`searchSemantic.results[].origin`、`get-card` 的 `alsoDependency`。既有字段一律保留，本次只增不改。
- **`lint-cards` 的违规标识**：`<规则>|<相对路径>|<键>` 形态不变；依赖侧路径以 `dependencies/` 开头。这个串是基线的键，形态一旦变动会让全部存量基线失效，因此 MUST NOT 为依赖侧另造标识格式。

## 8. 兼容性 / 迁移

### 8.1 兼容取舍决策（用户拍板，MUST）

> 下表逐条列出本次会改变的**既有可观察行为**。拍板人 2026-09-22 一次性过完十条，**全部取本表的默认项 A**。
>
> 第 1 行附带的并案项（`lint-cards` 要不要为"名字同时命中产品仓与依赖侧"判一条新违规）不在那次拍板的清单里，**由本文按详细设计定为「不判」**：撞车只在 `get-card` 那一刻可见，为它加一条体检规则会让存量项目在升级后无故变红，而收益仅是把同一件事提前告知一次。此项 MUST NOT 被读成用户拍板的结论。

| # | 被改变的既有行为 | 谁在依赖它 | 选项与代价 | 用户决定 | 确认时间 |
|---|---|---|---|---|---|
| 1 | `ctx get-card <名>` 对"既是产品仓名又是依赖名"的处置。现状：只看 `cards/`，依赖侧不可能命中，不存在冲突 | 同时有 `cards/X.md` 与 `dependencies/X.md` 的项目（本仓库自己就有 `cards/dw-system.md`，将来若把某个上游也叫 `dw-system` 即命中） | **A（本文 §3.1 的默认写法）** 产品仓优先，人读末尾加一行提示、`--json` 加 `alsoDependency: true`。代价：调用方不细看提示时仍只拿到一侧。**B** 判为冲突、不发 cite、退出 1 并同时列出两侧路径。代价：把一个可以给出答案的查询变成错误，且名字撞车并不罕见。**C** 两份全文都返回、两条 cite。代价：`get-card` 的返回形状从"一张卡"变成"可能多张"，全部下游脚本与 `--json` 消费者都要改。另需并案决定 `lint-cards` 要不要为此判一条新违规（判：多一条存量项目可能踩的红；不判：撞车只在 `get-card` 那一刻可见） | **A**（本表默认项）| 2026-09-22 |
| 2 | `ctx get-card <上游名>`（不给域）现状退出 1 并打印"未找到服务 card"；本次改为返回依赖声明全文、退出 0 | 任何把 `get-card` 退出码当"这个名字有没有卡"用的脚本与 agent | **A** 按 FR-006 改（退出 0 + 全文 + cite）。代价：既有脚本里"退出 1 即未登记"的判断对依赖名失效。**B** 维持退出 1，只在 stderr 提示"有依赖声明，用 `ctx get-card <名> <域>`"。代价：违背"一个上游只有一个入口文件"，且 agent 拿不到那份声明 | **A**（本表默认项）| 2026-09-22 |
| 3 | `ctx get-card <名> <域>` 的查找顺序由"产品域卡 → 地图卡小节"变成四级（插入依赖仓事实卡与依赖声明小节） | 同名的产品域卡与依赖仓事实卡并存的项目 | **A（§3.1 默认）** 产品仓两级在前、依赖仓两级在后。代价：产品仓地图卡里若有一个与依赖仓事实卡同名的 `## 小节`（如〈职责〉），拿到的是地图卡小节而不是事实卡——顺序是"产品域卡 → 依赖事实卡 → 地图卡小节 → 声明小节"，此例仍取事实卡，但顺序一旦被记错就会误判。**B** 依赖仓在前。代价：本项目自己的事实被外部事实盖住，与卡片层"先信自己"的口径相反 | **A**（本表默认项）| 2026-09-22 |
| 4 | `ctx discover` / `ctx search-semantic` 的结果集与排序：候选集多出依赖仓事实卡，既有 top-N 会被挤掉 | 全部使用这两条命令的项目；`search-semantic` 有 `--top`（默认 5，`semantic.js:128`） | **A** 不做任何惩罚，按分数自然排。代价：上游卡片体量大时（如 agent_fs 二十多条陷阱），产品仓条目可能被挤出默认 top 5。**B** 依赖仓条目乘一个固定折扣再排。代价：引入一个没有判据来源的魔数，且真正相关的外部陷阱会被压下去。**C** 分组输出，产品仓与依赖仓各给 top-N。代价：`--top` 的语义变成"每组 N"，既有 CI 断言的条数会变 | **A**（本表默认项）| 2026-09-22 |
| 5 | `ctx discover` 的 out-of-scope 列表多出依赖仓事实卡的〈陷阱项〉逐条警告 | 把 out-of-scope 行数当门禁或摘要长度的调用方 | **A** 与产品域卡同等待遇，逐条进。代价：out-of-scope 变长；这一栏是本层的立身之本，被稀释成噪音后 agent 会开始跳读（`commands.js:38-44` 记录过同类实测）。**B** 只在零命中时才给依赖侧的。代价：最该看到外部陷阱的时候（命中了外部依赖）反而看不到，等于本次改动白做 | **A**（本表默认项）| 2026-09-22 |
| 6 | 人读输出多出 `[依赖]` 前缀，`--json` 多出 `origin` / `alsoDependency` 字段 | 按行正则解析 `ctx` 人读输出的脚本；`--json` 消费者（新增字段一般安全） | **A** 按 FR-011 加。代价：按 `^• (\S+)` 取服务名的脚本会把 `[依赖]` 当成服务名。**B** 只在 `--json` 里区分，人读不加。代价：直接读 CLI 的 agent（本体系的主要使用方式）看不出来源，约束"调用方要看得出这是外部依赖的事实"落空 | **A**（本表默认项）| 2026-09-22 |
| 7 | `ctx lint-cards` 的扫描面扩到 `dependencies/`：存量项目可能冒出**基线外**的新违规 → 判红（`lint.js:4-5` 明确"没有任何入口能往既有基线里加条目"） | 已经跑过 `--init-baseline` 的存量项目 | **A** 直接扩面。代价：升级 `ctx` 后第一次跑 `lint-cards` 就红，且**修不掉的那部分只能靠删基线重建**——而 `--init-baseline` 对已有基线一律拒绝（`lint.js` 经 CLI 退出码 2，用例见 `test/ctx-domain-cards.test.mjs:234`）。**B** 扩面 + 放宽 `--init-baseline`，允许在已有基线上追加本次新扫描面的条目。代价：开了"往既有基线里加条目"的口子，新违规判红就可以靠改基线绕过。**C** 扩面 + 新增一条一次性命令把新扫描面的存量违规并入基线。代价：多一条只用一次的命令，且它与 B 的风险同源 | **A**（本表默认项）| 2026-09-22 |
| 8 | `ctx list-services` 打印的 `⚠ N 张 card 读不出来` 与 `--json.unreadableCards` 会把 `dependencies/` 下读不出的文件也算进来（`cli.js:263-264`） | 读这两项做告警的 CI | **A** 一并算入，文案仍写"card"。代价：文案与实际范围略有出入。**B** 一并算入并把文案改成"卡片 / 依赖声明"。代价：改动既有输出文案，按行匹配的断言会变。**C** 依赖侧只进 `lint-cards` 不进 `list-services`。代价：同一件事在两条命令里口径不一致 | **A**（本表默认项）| 2026-09-22 |
| 9 | `ctx probe` 的 A 类题型输入是 `loadAllCards`（`cli.js:283`）：`deprecated-trap` 现在可以从依赖仓事实卡的〈陷阱项〉取证，此前判 FAIL 的题可能转 PASS；门禁自检的"card 废弃段"样本来源也随之扩大（`scripts/ctx/README.md:298`），只有依赖卡、没有产品卡的项目不再必然 `GATE-BROKEN` | 已有 probe 棘轮基线的项目 | **A** 一并扩。代价：基线里某个编号"已不再失败"会直接判 `RED`（棘轮只许变短，`scripts/ctx/README.md:287` 第 ④ 条），升级后第一次跑门禁必红，需人工剪基线。**B** probe 的输入退回只取产品卡。代价：同一份 `loadAllCards` 要拆成两个口径，检索看得到而门禁看不到的事实会成为新的漂移源 | **A**（本表默认项）| 2026-09-22 |
| 10 | 依赖仓事实卡沿用业务域卡的体积上限（`BUDGET.domain`）。真实迁移样本 `aiudit_platform` 的 `cards/agent_fs.md` 现为 **17,957 字节**（`/Users/weidwonder/projects/aiudit_platform/engineering-context/cards/agent_fs.md:1`），整体搬过去即超限 | 要把既有 `cards/<上游名>.md` 搬成依赖仓事实卡的项目 | **A（FR-018 的默认写法）** 复用域卡上限，搬家时按业务域拆成多张事实卡（该文件本来就按〈向量库〉〈PDF 转换与索引失败分级〉等分节，天然可拆）。代价：迁移不是纯移动，要做一次拆分。**B** 抬高 `BUDGET.domain`。代价：产品仓域卡一起放宽，等于用一个上游的体量给全体松绑。**C** 给依赖仓事实卡单列一个更大的上限。代价：多一个体积常量，与 FR-018"不新增第二个体积数值"直接冲突 | **A**（本表默认项）| 2026-09-22 |

> 上表任何一行的结论影响到 §3 / §4 的写法时，MUST 回到本文改正对应契约后再进入 coding plan；MUST NOT 在实现阶段就地另做决定。

### 8.2 替换清单（Replacement Ledger，MUST）

| 被取代物 | 类型 | 取代者 | 处置 | 保留理由 + 到期日 |
|---|---|---|---|---|
| `cards/<上游名>.md` 作为"外部依赖仓事实"的落点（如 `aiudit_platform/engineering-context/cards/agent_fs.md`） | 资产位 / 文件格式 | `dependencies/<上游名>/<域>.md` | 迁移后删除原文件 | — |
| `rootsOf(service)`（`lint.js:149`，按 service 名反查地图卡） | 函数签名 | `rootsOf(card)`（要读 `card.origin`） | 改写，唯一调用点 `lint.js:164` 同步 | — |
| `cardLabel(card)` 的返回形态（`commands.js:170-172`，只有 `service` 与 `service › domain` 两种） | 函数行为 | 同名函数，增加 `[依赖]` 前缀分支 | 改写 | — |
| `loadAllCards(ctxDir)` 的返回集合定义（`cards.js:117-119`，"地图卡与域卡的平铺列表"） | 函数契约 | 三类卡的平铺列表，每项带 `origin` | 改写，文档注释同步 | — |
| `unreadableCards(ctxDir)` 的扫描面定义（`cards.js:134-137` 注释"cards/ 目录里读不出来的 card 文件名"） | 函数契约 | 扩到 `dependencies/` | 改写 | — |
| `references/代码事实纪律.md:175` 与 `assets/context-layer/dependency.md:3` 的"MUST NOT 造出子目录"一句 | 判据文本 | 改写为"声明文件本身 MUST NOT 造子目录；`dependencies/<上游名>/` 是依赖仓事实卡的专用目录" | 改写 | — |
| `scripts/ctx/README.md:116` §card 格式约定首条（只列地图卡与域卡两个落点） | 文档文本 | 加依赖仓事实卡一行 | 改写 | — |
| `scripts/ctx/README.md:213-219` 的 `lint-cards` 规则表（`sections` / `budget` / `cite` 三行的施加对象描述） | 文档文本 | 补依赖仓事实卡口径 | 改写 | — |
| `commands.js:429-453` 的 `DEPENDENCIES_README_STUB`（只讲一个上游一份 `.md`） | 模板文本 | 补事实卡目录与〈业务域地图〉节 | 改写 | — |

> 本次无函数、配置项或开关被删除，被取代物全部是资产位、函数契约与文本旧形态。代码评审门的残留轴按"旧表述是否还残留在别处"核销：`grep -rn "MUST NOT 造出子目录"` 与 `grep -rn "地图卡与域卡的平铺列表"` 在改后 MUST 零命中。

### 8.3 数据迁移 / 灰度

**没有自动迁移**：`ctx` 不搬文件。存量项目把一张 `cards/<上游名>.md` 变成依赖仓事实卡的步骤（以 `aiudit_platform` 的 `agent_fs` 为样本）：

1. 按原文件里已有的分节切域（该文件的 `## 向量库` 等小节就是天然的域），每域一张 `dependencies/agent_fs/<域>.md`，写成域卡的固定四节：职责 / 权威实现与对外接口 / 陷阱项 / 确认。原文件把确认时间按域各记一份，搬家时各自进自己那张卡的〈确认〉。
2. 在 `dependencies/agent_fs.md` 新增〈业务域地图〉节，逐域登记一行。该文件的最小五项一字不动。
3. 删除 `cards/agent_fs.md`。
4. 跑 `ctx lint-cards`。**该项目当前没有 `cards-lint-baseline.json`**（实测：`engineering-context/` 下无此文件），因此第一次跑会把全部存量违规都算作新增；按既有流程 `ctx lint-cards --init-baseline` 建基线即可。
5. 已有基线的项目：删除 `cards/<上游名>.md` 会让基线里属于它的条目变成"已不再失败"，按棘轮规则判红（`scripts/ctx/README.md:287`），MUST 跑 `ctx lint-cards --prune-baseline` 剪掉。新扫描面带来的新违规按 §8.1 第 7 行的拍板结论处置。

**灰度**：无。`ctx` 随 skill 分发，一次替换全部生效；旧版 `ctx` 遇到 `dependencies/<上游名>/` 子目录时只是读不到它（`loadCards` 只扫 `cards/`，`loadDependencies` 不存在），不会报错——新旧版本可以并存于不同项目。

**回滚**：把 `ctx` 回退到本次之前的版本即可；`dependencies/<上游名>/` 下的文件会变成"只有人读得到"的状态，不丢失。

## 9. AI 契约补充（含 AI 时）

不适用：本次改动不含模型调用、prompt 或推理路径。

## 10.（有状态时）状态机

不适用：`ctx` 是一次性读命令，本次不引入持久状态或状态流转。

## 11. 完成定义（Definition of Done）

| 编号 | 验收项 | 验证命令 / 判据 | 满足 |
|---|---|---|---|
| AC-001 | §0 阅读导引齐全（一句话目的 + 端到端场景 + 流程图 + 决策表） | 人工核对本文 §0 | — |
| AC-002 | `dependencies/<上游名>/<域>.md` 能被读出，`service` / `domain` / `path` 三字段与路径一致；`loadAllCards` 的长度等于三类卡之和 | `node --test test/ctx-dependency-cards.test.mjs` 中"读取层"分组全绿 | FR-001 / FR-003 / FR-005 |
| AC-003 | 三个读取函数的 `origin` 分别恒为 `product` / `product` / `dependency`；`checkCites` 与 `cardLabel` 之外的代码里 `grep -rn "dependencies" dw-system/skills/dw-code-facts/scripts/ctx/src/` 不出现按路径子串判来源的写法 | 用例断言 + 人工核对该 grep 输出 | FR-004 / Invariant 1 |
| AC-004 | `ctx get-card <上游名>` 返回依赖声明全文、cite 指向 `dependencies/<名>.md#全文` 且日期取自「确认时间」行、退出 0 | `node --test test/ctx-dependency-cards.test.mjs`；并在 `aiudit_platform` 实跑 `ctx get-card agent_fs` | FR-006 / FR-017 |
| AC-005 | `ctx get-card <上游名> <域>` 命中事实卡；四处皆无时不发 cite、退出 1，`available` 里依赖侧条目带 `[依赖]` 标注 | 同上；实跑 `ctx get-card agent_fs 向量库` 与 `ctx get-card agent_fs 不存在的域` | FR-007 / FR-008 |
| AC-006 | 只写在依赖仓事实卡里的符号能被 `ctx discover` 命中；该卡〈陷阱项〉逐条出现在 out-of-scope 里且指称带 `[依赖]` | `node --test test/ctx-dependency-cards.test.mjs`；实跑 `ctx discover "向量库 清理窗口"` | FR-009 / FR-011 |
| AC-007 | `ctx search-semantic` 的结果含依赖仓事实卡，`--json` 每项带 `origin`，人读行带 `[依赖]` | 同上；实跑 `ctx search-semantic "向量库 清理窗口" --json \| jq -r '.results[].origin'` 能看到 `dependency` | FR-010 / FR-011 |
| AC-008 | `lint-cards` 对依赖仓事实卡：缺必备小节、自造小节、超体积、带日期的小节名、陷阱项噪音、同上游域名近似重复，各有一个必红样本与一个必绿样本 | `node --test test/ctx-dependency-cards.test.mjs` 中"体检规则"分组全绿 | FR-012 |
| AC-009 | 依赖仓事实卡里指向不存在文件的 cite **不判**违规；同一段 cite 写进产品域卡**判**违规（证明豁免没有把产品侧一起放过） | 成对用例；且 `grep -n "origin" dw-system/skills/dw-code-facts/scripts/ctx/src/lint.js` 只在 `rootsOf` 内出现一次 | FR-013 / Invariant 2 |
| AC-010 | 有 `dependencies/<名>/` 而无 `dependencies/<名>.md` 时判 `sections\|dependencies/<名>\|缺依赖声明`；两者都在时不判 | 成对用例 | FR-014 |
| AC-011 | `dependencies/` 下读不出的 `.md`（声明文件与事实卡各一）各记一条 `unreadable`，路径以 `dependencies/` 开头；读得出时不判 | 成对用例（平台判据照 `test/ctx-domain-cards.test.mjs:337` 的 skip 写法：Windows 与 root 跳过） | FR-015 |
| AC-012 | `dependencies/README.md` 不被当作依赖声明：`ctx get-card README` 退出 1，`ctx discover` 不因它命中 | 用例 | FR-016 |
| AC-013 | `grep -rn "16000\|16,000" dw-system/skills/dw-code-facts/scripts/ctx/src/` 只命中 `lint.js:17`；本次新增或改写的文档里无第四处数字 | 人工核对 grep 输出与本次 diff | FR-018 |
| AC-014 | 三份模板与三处文档已改：`card-domain.md` 有"落在 `dependencies/` 下时的三点差异"段；`dependency.md` 有〈业务域地图〉节；`scripts/ctx/README.md` §card 格式约定与 `lint-cards` 规则表已补；`代码事实纪律.md` §4.1 / §5 / §10.2 已补且"MUST NOT 造出子目录"一句已改写；`DEPENDENCIES_README_STUB` 已同步 | 人工核对；`grep -rn "MUST NOT 造出子目录" dw-system/` 零命中 | FR-019 |
| AC-015 | 新测试文件 `test/ctx-dependency-cards.test.mjs` 存在，形态照既有域卡测试（`withProject` 式临时项目、每条规则成对样本） | `node --test test/ctx-dependency-cards.test.mjs` | FR-020 |
| AC-016 | 既有 `ctx` 用例全绿（无回归） | `node --test test/ctx-*.test.mjs` | — |
| AC-017 | 本仓库全部机器闸全绿（含 `doc-budgets`、`single-home`、`cross-reference`、`rule-destinations`） | `node --test test/*.test.mjs` | — |
| AC-018 | §8.1 十条兼容取舍每条都有用户确认结论（含显式的"维持现状"），且结论与 §3 / §4 的契约一致 | 人工核对本文 §8.1 全部「待拍板」已替换 | — |
| AC-019 | §8.2 替换清单逐条核销：该改的已改，`grep -rn "地图卡与域卡的平铺列表" dw-system/` 零命中 | 人工核对 + grep | — |
| AC-020 | 仓库根 `CHANGELOG.md` 的 `## 未发布` 节已按 §8.1 的"不兼容"结论逐行写条目（以判据实体名开头，含旧调用方式 / 新调用方式 / 迁移步骤） | 人工核对；规则见 `references/代码事实纪律.md:162-172` | — |
| AC-021 | 本仓库卡片已刷新：`engineering-context/cards/dw-system/ctx命令行.md` 的体检规则条目与命令清单反映新扫描面，〈确认〉已更新 | `ctx lint-cards` 无新增违规 | — |
| AC-022 | 本文已登记进 `docs/index.md` 现行区，frontmatter 的 `authority_refs` 非空且与别的现行文档无重复条目 | `ctx probe`（`rationale-traceable` 与 `authority-unique` 两题）| — |
| AC-023 | 在 `aiudit_platform` 上完成 §8.3 的迁移并实跑通过：`cards/agent_fs.md` 已删、`dependencies/agent_fs/` 下有事实卡、`dependencies/agent_fs.md` 有〈业务域地图〉节、`ctx lint-cards` 可收敛 | 在该项目根跑 `ctx lint-cards` 与 `ctx discover "向量库"` | FR-001 / FR-002 |

**覆盖自查**：FR-001→AC-002/AC-023；FR-002→AC-023；FR-003→AC-002；FR-004→AC-003；FR-005→AC-002；FR-006→AC-004；FR-007→AC-005；FR-008→AC-005；FR-009→AC-006；FR-010→AC-007；FR-011→AC-006/AC-007；FR-012→AC-008；FR-013→AC-009；FR-014→AC-010；FR-015→AC-011；FR-016→AC-012；FR-017→AC-004；FR-018→AC-013；FR-019→AC-014；FR-020→AC-015。二十条 `FR-###` 全部被覆盖。

## 12. 待澄清点

无。本文涉及的全部取舍要么已在 §1 的"不做什么"里定死，要么已作为 §8.1 的待拍板条目逐条陈列；没有需要用户额外提供业务规则、权限边界或数据归属的地方。

## 13. 过稿记录（MUST）

**2026-09-22 定稿。** 拍板人过目了 §1 范围与「不做什么」、§1.1 功能需求、§8.1 兼容取舍决策、§11 完成定义四项，回复「就按这个走」，未提修改意见。

同批过的兼容取舍：§8.1 十条全部取默认项 A（清单以业务语言逐条摆出，含「已记过基线的项目升级后首跑会红、只能删基线重建」与「已有棘轮基线的项目首跑必红需人工剪基线」两条代价；经核对本仓与 aiudit_platform 均未记过卡片体检基线、棘轮基线也是空的，故这两条代价对当前两个仓为零）。

本次与 aiudit_platform 仓的《事实卡按业务域重组》eng-spec 同批抛出、同批定稿。两仓合并顺序 MUST 是本仓先、aiudit_platform 后——对面消费本仓交付的读取能力。
