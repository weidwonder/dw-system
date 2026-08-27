# Codebase Card — ai-dev-system

> 本仓库是 AI 辅助开发方法论的分发包（两个 skill + 零依赖 CLI），不是应用。
> 事实以合入后的源码为准。每条对外接口带 `文件:行`。

## 原型容器（ui-prototype.html）

- **职责**：`ai-prd` 产出的 UI 原型的唯一容器——自带默认视觉基线、设计系统、图标库、批注框架与按屏状态切换；由 `preview.mjs init` 复制建出，产出方只填具名插槽。
- **对外接口**
  - 分区标记（`<!-- MARK:BEGIN … END -->`，`check` 按 `FIXED_REGIONS` 校验齐全）：`THEME`、`PROJECT-THEME`、`DESIGN-SYSTEM`、`CUSTOM-CSS`、`ANNO-FRAMEWORK:CSS`、`ICONS`、`TITLE`、`NOTES`、`SCREENS`、`SCREEN-SCRIPT`、`CUSTOM-JS`、`ANNOTATIONS`、`ANNO-FRAMEWORK:JS` — `ai-dev-system/skills/ai-prd/assets/templates/ui-prototype.html:14,57,62,644,649,831,879,887,894,901,950,954,970`
  - 画布单列布局 `.stage { display: block }`（不再有右侧常驻栏）— `:548-552`
  - 屏注解区 `.device-wrap > .screen-notes`（`__title` / `__body` / `__acts` 三个子位），挂在设备壳之外；`.device-wrap.is-anno-right` 改挂右侧 — `:561-588`
  - 设计说明面板 `#proto-notes-panel`（默认 `hidden`，工具栏 `[data-act="notes"]` 展开），`NOTES` 插槽与 `#proto-notes` 仍在其中 — `:885-893`
  - `SCREEN-SCRIPT` 固定区导出**唯一**全局 `window.setScreenState(screenEl, nextState)` —— 只认屏元素与目标态，**不认按钮**（按钮行为归 `CUSTOM-JS` 插槽）— `:901-911`
  - 批注数据块 `<script type="application/json" id="anno-data">`，schema 仍是 `prd-annotations@1`，字段 `global[]` / `items[]` / **`replies[]`**（`replies[].noteId` ↔ AI 说明的 `data-anno-id`）— `:954-968`
  - 批注框架 JS：`serialize()` 剥运行时状态（只认三种表达：`.screen` 上的 `state-*` 类、`[data-state]` 的 `aria-pressed`、`[data-anno-runtime]` 自报），并把 `#proto-notes-panel` 复位为 `hidden` — `:1076-1118`；`write()` 带 `If-Match` 版本头，`adoptLatest(latestHtml, latestVersion)` 按 id 合并磁盘与内存两侧 — `:1119-1170`；`openNote()` 承载对 AI 说明的增删改回复 — `:1552-1620`；工具栏 `bar.innerHTML` 按序为 标题/加注释/全局反馈/隐藏批注/**计数**/spacer/**设计说明**/save/复制 JSON/状态灯 — `:1272-1282`；`paint()` 令 `复制 JSON` 在 `SERVED && servedOk` 时隐藏、save 按钮在同条件且无脏数据时隐藏 — `:1303-1345`
  - 批注气泡渲染：`data-anno` → note 气泡、`data-anno-kind="question"` → ask 气泡（琥珀）、`items[]` → user 气泡 — `:1432` 一带
  - 图钉的定位与层级契约：`attach()` 恒给宿主加 `data-anno-host`（点图钉靠它 `closest` 回宿主），**只有 computed position 为 `static` 的宿主取值 `rel`** 才被 `[data-anno-host="rel"] { position: relative }` 提升；图钉贴宿主**内侧**（`top: 2px`、`right: 2 + n*21`）、`z-index: 880` — `:706-735,1423-1440`
- **陷阱项**
  - 用非上述三种方式改 DOM 状态，`serialize()` 还原不掉，写回时状态被烘进文件且零报错。
  - `serialize()` 若漏了 `#proto-notes-panel` 的复位，用户展开设计说明后的写回会把"展开"烘进文件。
  - 批注块注释里刻意不写取批注命令（命令含本区结束标记字样，写进去会让按标记取段的读法提前截断）— `:954-958`
  - `window.setScreenState` **MUST NOT** 扩成认按钮名的形态——那会把按钮语义写进容器，越过 PRD 非目标 3。
  - 提升定位 MUST NOT 改回无条件施加：`[data-anno-host]` 与作者的单 class 规则同权重且排在后面，无条件提升会把 `position: absolute` 的元素打回文档流、当场错位且零报错。同理 `attach()` 里的判定 MUST 只在首枚图钉时做——此刻宿主可能已被上一枚提升成 `relative`，再判一次会把提升撤掉。
  - 图钉的偏移 MUST NOT 改回负值（元素外侧）：任何 `overflow: auto|hidden` 的祖先都会把它整枚裁掉，用户会以为批注没保存成功。
  - 自定义样式的 `z-index` 上限是 880（框架自留层从此起算：图钉 880 < 设计说明面板 890 < 工具栏 900 < 批注弹窗 1000 < 拾取光标 1100）；图钉的层级 MUST 落在这段区间的下沿，拉高到框架自身之上会反过来遮住工具栏与弹窗。
