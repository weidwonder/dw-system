---
lifecycle: active
superseded_by: ''
archived: ''
last_confirmed: '2026-09-22'
authority_refs:
  - '依赖仓事实卡实现的任务切分与逐任务验收命令'
---

# 依赖仓事实卡 Coding Plan

**Goal:** 让"外部上游仓库的事实"落在 `engineering-context/dependencies/<上游名>/<域>.md`，与产品仓域卡同等被 `ctx` 读取、检索、体检，且在输出里始终能被认出是外部依赖。
**Architecture:** 读取层加第三个具名来源（`loadDependencyCards`）与一个非卡对象来源（`loadDependencies`），卡片对象新增闭集字段 `origin`，由三个读取函数各自显式赋值；`getCard` / `discover` / `searchSemantic` / `lintCards` 四条既有通路按 `origin` 分流，cite 豁免复用 `rootsOf` 返回 `null` 这一条既有分支。
**Tech Stack:** Node.js ESM（≥20），零依赖；`node --test`。
**Worktree:** `/Users/weidwonder/projects/dw-system/.worktrees/dependency-repo-cards`
**Task Branch:** `feat/dependency-repo-cards`
**目标主分支:** `main`
**Spec:** `docs/spec/2026-09-22-dw-system-依赖仓事实卡-eng-spec.md`

## 全局约束（每个任务都适用）

- `origin` 只在 `loadCards` / `loadDomainCards` / `loadDependencyCards` 三处写入，值域闭集 `'product' | 'dependency'`。调用方**只读不写**。MUST NOT 按路径子串（`path.includes('dependencies')`）、名字关键词或任何启发式推断来源。
- 卡片体积上限的唯一定义处是 `lint.js` 的 `BUDGET`。依赖仓事实卡复用 `BUDGET.domain`。MUST NOT 新增第二个体积常量，MUST NOT 改 `test/doc-budgets.json`。
- cite 豁免只有一条实现路径：`rootsOf(card)` 返回 `null`。MUST NOT 在 `checkCites` 里加任何按 `origin` 或路径前缀的提前返回。
- 边写边删：被取代的旧写法当场删除，MUST NOT 保留"兼容旧格式"的分支。
- MUST NOT 添加 spec 里没有的抽象、开关或配置项（不做"卡片根目录列表"、不做插件式注册表）。
- 兼容取舍十条一律按 spec §8.1 的默认项 A，MUST NOT 在实现时另做决定。

## 任务依赖图

```
T1 读取层（origin + 依赖仓两个来源 + unreadable 扫描面）
 ├─ T2 get-card 四级查找
 ├─ T3 discover / search-semantic 的来源标记
 ├─ T4 lint-cards 扩到事实卡 + rootsOf 改签名
 │   └─ T5 lint-cards 缺依赖声明 + unreadable 依赖侧
 └─ T6 模板与文档（含替换清单的四处删除动作）
T2..T6 ─ T7 本仓卡片刷新 + CHANGELOG + 索引登记
        └─ T8 全量验证 + 跨仓实跑
```

---

### Task 1：读取层读出依赖仓事实卡，每张卡带 origin

**Slice:** 在临时项目里放一张 `dependencies/agent_fs/向量库.md`，`loadDependencyCards` 读得出它且 `origin === 'dependency'`；`loadAllCards` 的长度等于三类卡之和。｜**依赖：** 无
**满足:** FR-001 / FR-003 / FR-004 / FR-005 / FR-015 / FR-016 / FR-017，Invariant 1

**Files:**
- Modify: `dw-system/skills/dw-code-facts/scripts/ctx/src/cards.js`
- Modify: `dw-system/skills/dw-code-facts/scripts/ctx/src/lint.js`（只改 `unreadableCards` 的那一行映射）
- Modify: `test/ctx-cards.test.mjs`（`unreadableCards` 返回值契约变了，断言同步）
- Create: `test/ctx-dependency-cards.test.mjs`（本任务只写「读取层」分组）

**Interfaces:**
- Produces: `loadDependencyCards(ctxDir)` → `Array<{service, domain, origin:'dependency', path, sections, raw}>`
- Produces: `loadDependencies(ctxDir)` → `Array<{upstream, path, sections, raw}>`（**不是**卡对象：无 `origin`、无 `domain`）
- Produces: `dependencyFreshness(raw)` → `YYYY-MM-DD | UNDECLARED_FRESHNESS`
- Changed: `loadCards` / `loadDomainCards` 返回对象多 `origin: 'product'`
- Changed: `loadAllCards(ctxDir)` = `[...loadCards, ...loadDomainCards, ...loadDependencyCards]`
- Changed: `unreadableCards(ctxDir)` 返回**带前缀**的相对路径（`cards/…` / `dependencies/…`），不再是裸文件名

