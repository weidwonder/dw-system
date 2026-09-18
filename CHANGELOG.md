# CHANGELOG

> 每次合并到主分支写一条；`不兼容` 条目以对外接口名开头，含旧调用方式 / 新调用方式 / 迁移步骤。规则见 `dw-system/skills/dw-code-facts/references/代码事实纪律.md` §10.1。
> 2.17.0 之前的历史不回填：按版本看 git tag `v<版本>`，按设计依据看 `docs/spec/`。

## 未发布

### 不兼容

### 新增

### 变更

### 修复

### 内部
- `.gitattributes` 强制 LF 检出：机器闸按行切文本、按字节量体积，Windows 上 `core.autocrlf=true` 的检出此前会让十来条闸误判。两条只在 Windows 上红的测试改成跨平台写法（路径分隔符、动态 `import` 用 `file://`）。

## 3.0.0 — 2026-09-17

迁移指南：`dw-system/migrations/3.0.0.md`。

### 不兼容
- `ai-dev-workflow` / `ai-prd`（skill 名与安装目录）—— 旧：`.claude/skills/ai-dev-workflow/`、`.claude/skills/ai-prd/`（`.agents/` 同）；新：`dw-workflow`、`dw-prd` 及另外六个 `dw-*` skill；迁移：重跑安装器，旧目录与旧版本戳由它删除。
- `<!-- ai-dev-workflow:start/end -->`（标记块起止行，Codex 约束块与 `.gitignore` 块同理）—— 旧：`ai-dev-workflow` / `ai-dev-system` 前缀；新：`dw-workflow` / `dw-system` 前缀；迁移：重跑安装器，三个字段与 `docs/` 入库决定逐字带入。
- `mode`（标记块字段）—— 旧：新块仍写 `mode` 墓碑字段，skill 侧可据它推断协作面；新：新块不写 `mode`，skill 读到旧名字的块即请用户重跑安装器，推断只由安装器做；迁移：重跑安装器。
- `ctx`（兜底调用路径与全局链接归属）—— 旧：`<skills 目录>/ai-dev-workflow/scripts/ctx/src/cli.js`；新：`<skills 目录>/dw-code-facts/scripts/ctx/src/cli.js`；迁移：重跑安装器重链全局命令，脚本里写死的路径手工改。
- `路径-lean.md`（Lean 自足册）—— 旧：Lean 全程只读这一册，各篇判据在册内各有一份；新：一页步骤顺序，每一步的判据在对应 skill；迁移：无需动作。
- `dw-workflow` 的 `references/core/`、`references/capability/`（分册路径）—— 旧：判据分册都在 `dw-workflow` 名下；新：评审门、文档治理、代码事实层、bug 诊断、worktree 纪律分属 `dw-review-gate`、`dw-doc-governance`、`dw-code-facts`、`dw-bug-diagnosis`、`dw-worktree`，`代码评审纪律.md` 拆为七篇、`文档治理.md` 拆出 `文档生命周期.md`；迁移：自己文档里写死了旧路径的手工改，逐小节去向见 `docs/report/2026-09-17-dw-3.0-规范去向清单.md`。
- `assets/context-layer/card.md`（卡片模板）—— 旧：每仓一张单文件卡；新：地图卡 `card-map.md` + 域卡 `card-domain.md`，小节名固定；迁移：存量卡片仍读得出，跑一次 `ctx lint-cards --init-baseline`，之后碰到哪个域搬哪个域。
- 注入标记块（正文）—— 旧：约 16KB，判据就地写全；新：约 5KB，只留常驻规则与指针；迁移：重跑安装器。
- GitHub 仓库与 npm 包名 —— 旧：`weidwonder/ai-dev-system`；新：`weidwonder/dw-system`；迁移：安装命令改用新地址。
- `install.mjs`（旧本地检出里的 2.x 安装器）—— 旧：在旧检出里跑 `./install.mjs <目标>` 可装任意版本的源；新：2.x 安装器不认识 `dw-system/` 目录，装不了 3.0 的源；迁移：先 `git pull` 更新检出，或改用 `npx --yes git+https://github.com/weidwonder/dw-system.git <目标>`。
- 评审子代理（派发前置）—— 旧：prompt 里点名加载 `ai-dev-workflow`、读 `references/core/代码评审纪律.md`；新：点名加载 `dw-review-gate`（文档轴另加 `dw-doc-governance`，查代码事实另加 `dw-code-facts`），模板在 `dw-review-gate` 的 `子代理模板.md`；迁移：自己存了旧派发 prompt 的，按新模板重填。
- 决策记录与索引行（目标项目的文档）—— 旧：来历可写在规范正文、spec 或卡片里，索引一条可多行；新：来历只进 `docs/decisions/`，索引每条一行；迁移：存量豁免，新建与被触碰的文档按新口径写。
- 卡片增删口径（`代码事实纪律.md` §4.2）—— 旧："只增不减"，卡内可留变更记录；新："事实不丢，体积有上限"，卡片只写现状，变更记录进变更日志、bug 修复历史或决策记录；迁移：存量豁免，碰到哪张卡改哪张，`ctx lint-cards` 的 `dated-heading` 会点名。
- cite 形态 —— 旧：`路径:行` 为主；新：`路径#符号` 为主，行号漂移不再让 cite 失效；迁移：存量 `路径:行` 仍合法，新写的 cite 用 `路径#符号`。
- `test/contract-numbers.mjs` 的 `ENTRY_MAX_BYTES` 与清单行数下限（本仓库机器闸）—— 旧：入口字节上限与行数下限散在各自的测试里；新：并入 `test/doc-budgets.json`；迁移：改上限只改这一份清单，超限按两条总纲的固定顺序处置。
- `test/wording-redline.test.mjs`（本仓库机器闸）—— 旧：规范词条数只增不减；新：`test/rule-destinations.test.mjs`，消失的含规范词小节须在 `docs/report/*规范去向清单.md` 交代去向，条数增减只打印不判红；迁移：删除、合并或搬走小节时登记去向清单。

