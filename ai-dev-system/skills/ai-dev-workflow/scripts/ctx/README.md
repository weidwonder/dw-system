# ctx — Engineering Context CLI

> **本文小节**：[安装 / 运行](#安装--运行) · [命令](#命令) · [跨平台说明](#跨平台说明) · [测试](#测试) · [CI / 脚本用法（--json）](#ci--脚本用法--json) · [card 格式约定（供解析）](#card-格式约定供解析) · [ctx init --minimal — 三行 registry 起步](#ctx-init---minimal--三行-registry-起步) · [ctx search-semantic "<query>" — 语义兜底检索](#ctx-search-semantic-query--语义兜底检索) · [ctx probe — Frozen Probe Set 防腐门禁](#ctx-probe--frozen-probe-set-防腐门禁)

查代码事实的 CLI，**替代 MCP**：Claude Code 与 Codex 都能通过 shell 调用。Node.js ≥20，**零运行时依赖**，跨平台。读本地 `engineering-context/`（markdown card + capability-registry），每条事实附 cite。

## 安装 / 运行

安装器（`install.mjs`）在装完 skill 后会自动执行下面的 `npm link`，所以通常直接 `ctx <命令>` 就能用。
链接失败（全局目录无写权限、npm 全局 bin 不在 PATH、已有同名 `ctx` 命令）时安装器只警告不中断——
**此时 ctx 依然可用**，用下面的直接运行方式即可，功能完全相同。

```bash
# 直接运行（无需安装依赖，任何时候都可用；ctx 命令找不到时用它兜底）
node <skill 根目录>/scripts/ctx/src/cli.js <命令>

# 全局链接为 ctx 命令（安装器已自动做过；失败或想重做时手动执行）
cd <skill 根目录>/scripts/ctx && npm link      # 之后可直接 `ctx <命令>`

# 撤销全局链接
npm rm -g ctx
```

`<skill 根目录>` = `ai-dev-workflow` 的 `SKILL.md` 所在目录。安装后目标项目下有两份逐字节相同的副本：Claude Code 读 `.claude/skills/ai-dev-workflow/`，Codex 读 `.agents/skills/ai-dev-workflow/`——任选一份，**别写死其中一份**。

> **全局 `ctx` 指向最后一次安装的那个项目里的副本**（`npm link` 只有一个全局 bin）。这不影响使用：`ctx` 按**运行目录**去找 `engineering-context/`，所以一份命令服务所有项目。但它确实意味着多项目并存时，你敲的可能是别的项目里那份 ctx 的**代码**——版本差异导致行为可疑时，用上面的直接运行方式跑本项目这一份来对照。

**版本口径**：`package.json` 的 `version` 不是 ctx 自己的版本号。ctx **随 skill 一起分发、不单独发布 npm 包**，它的版本就是分发包版本（`ai-dev-system/VERSION`）；`package.json` 只为 `npm link` 提供 `name` 与 `bin` 两个字段而存在。要判断手上这份 ctx 有多新，看 skill 目录旁的 `ai-dev-system.version` stamp，不要看 `package.json`。

## 命令

| 命令 | 作用 | 状态 |
|---|---|---|
| `ctx init [--dir <目标>]` | 生成 `engineering-context/` 骨架（registry + cards/ + scenes/README + probe-set + glossary + README + `.gitignore`） | ✅ |
| `ctx init --minimal [--dir <目标>]` | **只**生成 `capability-registry.md`（三列即可起步，推荐先用它） | ✅ 见下 |
| `ctx discover "<意图>"` | 意图 → 应加载的 card 清单（按命中分排序）+ out-of-scope 提示 | ✅ |
| `ctx get-card <repo> [域]` | 取某仓 card；域为 `## 段落标题` | ✅ |
| `ctx find-scenes <关键词...>` | 匹配 `scenes/*.md` 业务场景 | ✅ |
| `ctx list-services` | 列出已登记服务及其能力 | ✅ |
| `ctx search-semantic "<q>"` | discover 未命中时的语义兜底（本地向量相似） | ✅ 见下 |
| `ctx probe` | 跑 Frozen Probe Set 防腐门禁（自检 + 棘轮 + 衰减） | ✅ 见下 |

公共选项：`--dir <ctx目录>`（默认 `<cwd>/engineering-context`）；`--json` 输出 JSON。

> `--dir` **只改 `engineering-context` 的位置，不改项目根**。`ctx probe` 的零上下文交接题型读的是项目自身文件（README / docs/index.md / 架构节列出的模块路径 / `.codegraph/`），项目根一律取 **`ctx` 的运行目录（cwd）**。所以要在别的项目上跑门禁，得进那个项目再跑，而不是只把 `--dir` 指过去。
> 例外：`ctx init` 的 `--dir` 指的是**目标项目目录**（在它下面生成 `engineering-context/`），不是 ctx 目录。

## 跨平台说明

- 全程用 `node:path`（`path.join` / `path.resolve`），不硬编码 `/`。
- 无 bash-only 语法；所有逻辑在 Node 内完成。
- Windows：`npm link` / 安装时 npm 会依据 `package.json` 的 `bin` 生成 `ctx.cmd` shim，可直接调用。
- 读写统一 UTF-8。测试用 `os.tmpdir()`，不假设 `/tmp`。
- `--test` 用 Node 内置 `node:test`，无需第三方测试库。

## 测试

```bash
cd <skill>/scripts/ctx && node --test        # 全部用例，覆盖 cards 解析与全部命令（含 semantic / probe）
```

## CI / 脚本用法（`--json`）

所有查询命令加 `--json` 输出结构化 JSON，可直接喂 `jq` 或 CI：

```bash
# 取某接口段落的权威事实 + cite
node src/cli.js get-card sample-service 对外接口 --dir <ctx目录> --json | jq -r '.cite'

# discover 命中的权威服务名（供流水线做影响面校验）
node src/cli.js discover "作业辅导 对话" --dir <ctx目录> --json | jq -r '.cards[0].service'

# 断言某能力已登记（未登记则 CI 失败）
node src/cli.js list-services --dir <ctx目录> --json \
  | jq -e '[.[].capabilities[]] | index("背单词记录")' >/dev/null \
  || { echo "能力未登记，请补 capability-registry"; exit 1; }
```

`ctx probe --json` 输出衰减报告（`verdict` / `passRate` / `passRateDelta` / `skipped` / `results[]`），**`GREEN` 与 `AMBER` 退出 0，其余（`RED` / `GATE-BROKEN` / `NO-PROBE`）退出 1**——成因逐条见 ↓ §判级表。供 CI 门禁读取：

```bash
# 发布前防腐门禁：直接用退出码，门禁失效 / 新增失败 / 一道题都没跑 → 流水线红
node src/cli.js probe --dir <ctx目录> --json >/tmp/probe.json \
  || { echo "context 层防腐门禁未通过：$(jq -r .verdict /tmp/probe.json)"; exit 1; }
```

> 用退出码，别只用 `jq -e '.verdict=="GREEN" or .verdict=="AMBER"'`：那样写等于把判级规则在 CI 里抄第二遍，新增 verdict（如 `NO-PROBE`）时两边会漂移。同理，**MUST NOT** 用 `| jq` 直连——大输出经管道时请先落文件再读（`get-card --json` 的整卡全文可达数百 KB）。

## card 格式约定（供解析）

- card 放 `engineering-context/cards/<repo>.md`，文件名即 service 名。
- 段落用 `## 标题`（`get-card <repo> <域>` 按此定位）。
- `capability-registry.md` 用 markdown 表格；正文单元格避免裸 `|`（不处理转义）。
- **废弃行怎么写**（`deprecated-trap` 判据）：一行里同时出现被废弃项与替代物是推荐写法，解析器按下列顺序区分——
  ① **表格行按列序**：第一列是被废弃的那个（`| 废弃项 | 改用 | 原因 |`）；
  ② 行内**只有一个**反引号实体：它就是被废弃的那个，措辞与位置不影响结论；
  ③ 有两个以上实体时，看废弃词（废弃/中间产物/不可用/停用/下线/弃用/移除/deprecated）与指向词
  （改用/请用/请调用/改为/换成/替换为/替代/取代/迁移到/统一走/见/新接口/权威实现是/→/use/instead/replaced by/…）——
  **实体离谁近就归谁**；只有指向词时，指向词之后的实体是替代物（`X（replaced by Y）`），
  指向词在所有实体之后时紧挨它的那个是替代物（`X 已被 Y 取代`）。
  **判据不依赖指向词表命中**：漏在表外的措辞会退回"离废弃词最近的那个才是被废弃的"，
  MUST NOT 出现"整行都判废弃"——那会让替代物被判废弃，进而让门禁自检的必错样本通过、判自己 GATE-BROKEN。
- **表头必须紧跟一行分隔行**（`|---|---|`）才会被认作表头。每格 ≥1 个 `-` 即可，`|-|-|`、`|:-:|` 都算。
  没有分隔行 → 整张表被忽略（`ctx list-services` 会明说是分隔行的问题，不会误报成表头写错）。
- registry **按表头名取列，不按列序**（`src/cards.js` 的 `REGISTRY_FIELDS`，先到先得）：

  | 字段 | 认得的表头写法 |
  |---|---|
  | `capability` | `Capability` / 含`能力` |
  | `businessMeaning` | 含`业务含义` / `含义` |
  | `canonicalRepo` | 含`权威仓库` / `仓库` / `repo` |
  | `canonicalApi` | 含`权威实现` / `权威接口` / `实现` / `接口` |
  | `deprecated` | 含`陷阱` / `废弃` / `中间产物` |
  | `compatWindow` / `owner` / `testEntry` / `freshness` / `reason` | 含`兼容` / `owner`·`负责人` / `测试` / `freshness`·`新鲜`·`最近确认` / `理由` |

  认不出的列直接忽略，缺席的列留空，**都不报错**。**最小合法 schema 只有 `Capability` / `权威实现` / `陷阱项（废弃或中间产物）` 三列**，完整模板十列，两种形态都必须能解析——所以顺序无所谓，加列减列也不会错位。
- 表头首列认 `Capability` **与中文的「能力」**（复用 capability 列自己的别名表）；文件里**所有**表头首列命中的表都会被解析并合并——完整模板里三列最小表与十列完整表并存，填哪张都算。
- registry 行的 **`Capability` 列含 `【】` 即视为模板占位，整行跳过，不算已登记能力**——一份没填过的 registry 因此等于"未启用权威位"（`ctx list-services` 为空，`implementation-usable` 的权威位分支不成立）。
- `probe-set.md` 同样按表头名取列：探针表的表头首列是 `#`、次列含 `类型`/`type`，其余列按名匹配（`输入`/`input`、`期望`/`expected`、`severity`/`严重`、`weight`/`权重`、`status`/`状态`、`authority`/`refs`/`权威`）；标题含`基线`/`baseline`/`棘轮`/`ratchet` 的小节（`#` 到 `######` 任意层级）里**独立成行**的编号即棘轮基线编号。认这些前缀：列表符 `- * +`、有序号 `1.` `1)`、任务框 `[ ]` `[x]`、强调 `**12**` `_12_`、反引号 `` `12` ``、可选 `#`，以及表格首列 `| 12 |`。
  **行内散落的数字（日期、issue 号）不算**，所以基线段可以放心写复核记录（`> 2026-08-16 复核：暂时容忍 #1，见 issue 4321。`）。
  代价是"编号夹在句子里"的写法（`- 探针 #3：容忍到 2026-09`）也不算——这种行会被单独警告（`⚠️ 基线段有 N 行像编号却没被解析`），**不会**静默丢掉变成假 RED。
- `Freshness / Provenance` 段落里的 `YYYY-MM-DD` 用作 cite 的确认时间；**抽不到日期就标 `未声明新鲜度`**，绝不按新鲜处理（`search-semantic --as-of` 下同样降权标 stale）。

## `ctx init --minimal` — 三行 registry 起步

```bash
node src/cli.js init --minimal --dir <项目根>     # 只落 engineering-context/capability-registry.md
```

**为什么**：一次性铺开 registry + cards/ + scenes/ + probe-set + glossary 五个待填文件，会把刚要建权威位的人劝退，反而退回裸 grep。权威位的起步成本应该是"三行 registry"。

**最小合法 schema**（完整字段说明见 `../../assets/context-layer/capability-registry.md`）：

| Capability | 权威实现 | 陷阱项（废弃或中间产物） |
|---|---|---|
| 登录 | `src/auth/login.ts::login()` | `src/auth/legacy_login.ts`（旧实现，勿改） |

- 三列 MUST，其余列 MAY 缺席；缺列 `discover` 跳过而非报错。
- `discover` 对 registry 命中**单独出结果**（`capabilities` 字段），一张 card 都没有也能用；命中行的陷阱项列进 `outOfScope`。
- 无 `freshness` 列时，`cite` 写 `@未声明新鲜度`，人读输出附一行「⚠ 未声明新鲜度：…用前 MUST 回源码确认」。
- 需要 cards / scenes / probe-set 时再跑一次不带 `--minimal` 的 `ctx init` 补齐（已存在的文件不会被覆盖）。

---

## `ctx search-semantic "<query>"` — 语义兜底检索

**定位**：`discover` 用精确子串命中；本命令是 **discover 未命中时的兜底**，抓近义/形近说法。

**实现**（零依赖、离线）：对每张 card 的 `## 段落` 分块，用**字符 bigram 余弦相似度**给 query 排序；可选 `engineering-context/synonyms.md`（每行 `- 词: 近义1, 近义2`）做查询扩展。**非神经 embedding**——这是零依赖后端；未来可把打分器换成 embedding 索引，只要保持"结果带 freshness + 权威标记"的契约不变。

```bash
node src/cli.js search-semantic "背单词 进度" --top 3
node src/cli.js search-semantic "背单词" --as-of 2026-07-20 --stale-days 90   # 启用 freshness 降权
```

**防腐红线（已落地）**：
- 每个结果带 `freshness` 与 `cite`；给 `--as-of` 时，超过 `--stale-days`（默认 90）未确认的块标 `stale` 并把 score ×0.5。
- 每个结果带**权威指针** `authority`（`canonical` / `deprecated`）——命中"废弃/中间产物"段落会标 `deprecated`，避免把废弃项当权威。
- 输出固定附提醒：**语义检索不是第一入口**，权威 registry + `discover` 优先。

**局限**：字符 n-gram 对完全换词（无 synonyms 登记）的同义仍弱；需要更强召回时接 embedding 后端。

## `ctx probe` — Frozen Probe Set 防腐门禁

**定位**：真实项目每次都变，不能当回归基线；用冻结、可打分、每发布周期重跑的题集检测 context 层**衰减**。题集见 `engineering-context/probe-set.md`（`ctx init` 生成模板）。

**A 类题型 — context 层（读 `cards/` 与 `capability-registry.md`）**：
- `capability-mapping`：输入=能力名，期望=`权威仓库 :: 权威实现`；门禁按 registry 求解比对。
  registry 是**三列最小 schema**（没有"权威仓库"列）时，期望串**只写权威实现**——仓库维度不存在、无从比对，门禁只判权威实现。此时写成 `repo :: api` 会恒失败，把一道好题变成永久红点并污染棘轮基线。
- `deprecated-trap`：输入=接口/实体，期望=`deprecated`；门禁须从 cards/registry 判其废弃，被当 canonical 即失败。

**B 类题型 — 零上下文交接（读项目自身文件，`eng-spec §3.6` 四项可达性检查）**：

这四项**不依赖 context 层**，一张 card 都没有的项目照样能跑。类型名支持中英双写（表格"类型"列写哪个都行）。

| 类型名 | 中文题名 | 输入 | 期望 | 通过标准 |
|---|---|---|---|---|
| `requirement-reachable` | 需求真相源可达 | `docs/REQUIREMENTS.md` 或 `README.md#需求`（`路径` 或 `路径#锚点`）| `≤2 跳` | 从入口文档沿 markdown 链接 BFS ≤N 跳到达 |
| `architecture-reachable` | 架构真相源可达 | 同上，指向架构真相源 | `≤2 跳` | 同上 |
| `implementation-usable` | 实现真相源可用 | 架构节 `README.md#架构与边界` | `usable` | 模块路径无条件校验 + 探测到的每一位都要成立，见下 |
| `rationale-traceable` | 设计理由可追 | 索引路径（默认 `docs/index.md`）| `全部非空` | 索引**现行区**各 spec 的 frontmatter `authority_refs` 均非空 |

- **入口文档**：仓库根的 `README*.md` 与 `docs/index.md`。两者皆无 → `NO-ENTRY-DOC`，判 FAIL。
- **跳数**：入口文档本身算 0 跳，入口里的链接算 1 跳。期望串里的数字即上限（不写按 `≤2`）。
- **锚点**：目标带 `#锚点` 时，锚点必须对应文中一个标题（中文小节名与 github slug 都认），否则 `ANCHOR-MISSING`。
- **`implementation-usable` 的三项是「叠加」不是「互斥」**（能力位是探测结果，不是配置；两位可同时成立）：
  - **架构节里列出的模块路径均存在**——这一项**无条件校验**，有没有能力位都要过。三行 registry 不该让实现层门禁永久变绿。
  - 图谱位（`.codegraph/codegraph.db` 存在）→ 文件非空即索引可查询；权威位（`ctx list-services` 非空）→ 已登记服务/能力非空。探测到的每一位都要成立。
  - **什么算"模块路径"**：反引号代码片段或相对链接，且满足下列任一——**含目录分隔 `/`**；以白名单扩展名结尾；或是白名单里的裸文件名 / 点开头配置文件（`Makefile`、`Dockerfile`、`.env.example`、`.gitignore` 之类）。**两份白名单的完整清单以 `src/probe.js` 的 `PATH_EXT` 与 `BARE_PATH_NAME` 为准，此处 MUST NOT 抄第二遍**（抄了必然漂移）。
  - 判据 MUST 是白名单而非"点号后 1–8 位字母数字"——架构小节里用反引号写 `path.join`、`os.tmpdir`、`process.env` 极其常见，启发式会把它们当成带扩展名的路径，把一道好题变成永久红点。反过来，白名单**漏掉**真实路径同样危险：架构节列了三条不存在的 `go.mod`/`Makefile`，门禁却报"全部存在"——恒绿的门禁比没有门禁更糟。
- **`authority_refs` 非空的判据**：至少一条实义条目；空值、含 `【】` 的模板占位、`TBD` / `待填` 均视为未填。
- **`rationale-traceable` 只认 `spec/` 目录下的 `.md`**：本体系的文档目录是固定约定（spec → `docs/spec/`、plan → `docs/plan/`、report → `docs/report/`），判据据此锁定路径含 `spec/` 段的 markdown，避免把索引里的账本、ADR、原型一起拖进来判。spec 放在别处的项目要么把它们移进 `spec/` 目录，要么把探针输入指向真正列 spec 的那份索引。
- **"归档"标题下链到的文档不参与判定**，且排除范围按**标题层级**计算：`## 归档` 之下的 `### 2026 Q1` 仍在归档区内，只有遇到同级或更高级标题才解除。按季度/年份给归档区分子标题是常见写法，按"任意标题就重置"会让归档文档又被算进来。
- **零条目不算通过**：架构节一个模块路径都抽不到、索引现行区一篇 spec 都没链到 —— 一律 FAIL，"没有题目所以全绿"正是假门禁。

失败原因串（进 `actual` 列 / `--json` 的 `results[].actual`）：

| 串 | 含义 |
|---|---|
| `NO-ENTRY-DOC` | 仓库根没有 `README*.md`，也没有 `docs/index.md` |
| `BAD-TARGET` | 探针没写真相源路径 |
| `MISSING:<路径>` | 真相源（或索引）文件不存在 |
| `ANCHOR-MISSING:<路径>#<锚点>` | 文件在，但锚点对不上任何标题 |
| `UNREACHABLE(>N 跳)：<路径>` | 文件在，但从入口 N 跳内到不了 |
| `NO-SPEC-LINK:<索引> 现行区没有链到任何 spec` | 索引现行区为空 |
| `authority_refs 未填：<路径列表>` | 现行区某些 spec 的该字段为空/占位 |
| `直读：模块路径缺失 <路径列表>` / `直读：架构节未列出任何模块路径（…）` | 无能力位分支的两种失败 |
| `图谱位：.codegraph/codegraph.db 为空，索引不可查询` | 有索引文件但零字节 |

> **项目根 = cwd**：B 类题型按 `ctx probe` 的运行目录当项目根，`--dir` 只改 `engineering-context` 的位置。

```bash
node src/cli.js probe --dir <ctx目录>          # 人读报告
node src/cli.js probe --dir <ctx目录> --json    # CI 读；退出码见下表
```

### 判级表（`verdict` × 成因 × 退出码）

| verdict | 什么情况 | 退出码 |
|---|---|---|
| `GREEN` | **零失败**，且基线无冗余、通过率 ≥ 地板 | 0 |
| `AMBER` | 失败**全部落在基线内**（棘轮容忍），且通过率 ≥ 地板 | 0 |
| `RED` | 命中下列任一：① 出现**基线外的新增失败**；② 任何 `severity=blocking` 的探针失败（**零容忍，基线不豁免**）；③ 加权通过率 **< 地板 0.9**；④ 基线里有**已不再失败**的编号（棘轮只许变短，冗余基线本身就是失准） | 1 |
| `GATE-BROKEN` | 门禁自检没抓住植入的必错样本——门禁形同虚设，拒绝出具结论 | 1 |
| `NO-PROBE` | 一道**未暂停**的探针都没跑（题集为空 / 全是 `【…】` 占位行 / 全被 `needs-reconfirm` 暂停）。"没有题目所以全绿"正是假门禁，因此判不通过 | 1 |

> `NO-PROBE` 的判据是 **active（未暂停）** 探针数，不是 scored：题集全是 `blocking` 且全通过时门禁是有效的，判 `GREEN`——只是没有计分题，此时 `passRate` 为 `null`，人读模式打印 `—（本轮无计分题，仅 blocking）`。

不计分的两种状态：`status` 为 `needs-reconfirm`（挂的权威面变了，等人重新确认）或 `quarantined` 的探针**暂不计入通过率**，但会在报告里显式列出题数——静默排除等于偷偷降低门槛。

**四条铁律**：
1. **门禁自检**（防"永远全绿"的假门禁）：真跑前植入必错样本（谎报权威映射 / 把 canonical 接口谎称 deprecated / 指向不存在的真相源 / 架构节列不出模块路径），断言门禁判它们 FAIL；抓不到 → `GATE-BROKEN`，退出 1。交接题型的样本不依赖 cards/registry，所以 context 层为空的直读项目也有真门禁。题集里**没有**交接题型且 context 层为空时判据不变，仍是 `GATE-BROKEN`，不放水。
2. **双向棘轮**：`## 基线（棘轮）` 段登记容忍的失败编号。**新增**（基线外）失败 → `RED`；失败全落基线内 → `AMBER`（告警不拦）；基线里某个编号**已不再失败** → 同样 `RED`，必须把它从基线删掉。基线只许变短——留着已修好的编号，下次它再坏就没人发现了。
   基线段的编号**只认独立成行的条目**（`- 12` / `* #12` / `12`）。这样在基线段写 `> 2026-08-16 复核：暂时容忍 #1，见 issue 4321。` 这类记录才不会把 `2026`/`08`/`16`/`4321` 也当成基线编号——那会让棘轮报一堆"基线 #2026 已不再失败"的假 RED。
3. **地板**：加权通过率低于 `0.9` 直接 `RED`，与棘轮独立判定。基线能容忍"哪几道题坏了"，但不容忍"坏了一大半"。
4. **衰减报告**：读/写 `.index/probe-history.json`，`--json` 给出 `passRate`、`passRateDelta`（较上周期）与 `skipped`（被跳过的占位行题号）。

**运行节奏**：只在 CI 发布 / 里程碑节点，**不进 coding agent 每轮 loop**。

> 完整理念见 `../../references/capability/context-engineering.md`。
