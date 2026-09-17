# Codebase Card — dw-system

> 本仓库是 AI 辅助开发方法论的分发包（两个 skill + 零依赖 CLI），不是应用。
> 事实以合入后的源码为准。每条对外接口带 `文件:行`。

## 原型容器（ui-prototype.html）

- **职责**：`dw-prd` 产出的 UI 原型的唯一容器——本体只留分区标记与骨架，六个固定实现区的正文住在 `assets/templates/ui-prototype-framework/`，由 `preview.mjs init` 经 `composeTemplate()` 装配建出；**产物仍是单文件零外链**，产出方只填具名插槽。**2.12.0 起 `DESIGN-SYSTEM` 区分两层装配**。
- **对外接口**
  - 分区标记（`<!-- MARK:BEGIN … END -->`，`check` 按 `FIXED_REGIONS` 校验齐全）：`THEME`、`PROJECT-THEME`、`DESIGN-SYSTEM`、`CUSTOM-CSS`、`ANNO-FRAMEWORK:CSS`、`ICONS`、`TITLE`、`NOTES`、`SCREENS`、`SCREEN-SCRIPT`、`CUSTOM-JS`、`ANNOTATIONS`、`ANNO-FRAMEWORK:JS`
  - **结构层**（恒装配，196 行）：画布 `.stage` / `.devices` / `.device-wrap` / `.device` / `.app-bar` / `.screen` / `.status` / `.screen-notes`、图标尺寸、排版原语，以及满高布局原语 `.fill` + `.scroll-y` — `ui-prototype-framework/structure.css`
  - **外观层**（默认不装配，408 行）：按钮 / 表单 / 卡片 / 徽标 / 提示条 / 空态 / 列表 / 导航 / 浮层，只有 `init --with-baseline` 才追加 — `ui-prototype-framework/components.css`
  - 屏内布局：屏名 `.device-name` 恒在设备壳左上方（`align-self: flex-start`），屏注解区 `.device-wrap > .screen-notes` 恒挂该屏下方、居中限宽 420px；桌面屏 `860×540` — `ui-prototype-framework/structure.css:99`
  - 满高链路：`.device`(flex column) → `.screen`(flex:1, min-height:0) → 状态层(flex column, flex:1)，产出方用 `.fill` + `.scroll-y` 做内部滚动区
  - 状态切换：`SCREEN-SCRIPT` 导出 `window.setScreenState(screenEl, nextState)`，并提供 **`[data-state]` 声明式 hook**（点击带该属性的元素 → 把所在屏切到目标态；空串 = 回默认态）— `ui-prototype-framework/screen.js:17`
  - 设计说明面板 `#proto-notes-panel`（`position: sticky; top: 46px`，默认 `hidden`，工具栏 `[data-act="notes"]` 展开），正文外壳类是 `.anno-notes-body`（2.12.0 起，此前借用外观层的 `.card-content`）
  - 批注数据块 `<script type="application/json" id="anno-data">`，schema `prd-annotations@1`，字段 `global[]` / `items[]` / `replies[]`
  - 批注框架自护：框架 UI 内 `[hidden]` 恒生效的通用规则 — `ui-prototype-framework/anno.css:81`；图钉尺寸盒与三种变体背景色带 `!important` — `:88`；注解区按钮 `.anno-btn` 尺寸盒同样锁死 — `:256`
  - AI 说明的回复编辑态：`setEditing()` 统一进出（高亮被改那条 + 提示 + 放弃修改按钮）— `ui-prototype-framework/anno.js:622`；发号 `nextAnnoId()` 同时看 DOM 与 `store.replies` 已用的 noteId — `:589`
