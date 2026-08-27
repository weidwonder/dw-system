# 文档索引（现行口径）

> **本索引只列 `lifecycle: active` 的文档。** 已归并 / 被取代 / 已废弃的进 [归档索引](./index-archive.md)，文件仍在原路径，只是不再代表现行口径。
> 规则见 `ai-dev-system/skills/ai-dev-workflow/references/core/文档治理.md` §文档生命周期与索引门控。创建、归档或重命名文档后**必须**同步本索引与归档索引。

## 需求真相源与还没做的事（`docs/` 根）

- **[需求真相源](./REQUIREMENTS.md)** — 本仓库现在是什么、为什么做、有哪些功能：两个 skill（`ai-prd` / `ai-dev-workflow`）、`ctx` CLI、安装器、必备的代码事实层、文档治理与三层真相源。**只写 main 分支已实现的现状**，尚未实现的一切在 TODO。
- **[TODO](./TODO.md)** — 本仓库"还没做的事"的唯一出口：想做的功能 / 待澄清的问题 / 已知风险 / 技术欠账，每条带提出日期。

## 现行设计与规范（`docs/spec/`）

- **[ai-dev-system 体系设计](./spec/2026-07-06-ai-dev-system-design.md)** — 三层架构、skill 加壳与路由、Engineering Context 层的总设计。
- **[ai-prd 设计](./spec/2026-07-06-ai-prd-design.md)** — 产 PRD skill 的设计；§7 是变更 PRD 模板的覆盖度映射，改模板前对照。
- **[Skill 写作自检清单](./spec/2026-07-16-skill写作自检清单.md)** — 信息层级 / 六大失败模式 / 交叉引用同步；改任何 skill markdown 前后各过一遍。
- **[Skill 版本管理与迁移机制](./spec/2026-07-16-skill版本管理与迁移机制.md)** — VERSION、migrations、tag 与安装器 stamp 的现行约定。
- **[源头对齐基线与回灌机制](./spec/2026-07-14-源头对齐基线与回灌机制.md)** — 与上游来源保持对齐、变更回灌的治理规则。
- **[codegraph 自动安装与索引](./spec/2026-08-14-codegraph自动安装与索引-lean-change-spec.md)** — 安装器保持 codegraph 最新、接线到 agent、给目标项目建索引的现行口径与选项。
- **[ctx 全局命令安装](./spec/2026-08-16-ctx全局命令安装-lean-change-spec.md)** — 安装器把 skill 自带的 ctx CLI 链接成全局命令、验证可用性与失败降级的现行口径与选项。**兼容取舍里「不覆盖同名命令」那条已被 2026-08-26 的 [全局 ctx EEXIST 处置](./spec/2026-08-26-ctx全局链接EEXIST处置-lean-change-spec.md) 收窄**（确认是本体系自己留下的才覆盖），其余判据仍是现行口径。
- **[全局 ctx 撞到 EEXIST 时的处置](./spec/2026-08-26-ctx全局链接EEXIST处置-lean-change-spec.md)** — Windows 上换项目重装必现的 `npm link` EEXIST：安装器捕获 npm 输出分辨失败类型，撞到 EEXIST 时先判归属（PATH 上签名匹配，或 `npm root -g` 下的 ctx 包符号链接目标含 `ai-dev-workflow` / 入口脚本含签名串），确认是本体系上次留下的才 `npm link --force` 覆盖，判不出归属一个字节都不动。`authority_refs`：EEXIST 与其余失败的分支判定、归属判定的两种形态、force 的前置条件、npm 输出的回显。
- **[代码事实层强制化](./spec/2026-08-18-代码事实层强制化-eng-spec.md)** — 2.1.0 的设计依据：`engineering-context/` 卡片层改为**无条件必备**（初始化建骨架、干活过程中渐进补齐），取消按项目资产分档；分流默认倾向改为无条件。`authority_refs`：SKILL.md §路由逻辑、总纲 §默认倾向、core/代码事实纪律.md、references/ 目录分层。
- **[PRD 复核门](./spec/2026-08-19-prd复核门-lean-change-spec.md)** — 2.2.0 的设计依据：`ai-prd` 组稿后、落盘确认门前新增双轴子代理复核（自洽轴查 PRD 内部打架、冲突轴查与现有系统的功能/约束冲突）；三个出口的分流判据是"事实错了回去补，取舍待定才给用户"。**§B 的门序与步骤号已被 2.6.0 的[用户过稿门](./spec/2026-08-25-用户过稿门-lean-change-spec.md)修订**（复核门现在跑在用户定稿之后），其余判据仍是现行口径。`authority_refs`：ai-prd/references/prd复核纪律.md、00-prd生成流程.md §组稿、prd质量清单.md、ai-prd/SKILL.md §路由逻辑。
- **[用户过稿门](./spec/2026-08-25-用户过稿门-lean-change-spec.md)** — 2.6.0 的设计依据：`ai-prd` 组稿在质量清单与复核门之间插入**用户过稿门**（用户读稿、提意见、定稿之后才派复核子代理），三门顺序定为 用户过稿门 → 复核门 → 落盘确认门；原型以预览副本交付、MUST NOT 提前进 `docs/`；复核零发现时落盘确认门退化为一句话告知。`authority_refs`：00-prd生成流程.md §组稿 的三门顺序与退化规则、prd复核纪律.md §门禁 的开跑前置、UI原型纪律.md 的预览副本条、ai-prd/SKILL.md §关键纪律。
- **[原型批注框架](./spec/2026-08-25-原型批注框架-lean-change-spec.md)** — 2.7.0 的设计依据：`ui-prototype.html` 由「带示例屏的模板」改造成**容器**——自带中性视觉基线、常用控件样式与内联图标，AI 侧用元素上的 `data-anno` 挂悬浮气泡把控件级说明疏导出界面，用户侧用画布顶端工具栏点选元素写意见与全局反馈、随时改随时写回文件；容器**不含任何示例业务内容**，产出原型只填七个具名插槽、全程不读容器（范例会锚定产出）。建原型、改稿、自检、取批注、起预览一律走 `scripts/preview.mjs` 的六条子命令：`slot` 让改稿不必整份重读、也不会抹掉用户已写的批注，`check` 收编「写错了页面照常打开」的结构知识，`annotations` 是取批注的唯一入口（用户逐元素批注 + 全局反馈 + AI 侧 `data-anno` + 用户对说明的回复），下游每个真打开原型的执行点都就地给出它。`authority_refs`：分区标记、插槽逐字原文与工具插槽键、class 与图标 id 的双向一致、`prd-annotations@1` 数据结构、`preview.mjs` 子命令契约、UI原型纪律.md §6/§7/§8。
- **[文档轴](./spec/2026-08-19-文档轴-lean-change-spec.md)** — 2.3.0 的设计依据：代码评审门新增恒跑的 **D 文档轴**（参照物是 `docs/` 现行文档与真相源，查正文与代码是否背离 / 断链与孤儿 / 真相源跟上没有），agent 架构轴顺延为 E；完成门那条文档结算从"执行整套盘点"改成"核对 D 轴报告"。`authority_refs`：代码评审纪律.md §四条轴、worktree开发纪律.md §完成与自动合并门、文档治理.md §3、00-流程总纲.md §代码评审门。
- **[需求真相源分层与 TODO 出口](./spec/2026-08-26-需求真相源分层与TODO出口-eng-spec.md)** — 2.8.0 的技术 spec：需求真相源收窄为**只描述 main 分支已实现的现状**（历史、前后对比、技术选型、需求调整过程一律不进），承载分两层——主文档 `docs/REQUIREMENTS.md` + 一级子模块 `docs/requirements/<模块>.md`，不再往下分目录，划分方式必须写在主文档里；尚未实现的一切改走新增的唯一出口 `docs/TODO.md`（章节按类型分且是闭集、每条带提出日期、只收够格条目、陈旧只提醒不代删）；准出归并从三个写死落点改为按口径类型分派的映射表，「功能清单没变化」MUST NOT 被读成「无需归并」；存量按"下次触碰就收敛"处置，删规划节当场做、拆子模块先由用户拍板。`authority_refs`：需求真相源的定位与两层承载、拆分阈值、准出归并的落点映射表、`docs/TODO.md` 的章节类型与准入门槛、`docs/` 根例外清单、整品 PRD 模板的章节集合。


