---
lifecycle: active
superseded_by: ''
archived: ''
last_confirmed: '2026-09-17'
authority_refs:
  - '安装器的名字常量与旧名字残留清单（LEGACY）'
  - '安装器升级旧安装的卸载与改写顺序'
  - 'ctx get-card 的域卡解析顺序'
  - 'ctx lint-cards 的规则集、基线文件与退出码'
  - 'ctx probe 题型 authority-unique'
  - '体积上限清单 test/doc-budgets.json 的形态与处置顺序'
  - '规范句重复检测闸与规范去向清单闸的判据'
---

# dw-system 技术 Spec — 安装器迁移、ctx 卡片体检与机器闸

> 本文只覆盖 [变更 PRD](./2026-09-17-dw体系重组与两条总纲-PRD.md) 里动到可执行代码的部分：`install.mjs`、`ctx` CLI、`test/`。skill 文档的拆分、清理与更名以 PRD 为 spec，实现落点在 coding plan。
> 本文按 RFC 2119 解释 MUST / MUST NOT / SHOULD / MAY。

## 0. 阅读导引

- **一句话目的**：让 3.0.0 的安装器把旧名字的安装就地升级成 `dw-` 体系，让 `ctx` 能读域卡并体检卡片质量，让两条总纲各有机器闸。
- **端到端场景**：
  1. 2.17.0 项目重跑安装器 → 计划里列出"旧版残留清理"各项 → 确认后旧 skill 目录与旧戳被删、三处旧标记块被新块取代、字段值与"docs 是否入库"的决定原样带过去 → 再跑一次无任何改动。
  2. 全新项目安装 → 只出现新名字；计划里没有"旧版残留清理"一段。
  3. 在整仓单卡 146KB 的项目里首次跑 `ctx lint-cards --init-baseline` → 写出基线、退出 0；之后有人给卡片加了一个带日期的小节 → `ctx lint-cards` 退出 1 并点名那一条。
  4. 维护者压缩某篇分册、删掉了一个含 MUST 的小节却没在去向清单里交代 → `node --test` 判红并点名该小节。
- **核心流程图**（安装器升级路径）：
  ```mermaid
  flowchart TD
    A[读目标项目] --> B{有新名字的戳或块?}
    B -->|有| C[按新名字读取设置]
    B -->|无| D{有旧名字的戳/块/skill 目录?}
    D -->|有| E[按旧名字读取设置, 记入残留清单]
    D -->|无| F[全新安装]
    C --> G[打印计划: 复制 + 残留清理]
    E --> G
    F --> G
    G --> H{dry-run?}
    H -->|是| I[结束, 磁盘无变化]
    H -->|否| J[确认] --> K[删旧 skill 目录与旧戳] --> L[复制新 skill, 写新戳] --> M[新块取代旧块: gitignore / Codex 约束 / 标记块] --> N[ctx 重链到新位置]
  ```
- **决策表**：

  | 输入 / 状态 | 条件 | 处置 | 结果 |
  |---|---|---|---|
  | 两个入口都只有旧标记块 | 含 `collaboration` | 字段原样带入新块，删旧块 | 新块，无 `mode` |
  | 只有旧标记块 | 只含 `mode` | 按现有推断规则得出协作面与合并方式后写新块 | 新块，无 `mode` |
  | 新旧标记块并存 | — | 以新块为准，旧块删除 | 只剩新块 |
  | 旧 `.gitignore` 块含入库决定行 | — | 决定值带入新块，不发问 | 新块 |
  | 全局 `ctx` 是指向旧 skill 目录的符号链接 | 链接路径含旧 skill 名 | 判为本体系所有，重链 | 指向 `dw-code-facts` |
  | 全局 `ctx` 判不出归属 | — | 不动，打印兜底调用方式 | 同现状 |

## 1. 范围

- 本仓库做什么：安装器更名与旧残留迁移；`ctx` 新增域卡解析、`lint-cards` 命令、`authority-unique` 题型；`test/` 新增三条闸、退役五条、其余改路径。
- **不做什么**：不改 `ctx` 既有命令的名字、参数与输出；不自动拆分存量卡片；不改伴生 skill、代码图谱、冲突插件三段安装逻辑；不回改历史文档里的旧名字。
- 依赖的上游 / 被依赖的下游：无新增。
- **既有系统清单**：