- **陷阱项**
  - **`[hidden]` 的 `display:none` 来自 UA 样式表，任何作者的 `display` 都压过它**——框架 UI 内新增隐藏元素时 MUST 靠 `anno.css:81` 那条通用规则兜住，MUST NOT 逐个元素补（逐条补必然漏，实测踩过三次）。
  - **`!important` 有传染性**：`.anno-pin` / `.anno-btn` 的属性为挡产出方带了 `!important`，**框架自己**覆盖同名属性的规则（如 `[data-anno-hidden] .anno-pin`、`.anno-btn--icon`）也 MUST 带 `!important`，否则压不过自己。
  - 渲染弹窗的函数 MUST NOT 绑定自己没渲染的 `data-role`——`null.onclick` 抛 TypeError 会让函数整个中断，表现只是"按钮点了没反应"。
  - `window.setScreenState` MUST NOT 扩成认按钮名的形态；`[data-state]` hook 是声明式属性，不改它的签名。
  - 用非上述方式改 DOM 状态，`serialize()` 还原不掉，写回时状态被烘进文件且零报错。
  - 图钉的偏移 MUST NOT 改回负值（元素外侧）：任何 `overflow` 祖先都会把它整枚裁掉。
  - 自定义样式的 `z-index` 上限是 880（图钉 880 < 设计说明面板 890 < 工具栏 900 < 批注弹窗 1000 < 拾取光标 1100）。
  - **框架改动对已生成的原型不生效**——框架在 `init` 时装配进产物，只能重建，而重建会清空批注块（已记入 `docs/TODO.md` 技术欠账）。
- **确认时间**：2026-08-28

## 原型工具（preview.mjs）

- **职责**：`dw-prd` 唯一脚本，七条子命令覆盖原型全流程（建/加屏/填插槽/取界面/取批注/自检/预览服务）。零第三方依赖，跨平台。
- **对外接口**
  - `FRAMEWORK` 六项装配表与 `composeTemplate()` 将容器固定区和 `ui-prototype-framework/` 源文件装配回完整 HTML — `dw-system/skills/dw-prd/scripts/preview.mjs:36-135`
  - `SLOTS` **七个**具名插槽 `title | subtitle | screens | notes | theme | custom | script`，区间一律由 `markRange()` 按 `MARK:BEGIN/END` 界定 — `dw-system/skills/dw-prd/scripts/preview.mjs:54-160` 一带
  - `annoBlockRange()` 定位批注块**限定在 `ANNOTATIONS` 标记区间内**取，不做全文 `indexOf` — `:220-230`
  - `screenSkeleton(name, states, desktop, annoRight)` 生成 `.device-wrap > .device-name + .device + .screen-notes`，`--anno-right` 加 `is-anno-right` — `:270-294`
  - `cmdSlot` 的放行契约：`--agreed` + `--agreed-plan`（闭集 `done|void|move`），受影响集 = 丢锚点项 ∪ 显式声明的 `move` 项；`--drop-anchors` 已废除，传入报错退出码 2 — `:329-371` 一带
  - `cmdSlot` 写入后的等值不变式**无条件执行**（先删后验，不因"没有放行"跳过），不等即 `拒绝写入：本次替换会改动批注块…这是 bug` — `:419`
  - `cmdAnnotations` 输出**三类 + 回复**：用户元素批注 / 全局反馈 / AI 侧说明（标待拍板）/ 用户对说明的回复（带被回复说明原文）— `:556-599`
  - `cmdExtract` 按固定顺序输出 `TITLE/NOTES/SCREENS`，`--with-css` 追加 `PROJECT-THEME/CUSTOM-CSS`，段头带源文件行号 — `:448-471`
  - `cmdCheck` 十二类检查（编号不变，屏注解区、按屏状态入口、注解区按钮行为三项并进第 6/7/8 类）— `:653-831` 一带
  - `cmdServe` 版本化写回：`versionOf()` 取内容 SHA-256，GET/HEAD 回 `X-Proto-Version`，`POST /save` 认 `If-Match` 头或 `?v=` 查询参数（二者等价，后者供 `sendBeacon`），版本不符回 **409 + `{version, html}`**；`serializeWrite()` 用 Promise 链关掉 TOCTOU 窗口 — `:864-980` 一带
  - `FIXED_REGIONS` 含 `SCREEN-SCRIPT`，**不含** `CUSTOM-JS`（后者是插槽，产出方要写）— `:603`
  - `FRAMEWORK` 装配表用 **`files[]` + `baselineFiles[]`**（有序多文件拼装），`composeTemplate({baseline})` 决定是否追加外观层 — `scripts/preview.mjs:33`、`:119`
  - `init --with-baseline` 开启外观层，两条路径各自打印下一步指引 — `:293`
  - `screenSkeleton(name, states, desktop)` 生成屏骨架，**声明多个状态时直接生成 `data-state` 切换按钮**（值带 `state-` 前缀，默认态用空串），行为由容器 hook 提供 — `:315`；`--anno-right` 已废除，传入报错退出码 2
  - `reattachNoteIds()`：`slot --set screens` 时按 `data-anno` 文本把 `data-anno-id` 续回新片段，**新旧两侧都唯一才续**，有歧义不猜 — `:389`
  - `emptyStates()`：声明了却没填内容的状态层报 P1（判空在剥标签**并**去 HTML 注释之后）— `:757`
  - `writeAtomic()` 临时文件名唯一（pid + 时间 + 序号），失败清理半成品 — `:234`
  - `check` 的状态按钮检查改为**校验 `data-state` 取值**（前缀合法 + 指向本屏真有的状态层），不再按字符串包含判断有无绑定
  - `HELP` 文案含 `extract`、七个插槽名、`--anno-right` 与放行参数 — `:984` 一带