- [ ] Step 1: 先写失败测试 `test/ctx-dependency-cards.test.mjs` 的「读取层」分组，形态照 `test/ctx-domain-cards.test.mjs` 的 `withProject`（临时项目 + `finally` 清理）：
  - `loadDependencyCards` 给出 `service='agent_fs'`、`domain='向量库'`、`path='dependencies/agent_fs/向量库.md'`；
  - 三个读取函数的 `origin` 分别恒为 `product` / `product` / `dependency`（逐条断言，不抽样）；
  - `loadAllCards().length === 地图卡数 + 产品域卡数 + 依赖仓事实卡数`，且顺序是三段拼接；
  - `dependencies/README.md` 不产生任何卡、也不进 `loadDependencies`（大小写不敏感：`README.md` 与 `readme.md` 各一条）；
  - `dependencies/` 目录不存在时两个新函数都返回 `[]`，不抛；
  - `dependencies/<名>/<子目录>/x.md` **不**被读出（只下探一层）；
  - `dependencyFreshness`：有「确认时间：2026-09-03」行时取它；只有「上游与当前版本：`b-sdk @ 1.2.3-2026.01.01`」这种形似日期的版本串时，**不**取那个串——取不到就退回 `confirmedAtOf`，本例断言不等于版本串里的日期。
- [ ] Step 2: `cards.js` 的 `loadCards` / `loadDomainCards` 返回对象各加 `origin: 'product'`（字面量写死，不从参数传）。
- [ ] Step 3: `cards.js` 新增 `loadDependencyCards(ctxDir)`：按 spec §4.1 的伪码写。目录遍历 MUST 复用既有 `isDir` 与 `readMarkdownDir`，MUST NOT 另写一套。非目录条目（声明文件、README）跳过。
- [ ] Step 4: `cards.js` 新增 `loadDependencies(ctxDir)`：读 `dependencies/*.md`，按文件名忽略 `README.md`（`toLowerCase() !== 'readme.md'`，与 `findScenes` 同一条理由）。返回 `{upstream, path, sections, raw}`。**MUST NOT 混进 `loadAllCards`**——混进去会让声明的〈用到的部分〉表被 `discover` 当卡片正文计分，把"我们调了它哪些接口"错报成外部依赖事实。在函数注释里写下这条理由。
- [ ] Step 5: `cards.js` 新增 `dependencyFreshness(raw)`：先 `^-?\s*确认时间[:：]\s*(\d{4}-\d{2}-\d{2})` 取多行匹配，取不到退回 `confirmedAtOf(raw)`。注释写清为什么不能直接用 `cardFreshness`（声明没有〈确认〉小节，会落到"全文第一个日期"，而头部的版本串可能形似日期）。
- [ ] Step 6: `loadAllCards` 改为三段拼接。**删除**旧注释 `地图卡与域卡的平铺列表`（替换清单第 4 条）——改写成"三类卡的平铺列表，每项带 `origin`"。改后 `grep -rn "地图卡与域卡的平铺列表" dw-system/` MUST 零命中。
- [ ] Step 7: `unreadableCards(ctxDir)` 扩面：对 `dependencies/` 再调一次同一个内部 `scan`，前缀写 `dependencies/`；`cards/` 那次的前缀改成 `cards/`。MUST NOT 复制第二份遍历实现。**删除**旧注释 `cards/ 目录里读不出来的 card 文件名`（替换清单第 5 条），改写成覆盖两个目录的说法。
- [ ] Step 8: `lint.js:148` 的 `violation('unreadable', \`cards/${rel}\`)` 改成 `violation('unreadable', rel)`——前缀已由 `unreadableCards` 给出，两处都加就成了 `cards/cards/…`。
- [ ] Step 9: 同步 `test/ctx-cards.test.mjs:295` 的断言：`['bad.md']` → `['cards/bad.md']`。这是契约变更不是放宽断言，路径以 `engineering-context/` 为根是 FR-015 的要求。
- [ ] Step 10: `node --test test/ctx-dependency-cards.test.mjs test/ctx-cards.test.mjs test/ctx-domain-cards.test.mjs` 预期全绿。

**验证:** AC-002 / AC-003（读取层部分）；`grep -rn "geo\|includes('dependencies')" src/` 无按路径子串判来源的写法。

---

### Task 2：`ctx get-card` 接上依赖仓两级

**Slice:** `ctx get-card agent_fs` 返回依赖声明全文并退出 0；`ctx get-card agent_fs 向量库` 返回事实卡全文；都没有时不发 cite 且 `available` 里依赖侧条目带 `[依赖]`。｜**依赖：** Task 1
**满足:** FR-006 / FR-007 / FR-008 / FR-017，§3.1 全表，§8.1 第 1/2/3 行