| 既有模块 / 机制 | 从哪知道它的 | 本次可能怎么碰到 | 卡片补了吗 |
|---|---|---|---|
| 名字常量与默认仓库地址 | `install.mjs:54,64,97,143-159` | 全部换新名字，旧名字收进 LEGACY | 本次更新 `engineering-context/cards/ai-dev-system.md` |
| 标记块字段模型与 `mode` 推断 | `install.mjs:496-607` | 读取新增"旧块"来源；写出不含 `mode` | 同上 |
| 已装版本判定 | `install.mjs:1333-1341` | 增加旧戳与旧 skill 目录两个来源 | 同上 |
| skill 发现与复制 | `install.mjs:730-748` | 复制前增加旧目录删除 | 同上 |
| `.gitignore` 块与入库决定 | `install.mjs:401-438` | 读取新增"旧块"来源；旧块删除 | 同上 |
| Codex 冲突约束块 | `install.mjs:389-399,478-487` | 旧块删除 | 同上 |
| 全局 `ctx` 归属判定 | `install.mjs:1042-1059` | 符号链接路径段同时认新旧两个 skill 名 | 同上 |
| card 读取与按 `## ` 切段 | `scripts/ctx/src/cards.js:9-66` | 增加子目录域卡 | 同上 |
| probe 题型分派与现行区 spec 收集 | `scripts/ctx/src/probe.js:424-440,717-770` | 新增一个题型，复用现行区收集 | 同上 |
| 规范条数棘轮 | `test/wording-redline.test.mjs` | 退役，由规范去向清单闸取代 | 无需卡片 |
| 常驻前置量与契约数字三件套 | `test/resident-budget.test.mjs`、`test/number-drift.test.mjs`、`test/contract-numbers.mjs`、`test/contract-sync.test.mjs` | 退役，由体积上限清单取代 | 无需卡片 |
| Lean 自足册覆盖率 | `test/lean-selfcontained.test.mjs` | 随自足册取消而退役 | 无需卡片 |

### 1.1 功能需求

| 编号 | 需求 |
|---|---|
| FR-001 | 安装器的包内目录、默认仓库地址、包名与命令名、版本戳文件名、三处标记块的起止行、入库决定行前缀、`ctx` 归属的 skill 名、注入片段所在 skill，全部使用新名字（§2.1）。 |
| FR-002 | 安装器 MUST 用一张 LEGACY 表集中登记全部旧名字（§2.1），旧名字 MUST NOT 散落在其它位置。 |
| FR-003 | 已装版本按"新戳 → 旧戳 → 旧 skill 目录存在则 1.0.0 → 新 skill 目录存在则 1.0.0 → 全新安装"判定。 |
| FR-004 | 升级时 MUST 删除两个 skills 目录下 LEGACY 登记的旧 skill 目录与旧戳；删除发生在用户确认之后、复制新 skill 之前。 |
| FR-005 | 标记块：新块优先，无新块才读旧块；字段值原样带入；旧块里的 `mode` 只用于现有推断，新块 MUST NOT 含 `mode`；写入新块的同一次写入里删除该入口的旧块；打印改写前后的字段行对照。 |
| FR-006 | Codex 冲突约束块：任何模式下都删除旧块；新块按现有模式逻辑写或不写。 |
| FR-007 | `.gitignore` 块：入库决定按"新块 → 旧块"读取，读到即不发问；旧块删除；新块列新 skill 目录与新戳。 |
| FR-008 | 全局 `ctx`：归属判定的符号链接路径段同时认新旧两个 skill 名；确认归属后重链到新位置。 |
| FR-009 | 计划输出 MUST 含"旧版残留清理"一段，逐项列出本次发现的残留；没有残留时整段不出现；`--dry-run` 打印同样内容且磁盘无变化；同一项目第二次运行无残留、无改写。 |
| FR-010 | 版本 `3.0.0`；迁移指南 `migrations/3.0.0.md` 含〈结论〉〈需要的动作〉〈行为变化知会〉三节且 ≤45 行。 |
| FR-011 | `ctx get-card <仓库> [域]`：存在 `cards/<仓库>/<域>.md` 时读该文件，否则读 `cards/<仓库>.md` 里同名的 `## ` 小节；`discover`、`search-semantic` 的检索范围包含域卡；`list-services` 只列地图卡。 |
| FR-012 | 新命令 `ctx lint-cards`：规则集、基线与退出码见 §3.2、§4.2。 |
| FR-013 | 卡片模板拆为地图卡与域卡两份；`ctx init` 的骨架说明同步。 |
| FR-014 | 新 probe 题型 `authority-unique`（别名〈权威面唯一〉）：现行区任意两份文档的 `authority_refs` 出现归一化后相同的条目即判失败并列出成对文件。 |
| FR-015 | 体积上限闸：清单 `test/doc-budgets.json` + `test/doc-budgets.test.mjs`（§2.3、§4.3）。 |
| FR-016 | 规范句重复检测闸 `test/single-home.test.mjs`（§4.4）。 |
| FR-017 | 规范去向清单闸 `test/rule-destinations.test.mjs`（§4.5），取代 `wording-redline`。 |
| FR-018 | 既有契约测试：断言"某条规则存在"的，改指向新住处、断言不变；断言"两份副本保持同步"的，随其中一份副本取消而退役。退役名单见 §8.2。 |