- **陷阱项**
  - **`check` 的 class 定义来源 MUST 含 `ANNO-FRAMEWORK:CSS` 区**：屏注解区的按钮用批注框架私有类，漏掉这一区会把工具自己生成的按钮报成"没有样式定义"。
  - 并发改同一份原型：唯一临时名只消除 ENOENT 崩溃，**后写仍覆盖先写**（各自读的是同一份旧内容），工具不加锁。
  - `SLOTS.screens` / `notes` / `theme` / `custom` / `script` **没有 `re` 字段**，误引用 `slot.re` 会静默失效（`match(undefined)` 给空匹配、`replace(undefined,…)` 当字面串）——历史上撞出过 `screen` 命令零改动却退出 0。
  - 判空 MUST 在剥外壳**并**去注释之后，否则出厂 `<!-- SCREENS -->` 占位注释被当成已有内容。
  - 终止用抛 `Abort` 不用 `process.exit()`（管道下输出会被截断而退出码正常）。
  - 批注块定位 MUST 限定在 `ANNOTATIONS` 区间内：全文 `indexOf` 时，片段里夹带一个假 `id="anno-data"` 块会让放行数据写进假块、真块原样不动，命令照常打印放行清单并退出 0（实测撞出过，文件里留下三个批注块）。
  - `script` 插槽写入 MUST 转义 `</script`，否则内容提前闭合脚本标签。
- **确认时间**：2026-08-28

## 原型读取契约（dw-workflow）

- **职责**：下游五个读原型落点统一先取界面与批注，避免通读固定实现区。
- **对外接口**：界面内容用 `node <skills 根>/dw-prd/scripts/preview.mjs extract <原型文件>`，批注用同脚本 `annotations <原型文件>`；两条都跑完才算读过原型。五个落点：`步骤-1-7-设计与实现.md:21`（Step 1）、`:139`（Step 4），`步骤-8-10-测试.md:10`（Step 8），`路径-lean.md:273`，`00-流程总纲.md:111`。
- **陷阱项**：只跑其中一条等于没读全；界面上看不见的 `data-anno` 说明同属用户可见行为契约；两条命令都跑不起来时才降级为直读文件并在问题清单记一笔。
- **确认时间**：2026-08-27