**Files:**
- Modify: `dw-system/skills/dw-code-facts/scripts/ctx/src/commands.js`（`getCard` 与它的 import）
- Modify: `test/ctx-dependency-cards.test.mjs`（新增「get-card」分组）

**Interfaces:**
- Changed: `getCard(ctxDir, service, domain)` 的查找顺序与返回对象（无域命中地图卡时可带 `alsoDependency: true`）
- Consumes: `loadDependencyCards` / `loadDependencies` / `dependencyFreshness`

- [ ] Step 1: 先写失败测试，逐条对应 §3.1 的六行：
  - 无域 + 有 `cards/X.md` + 有 `dependencies/X.md` → 返回地图卡全文、`alsoDependency === true`；只有地图卡时 `alsoDependency` 为假值；
  - 无域 + 无任何产品卡 + 有 `dependencies/X.md` → 返回声明全文，cite 形如 `dependencies/X.md#全文 @2026-09-03`（日期取「确认时间」行）；
  - 无域 + 无产品卡 + 无 `dependencies/X.md` + 有 `dependencies/X/<域>.md` → `cite === null`、`missing === true`、`available` 列出事实卡域名；
  - 有域 + 产品域卡与依赖仓事实卡同名 → **取产品域卡**（顺序写死，产品仓优先）；
  - 有域 + 只有依赖仓事实卡 → 取它，cite 指向 `dependencies/X/<域>.md#全文`；
  - 有域 + 只有地图卡同名小节 → 取地图卡小节；有域 + 只有依赖声明同名小节 → 取声明小节，cite 指向 `dependencies/X.md#<域>`；
  - 有域 + 四处皆无 → `cite === null`，`available` 同时含产品域卡名、`<事实卡域名>[依赖]`、地图卡小节名、`<声明小节名>[依赖]`。
- [ ] Step 2: 按 spec §4.2 的伪码改写 `getCard`。四者皆空才返回 `null`（CLI 打"未找到服务 card"退 1）。
- [ ] Step 3: 查找顺序 MUST 写死在函数里：`cards/<名>/<域>.md` → `dependencies/<名>/<域>.md` → 地图卡 `## 小节` → 声明 `## 小节`。MUST NOT 提供参数让调用方调整顺序。
- [ ] Step 4: `available` 的依赖侧条目统一加 `[依赖]` 后缀（`` `${d.domain}[依赖]` ``）。产品侧不加。
- [ ] Step 5: `getCard` 的返回对象 MUST NOT 新增 `origin` 字段——cite 路径已经以 `dependencies/` 开头，再加字段是同一事实的第二份表示（spec §2.4）。
- [ ] Step 6: CLI 侧不改逻辑，只确认 `alsoDependency` 随 `{...c}` 进了 `--json`；人读末尾追加一行 `（另有同名依赖声明：dependencies/<名>.md）`。这一行在 `cli.js` 的 `get-card` 分支拼，条件是 `c.alsoDependency`。
- [ ] Step 7: `node --test test/ctx-dependency-cards.test.mjs test/ctx-domain-cards.test.mjs test/ctx-cli.test.mjs` 预期全绿。

**验证:** AC-004 / AC-005 / AC-012（`ctx get-card README` 退 1 那半条）。

---

### Task 3：`discover` 与 `search-semantic` 区分产品仓与依赖仓

**Slice:** 只写在依赖仓事实卡里的符号能被 `discover` 命中，命中行与 out-of-scope 都带 `[依赖]` 前缀，`--json` 每项带 `origin`。｜**依赖：** Task 1
**满足:** FR-009 / FR-010 / FR-011，§3.2 / §3.3，§8.1 第 4/5/6 行

**Files:**
- Modify: `dw-system/skills/dw-code-facts/scripts/ctx/src/commands.js`（`cardLabel`、`discover` 的结果对象）
- Modify: `dw-system/skills/dw-code-facts/scripts/ctx/src/semantic.js`（结果对象加 `origin`）
- Modify: `dw-system/skills/dw-code-facts/scripts/ctx/src/cli.js`（discover 行与 semantic 行）
- Modify: `test/ctx-dependency-cards.test.mjs`（新增「检索」分组）
- Modify: `test/ctx-semantic.test.mjs`（若既有断言逐字匹配人读行，按新格式同步）

**Interfaces:**
- Produces: `originTag(origin)` → `'[依赖] ' | ''`，从 `commands.js` 导出
- Changed: `cardLabel(card)` 返回 `` `${originTag(card.origin)}${base}` ``
- Changed: `discover().cards[]` 与 `searchSemantic().results[]` 各多一个 `origin`