### 新增
- 两条总纲与〈归属表〉（`dw-workflow/SKILL.md`）：一个事实只有一个家；规范文本有体积上限，超限先搬走、再压缩、最后才抬上限。目标项目侧的归属表在 `文档治理.md`。
- skill `dw-prose`：完整命题规则、各类文本必须写什么、只写现状、清理推理残留。
- skill `dw-review-gate`、`dw-doc-governance`、`dw-code-facts`、`dw-bug-diagnosis`、`dw-worktree`：各带入口与〈读取条件〉表。
- `文档治理.md` §决策记录：来历与被否决方案的唯一去处；索引每条一行。
- `ctx lint-cards`：卡片体检七条规则（固定小节、体积、带日期的小节名、cite、域名近似重复、registry 指针、陷阱项噪音）与只减不增的基线 `cards-lint-baseline.json`。
- `ctx` 域卡：`get-card <repo> <域>` 先读 `cards/<repo>/<域>.md`；`discover`、`search-semantic`、`probe` 覆盖域卡；`list-services` 输出带 `domains`。
- `ctx probe` 题型 `authority-unique`（别名〈权威面唯一〉）。
- 安装器：旧版残留清理（计划输出单列一段，`--dry-run` 同样打印）；旧名字集中在 `LEGACY` 表。
- 评审门文档轴与 skill 原则轴的"同一事实有没有两个家"检查项。
- 设计原则 YAGNI / KISS / DRY / LoD 成文（`dw-workflow` 的 `实现纪律.md` §设计原则）：写 spec 方案与写代码都守，spec 自检清单、两份 spec 模板、评审门规范轴按它判。

- 安装器：两个入口的标记块字段不一致时，打印 `AGENTS.md` 原来的字段行与将按 `CLAUDE.md` 统一的提示；读到旧名字的块一律打印改写前后对照；块类残留逐项核销后各打印一行"已改写"。
- `ctx lint-cards`：读不出的卡记 `unreadable` 违规；基线文件损坏退出 2 并点名文件；`--init-baseline` 列出按业务域拆分的建议；`domain-dup` 覆盖还没拆成域卡的单文件卡；没有卡片而 registry 有违规时照常列出。
- 机器闸：`cross-reference` 加查 `<skills 根>/…` 形态的文件路径必须存在、跨 skill 的引用同一行必须点名属主 skill；`doc-budgets` 的例外条目写成 `{max, note}`、高于同类上限而没有 note 判红、单条上限规则一行都匹配不到判红；`rule-destinations` 的射程加上仓库根 `CLAUDE.md` 并打印规范词条数增减；`gate-sync` 要求入口点到每道贯穿门的名字；`change-awareness` 按当前版本有没有打 tag 判"本次有没有写条目"。
### 变更
- `merge-gate="pr"` 的项目：合并即发布，完成与自动合并门兼作发布门（PR 带发版件、放行合并后打 tag）；此前写"自动合并不等于擅自发布上线"。`direct` 不变。
- 代码事实纪律 §4.2「只增不减」改为「事实不丢，体积有上限」：地图卡 8,000、域卡 16,000、registry 单格 300 字节，超限先搬来历再按域拆。
- 卡片里指向源码的 cite 以 `路径#符号` 为主，行号可附。
- `ctx` 读最近确认日期的顺序：〈确认〉小节 → 〈Freshness / Provenance〉小节 → 全文第一个日期；标题含"陷阱"的小节整节按误用警告处理。

