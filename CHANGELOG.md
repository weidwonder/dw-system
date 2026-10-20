# CHANGELOG

> 每次合并到主分支写一条；`不兼容` 条目以对外接口名开头，含旧调用方式 / 新调用方式 / 迁移步骤。规则见 `dw-system/skills/dw-code-facts/references/代码事实纪律.md` §10.1。
> 2.17.0 之前的历史不回填：按版本看 git tag `v<版本>`，按设计依据看 `docs/spec/`。

## 未发布

### 不兼容
- `preview.mjs slot --agreed --agreed-plan=<id>=done|void`（`dw-prd` 原型改稿放行）—— 旧：约定为已落实 / 作废的用户批注从批注块删除；新：条目保留并写 `released: done|void`，放行前该条最后一句 MUST 是 AI 回复，否则拒绝写入并列出缺回复的条目；迁移：放行前先对每条 `done` / `void` 跑 `preview.mjs reply <文件> --to <id> --text "<落实了什么 / 为什么作废>"`。
- `preview.mjs annotations`（人读输出）—— 旧：每条批注一行加原话；新：开头一行待处理总数，每条用户意见带「待处理 / 已回复」与完整对话，用户对说明的回复按说明分组成串；`--json` 只增字段（顶层 `pending`，`items[]` / `global[]` 的 `status` 与 `thread`，`replies[]` 的 `by`，有用户回复的 `ai[]` 条目的 `status`）；迁移：按行解析人读输出的脚本改读 `--json`。
- `dw-prd` 原型页面上点用户批注图钉 —— 旧：弹出改原话的编辑框；新：弹出对话浮层（原话、AI 与自己的往来、追加框，原话仍可改可删）；迁移：无需手工动作。

### 新增
- `preview.mjs reply <文件> --to <u<n>|g<n>|a<n>> (--text <文本> | --from <文件>)`：AI 在一条用户元素批注、全局反馈或对 AI 说明的回复下面追加回复，写进原型；用户在页面上看到并可继续追加。最后一句是 AI 即已回复，否则待处理；`dw-prd` 落盘确认门前待处理数 MUST 为 0。本版之前生成的原型照写，页面上看不到，命令会提示改在对话里转告。
- 原型页面：已回复的用户批注图钉换成中性色，工具栏显示待 AI 处理数，全局反馈面板里每条反馈与界面已改掉的批注都能点开对话；写回撞版本冲突时按字段合并、对话按 id 取并集，`reply` 刚写进文件的回复不会被页面覆盖。

## 3.2.0 — 2026-10-12