- [ ] Step 1: 先写失败测试：
  - 只写在 `dependencies/agent_fs/向量库.md` 里的符号 → `discover` 命中，该结果对象 `origin === 'dependency'`，同一次调用里产品域卡结果 `origin === 'product'`；
  - 该卡〈陷阱项〉的每一条都进 `outOfScope`，指称形如 `[依赖] agent_fs › 向量库: …`；产品域卡的指称**不带**前缀；
  - `searchSemantic` 的 `results[]` 含该卡的段落，带 `origin === 'dependency'`；
  - CLI 人读：`discover` 行匹配 `^• \[依赖\] agent_fs › 向量库`，`search-semantic` 行匹配 `^• \[依赖\] agent_fs/向量库 › `；
  - 依赖仓事实卡**不**吃 registry 加权（它带 `domain`，走既有分支），也**不**被分数惩罚——同分时不因来源改变顺序。
- [ ] Step 2: `commands.js` 导出 `originTag(origin)`，返回 `origin === 'dependency' ? '[依赖] ' : ''`。前缀是 ASCII 方括号固定字面量，MUST NOT 随语言或终端变化。
- [ ] Step 3: 改写 `cardLabel(card)`（替换清单第 3 条）：`base` 仍是 `service` 或 `service › domain`，外面套 `originTag(card.origin)`。
- [ ] Step 4: `discover` 的 `scored.push({...})` 加 `origin: card.origin`。计分逻辑一行不改（`card.domain ? [] : registry.filter(...)` 保持原样）。
- [ ] Step 5: `semantic.js` 的 `scored.push({...})` 加 `origin: card.origin`。分块、`authority`、freshness 降权逻辑一行不改。
- [ ] Step 6: `cli.js` 的 discover 行（现 `cli.js:196`）与 semantic 行（现 `cli.js:276`）改为在卡片名前插 `originTag(c.origin)`，从 `commands.js` import。**MUST NOT 在三处各拼一次前缀字符串**——两条 CLI 行与 `cardLabel` 共用同一个 `originTag`。
- [ ] Step 7: `node --test test/ctx-dependency-cards.test.mjs test/ctx-semantic.test.mjs test/ctx-cli.test.mjs test/ctx-domain-cards.test.mjs` 预期全绿。

**验证:** AC-006 / AC-007。

---

### Task 4：`lint-cards` 把依赖仓事实卡纳入五条既有规则，cite 整卡豁免

**Slice:** 一张缺〈陷阱项〉的依赖仓事实卡判 `sections|dependencies/agent_fs/向量库.md|缺:陷阱项`；同一张卡里指向不存在文件的 cite **不**判违规，同一段 cite 写进产品域卡**判**违规。｜**依赖：** Task 1
**满足:** FR-012 / FR-013 / FR-018，§3.4 规则表，Invariant 2，§8.1 第 7/10 行

**Files:**
- Modify: `dw-system/skills/dw-code-facts/scripts/ctx/src/lint.js`
- Modify: `test/ctx-dependency-cards.test.mjs`（新增「体检规则」分组）

**Interfaces:**
- Changed: `rootsOf(service)` → `rootsOf(card)`（替换清单第 2 条），唯一调用点同步
- Changed: `checkDomainDup(service, domainNames)` → 多一个"违规路径"参数，让依赖侧报成 `domain-dup|dependencies/<名>|…`
- Changed: `lintCards` 的 `cards` 计数含依赖仓事实卡

- [ ] Step 1: 先写失败测试，每条规则**成对**（一个必红样本 + 一个必绿样本）：
  - `sections`：缺必备小节 → `sections|dependencies/agent_fs/向量库.md|缺:陷阱项`；自造小节 → `多:本次核实`；四节齐全 + 可选节 → 零违规；
  - `budget`：`raw` 超 `BUDGET.domain` → `budget|dependencies/agent_fs/向量库.md|`；不超 → 不判。样本 MUST 从 `lint.js` import `BUDGET` 生成，MUST NOT 在测试里写死数字；
  - `dated-heading`：`### 2026-08-20 修复` → 判；正文里的日期 → 不判；
  - `trap-noise`：〈陷阱项〉里写"仍在维护" → 判；写在 `>` 引用块里 → 不判；
  - `domain-dup`：同一上游内 `向量库` 与 `向量库历史` → `domain-dup|dependencies/agent_fs|向量库~向量库历史`；跨上游同名（`agent_fs/向量库` 与 `other/向量库`）→ **不**判；
  - `cite`（成对，Invariant 2）：依赖仓事实卡里 `` `packages/search/src/vector-store/store.ts#VectorStore` `` → **不**判；同一段文字写进 `cards/order/订单导出.md` → **判**一条 `cite|cards/order/订单导出.md|…`。这一对证明豁免没有把产品侧一起放过。