- **[原型注解分层与文档日期前缀 · 顶层架构](./spec/2026-08-27-原型注解分层与文档日期前缀-overview.md)** — 本期的 Overview：把改造切成六批（原型容器 / 原型工具 / `ai-prd` 纪律模板 / `ai-dev-workflow` 命名与可达性 / 口径落点 / 机器闸与存量），A/B 两道核查捞出三个开放问题并在 eng-spec 定案。`authority_refs`：三层注释归属的槽位划分、可写位置由六处扩到七处、容器与产出方的职责边界、改稿放行契约、预览写回冲突的处置方向、日期前缀地板、本次的边界划分与合并顺序。
- **[原型注解分层与文档日期前缀 · 技术 spec](./spec/2026-08-27-原型注解分层与文档日期前缀-eng-spec.md)** — 本期的技术 spec（FR-001–031 / AC-001–044）：屏注解区的 DOM 契约 `.device-wrap > .screen-notes`、新增 `CUSTOM-JS` 插槽与 `SCREEN-SCRIPT` 固定区、容器导出 `window.setScreenState`（只认屏元素与目标态，不认按钮）、批注 schema **不升版本**（回复以可选 `replies[]` 挂在 AI 说明的 `data-anno-id` 上）、`slot` 的 `--agreed` / `--agreed-plan` 放行契约（`--drop-anchors` 废除）、`serve` 的 `X-Proto-Version` / `If-Match` 写回契约、日期前缀的适用范围与常青档例外。`authority_refs`：七个插槽的集合、两个新分区标记、屏注解区 DOM 契约、三种运行时状态表达、`replies[]` 结构与 `data-anno-id` 锚点、放行与写回两组命令契约、日期前缀地板与例外清单。
- **[原型批注框架绝对定位与图钉可见性](./spec/2026-08-27-原型批注框架绝对定位与图钉可见性-lean-change-spec.md)** — 批注框架 MUST NOT 改写被批注元素本来的定位：`data-anno-host` 恒加（点图钉靠它回溯宿主）但只有 computed position 为 `static` 的宿主取值 `rel` 才被提升为 `relative`，绝对定位的画布元素打批注不再错位；图钉改贴元素**内侧**（`top: 2px`）以免被 `overflow` 祖先裁掉，`z-index` 由 60 提到 880——高于原型自定义内容、低于批注框架自身的面板/工具栏/弹窗/拾取光标，自定义样式的取值上限随之写进 `UI原型纪律.md` §8.4。存量已产出的原型不做迁移。`authority_refs`：`[data-anno-host="rel"]` 的提升条件、图钉的内侧偏移与层级区间、自定义样式的 z-index 上限。