### 不兼容
- `dw-review-gate` 评审子代理的阅读范围 —— 旧：评审范围内的文件各轴一律通读评判；新：与已过评审门的上游版本逐字节一致、或由其注入 / 生成工具原样写出的文件，主会话核实后在派发 prompt 里点名排除，各轴只评接入面，轴集合不变（`评审门禁.md` §上游已评审的原样带入内容，`子代理模板.md`〈评审对象〉新增占位行）；迁移：自写评审 prompt 的项目照新占位行补一项，没有原样带入内容时删掉该行即与旧行为一致。
- `ctx get-card <上游名>`（不给域）—— 旧：只看 `cards/`，依赖名必然落空，打印「未找到服务 card」并退出 1；新：没有产品卡而有 `dependencies/<上游名>.md` 时返回该声明全文、发 cite `dependencies/<名>.md#全文 @<确认时间>`、退出 0；迁移：把 `get-card` 退出码当「这个名字有没有卡」用的脚本与 agent，改判 `--json` 的 `missing` 字段，不要再用退出码区分"未登记"与"取到了"。
- `ctx lint-cards`（扫描面）—— 旧：只扫 `engineering-context/cards/`；新：同时扫 `dependencies/`（依赖声明与依赖仓事实卡），事实卡按域卡那套固定小节、体积、`dated-heading`、`trap-noise`、`domain-dup` 检，有事实卡而无同名声明判 `sections|dependencies/<名>|缺依赖声明`；迁移：已跑过 `--init-baseline` 的存量项目升级后首跑会冒出基线外新违规而判红——基线只许变短，修不掉的那部分只能删掉 `cards-lint-baseline.json` 重新 `--init-baseline`。
- `ctx discover` / `ctx search-semantic`（人读输出的卡片指称）—— 旧：命中行一律 `• <service>[ › <domain>]`，out-of-scope 行一律 `<service> › <domain>: …`；新：来自依赖仓的卡片在名字前加 `[依赖] ` 前缀，产品仓不变，`--json` 的 `cards[]` / `results[]` 每项多一个 `origin`（`product` / `dependency`）；迁移：按 `^• (\S+)` 取服务名的脚本会把 `[依赖]` 当成服务名，改读 `--json` 的 `service` 与 `origin`。
- `unreadableCards(ctxDir)`（返回值形态；`ctx list-services` 的 `⚠ N 张 card 读不出来` 与 `--json.unreadableCards` 读它）—— 旧：返回裸文件名或 `<repo>/<文件名>`；新：一律带 `cards/` 或 `dependencies/` 前缀，路径以 `engineering-context/` 为根；迁移：按裸文件名匹配这两项的 CI 断言改成匹配带前缀的相对路径。
- `ctx search-semantic`（结果集与排序）—— 旧：候选集只有产品仓的地图卡与域卡；新：并入依赖仓事实卡，不做任何折扣、按分数自然排，上游卡片体量大时（如二十多条陷阱的 `agent_fs`）产品仓条目会被挤出 `--top` 默认的 5 条；迁移：靠默认 top-N 取结果的脚本与 agent，改用 `--top` 调大取数，或按 `--json` 的 `origin` 过滤到 `product` 之后再截断。
- `ctx discover`（结果集与排序）—— 旧：候选集只有产品仓的地图卡与域卡；新：并入依赖仓事实卡。本命令**不截断**、也没有 `--top` 参数，变的是命中列表整体变长与排序位次；迁移：按位次取前几条的脚本与 agent，改按 `--json` 的 `origin` 过滤后再取。
- `ctx discover` 的 out-of-scope 警告列表 —— 旧：只列产品域卡〈陷阱项〉里的条目；新：命中的依赖仓事实卡，其〈陷阱项〉与产品域卡同等待遇逐条进，列表因此变长；迁移：把 out-of-scope 行数当门禁阈值或摘要长度上限的调用方，按新的条数重定阈值，MUST NOT 靠截断丢掉依赖侧的警告——那正是最该看到的外部陷阱。
- `ctx get-card <名>`（名字同时命中产品仓卡片与依赖声明时）—— 旧：只返回地图卡全文加一行 cite，没有任何其他输出；新：cite 之后多一行「（另有同名依赖声明：`dependencies/<名>.md`）」，`--json` 多一个 `alsoDependency: true`；迁移：按行位取 `get-card` 输出末行的脚本改读 `--json`，MUST NOT 按输出行数判定。
- `ctx get-card <名> <域>`（查找层级）—— 旧：只查 `cards/<名>/<域>.md` 与地图卡同名小节，其余一律退出 1；新：四级查找，第 2 级 `dependencies/<名>/<域>.md`、第 4 级依赖声明的同名小节，产品仓在前、命中即退出 0，**任何已有 `dependencies/*.md` 的存量项目升级后立刻生效**；迁移：把「退出 1 = 这个域没登记」当判据的脚本改判 `--json` 的 `missing`，并注意返回的 cite 路径可能以 `dependencies/` 开头。
- `ctx probe` 的 A 类题型输入 —— 旧：`loadAllCards` 只给产品地图卡与域卡；新：并入依赖仓事实卡，`deprecated-trap` 因此可从上游卡片的〈陷阱项〉取证，此前失败的题可能转 PASS，门禁自检的「card 废弃段」样本来源同步扩大；迁移：已有 probe 棘轮基线的项目升级后首跑可能因「基线里某编号已不再失败」判 RED，按棘轮规则人工把该编号从 `probe-set.md` 的基线段删掉。
- `test/doc-budgets.json`（清单形态，本仓库维护用，不随 skill 分发）—— 旧：`totals` 按 skill 合计 `references/` 并给 `dw-workflow`、`dw-prd` 冻结值；新：不再有合计上限，只判单篇、类、单条行长与 `CLAUDE.md`，清单出现判定逻辑不认识的顶层键即判红；迁移：无需手工动作，往清单加新种类的上限要先在 `test/doc-budgets-lib.mjs` 写判定。
- `dw-review-gate` 忠实轴的职责 —— 旧：只逐条对照 spec 查漏做、镀金、越界；新：另查实现逻辑是否成立与被波及的既有调用方，既有行为变了却不在兼容取舍表里记 `越界`（`评审轴.md` §评审轴、`子代理模板.md`〈本轴职责〉），偏离类型仍是五类；迁移：自写评审 prompt 的项目照模板补这三行，同样的改动可能比以前多报 P0。
- `dw-review-gate` 评审意见的处置 —— 旧：主会话按评审意见直接改，包括推翻已拍板事项的意见；新：要改兼容取舍、spec 过稿结论或大架构的意见，回到对应那道确认门由拍板人重定（`评审处置.md` §处置）；迁移：无需手工动作。
- `dw-workflow` 交接文档（`上下文卫生.md` §2 规则 2）—— 旧：四项内容，只在过载信号出现时写；新：多当前位置（worktree、分支、HEAD、未提交改动）与验证状态两项，拍板人要求换会话或换执行者时也写，新会话先读文档再对照仓库核对；迁移：存量交接文档不用补，下次交接按新口径写。
- `dw-workflow` 环境冲突扫描的范围（`环境冲突扫描.md` §扫描范围）—— 旧：只扫项目级的入口正文与 skills / agents / commands；新：加上 `~/.claude/` 与 `~/.codex/` 下的同类位置与登记的挂钩；迁移：已初始化的项目要体检时说一句"扫描 dw 体系"重扫，新冒出的冲突项逐条决断。