- [ ] Step 2: `lintCards` 里 `deps = loadDependencyCards(ctxDir)`。
- [ ] Step 3: **改写** `rootsOf`：签名从 `service` 改成整张 `card`。函数体第一行 `if (card.origin === 'dependency') return null;`，注释写明这是与 `> 根目录：外部` 汇合的同一条分支；其余逻辑（`declaredRoot` → `'外部'` → `null`）不变。唯一调用点 `rootsOf(card.service)` 改成 `rootsOf(card)`。旧签名当场删除，不留重载。
- [ ] Step 4: `checkCites(card, roots)` **一行不改**。MUST NOT 在里面加 `if (card.origin === 'dependency') return []`。
- [ ] Step 5: `deps` 逐张跑 `checkSections(card, DOMAIN_REQUIRED, DOMAIN_OPTIONAL)` 与 `bytes(card.raw) > BUDGET.domain → budget`。复用 `DOMAIN_REQUIRED` / `DOMAIN_OPTIONAL` 两张既有表，MUST NOT 新增第五张表；复用 `BUDGET.domain`，MUST NOT 给 `BUDGET` 加字段。
- [ ] Step 6: `[...maps, ...domains, ...deps]` 逐张跑 `checkDatedHeadings` + `checkTrapNoise` + `roots = rootsOf(card); if (roots) checkCites(card, roots)`。
- [ ] Step 7: `checkDomainDup` 加一个违规路径参数（产品侧传 `path.join('cards', service)` 或 `` `${service}.md` `` 的既有拼法，依赖侧传 `path.join('dependencies', service)`）。函数内部 `normName` 的归一化只用于报重复、不用于路由，这条不变。
- [ ] Step 8: 依赖侧按上游分组跑 `checkDomainDup`：同一上游内比较，跨上游不比较。
- [ ] Step 9: `lintCards` 返回的 `cards` 计数改为 `maps.length + domains.length + deps.length`。
- [ ] Step 10: 不施加的三条**显式不做**：`sections` 不检 `dependencies/<名>.md` 本身；`registry-pointer` 不扩到 `dependencies/`（`lint.js` 的 `cards\/[^\s\`|)）]+?\.md` 正则不动）；`splitSuggestions` 不扩到依赖侧。各配一条断言。
- [ ] Step 11: `node --test test/ctx-dependency-cards.test.mjs test/ctx-domain-cards.test.mjs` 预期全绿。

**验证:** AC-008 / AC-009 / AC-013（`grep -n "origin" lint.js` 只在 `rootsOf` 内出现一次）。

---

### Task 5：`lint-cards` 判「缺依赖声明」与依赖侧 `unreadable`

**Slice:** `dependencies/foo/` 下有卡而 `dependencies/foo.md` 不存在 → 判 `sections|dependencies/foo|缺依赖声明`；两者都在 → 不判。｜**依赖：** Task 4
**满足:** FR-014 / FR-015，§3.4，§5 失败模型第 3/4 行

**Files:**
- Modify: `dw-system/skills/dw-code-facts/scripts/ctx/src/lint.js`
- Modify: `test/ctx-dependency-cards.test.mjs`（新增「缺依赖声明 / unreadable」分组）

**Interfaces:**
- Consumes: `loadDependencies(ctxDir)`

- [ ] Step 1: 先写失败测试（成对）：
  - 有 `dependencies/foo/向量库.md`、无 `dependencies/foo.md` → 判 `sections|dependencies/foo|缺依赖声明`；
  - 两者都在 → 不判；
  - `dependencies/foo/` 是**空目录**、且 `dependencies/foo.md` 也不存在 → **不**判（触发条件是"有事实卡"，空目录是常见 git 残留，判红是噪音）；
  - `dependencies/foo.md` 缺〈业务域地图〉节而目录下有卡 → **不**判（产品侧也没有"域没登记进地图表"这条规则，两侧保持对称）；
  - `unreadable`（成对，平台判据照 `test/ctx-domain-cards.test.mjs:337` 的 skip 写法：`process.platform === 'win32' || process.getuid?.() === 0` 跳过）：`dependencies/foo.md` 与 `dependencies/foo/向量库.md` 各 `chmod 000` → 各记一条 `unreadable|dependencies/…|`；恢复权限后不判。
- [ ] Step 2: `lintCards` 里对 `deps` 的每个 `service`，若 `loadDependencies(ctxDir)` 里没有同名 `upstream`，push `violation('sections', path.join('dependencies', service), '缺依赖声明')`。规则名沿用 `sections`，与产品侧 `缺地图卡` 同一形态。
- [ ] Step 3: 确认 Task 1 Step 7/8 的 `unreadable` 扩面已让依赖侧两类文件各记一条，路径以 `dependencies/` 开头。
- [ ] Step 4: `lint.js` 的 `RULE_HINT.sections` 一句补上依赖仓事实卡的口径（小节名与域卡同一套；有事实卡目录就要有同名依赖声明）。MUST NOT 在这句里抄体积数字。
- [ ] Step 5: `node --test test/ctx-dependency-cards.test.mjs test/ctx-domain-cards.test.mjs test/ctx-cli.test.mjs` 预期全绿。