- **确认时间**：2026-08-27

## 原型工具（preview.mjs）

- **职责**：`ai-prd` 唯一脚本，六条子命令覆盖原型全流程（建/加屏/填插槽/取批注/自检/预览服务）。零第三方依赖，跨平台。
- **对外接口**
  - `SLOTS` **七个**具名插槽 `title | subtitle | screens | notes | theme | custom | script`，区间一律由 `markRange()` 按 `MARK:BEGIN/END` 界定 — `ai-dev-system/skills/ai-prd/scripts/preview.mjs:40-160` 一带
  - `annoBlockRange()` 定位批注块**限定在 `ANNOTATIONS` 标记区间内**取，不做全文 `indexOf` — `:166-180` 一带
  - `screenSkeleton(name, states, desktop, annoRight)` 生成 `.device-wrap > .device-name + .device + .screen-notes`，`--anno-right` 加 `is-anno-right` — `:217-242`
  - `cmdSlot` 的放行契约：`--agreed` + `--agreed-plan`（闭集 `done|void|move`），受影响集 = 丢锚点项 ∪ 显式声明的 `move` 项；`--drop-anchors` 已废除，传入报错退出码 2 — `:274-300` 一带
  - `cmdSlot` 写入后的等值不变式**无条件执行**（先删后验，不因"没有放行"跳过），不等即 `拒绝写入：本次替换会改动批注块…这是 bug` — `:353-367`
  - `cmdAnnotations` 输出**三类 + 回复**：用户元素批注 / 全局反馈 / AI 侧说明（标待拍板）/ 用户对说明的回复（带被回复说明原文）— `:461-505`
  - `cmdCheck` 十二类检查（编号不变，屏注解区、按屏状态入口、注解区按钮行为三项并进第 6/7/8 类）— `:558-760` 一带
  - `cmdServe` 版本化写回：`versionOf()` 取内容 SHA-256，GET/HEAD 回 `X-Proto-Version`，`POST /save` 认 `If-Match` 头或 `?v=` 查询参数（二者等价，后者供 `sendBeacon`），版本不符回 **409 + `{version, html}`**；`serializeWrite()` 用 Promise 链关掉 TOCTOU 窗口 — `:769-850` 一带
  - `FIXED_REGIONS` 含 `SCREEN-SCRIPT`，**不含** `CUSTOM-JS`（后者是插槽，产出方要写）— `:508`
  - `HELP` 文案含七个插槽名、`--anno-right` 与放行参数 — `:889` 一带
- **陷阱项**
  - `SLOTS.screens` / `notes` / `theme` / `custom` / `script` **没有 `re` 字段**，误引用 `slot.re` 会静默失效（`match(undefined)` 给空匹配、`replace(undefined,…)` 当字面串）——历史上撞出过 `screen` 命令零改动却退出 0。
  - 判空 MUST 在剥外壳**并**去注释之后，否则出厂 `<!-- SCREENS -->` 占位注释被当成已有内容。
  - 终止用抛 `Abort` 不用 `process.exit()`（管道下输出会被截断而退出码正常）。
  - 批注块定位 MUST 限定在 `ANNOTATIONS` 区间内：全文 `indexOf` 时，片段里夹带一个假 `id="anno-data"` 块会让放行数据写进假块、真块原样不动，命令照常打印放行清单并退出 0（实测撞出过，文件里留下三个批注块）。
  - `script` 插槽写入 MUST 转义 `</script`，否则内容提前闭合脚本标签。
- **确认时间**：2026-08-27

## 文档治理与命名（ai-dev-workflow）

- **职责**：定义本体系产出文档的目录、命名、生命周期字段与索引门控。
- **对外接口**
  - §默认命名 的文件名范式，**每条都以 `YYYY-MM-DD-` 开头**；末尾逃生口收窄为"日期前缀与目录不可改变" — `ai-dev-system/skills/ai-dev-workflow/references/core/文档治理.md` §默认命名
  - §文档生命周期与索引门控：`lifecycle` / `last_confirmed` / `authority_refs`
  - §TODO 出口
  - 机器闸 `test/doc-index.test.mjs` 的 `collectDocs(rootDir)`（导出的纯函数，`walk()` 递归子目录）校验前缀与索引收录
- **陷阱项**：字段名是 `lifecycle` 不是 `status`；前缀规则的例外是**常青档与两份索引**（`REQUIREMENTS.md` / `ARCHITECTURE.md` / `TODO.md` / `index.md` / `index-archive.md` 与 `docs/requirements/` 下的一级子模块），清单在 §默认命名。
- **确认时间**：2026-08-27