## 文档治理与命名（dw-workflow）

- **职责**：定义本体系产出文档的目录、命名、生命周期字段与索引门控。
- **对外接口**
  - §默认命名 的文件名范式，**每条都以 `YYYY-MM-DD-` 开头**；末尾逃生口收窄为"日期前缀与目录不可改变" — `dw-system/skills/dw-workflow/references/core/文档治理.md` §默认命名
  - §文档生命周期与索引门控：`lifecycle` / `last_confirmed` / `authority_refs`
  - §TODO 出口
  - 机器闸 `test/doc-index.test.mjs` 的 `collectDocs(rootDir)`（导出的纯函数，`walk()` 递归子目录）校验前缀与索引收录
- **陷阱项**：字段名是 `lifecycle` 不是 `status`；前缀规则的例外是**常青档与两份索引**（`REQUIREMENTS.md` / `ARCHITECTURE.md` / `TODO.md` / `index.md` / `index-archive.md` 与 `docs/requirements/` 下的一级子模块），清单在 §默认命名。
- **确认时间**：2026-08-27

## UI 原型纪律（dw-prd）

- **职责**：原型的产出、结构、自检、批注框架与写回路径的权威判据。
- **对外接口**
  - §2 原型命名 `docs/spec/YYYY-MM-DD-<name>-prototype.html`（日期在前）
  - §5 PRD「UI 原型」五项表（三类模板同一套项）
  - §6 交付前自检清单（「**未经约定**失联的一条报一条 P0」、「每个声明覆盖的状态都在该屏注解区里有对应切换按钮且按钮有行为」）
  - §7 批注框架三区表与写入方声明；§7.5 设计说明、§7.6 屏注解区、§7.7 放行契约
  - §8.1 命令表、§8.2 屏结构、**§8.3 风格归属判据**（外观层默认不装配；棕地 MUST NOT 开基线、绿地 MUST 与用户确认四项、确无来源才兜底）、§8.4 项目样式与 `.fill`/`.scroll-y`
- **陷阱项**：批注数据块的写入方现在有**两个**——页面工具栏，以及 §7.7 显式放行路径上的 `slot`；**AI 手工编辑本块仍然禁止**。三层归属是闭集，MUST NOT 自造第四层。
- **确认时间**：2026-08-27


## 流程门禁契约（dw-workflow）

- **职责**：定义完整流程与 Lean 路径共用的贯穿门与条件门——每道门插在哪、判据在哪一节、谁拍板、复述这些门的文件有哪些。
- **对外接口**
  - 贯穿门总表 §五道门（计数词 `五道门` 的**权威定义处**，别处 MUST 指名引用具体那道门的小节）— `dw-system/skills/dw-workflow/references/core/00-流程总纲.md:22`
  - 五道贯穿门依次为：工作区隔离门 / 兼容取舍确认门（`:116`）/ **spec 过稿门**（`:139`，2.11.0 新增）/ 代码评审门（`:186`）/ 完成与自动合并门（`:202`）
  - §spec 过稿门 的四个子节是各处引用的锚点：`§摆什么给拍板人` / `§怎么算过了这道门` / `§跳过本门只有一条通路` / `§结论 MUST 当场留痕` — `:147,153,162,170`
  - 三道条件门（红回路 / 不可逆 / 大架构）在总表之后逐条声明 — `:33-39`
  - 大架构确认门的**判据**（主干路"形状"变 vs "取值"变；槽位增删算）— `references/core/用户沟通纪律.md:11-45`；**落地位置**（完整流程 Step 4 前）— `references/core/步骤-1-7-设计与实现.md:101`
  - Lean 侧的投影：§1.3 门的全景 — `references/core/路径-lean.md:88`；§6 第 4 步（兼容取舍 §6.1 + 大架构 §6.2 + spec 过稿 §6.3 **同一批抛出**）— `:347,373,402`
  - 完整流程 Step 5 内部技术自检**明确不问用户**，其末尾声明 Step 6 之前有两道门且顺序固定 — `references/core/步骤-1-7-设计与实现.md:147-160`
  - 留痕落点：`assets/templates/eng-spec.md` §13 过稿记录、`assets/templates/lean-change-spec.md` 过稿记录节
  - 机器闸两条：`test/counter-word.test.mjs:48-58` 管计数词取值（`五道门`，旧值 `四道门` 留在 variants 里同受管辖）；`test/gate-sync.test.mjs` 管"每道门在必须复述它的文件里在不在场" + 总表行数与标题计数词一致