### 新增
- 依赖仓事实卡 `engineering-context/dependencies/<上游名>/<域>.md`：外部上游的事实有了与产品仓域卡同等待遇、但不和产品仓卡片平级摆放的位置。目录名即上游名、文件名即域名，小节名、模板（`card-domain.md`）与体积上限都与域卡相同；`ctx get-card <上游名> <域>` 直接取它，`discover` / `search-semantic` / `probe` 一并检索它，它的〈陷阱项〉逐条进 out-of-scope。
- `dependencies/<上游名>.md` 新增〈业务域地图〉节（业务域 / 一句话 / 事实卡路径）：一个上游仍然只有一个入口文件，最小五项一字未动。
- `ctx get-card <名> <域>` 的四级查找：`cards/<名>/<域>.md` → `dependencies/<名>/<域>.md` → 地图卡同名小节 → 依赖声明同名小节，产品仓在前；`missing` 时的 `available` 覆盖四处来源，依赖侧条目标 `[依赖]`。名字同时命中产品仓与依赖侧时产品仓优先，人读末尾提示一行、`--json` 给 `alsoDependency: true`。
- `dw-workflow` 的 `实现纪律.md` §委派执行：把 coding plan 派给子代理或外部编码工具时按 checkpoint 分批、写明独占文件与回报内容，收回后主会话亲自重跑验证并读 diff；另立通用纪律"不得为让测试变绿而削弱、跳过或删除测试"。
- `dw-bug-diagnosis` Phase 2 第 6 条：回归类问题用 `git bisect run <红回路命令>` 定位引入提交。
- `dw-worktree` 合并收尾：移除 worktree 之前先停掉本任务在里面启动的后台进程。
- `eng-spec.md` 模板 §4：有两个以上可行方案时写出各自依赖的关键假设与选择理由。
- `测试资产纪律.md` §敏感信息：凭证的值不出现在对话、日志、文档、卡片与提交信息里，只写文件路径与字段名。

### 变更
- 依赖仓事实卡的 cite 整卡跳过校验，走的是地图卡 `> 根目录：外部` 那条既有分支（`rootsOf` 返回 `null`），没有第二条豁免路径；这类卡因此 MUST NOT 记本项目的调用点，调用点的家仍是依赖声明的〈用到的部分〉列。
- 「依赖声明文件名含 `/` 要替换成 `__`、MUST NOT 造出子目录」一句改写为「声明文件本身 MUST NOT 造子目录；`dependencies/<上游名>/` 是依赖仓事实卡的专用目录」，`代码事实纪律.md` §10.2、`assets/context-layer/dependency.md` 与 `ctx init` 生成的 `dependencies/README.md` 三处同改。

### 修复
- `dw-workflow` 环境冲突处置的保护范围与执行时机：「未经同意不得删改」改为覆盖扫描范围内的全部文件（含 commands、挂钩与入口正文）；`init-初始化.md` 与 `worktree开发纪律.md` 写明用户级文件的处置排在进入 worktree 之后、直接作用于用户目录、不随分支提交。
- 安装器不再把 `codegraph upgrade` 的退出码当作升级成功：本机同时装了 npm 包与独立包时，`upgrade` 升的是它自己那份而 PATH 优先命中另一份，导致每次安装都报同一个「有新版本」。改为升级后重新探测版本，仍落后于远端就退回 `npm install -g …@latest`，npm 也换不掉则告警提示本机有多份副本。

## 3.1.0 — 2026-09-21

### 不兼容
- 入口文件顶部的 `dw-workflow` 提示块（`<!-- dw-workflow:hint:start/end -->`）—— 旧：入口文件顶部没有这个块；新：重跑安装器即在**已存在**的入口文件最前面写入它，被标记块顺带创建出来的入口只带标记块；迁移：无需手工动作，重跑安装器即补上。
- 注入标记块（"skill 在哪"一句）—— 旧：`skill 在 .claude/skills/<名>/（Codex 在 .agents/skills/<名>/）`；新：`skill 在项目级或全局的 <skills 根>/<名>/（路径见 dw-code-facts）`；迁移：重跑安装器即改写，无需手工动作。

### 新增
- 入口文件顶部的 `dw-workflow` 提示块：`AGENTS.md` / `CLAUDE.md` 最前面写一段「动手前先加载 `dw-workflow`」，正文随 skill 分发（`dw-workflow/assets/config-snippets/hint.md`）。首次由 skill 初始化写，已有标记块的项目重跑安装器即补上；只写进写入前就已存在的入口文件，两个都不在时只写 `AGENTS.md`，标记块的既有行为一条未改。
- `install.mjs --global`：把全部 skill 装进本机 `~/.claude/skills/` 与 `~/.codex/skills/`，所有项目共用，不改任何项目文件；冲突插件改为从本机直接卸载（`--keep=` 保留、`--no-plugins` 跳过），全局 `ctx` 链接到用户级副本，codegraph 全局接线不建索引。与目标目录、`--shared`、`--docs-in-git`、`--codex-conflicts`、`--codegraph-location=local` 互斥。项目级安装检测到全局安装时提示两份并存。

### 变更
- 各 skill 文档里 `<skills 根>` 的说明同步覆盖全局安装。README 删去手工 `cp` 全局安装的写法，改指 `--global`。

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