**验证:** AC-010 / AC-011。

---

### Task 6：模板与文档落点，替换清单里的文本删除动作

**Slice:** 照着文档能写出一张合规的依赖仓事实卡；`grep -rn "MUST NOT 造出子目录" dw-system/` 零命中。｜**依赖：** Task 1（落点契约已定）
**满足:** FR-002 / FR-018 / FR-019，§8.2 替换清单第 6/7/8/9 条

**Files:**
- Modify: `dw-system/skills/dw-code-facts/assets/context-layer/card-domain.md`
- Modify: `dw-system/skills/dw-code-facts/assets/context-layer/dependency.md`
- Modify: `dw-system/skills/dw-code-facts/scripts/ctx/src/commands.js`（`DEPENDENCIES_README_STUB`）
- Modify: `dw-system/skills/dw-code-facts/scripts/ctx/README.md`
- Modify: `dw-system/skills/dw-code-facts/references/代码事实纪律.md`
- Modify: `dw-system/skills/dw-code-facts/SKILL.md`

**逐处删除 / 改写动作（MUST 逐条核销）:**

| # | 文件 | 删掉 / 改掉什么 | 改成什么 |
|---|---|---|---|
| 1 | `references/代码事实纪律.md` §10.2 首段 | 句尾 `MUST NOT 造出子目录。` | `声明文件本身 MUST NOT 造子目录；`dependencies/<上游名>/` 是依赖仓事实卡的专用目录。` |
| 2 | `assets/context-layer/dependency.md` 顶部引导第 3 行 | 同上一句 | 同上 |
| 3 | `scripts/ctx/src/commands.js` 的 `DEPENDENCIES_README_STUB` | 同上一句 | 同上 + 新增一段讲事实卡目录与〈业务域地图〉节 |
| 4 | `scripts/ctx/README.md` §card 格式约定 首条 | 只列地图卡与域卡两个落点的那一句 | 加依赖仓事实卡一行（落点 + 谁读它 + `list-services` 不列它） |
| 5 | `scripts/ctx/README.md` §`ctx lint-cards` 规则表 | `sections` / `budget` / `cite` 三行的施加对象描述 | 补依赖仓事实卡口径；`cite` 那行补"落在 `dependencies/` 下的事实卡整卡跳过，与 `> 根目录：外部` 同一条分支" |

- [ ] Step 1: `card-domain.md` 顶部加一段「落在 `dependencies/<上游名>/<域>.md` 时的三点差异」：① 目录名即上游名、文件名即域名，`ctx get-card <上游名> <域>` 读它；② 域名登记在 `dependencies/<上游名>.md` 的〈业务域地图〉里（不是地图卡）；③ 源码不在本项目，cite 不校验、也**不必**声明 `> 根目录：外部`，但**正因为不校验**，这张卡 MUST NOT 记本项目的调用点——调用点唯一的家是声明的〈用到的部分〉列。四节固定与上限与产品域卡完全相同。**MUST NOT 在这段里再抄一遍体积数字**（既有第 6 行已抄，保持原样、不扩散第四处）。
- [ ] Step 2: `dependency.md` 加 `## 业务域地图` 节：三列（业务域 / 一句话 / 事实卡），列形态与 `card-map.md:25-27` 的〈业务域地图〉同名同形；写清"有事实卡时 MUST 有本节，没有事实卡时整节删掉"。最小五项一字不动。改写第 3 行的子目录禁令（表第 2 行）。
- [ ] Step 3: `DEPENDENCIES_README_STUB` 同步：改写子目录禁令（表第 3 行），并补一段讲 `dependencies/<上游名>/<域>.md` 与〈业务域地图〉。**MUST 保住 `test/change-awareness.test.mjs` 已有的对照断言**：五项字样、`createOrder`、`src/order/service.ts:41`、`代码事实纪律.md §10.2` 在 stub 与模板里都要仍然在场。
- [ ] Step 4: `scripts/ctx/README.md` 按表第 4/5 行改。另在 §`ctx lint-cards` 的正文段补一句：读不出的 `.md` 现在两个目录都扫。
- [ ] Step 5: `references/代码事实纪律.md`：
  - §4.1 的两种卡表格加**第三行**「**依赖仓事实卡** | `engineering-context/dependencies/<上游名>/<域>.md` | 外部上游一个业务域的权威实现、对外接口、陷阱；小节名与域卡同一套」；并在"新事实先找所属的域"那段补一句：外部上游的事实去它的〈业务域地图〉找域，MUST NOT 落进 `cards/`。
  - §4.2 体积上限那句补"依赖仓事实卡与域卡同上限"——**MUST NOT 再写一遍数字**，就写"与域卡同一个数值"。
  - §5 cite 纪律补一句：依赖仓事实卡按位置即豁免，不必声明 `> 根目录：外部`。
  - §10.2 按表第 1 行改写子目录禁令，并补一句：该上游的事实卡与〈业务域地图〉节的写法见 §4.1 与模板。