- **[ai-dev-workflow 精简与需求追溯](./spec/2026-08-22-workflow精简与需求追溯-PRD.md)** — 与 `github/spec-kit` 比对后的调整需求：常驻负担由 108,003 压到 ≤50,000（移出文档治理/spec写作纪律/worktree开发纪律三篇、入口瘦身、抽历史沿革、全篇措辞精简）、Lean 路径改为**渐进式披露**（交付加载点清单，每行须触发条件明确/加载单元最小/说得出为什么此刻需要；不定体积阈值——该清单取决于命中哪几道门，三版阈值均被复核证伪）、spec 需求编号贯通四个落点、评审门忠实轴增加五类偏离类型。经三轮子代理复核（双轴 28 条 + 验证 8 条 + 收敛验证 6 条，含 6 条 P0）三次重修。`authority_refs`：加载点清单的三条判据、工作区隔离门要点驻留入口、需求编号的 MUST 与永不复用规则、忠实轴报告两维度格式、升级零手动动作承诺。
- **[渐进式披露与需求追溯](./spec/2026-08-23-渐进式披露与需求追溯-eng-spec.md)** — 2.5.0 的技术 spec：判据加载模型改为**渐进式披露**（常驻收敛到六份且分两批取，其余按住在 `SKILL.md` 的〈加载点清单〉在触发点取），`文档治理.md` / `spec写作纪律.md` / `worktree开发纪律.md` 三篇移出常驻，`路径-lean.md` 扩为 Lean 自足册；spec 需求编 `FR-###` / 验收项编 `AC-###` 贯通到 coding plan、评审门与 test-spec；评审门忠实轴按轴增列五类偏离类型。`authority_refs`：常驻集合与加载点清单、入口自带工作区隔离门要点、需求编号格式与永不复用规则、忠实轴返回格式的增列、措辞精简红线。
- **[流程总纲历史沿革](./spec/2026-08-23-流程总纲历史沿革.md)** — `00-流程总纲.md` 里"当初为什么这么定"的论证展开，渐进式披露改造时从常驻总纲抽出：大架构确认门为什么绑"改动命中判据"而不绑 Overview、第 3 问的确认义务为什么单列、默认倾向判据 3/4 为什么回溯触发、七条护栏为什么全写成否定式。总纲只留判据，照总纲执行不需要读本文；要改判据时才读。`authority_refs`：总纲各条判据的立论依据与读错后果。