## 2. 数据模型 / 数据结构

### 2.1 名字表

| 项 | 新名字 | LEGACY |
|---|---|---|
| 包内目录 | `dw-system/` | `ai-dev-system/`（只存在于旧源，安装器不读） |
| 默认仓库 | `https://github.com/weidwonder/dw-system.git` | — |
| 包名 / 命令名 | `dw-system` | — |
| skill 目录 | `dw-workflow` `dw-prd` `dw-review-gate` `dw-doc-governance` `dw-code-facts` `dw-bug-diagnosis` `dw-worktree` `dw-prose` | `ai-dev-workflow` `ai-prd` |
| 版本戳 | `dw-system.version` | `ai-dev-system.version` |
| 标记块 | `<!-- dw-workflow:start -->` / `<!-- dw-workflow:end -->` | `<!-- ai-dev-workflow:start -->` / `<!-- ai-dev-workflow:end -->` |
| Codex 约束块 | `<!-- dw-system:codex-conflicts:start -->` / `…:end -->` | `<!-- ai-dev-system:codex-conflicts:start -->` / `…:end -->` |
| `.gitignore` 块 | `# dw-system:gitignore:start` / `…:end` | `# ai-dev-system:gitignore:start` / `…:end` |
| 入库决定行前缀 | `# dw-system:project-docs-in-git=` | `# ai-dev-system:project-docs-in-git=` |
| `ctx` 所在 skill | `dw-code-facts` | `ai-dev-workflow` |
| 注入片段所在 skill | `dw-workflow` | `ai-dev-workflow` |

`ctx` 的命令名、`--help` 首行签名串、`engineering-context/` 目录名不变。

### 2.2 卡片体检基线

文件 `engineering-context/cards-lint-baseline.json`，入库：

```json
{ "version": 1, "violations": ["<规则>|<相对路径>|<键>"] }
```

`键` 是该规则下区分同文件多条违规的稳定串（小节名、cite 原文、域名对）；无则为空串。数组按字典序排序，保证 diff 稳定。

### 2.3 体积上限清单

`test/doc-budgets.json`：

```json
{
  "files":   { "<仓库相对路径>": <字节上限> },
  "classes": [ { "glob": "<模式>", "max": <字节上限>, "note": "<一句话>" } ],
  "totals":  [ { "glob": "<模式>", "groupBy": "<路径段序号>", "max": <字节上限> } ],
  "lines":   [ { "file": "<路径>", "entryPattern": "<正则>", "maxBytes": <单条上限> } ],
  "blockExcluded": { "file": "CLAUDE.md", "start": "<!-- dw-workflow:start -->", "end": "<!-- dw-workflow:end -->" }
}
```

`files` 优先于 `classes`；同一文件被多个 `classes` 命中取最先一条。