- [ ] Step 6: `SKILL.md`：「卡片按业务域分」那条恒定规则补依赖仓事实卡的落点；〈读取条件〉表里"查不到卡片；要落笔写一张卡"那一行的模板清单加 `dependency.md` 的〈业务域地图〉去向。
- [ ] Step 7: **体积闸**。`references/代码事实纪律.md` 现为 23,671 字节，`test/doc-budgets.json` 的 `references/**` 单篇上限 24,000——只有约 330 字节余量，而本任务要往 §4.1 / §4.2 / §5 / §10.2 四处加字。**MUST NOT 改 `test/doc-budgets.json`**。处置顺序：先把新增写到最小（能指指针的不展开），仍超就在同一篇里压缩与本方案相邻的冗余表述（同一判据在 `dependency.md` / stub / README 已有展开的，纪律篇只留一句 + 指针）。压缩后 MUST 重跑 `node --test test/doc-budgets.test.mjs test/change-awareness.test.mjs test/cross-reference.test.mjs test/single-home.test.mjs test/rule-destinations.test.mjs`，确认被压掉的句子不是某条机器闸在核的判据。
- [ ] Step 8: 核销 grep：`grep -rn "MUST NOT 造出子目录" dw-system/` 零命中；`grep -rn "地图卡与域卡的平铺列表" dw-system/` 零命中（Task 1 已做，这里复核）。
- [ ] Step 9: `node --test test/change-awareness.test.mjs test/template-contract.test.mjs test/doc-budgets.test.mjs test/cards-mandatory.test.mjs test/cross-reference.test.mjs test/single-home.test.mjs test/rule-destinations.test.mjs` 预期全绿。

**验证:** AC-013 / AC-014 / AC-019。

---

### Task 7：本仓卡片刷新、CHANGELOG 条目、索引登记

**Slice:** 改完权威面后，本仓自己的代码事实层与变更日志跟上；`node --test test/doc-index.test.mjs` 从红转绿。｜**依赖：** Task 2–6
**满足:** AC-020 / AC-021 / AC-022，`代码事实纪律.md` §8（碰了权威面就刷卡）与 §10.1

**Files:**
- Modify: `engineering-context/cards/dw-system/ctx命令行.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/index.md`

- [ ] Step 1: 刷新 `engineering-context/cards/dw-system/ctx命令行.md`：
  - 〈权威实现与对外接口〉表加「依赖仓事实卡读取」一行（`cards.js#loadDependencyCards`）与「依赖声明读取」一行（`cards.js#loadDependencies`，写清它不是卡对象、不进 `loadAllCards` 及其理由）；
  - 「检索范围」行改成三类卡 + `origin`；「地图卡读取」「域卡读取」两行补 `origin: 'product'`；
  - 「get-card」行改成四级查找顺序 + `available` 的 `[依赖]` 标注 + `alsoDependency`；
  - 「卡片体检」行的"七条规则"改成现行条数与新扫描面；「cite 规则的解析口径」行补"依赖仓事实卡整卡跳过，与 `> 根目录：外部` 同一条分支"；
  - 「读不出的卡」行补 `dependencies/` 扫描面与带前缀的返回值；
  - 〈陷阱项〉加两条：把 `origin` 改成按路径子串推断（换个目录名即静默失效）；在 `checkCites` 里另加一条 `origin` 提前返回（两条豁免必然漂移，且漂移方向是"本该校验的被放过"）；
  - 〈测试入口〉加 `test/ctx-dependency-cards.test.mjs`；
  - 〈确认〉改写成一行 `2026-09-22｜来源：…`（**改写不追加**）。
  - 卡片体积 MUST 仍在 `BUDGET.domain` 之内：改完跑 `node dw-system/skills/dw-code-facts/scripts/ctx/src/cli.js lint-cards`，无新增违规。
- [ ] Step 2: `CHANGELOG.md` 的 `## 未发布` 下写条目。**MUST NOT 定版本号、MUST NOT 把 `## 未发布` 改名、MUST NOT 打 tag。**
  - `不兼容`（来自 §8.1 拍板为不兼容的行，一行一条，每条以**被改变的判据实体名**开头，含旧调用方式 / 新调用方式 / 迁移步骤）：至少覆盖 `ctx get-card <上游名>`（§8.1 第 2 行：退出码语义变了）、`ctx lint-cards`（第 7 行：扫描面扩到 `dependencies/`，存量项目首跑可能红，迁移是删基线重建）、`ctx discover` / `ctx search-semantic` 的人读行（第 6 行：多出 `[依赖]` 前缀，按 `^• (\S+)` 取服务名的脚本要改）、`unreadableCards` 的返回值（裸文件名 → 带 `cards/` / `dependencies/` 前缀）、`ctx probe` 的 A 类输入（第 9 行：棘轮基线可能要人工剪）。
  - `新增`：依赖仓事实卡这个资产位、`dependencies/<上游名>.md` 的〈业务域地图〉节、`--json` 的 `origin` / `alsoDependency` 字段。
  - `变更`：模板与纪律篇的落点说明。
  - 其余小节留空但保留标题（五类闭集，MUST NOT 自造第六类）。