- **陷阱项**
  - 门的复述散在多处，加/减一道门要同改：总纲总表与总览图、`路径-lean.md` §1.3、入口 `SKILL.md`、`collab/{solo,team}.md`、`assets/config-snippets/base.md`、`dw-prd/references/collab/team.md`（**该处在 dw-prd 下，`test/counter-word.test.mjs` 不遍历，漏改不报错**）、`docs/REQUIREMENTS.md` 的门禁节。
  - `五道门` 的权威小节名字面就含受检子串，引用方 MUST 指名引用**具体那一道门**的小节，MUST NOT 引用总表。
  - `gate-sync.test.mjs` 对 `路径-lean.md` **按 §1.3 切段**匹配，**MUST NOT 退回全文匹配**——同一个门名在 §6.3/§14 也出现，全文匹配下把 §1.3 表里那一行抽掉照样全绿（写闸时反向自检当场撞出）。
  - Lean 的步骤号与自足册节号是两套（§2=第1步 … §6=第4步 … §10=第10步），MUST NOT 拿节号当步骤号引用。
  - 给常驻篇（`用户沟通纪律.md` 等）新增一段判据要同时看两个预算：**常驻前置量 50,000**（`test/resident-budget.test.mjs`，当前余量已不足百字节）与该节是否因此**从"无 MUST"变成"含 MUST"**——后者会自动新增一条 Lean 自足册覆盖义务。
- **确认时间**：2026-08-27（2.11.0 合入后）

## 伴生 skill 同步（install.mjs）