## 3. 接口契约

### 3.1 安装器

命令行参数不增不减。新增输出段：

```
  旧版残留清理（ai-dev-system 2.x → dw-system）：
       - 删除 .claude/skills/ai-dev-workflow/
       - 删除 .claude/skills/ai-dev-system.version
       - CLAUDE.md：ai-dev-workflow 标记块 → dw-workflow 标记块
           旧：(mode="team" collaboration="solo" merge-gate="direct" worktree-dir="./.worktrees/")
           新：(collaboration="solo" merge-gate="direct" worktree-dir="./.worktrees/")
       - .gitignore：忽略规则块改名，docs 入库决定沿用 yes
```

### 3.2 `ctx lint-cards`

| 用法 | 行为 | 退出码 |
|---|---|---|
| `ctx lint-cards` | 跑全部规则；与基线比对；打印新增违规与"已修掉、可从基线移除"的条目 | 无新增 0；有新增 1 |
| `ctx lint-cards --init-baseline` | 基线文件不存在时写出当前全部违规；已存在则拒绝 | 0；已存在 2 |
| `ctx lint-cards --prune-baseline` | 从基线移除已不再出现的条目；MUST NOT 添加 | 0 |
| `ctx lint-cards --json` | 同第一行，机器可读输出 | 同第一行 |

没有 `engineering-context/cards/` 或目录为空：打印"没有卡片可检"，退出 0。

规则集：

| 规则 | 判据 |
|---|---|
| `sections` | 域卡的 `## ` 小节集合 MUST ⊇ {职责, 权威实现与对外接口, 陷阱项, 确认} 且 ⊆ 前者 ∪ {测试入口, 日志与排障, 端侧补充}。地图卡 MUST ⊇ {职责, 业务域地图} 且 ⊆ 前者 ∪ {对外入口总览, 跨域陷阱, 上下游, 测试入口, 日志与排障, 确认} |
| `budget` | 地图卡 ≤ 8,000 字节；域卡 ≤ 16,000；registry 任一单元格 ≤ 300 |
| `dated-heading` | 任一 `##`/`###` 标题含 `20\d{2}-\d{2}-\d{2}` |
| `cite` | 反引号内形如 `路径#符号` 或 `路径:行` 的 cite：路径按"项目根 → 地图卡声明的根目录"解析；文件 MUST 存在；`#符号` MUST 能在该文件里检索到；`:行` MUST 不超过文件行数。地图卡〈职责〉下声明 `> 根目录：外部` 的仓库跳过本规则 |
| `domain-dup` | 同一仓库内两个域名归一化（去空白与标点）后相等，或一个是另一个的前缀且较短者 ≥4 个字符 |
| `registry-pointer` | registry 单元格里出现的 `cards/…​.md` 指针 MUST 指向存在的文件 |
| `trap-noise` | 〈陷阱项〉内出现"非废弃""仍在维护""持续维护" |

### 3.3 `authority-unique` 题型

探针行：类型 `authority-unique`（或〈权威面唯一〉），输入为索引路径（缺省 `docs/index.md`），期望留空。归一化：去首尾空白、去反引号与引号、连续空白折成一个；`无` 不参与比对。

## 4. 核心逻辑

### 4.1 安装器升级顺序

1. 只读阶段（全部发生在任何写入之前，任何一步抛错都不留半截改动）：解析两个入口的新块与旧块 → 解析 `.gitignore` 新块与旧块 → 判定已装版本 → 扫描两个 skills 目录里的 LEGACY 目录与旧戳 → 汇成残留清单。
2. 打印计划（含残留清单与迁移指南）→ `--dry-run` 到此结束。
3. 确认后按序写入：删旧 skill 目录与旧戳 → 复制新 skill、写新戳 → `.gitignore`（同一次写入里删旧块、并入新块）→ Claude 设置 → Codex 约束（删旧块，再按模式处理新块）→ 标记块（每个入口同一次写入里删旧块、并入新块；两入口同一实体文件时只写一次）→ 伴生 skill → `ctx` → 代码图谱。