- [ ] Step 3: `docs/index.md` 的现行区登记本次 spec 与本 plan（按该文件既有条目格式；单条 `maxBytes` 为 360，见 `test/doc-budgets.json` 的 `lines` 段，写完核对不超）。
- [ ] Step 4: `node --test test/doc-index.test.mjs test/doc-budgets.test.mjs test/change-awareness.test.mjs` 预期全绿（`doc-index` 那条在本任务之前是**基线红**，原因就是 spec 未登记）。

**验证:** AC-020 / AC-021 / AC-022。

---

### Task 8：全量验证与跨仓实跑

**Slice:** 23 条 AC 逐条过；在真实项目上跑通 `ctx get-card` 与 `ctx search-semantic`。｜**依赖：** Task 1–7
**满足:** AC-001 / AC-015 / AC-016 / AC-017 / AC-018 / AC-023

- [ ] Step 1: `node --test test/ctx-*.test.mjs` 全绿（AC-016）。
- [ ] Step 2: `node --test test/*.test.mjs` 全绿（AC-017）。**MUST NOT 为了让测试变绿而放宽断言或跳过用例**；跑不过就报出来。
- [ ] Step 3: 人工核对 grep 三条：
  - `grep -rn "16000\|16,000" dw-system/skills/dw-code-facts/scripts/ctx/src/` 只命中 `lint.js` 的 `BUDGET` 那一行（AC-013）；
  - `grep -n "origin" dw-system/skills/dw-code-facts/scripts/ctx/src/lint.js` 只在 `rootsOf` 内出现一次（AC-009）；
  - `grep -rn "MUST NOT 造出子目录\|地图卡与域卡的平铺列表" dw-system/` 零命中（AC-014 / AC-019）。
- [ ] Step 4: 人工核对 spec §0 齐全（AC-001）、§8.1 十条都有结论且与 §3 / §4 一致（AC-018）。
- [ ] Step 5: 跨仓实跑（AC-023，**只读**）：在 `/Users/weidwonder/projects/aiudit_platform/.worktrees/context-cards-split` 上用本 worktree 的 CLI 跑
  - `node <本worktree>/dw-system/skills/dw-code-facts/scripts/ctx/src/cli.js get-card agent_fs Excel索引产物 --dir <那个worktree>/engineering-context`
  - `… search-semantic "Excel 区域切分" --dir <那个worktree>/engineering-context --json`（`results[].origin` 能看到 `dependency`）
  - **MUST NOT 修改那个项目的任何文件，MUST NOT 在那个仓跑 git 命令。** `--dir` 只读，不写；MUST NOT 在那边跑 `lint-cards --init-baseline`（它会写基线文件）。
  - 那批资料若还没搬完，如实记为"未命中"并说明卡在哪一步，MUST NOT 据此改本仓代码去迁就。
- [ ] Step 6: 按任务分段提交已在各 Task 末尾完成；本步只做最终 `git status` 核对与收尾提交。

**验证:** 23 条 AC 全表。

---

## 风险与处置

| 风险 | 征兆 | 处置 |
|---|---|---|
| `代码事实纪律.md` 撞 24,000 字节上限 | `node --test test/doc-budgets.test.mjs` 红 | 按 Task 6 Step 7：压缩同篇冗余，MUST NOT 改 `test/doc-budgets.json`，MUST NOT 把判据整句删掉（删前先确认同一判据在别处哪一句还在） |
| `unreadableCards` 契约变更打到别处 | `test/ctx-cards.test.mjs` / `test/ctx-cli.test.mjs` 红 | 断言按新契约同步（路径以 `engineering-context/` 为根），不是放宽；`list-services` 的 ⚠ 行文案按 §8.1 第 8 行**保持**写"card" |
| 本仓 `ctx lint-cards` 因扫描面扩大冒新违规 | Task 7 Step 1 的 lint 出现 `dependencies/` 开头的违规 | 本仓 `engineering-context/dependencies/` 下若只有 README，不会产生事实卡违规；真冒出来的按规则修卡，MUST NOT 建基线绕过 |
| 跨仓实跑命中不了 | `get-card` 退 1 | 先确认那边的文件是否已落到 `dependencies/agent_fs/<域>.md`；只读排查，MUST NOT 动那个仓 |