## 进行中的计划（`docs/plan/`）

按次产出的计划文件名 MUST 以 `YYYY-MM-DD-` 开头；已归并计划移入归档索引。

- **[原型注解分层与文档日期前缀 Coding Plan](./plan/2026-08-27-原型注解分层与文档日期前缀-coding-plan.md)** — 本期的 coding plan：15 个垂直切片任务（容器 → 工具 → 纪律模板 → 机器闸），每个任务带 `满足:` 的 `FR-###`、失败测试先行、替换清单核销表与三个 checkpoint。`authority_refs`：`window.setScreenState` 签名、`slot` 的 `--agreed` / `--agreed-plan` 参数契约、`serve` 的 `X-Proto-Version` / `If-Match` 头契约、`replies[]` 字段集合、`.screen-notes` DOM 契约与两个新标记名。

- **[渐进式披露与需求追溯 Coding Plan](./plan/2026-08-23-渐进式披露与需求追溯-coding-plan.md)** — [渐进式披露与需求追溯 spec](./spec/2026-08-23-渐进式披露与需求追溯-eng-spec.md) 的任务拆解（FR-001…FR-014 / AC-001…AC-024 的核销表）。`authority_refs`：Interfaces 节冻结的加载点清单列结构、`FR-###`/`AC-###` 编号格式、忠实轴返回格式的增列方式。

其余已完成的计划见[归档索引](./index-archive.md)。

## 进行中的报告（`docs/report/`）

- **[agentic-principle 缺口报告](./report/2026-08-02-agentic-principle-gap-report.md)** — 待 `agentic_principle` 维护者评估，未结案。
- **[渐进式披露真跑验收](./report/2026-08-23-渐进式披露真跑验收.md)** — 2.5.0 改造后三种典型 Lean 与完整流程的实测加载量（观测指标，非门槛），以及真跑撞出的三个缺口——三个都不是机器闸能发现的，撞出时 260 项测试全绿。`authority_refs`：各条路径的实测加载量、真跑发现的缺口及修正指向。

## 归档

历史文档（已归并的实施计划、被取代的设计）见 **[归档索引](./index-archive.md)**。**归档文档不代表现行口径**，与本索引所列文档冲突时以本索引为准。