- **职责**：主安装完成后检查并保持外部伴生 skill 为最新——本体系不收录其内容，只负责"装上并保持新"；装到用户级目录，跨项目共享一份，不进目标项目、不写目标项目 `.gitignore`。**2.15.0 起是两个**，且两个的形态并不相同。
- **对外接口**
  - `COMPANION_SKILLS` 常量（数组，每项 `name` / `repo` / `ref` / `subdir` / `why`）— `install.mjs:71`
    - `agentic-principle`：`https://github.com/weidwonder/agentic-principle.git`，本体在 `agentic-principle/` 子目录，**frontmatter 有 `metadata.version`**
    - `skill-principle`：`https://github.com/weidwonder/skill-principle.git`，**本体在 `skill/` 子目录**（仓库根是开发工程，含 `dist/` `docs/` `README.md`，根目录**没有** `SKILL.md`），**frontmatter 无 `metadata.version`**（该 skill 用 git tag 管版本）— 2026-09-03 实拉 `main` @ `5d4c0bd` 核实
  - `syncCompanions(opt, home)` 主入口，主安装后调用（两处：`install.mjs:1507`、`:1627`）— `install.mjs:901`
  - `fetchCompanion(spec, repo)`：浅克隆到临时目录、校验 `<subdir>/SKILL.md` 存在、读 frontmatter `metadata.version`，返回 `{srcDir, version, cleanup}` — `install.mjs:850`
  - `companionNeedsUpdate(localVersion, remoteVersion)`：本地缺失或本地更旧才写入；**远端版本判不出时返回 false**（不覆盖已有安装）— `install.mjs:876`
  - `companionContentSame(localDir, remoteDir)` + `companionShouldUpdate(local, remoteVersion, remoteDir)`：**两边版本号都判不出时改按 `SKILL.md` 内容逐字节比对**，相同即跳过。没有它，无版本号的 skill 会命中 `companionNeedsUpdate` 的 `localVersion == null → true` 分支，**每次安装都被无谓重写**（幂等与 `--dry-run` 两条承诺同时失效）— `companionContentSame` 在 `install.mjs:887`、`companionShouldUpdate` 在 `:895`
  - `companionDestDirs(home)`（用户级安装位置）`install.mjs:830`；`legacyCompanionDirs(home, name)`（≤v1.6.0 误装进 `~/.agents/skills/` 的陈旧副本提示）`:836`；`companionGuardReason(dir)`（symlink / git 工作区不自动覆盖）`:842`
  - CLI：`--no-companions`（同义 `--no-agentic`，跳过整段）— `install.mjs:199`；**`--companion-repo=<name>=<url>`** 覆盖某个 skill 的来源仓库，`<name>` 不在 `COMPANION_SKILLS` 内时报错中止并列出合法值域 — `install.mjs:216`。**`--agentic-repo=<url>` 已于 2.15.0 整个删除、不留别名**（用户拍板"不兼容，直接切"），传入落进未知参数报错路径、退出码 2，且 `install.mjs:235` 的 `removed` 映射会额外打一行迁移指路（回归闸：`test/companion-skill.test.mjs` 的「已删除的 --agentic-repo= 落进未知选项路径」）
  - 机器闸：`test/companion-skill.test.mjs`（14 用例）用 fake remote 跑全链路，装置按 `COMPANIONS` 表参数化覆盖两个 skill 的两种版本形态；另有一条用例按字面锁两个条目的真实地址、subdir 与非空 `why`，并断言源码里不再出现 `COMPANION_SKILLS[0]` 下标
- **陷阱项**
  - 仓库地址在源码与文档里有多处副本：`install.mjs:71` 是权威，`AI-LLM-overlay.md` 的手动 clone 指引、`migrations/1.6.0.md`、`docs/report/2026-08-02-agentic-principle-gap-report.md` 都各写一份，改地址要一起改（2026-09-02 的仓库改名就是这么漏出来的）。
  - **两个 skill 的 `subdir` 不同，MUST NOT 想当然按 `name` 推**：`agentic-principle` 的本体目录与仓库同名，`skill-principle` 的却叫 `skill`。写错 `subdir` 的表现是每次安装都报"仓库里找不到 `<subdir>/SKILL.md`"并降级为警告，**主安装照常成功**，很容易被忽略。
  - **`metadata.version` 不是伴生 skill 的通用契约**，本体系无权要求上游加它；新增伴生 skill 时 MUST 先确认它有没有版本字段，没有就落进内容比对分支。
  - skill 内容按 `DEFAULT_REF = v${SELF_VERSION}`（`install.mjs:66`）从 **tag** 取：只改 main 上的 skill 文件而不 bump `dw-system/VERSION` 并推 tag，使用者默认装到的仍是旧内容；`install.mjs` 自身的改动则跟着 main 立即生效——两者节奏不同。
  - 伴生拉取的任何失败都只降级为警告，不影响已完成的主安装（`install.mjs:928` 一段）；因此"装完没报错"不等于伴生 skill 已更新。**失败文案按各条目的 `spec.why` 生成**，`why` 写空会打印一句没有内容的提示。
  - **本节的 `文件:行` 在 2026-09-03 逐条实测回填过一次**：2.15.0 给 `install.mjs` 净增约 40 行，此前卡片里 11 处引用全部漂移（如 `syncCompanions` 由 `:853` 移到 `:893`）。**改动 `install.mjs` 后 MUST 回来重核本节全部行号**——`文件:行` 错了等同幻觉，而它不会报错。
- **确认时间**：2026-09-03（2.15.0 合入前，行号已逐条实测）