同一入口的"删旧块 + 并入新块"MUST 在内存里合成最终文本后一次写出，MUST NOT 分两次写文件。

### 4.2 `lint-cards`

```
cards  = 地图卡(cards/*.md) + 域卡(cards/*/*.md)
found  = ⋃ 规则(cards, registry) → "<规则>|<路径>|<键>"
base   = 读基线（无文件 → 空集）
new    = found − base ;  fixed = base − found
打印 new 与 fixed ;  退出码 = new 为空 ? 0 : 1
```

基线只经 `--init-baseline`（从无到有）与 `--prune-baseline`（只减）变化；没有任何命令能往既有基线里加条目。

### 4.3 体积上限闸

逐项取字节数与上限比较；清单点名的文件不存在判红；`classes` 的 glob 零命中判红（防止改名后静默失守）。无论红绿都打印"实测 / 上限 / 余量"三列表。判红信息 MUST 写出处置顺序：搬走 → 压缩 → 抬上限。

### 4.4 规范句重复检测

范围 `dw-system/skills/**/*.md`，跳过代码围栏。按行、再按 `。；` 切句；取含 `MUST` 或 `SHOULD` 的句子；归一化（去 `*` `` ` `` `>` 与列表符号、去全部空白与中英文标点）；长度 <24 个字符的丢弃。同一归一化句出现在 ≥2 个文件即判红，除非在 `test/single-home.allow.json` 里登记（`sentence` / `files` / `reason` 三项齐全，`reason` 非空）。白名单里已不再重复的条目判红（防止白名单只增不减）。

### 4.5 规范去向清单闸

基线取 `git merge-base HEAD <主分支>`；取不到时打印"本闸未生效"并通过。对基线树里 `ai-dev-system/skills/**` 与 `dw-system/skills/**` 下每个含 `MUST`/`SHOULD` 的小节（文件 + 最近的 `##`/`###` 标题），若 HEAD 里同路径同标题已不存在，则 MUST 在本分支新增的某份 `docs/report/*规范去向清单.md` 里有一行：`| 原位置 | 去向 | 说明 |`。去向三选一：新位置（文件 + 标题，MUST 在 HEAD 存在）、`并入 <新位置>`、`删除`（说明列非空）。本闸同时打印各文件规范词条数的增减，只作信息，不判红。

## 5. 错误处理

| 失败 | 处置 |
|---|---|
| 旧块与新块字段值非法 | 沿用现有行为：报错中止，列出合法值域，不写任何文件 |
| 旧 skill 目录删除失败（权限） | 中止并点名路径；此时尚未复制新 skill，项目保持旧安装可用 |
| 旧 skill 目录是符号链接 | 只删链接本身，不进入链接目标 |
| `lint-cards` 读不出某张卡 | 记为 `unreadable|<路径>|` 违规，不抛栈 |
| 基线 JSON 损坏 | 退出 2 并点名文件，MUST NOT 当作空基线继续 |

## 6. 安全 / 不变量

```
Invariant 1: 安装器只删除 <目标>/.claude/skills/ 与 <目标>/.agents/skills/ 下、名字逐字等于 LEGACY 登记项的条目。
- 强制机制：删除路径由"固定父目录 + LEGACY 常量"拼出，不接受任何外部输入；删除前校验解析后的路径仍以父目录为前缀。
- 违反时：抛错中止。

Invariant 2: 标记块迁移前后，collaboration / merge-gate / worktree-dir 三个字段的值逐字相等。
- 强制机制：写入后重新解析新块并与写入前解析结果比对。
- 违反时：抛错中止并点名字段。

Invariant 3: 没有任何 ctx 命令能向既有基线添加条目。
- 强制机制：基线写入只有两个入口，一个要求文件不存在，一个只做差集。
- 违反时：不适用（结构上不可达）；测试植入"--prune-baseline 时出现新违规"验证不被写入。

Invariant 4: 每条新闸都带一条植入坏样本的自检；自检失败整条闸判红。
```

## 7. 可观测性

安装器沿用现有 `✓` / `⚠` 行风格，残留清理每项一行 `✓ 已删除 …` / `✓ 已改写 …`。`lint-cards` 每条违规一行：`<规则>  <路径>  <键>  —  <一句话怎么改>`。

## 8. 兼容性 / 迁移

### 8.1 兼容取舍决策

| 被改变的既有行为 | 谁在依赖它 | 用户决定 | 到期日 | 到期动作 | 确认时间 |
|---|---|---|---|---|---|
| skill 名改为 `dw-workflow` 系列 | 所有已安装项目 | 不兼容（安装器自动卸载旧目录） | — | — | 2026-09-17 |
| 标记块名跟着改 | 所有已安装项目 | 不兼容（安装器自动改写） | — | — | 2026-09-17 |
| 体系、仓库、包名、戳、各块整体更名 | 所有已安装项目 | 不兼容（安装器自动调整残留） | — | — | 2026-09-17 |
| C1 新块不写 `mode`，升级时仍读旧 `mode` | 无 | 不兼容 | — | — | 2026-09-17 |
| C2 安装命令与包名改为 `dw-system` | 记着旧命令的人 | 兼容一段时间（平台跳转） | 无（跳转失效即结束） | 无 | 2026-09-17 |
| C3 旧本地检出的 2.x 安装器装不了新源 | 长期不更新检出的人 | 不兼容 | — | — | 2026-09-17 |
| C4 Lean 自足册取消 | 所有已安装项目 | 不兼容 | — | — | 2026-09-17 |
| C5 入口字节上限与清单行数下限并入体积清单 | 本仓库维护者 | 不兼容 | — | — | 2026-09-17 |
| C6 规范条数"只增不减"改为"去向须交代" | 本仓库维护者 | 不兼容 | — | — | 2026-09-17 |
| C7 注入块瘦身 | 所有已安装项目 | 不兼容 | — | — | 2026-09-17 |
| C8 决策记录成为来历的唯一去处；索引单条一行 | 目标项目新建文档 | 不兼容（存量豁免） | — | — | 2026-09-17 |
| C9 评审子代理改加载 `dw-review-gate` | 所有已安装项目 | 不兼容 | — | — | 2026-09-17 |
| C10 卡片改为地图卡 + 域卡 | 存量卡片 | 兼容一段时间（单文件小节照旧可读） | 无 | 靠体检基线只减不增逐步迁完 | 2026-09-17 |
| C11 "只增不减"改为"事实不丢"，卡内不留变更记录 | 新写与被触碰的卡片 | 不兼容（存量豁免） | — | — | 2026-09-17 |
| C12 cite 以 `路径#符号` 为主 | 新写的 cite | 不兼容（存量 `路径:行` 合法） | — | — | 2026-09-17 |

### 8.2 替换清单

| 被取代物 | 类型 | 取代者 | 处置 | 保留理由 + 到期日 |
|---|---|---|---|---|
| `ai-dev-system/` 目录 | 目录 | `dw-system/` | 改名 | — |
| `skills/ai-dev-workflow/`、`skills/ai-prd/` | 目录 | 八个 `dw-` skill | 拆分 / 改名 | — |
| `references/core/路径-lean.md` | 文件 | `dw-workflow` 的一页 Lean 步骤顺序 | 删除 | — |
| 入口〈加载点清单〉里"取哪一篇"的行 | 文档段 | 各 skill 的 description | 删除 | — |
| 安装器里散落的旧名字常量 | 常量 | 新常量 + LEGACY 表 | 删除 | — |
| 安装器写 `mode="team"` 的逻辑 | 函数片段 | 无 | 删除 | — |
| 读旧块 `mode` 的推断 | 函数 | 无 | 保留 | 回滚与升级路径显式依赖：1.x 项目只有它能带出协作面；无到期日，随 LEGACY 表一并评估 |
| `test/wording-redline.test.mjs` | 测试 | `test/rule-destinations.test.mjs` | 删除 | — |
| `test/resident-budget.test.mjs`、`test/number-drift.test.mjs`、`test/contract-numbers.mjs`、`test/contract-sync.test.mjs` | 测试 | `test/doc-budgets.test.mjs` | 删除 | — |
| `test/lean-selfcontained.test.mjs` | 测试 | 无（副本已取消） | 删除 | — |
| `assets/context-layer/card.md` | 模板 | `card-map.md`、`card-domain.md` | 删除 | — |
| `代码事实纪律.md` §4.2「只增不减」 | 规则 | 「事实不丢」 | 改写 | — |

### 8.3 数据迁移 / 灰度

无数据迁移。发布顺序：合并 → 打 tag `v3.0.0` → 托管平台改仓库名 → 旧、新两条安装命令各实跑一次 `--dry-run`。平台改名这一步由拍板人单独确认后执行。

## 9. AI 契约补充

不适用。

## 10. 状态机

不适用。

## 11. 完成定义

| 编号 | 验收项 | 满足 |
|---|---|---|
| AC-001 | §0 阅读导引齐全 | — |
| AC-002 | 全新目录安装后，两个 skills 目录、两个入口、`.gitignore` 里检索不到 LEGACY 表中任何旧名字 | FR-001 FR-002 |
| AC-003 | 以 2.17.0 形态的夹具项目升级：旧 skill 目录与旧戳消失；三个字段与入库决定逐字保留；新块不含 `mode`；计划输出含残留清单与前后对照 | FR-003 FR-004 FR-005 FR-006 FR-007 FR-009 |
| AC-004 | 只有 `mode` 的 1.x 夹具升级后得到与现有推断规则一致的新块 | FR-005 |
| AC-005 | 同一夹具第二次运行：无残留段、无文件改写 | FR-009 |
| AC-006 | `--dry-run` 前后目标目录逐字节相同 | FR-009 |
| AC-007 | 旧 skill 目录是符号链接时只删链接；LEGACY 名字之外的同目录条目不被触碰 | FR-004 |
| AC-008 | `globalCtxIsOurs` 对指向旧 skill 路径的链接返回真 | FR-008 |
| AC-009 | `VERSION` 为 3.0.0；迁移指南通过既有迁移契约测试 | FR-010 |
| AC-010 | 域卡文件优先、单文件小节兜底、`list-services` 不列域卡，三条各有用例 | FR-011 |
| AC-011 | `lint-cards` 七条规则各有一个坏样本判红、一个好样本通过；基线三条命令的退出码与"只减不增"各有用例；基线损坏退出 2 | FR-012 |
| AC-012 | 两份卡片模板通过模板↔解析器往返契约 | FR-013 |
| AC-013 | `authority-unique` 对重复声明判失败并列出成对文件；`无` 不触发 | FR-014 |
| AC-014 | 体积闸：超限、点名文件缺失、glob 零命中三种各判红；打印三列表 | FR-015 |
| AC-015 | 重复检测闸：植入重复判红；白名单缺理由判红；白名单陈旧条目判红 | FR-016 |
| AC-016 | 去向清单闸：植入"删了含 MUST 的小节且无清单行"判红；去向指向不存在的位置判红；取不到基线时打印未生效并通过 | FR-017 |
| AC-017 | §8.2 标为删除的文件在仓库中不存在，且全仓检索无对它们的现行引用 | FR-018 |
| AC-018 | `node --test test/*.test.mjs` 全绿 | — |
| AC-019 | 代码评审门逐轴通过，P0/P1 清零 | — |
| AC-020 | `engineering-context/cards/` 本仓库的卡片已按新形态更新 | — |

覆盖自查：FR-001→AC-002；FR-002→AC-002；FR-003→AC-003；FR-004→AC-003/AC-007；FR-005→AC-003/AC-004；FR-006→AC-003；FR-007→AC-003；FR-008→AC-008；FR-009→AC-003/AC-005/AC-006；FR-010→AC-009；FR-011→AC-010；FR-012→AC-011；FR-013→AC-012；FR-014→AC-013；FR-015→AC-014；FR-016→AC-015；FR-017→AC-016；FR-018→AC-017。

## 12. 待澄清点

无。

## 13. 过稿记录

- 2026-09-17｜已定稿｜拍板人对 §1 范围、§1.1 功能需求、§8.1 兼容取舍、§11 完成定义整体回复「同意」；其中「规范去向清单按小节粒度、小节内命题保全交评审门 skill 原则轴」这一取舍单独摆出并获同意。