## UI 原型纪律（ai-prd）

- **职责**：原型的产出、结构、自检、批注框架与写回路径的权威判据。
- **对外接口**
  - §2 原型命名 `docs/spec/YYYY-MM-DD-<name>-prototype.html`（日期在前）
  - §5 PRD「UI 原型」五项表（三类模板同一套项）
  - §6 交付前自检清单（「**未经约定**失联的一条报一条 P0」、「每个声明覆盖的状态都在该屏注解区里有对应切换按钮且按钮有行为」）
  - §7 批注框架三区表与写入方声明；§7.5 设计说明、§7.6 屏注解区、§7.7 放行契约
  - §8.1 命令表、§8.2 屏结构、§8.3 class 与 hook、§8.4 项目样式
- **陷阱项**：批注数据块的写入方现在有**两个**——页面工具栏，以及 §7.7 显式放行路径上的 `slot`；**AI 手工编辑本块仍然禁止**。三层归属是闭集，MUST NOT 自造第四层。
- **确认时间**：2026-08-27


## 流程门禁契约（ai-dev-workflow）

- **职责**：定义完整流程与 Lean 路径共用的贯穿门与条件门——每道门插在哪、判据在哪一节、谁拍板、复述这些门的文件有哪些。
- **对外接口**
  - 贯穿门总表 §五道门（计数词 `五道门` 的**权威定义处**，别处 MUST 指名引用具体那道门的小节）— `ai-dev-system/skills/ai-dev-workflow/references/core/00-流程总纲.md:22`
  - 五道贯穿门依次为：工作区隔离门 / 兼容取舍确认门（`:116`）/ **spec 过稿门**（`:139`，2.10.0 新增）/ 代码评审门（`:186`）/ 完成与自动合并门（`:202`）
  - §spec 过稿门 的四个子节是各处引用的锚点：`§摆什么给拍板人` / `§怎么算过了这道门` / `§跳过本门只有一条通路` / `§结论 MUST 当场留痕` — `:147,153,162,170`
  - 三道条件门（红回路 / 不可逆 / 大架构）在总表之后逐条声明 — `:33-39`
  - 大架构确认门的**判据**（主干路"形状"变 vs "取值"变；槽位增删算）— `references/core/用户沟通纪律.md:11-45`；**落地位置**（完整流程 Step 4 前）— `references/core/步骤-1-7-设计与实现.md:101`
  - Lean 侧的投影：§1.3 门的全景 — `references/core/路径-lean.md:88`；§6 第 4 步（兼容取舍 §6.1 + 大架构 §6.2 + spec 过稿 §6.3 **同一批抛出**）— `:347,373,402`
  - 完整流程 Step 5 内部技术自检**明确不问用户**，其末尾声明 Step 6 之前有两道门且顺序固定 — `references/core/步骤-1-7-设计与实现.md:147-160`
  - 留痕落点：`assets/templates/eng-spec.md` §13 过稿记录、`assets/templates/lean-change-spec.md` 过稿记录节
  - 机器闸两条：`test/counter-word.test.mjs:51-58` 管计数词取值（`五道门`，旧值 `四道门` 留在 variants 里同受管辖）；`test/gate-sync.test.mjs` 管"每道门在必须复述它的文件里在不在场" + 总表行数与标题计数词一致
- **陷阱项**
  - 门的复述散在多处，加/减一道门要同改：总纲总表与总览图、`路径-lean.md` §1.3、入口 `SKILL.md`、`collab/{solo,team}.md`、`assets/config-snippets/base.md`、`ai-prd/references/collab/team.md`（**该处在 ai-prd 下，`test/counter-word.test.mjs` 不遍历，漏改不报错**）、`docs/REQUIREMENTS.md` 的门禁节。
  - `五道门` 的权威小节名字面就含受检子串，引用方 MUST 指名引用**具体那一道门**的小节，MUST NOT 引用总表。
  - `gate-sync.test.mjs` 对 `路径-lean.md` **按 §1.3 切段**匹配，**MUST NOT 退回全文匹配**——同一个门名在 §6.3/§14 也出现，全文匹配下把 §1.3 表里那一行抽掉照样全绿（写闸时反向自检当场撞出）。
  - Lean 的步骤号与自足册节号是两套（§2=第1步 … §6=第4步 … §10=第10步），MUST NOT 拿节号当步骤号引用。
  - 给常驻篇（`用户沟通纪律.md` 等）新增一段判据要同时看两个预算：**常驻前置量 50,000**（`test/resident-budget.test.mjs`，当前余量已不足百字节）与该节是否因此**从"无 MUST"变成"含 MUST"**——后者会自动新增一条 Lean 自足册覆盖义务。
- **确认时间**：2026-08-27（2.10.0 合入后）
