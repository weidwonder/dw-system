# Codebase Card — ai-dev-system

> 本仓库是 AI 辅助开发方法论的分发包（两个 skill + 零依赖 CLI），不是应用。
> 事实以合入后的源码为准。每条对外接口带 `文件:行`。

## 原型容器（ui-prototype.html）

- **职责**：`ai-prd` 产出的 UI 原型的唯一容器——自带默认视觉基线、设计系统、图标库、批注框架与状态切换；由 `preview.mjs init` 复制建出，产出方只填具名插槽。
- **对外接口**
  - 分区标记（`<!-- MARK:BEGIN … END -->`，`check` 按 `FIXED_REGIONS` 校验齐全）：`THEME`、`PROJECT-THEME`、`DESIGN-SYSTEM`、`CUSTOM-CSS`、`ANNO-FRAMEWORK:CSS`、`ICONS`、`TITLE`、`SCREENS`、`NOTES`、`ANNOTATIONS`、`ANNO-FRAMEWORK:JS` — `ai-dev-system/skills/ai-prd/assets/templates/ui-prototype.html:14,57,62,626,631,790,838,845,871,934,949`
  - 画布两列布局 `.stage { grid-template-columns: minmax(0,1fr) 340px }` + `.aside-stack` 随滚动（`position: sticky`）— `:548-556`、`:598`
  - 状态切换卡片（画布右侧唯一入口，`[data-state]` 按钮组）— `:851-865`
  - 设计说明栏 `.card-title` 文案「设计说明（不属于用户界面）」+ `#proto-notes` — `:867-873`
  - 未被任何 MARK 区间保护的原型级交互脚本（`setState` 遍历**全部** `.screen`、`[data-submit]` 演示、tablist/switch/checkbox 的 `data-anno-runtime` 记录）— `:876-932`
  - 批注数据块 `<script type="application/json" id="anno-data">`，schema `prd-annotations@1`，字段 `global[]` / `items[]`（`items[].id` ↔ 界面 `data-anno-user`）— `:934-947`
  - 批注框架 JS：`serialize()` 剥运行时状态（只认三种表达：`.screen` 上的 `state-*` 类、`[data-state]` 的 `aria-pressed`、`[data-anno-runtime]` 自报）— `:1053-1073`；`write()` 分 `SERVED`(POST /save) 与 File System Access 两路 — `:1094-1107`；工具栏 `bar.innerHTML` 按序为 标题/加注释/全局反馈/隐藏批注/spacer/计数/save/复制 JSON/状态灯 — `:1189-1199`；`paint()` 决定 save 按钮文案与显隐（`SERVED && servedOk && !dirty` 时隐藏）— `:1214-1260`
  - 批注气泡渲染：`data-anno` → note 气泡、`data-anno-kind="question"` → ask 气泡（琥珀）、`items[]` → user 气泡 — `:1327-1349`
- **陷阱项**
  - `:876-932` 那段交互脚本**不在任何 MARK 区间内**，`check` 的 `FIXED_REGIONS` 管不到它。
  - 用非上述三种方式改 DOM 状态，`serialize()` 还原不掉，写回时状态被烘进文件且零报错。
  - 批注块注释里刻意不写取批注命令（命令含本区结束标记字样，写进去会让按标记取段的读法提前截断）— `:937-938`
- **确认时间**：2026-08-27

## 原型工具（preview.mjs）

- **职责**：`ai-prd` 唯一脚本，六条子命令覆盖原型全流程（建/加屏/填插槽/取批注/自检/预览服务）。零第三方依赖，跨平台。
- **对外接口**
  - `SLOTS` 六个具名插槽 `title | subtitle | screens | notes | theme | custom`，区间一律由 `markRange()` 按 `MARK:BEGIN/END` 界定 — `ai-dev-system/skills/ai-prd/scripts/preview.mjs:41-77`、`:80-88`
  - `cmdScreen` 生成屏骨架 `.device-wrap > .device-name + .device(.app-bar + .screen > .status*)`，设备壳外无任何可写位置 — `:198-213`
  - `cmdSlot` 写入后两道校验：批注块前后必须逐字相等（不等即 `拒绝写入：…这是 bug`）、界面区 `data-anno-user` 锚点不得减少（丢锚点默认拒绝，`--drop-anchors` 才放行）— `:279-303`
  - `cmdAnnotations` 输出三类：用户元素批注 / 全局反馈 / AI 侧 `data-anno` 说明（`--json` 时 schema 取自批注块）— `:366-396`
  - `cmdCheck` 十二类检查：零外链/占位符/固定区完整/插槽已填/批注块可解析/孤儿批注(P0)/屏结构/状态层一致性/结构契约/class 有定义/图标 id/写死颜色/内联脚本语法 — `:452-600`
  - `cmdServe` 只绑 `127.0.0.1`，校验 Host 与 `sec-fetch-site`，`POST /save` 校验 payload 形似原型文档后原子写回；**不校验版本，后到的写入直接覆盖** — `:634-720`
  - `HELP` 文案含插槽名清单与「批注块与 data-anno-user 锚点原样保留」承诺 — `:731`
- **陷阱项**
  - `SLOTS.screens` / `notes` / `theme` / `custom` **没有 `re` 字段**，误引用 `slot.re` 会静默失效（`match(undefined)` 给空匹配、`replace(undefined,…)` 当字面串）——历史上撞出过 `screen` 命令零改动却退出 0。
  - 判空 MUST 在剥外壳**并**去注释之后，否则出厂 `<!-- SCREENS -->` 占位注释被当成已有内容。
  - 终止用抛 `Abort` 不用 `process.exit()`（管道下输出会被截断而退出码正常）。
- **确认时间**：2026-08-27

## 文档治理与命名（ai-dev-workflow）

- **职责**：定义本体系产出文档的目录、命名、生命周期字段与索引门控。
- **对外接口**
  - §默认命名 七条文件名范式 + 末尾逃生口「项目已有更严格的文件名约定时可以沿用，但目录不可改变」— `ai-dev-system/skills/ai-dev-workflow/references/core/文档治理.md:235-245`
  - §文档生命周期与索引门控：`lifecycle` / `last_confirmed` / `authority_refs` — `:91-213`
  - §TODO 出口 — `:214-234`
- **陷阱项**：字段名是 `lifecycle` 不是 `status`；§默认命名 当前**没有**日期前缀规则（本仓库 28/29 份文档带前缀靠习惯）。
- **确认时间**：2026-08-27

## UI 原型纪律（ai-prd）

- **职责**：原型的产出、结构、自检、批注框架与写回路径的权威判据。
- **对外接口**
  - §2 原型命名 `docs/spec/<name>-prototype-YYYYMMDD.html`（日期在后）— `ai-dev-system/skills/ai-prd/references/UI原型纪律.md:29`
  - §5 PRD「UI 原型」五项表（三类模板同一套项）— `:63-76`
  - §6 交付前自检清单（含「失联一条报一条 P0」`:92`、「每个声明覆盖的状态都有对应可点击切换入口」）— `:77-96`
  - §7 批注框架三区表与写入方声明（`ANNOTATIONS` 区「只有页面工具栏写」`:110`、§7.1 `:118-119`、§7.3 「唯一写入方是页面工具栏」`:144`）— `:98-172`
  - §8.1 命令表、§8.2 屏结构、§8.3 class 与 hook、§8.4 项目样式 — `:179-303`
- **陷阱项**：§4「右侧『设计说明』栏全篇只保留一个」`:49`、§7 容器自带能力表 `:175`、§8.3 状态切换作用于全部屏 `:232` 三处会随本次删总闸而失准。
- **确认时间**：2026-08-27