### 修复
- `ctx`：软链接的卡片文件与域卡目录读得到了（域卡读取改用目录项类型判断时，软链接被无声跳过）。
- 拆分 skill 时机械改名留下的失效指针：Lean 评审子代理被指去加载 `dw-workflow`（应为 `dw-review-gate`）、`dw-prd` 与 `init-初始化.md` 里 `ctx` 的兜底路径指向 `dw-workflow/scripts/`（应为 `dw-code-facts`）、`collab/` 三处空指针、`dw-doc-governance` 里指向不存在的 `assets/` 的四处、环境冲突扫描的自排除清单只列两个 skill。
- 搬家与注入块瘦身时弱化或丢掉的命题按 2.17 原文补回（逐条见 `docs/report/2026-09-17-dw-3.0-代码评审与特性损失审计.md`）。

### 内部
- 机器闸换代：`wording-redline`、`resident-budget`、`number-drift`、`contract-sync`、`lean-selfcontained` 退役；新增体积清单闸 `doc-budgets`、规范去向清单闸 `rule-destinations`、规范句重复检测闸 `single-home`、`installer-legacy-upgrade`、`ctx-domain-cards`。契约测试改问"判据在它的家里"，计数词闸扫描面扩到整棵 skills 树。
- 仓库 `CLAUDE.md` 重写为常驻规则（约 7KB），细则下沉到 `dw-system/skills/AGENTS.md` 与 `test/AGENTS.md`。
- `test/change-awareness.test.mjs` 最后一条断言改为「`## 未发布` 在版本节之前 + 全文至少一条条目」：发版刚改完名时 `未发布` 合法为空，原断言会判红；「每次合并至少写一条」由完成门的 first-parent 检查守。

## 2.17.0 — 2026-09-16

### 不兼容
- `完成与自动合并门`（准出项集合）—— 旧：不要求变更日志；新：多一项"仓库根 `CHANGELOG.md` 的 `## 未发布` 下有本次分支写的条目"（缺则退回实现阶段补，门内不代写）+ 一条 SHOULD 的 first-parent 漏写检查；迁移：每次合并前在实现阶段写条目即可，存量项目首次合并时新建该文件，无其他动作。
- `忠实轴`（评审门 B 轴职责）—— 旧：只对照 spec 的 FR/AC 与 coding plan；新：多一项 spec §8.1 兼容取舍表 ↔ CHANGELOG `不兼容` 条目的逐行对照，缺一行记 `漏做`；迁移：无需动作，条目在实现阶段写好即通过。
- `上游升级处置`（`代码事实纪律.md` §10.2）—— 旧：升级上游按普通改动走；新：命中触发时 MUST 按"读声明 → 读上游 CHANGELOG 取交集 → 无 CHANGELOG 派 1 个子代理看 diff → 无声明先补声明"的顺序；迁移：首次升级某上游时补一份 `engineering-context/dependencies/<上游名>.md`。
- `ctx init`（骨架输出集合）—— 旧：不含 `dependencies/`；新：多生成 `engineering-context/dependencies/README.md`（`--minimal` 不变）；迁移：存量项目首次补声明时直接建目录，不要求重跑 init。
- `合并到主分支`（准入约定）—— 旧：不要求写变更日志；新：每次合并 MUST 在仓库根 `CHANGELOG.md` 至少写一条，五类闭集，无声明式豁免；迁移：无需动作。

### 新增
- `代码事实纪律.md` §10「变更感知：CHANGELOG 与依赖声明」（触发式）：上游侧每次合并写 CHANGELOG 的形态与时机、发版规则（只是规则不是门）；下游侧依赖声明的载体与最小五项、上游升级的处置顺序与两条兜底。
- `assets/context-layer/dependency.md` 依赖声明模板；Lean 自足册 §3.11 / §3.12；入口〈加载点清单〉两行；注入片段 `base.md` 两条。
- 机器闸 `test/change-awareness.test.mjs`。

### 变更
- 卡片模板 `## 上下游` 的"下游（我调谁）"行改为指向 `dependencies/` 的指针。
- `文档治理.md` §硬规则 与总纲 / Lean 侧的根目录例外清单加入仓库根 `CHANGELOG.md`。

### 修复

### 内部
- 本仓库自身落这份 `CHANGELOG.md` 作为第一个实例；`VERSION` 2.16.0 → 2.17.0，未建迁移指南（零手动动作）。
