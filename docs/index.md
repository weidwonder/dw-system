# 文档索引（现行口径）

> **本索引只列 `lifecycle: active` 的文档。** 已归并 / 被取代 / 已废弃的进 [归档索引](./index-archive.md)，文件仍在原路径，只是不再代表现行口径。
> 规则见 `dw-system/skills/dw-doc-governance/references/文档生命周期.md` §文档生命周期与索引门控。创建、归档或重命名文档后**必须**同步本索引与归档索引。

## 需求真相源与还没做的事（`docs/` 根）

- **[需求真相源](./REQUIREMENTS.md)** — 本仓库现在是什么、为什么做、有哪些功能：两个 skill（`dw-prd` / `dw-workflow`）、`ctx` CLI、安装器、必备的代码事实层、文档治理与三层真相源。**只写 main 分支已实现的现状**，尚未实现的一切在 TODO。
- **[TODO](./TODO.md)** — 本仓库"还没做的事"的唯一出口：想做的功能 / 待澄清的问题 / 已知风险 / 技术欠账，每条带提出日期。

## 现行设计与规范（`docs/spec/`）

- **[dw-system 体系设计](./spec/2026-07-06-ai-dev-system-design.md)** — 三层架构、skill 加壳与路由、Engineering Context 层的总设计。
- **[dw-prd 设计](./spec/2026-07-06-ai-prd-design.md)** — 产 PRD skill 的设计；§7 是变更 PRD 模板的覆盖度映射，改模板前对照。
- **[Skill 写作自检清单](./spec/2026-07-16-skill写作自检清单.md)** — 信息层级 / 六大失败模式 / 交叉引用同步；改任何 skill markdown 前后各过一遍。
- **[Skill 版本管理与迁移机制](./spec/2026-07-16-skill版本管理与迁移机制.md)** — VERSION、migrations、tag 与安装器 stamp 的现行约定。
- **[源头对齐基线与回灌机制](./spec/2026-07-14-源头对齐基线与回灌机制.md)** — 与上游来源保持对齐、变更回灌的治理规则。
- **[codegraph 自动安装与索引](./spec/2026-08-14-codegraph自动安装与索引-lean-change-spec.md)** — 安装器保持 codegraph 最新、接线到 agent、给目标项目建索引的现行口径与选项。
- **[ctx 全局命令安装](./spec/2026-08-16-ctx全局命令安装-lean-change-spec.md)** — 安装器把 ctx 链接成全局命令、验证与失败降级；「不覆盖同名命令」一条已被[EEXIST 处置](./spec/2026-08-26-ctx全局链接EEXIST处置-lean-change-spec.md)收窄。
- **[全局 ctx 撞到 EEXIST 时的处置](./spec/2026-08-26-ctx全局链接EEXIST处置-lean-change-spec.md)** — Windows 上换项目重装必现的 `npm link` EEXIST：安装器捕获 npm 输出分辨失败类型，撞到 EEXIST 时先判归属。
- **[docs 与工程上下文是否入库](./spec/2026-08-30-安装器询问docs与工程上下文入库-lean-change-spec.md)** — 2.13.0 的设计依据：安装器在交互安装时问一次 `docs/` 与 `engineering-context/` 要不要提交进 git，答"不提交"就把这两个目录写进既有的 `.gitignore` 标记块。
- **[伴生仓库 agentic-principle 改名](./spec/2026-09-02-伴生仓库agentic-principle改名-lean-change-spec.md)** — 伴生 skill 的上游仓库由 `agentic_principle` 更名为 `agentic-principle` 后，安装器地址、测试断言与文档指代的现行口径。
- **[Agentic 调试模式与切片回放](./spec/2026-09-02-agentic调试模式与切片回放-lean-change-spec.md)** — 把"出事之后看不看得见"从排障时的补救前移成设计期的地基项：伴生 skill `agentic-principle` 新增 D12 可观测与回放。
- **[按开发对象面分派评审轴与设计原则册](./spec/2026-09-02-按开发对象面分派评审与设计-eng-spec.md)** — 代码评审门的轴集合不再恒为四条：改成先判本次改动触碰的对象面（P 程序代码面 / K skill 文档面 / G agent 架构面，闭集三类、可多命中），再由面推轴取并集。
- **[代码事实层强制化](./spec/2026-08-18-代码事实层强制化-eng-spec.md)** — 2.1.0 的设计依据：`engineering-context/` 卡片层改为无条件必备（初始化建骨架、干活过程中渐进补齐），取消按项目资产分档。
- **[PRD 复核门](./spec/2026-08-19-prd复核门-lean-change-spec.md)** — `dw-prd` 组稿后的双轴子代理复核（自洽轴、冲突轴）；§B 的门序已被[用户过稿门](./spec/2026-08-25-用户过稿门-lean-change-spec.md)修订。
- **[用户过稿门](./spec/2026-08-25-用户过稿门-lean-change-spec.md)** — 2.6.0 的设计依据：`dw-prd` 组稿在质量清单与复核门之间插入用户过稿门（用户读稿、提意见、定稿之后才派复核子代理），三门顺序定为 用户过稿门 → 复核门 → 落盘确认门。
- **[原型批注框架](./spec/2026-08-25-原型批注框架-lean-change-spec.md)** — 2.7.0 的设计依据：`ui-prototype.html` 由「带示例屏的模板」改造成容器——自带中性视觉基线、常用控件样式与内联图标，AI 侧用元素上的 `data-anno` 挂悬浮气泡把控件级说明疏导出界面。
- **[原型风格分层与批注框架修复](./spec/2026-08-28-原型风格分层与批注框架修复-eng-spec.md)** — 2.12.0 的技术 spec：容器按结构层/外观层分两层装配——结构层（画布 / 设备壳 / 屏 / 状态层 / 注解区 / 图标尺寸 / `.fill`+`.scroll-y` 布局原语）恒装配，外观层。
- **[文档轴](./spec/2026-08-19-文档轴-lean-change-spec.md)** — 2.3.0 的设计依据：代码评审门新增恒跑的 D 文档轴（参照物是 `docs/` 现行文档与真相源，查正文与代码是否背离 / 断链与孤儿 / 真相源跟上没有），agent 架构轴顺延为 E。
- **[需求真相源分层与 TODO 出口](./spec/2026-08-26-需求真相源分层与TODO出口-eng-spec.md)** — 2.8.0 的技术 spec：需求真相源收窄为只描述 main 分支已实现的现状（历史、前后对比、技术选型、需求调整过程一律不进）。


- **[原型注解分层与文档日期前缀 · 顶层架构](./spec/2026-08-27-原型注解分层与文档日期前缀-overview.md)** — 本期的 Overview：把改造切成六批（原型容器 / 原型工具 / `dw-prd` 纪律模板 / `dw-workflow` 命名与可达性 / 口径落点 / 机器闸与存量）。
- **[原型注解分层与文档日期前缀 · 技术 spec](./spec/2026-08-27-原型注解分层与文档日期前缀-eng-spec.md)** — 本期的技术 spec（FR-001–031 / AC-001–044）：屏注解区的 DOM 契约 `.device-wrap > .screen-notes`、新增 `CUSTOM-JS` 插槽与 `SCREEN-SCRIPT` 固定区、容器导出 `window.setScreenState`。
- **[原型批注框架绝对定位与图钉可见性](./spec/2026-08-27-原型批注框架绝对定位与图钉可见性-lean-change-spec.md)** — 批注框架 MUST NOT 改写被批注元素本来的定位：`data-anno-host` 恒加（点图钉靠它回溯宿主）但只有 computed position 为 `static` 的宿主取值 `rel` 才被提升为 `relative`。

- **[dw-workflow 精简与需求追溯](./spec/2026-08-22-workflow精简与需求追溯-PRD.md)** — 与 `github/spec-kit` 比对后的调整需求：常驻负担由 108,003 压到 ≤50,000（移出文档治理/spec写作纪律/worktree开发纪律三篇、入口瘦身、抽历史沿革、全篇措辞精简）、Lean 路径改为渐进式披露。
- **[渐进式披露与需求追溯](./spec/2026-08-23-渐进式披露与需求追溯-eng-spec.md)** — 2.5.0 的技术 spec：判据加载模型改为渐进式披露（常驻收敛到六份且分两批取，其余按住在 `SKILL.md` 的〈加载点清单〉在触发点取）。
- **[流程总纲历史沿革](./spec/2026-08-23-流程总纲历史沿革.md)** — `00-流程总纲.md` 里"当初为什么这么定"的论证展开，渐进式披露改造时从常驻总纲抽出：大架构确认门为什么绑"改动命中判据"而不绑 Overview、第 3 问的确认义务为什么单列、默认倾向判据 3/4 为什么回溯触发。

- **[spec 过稿门](./spec/2026-08-27-ai-dev-workflow-spec过稿门-eng-spec.md)** — 给 `dw-workflow` 新增第五道贯穿门：技术 spec 定稿后、生成 Coding Plan 之前，把 spec 里业务可判定的部分（范围与不做什么 / 功能需求 / 兼容取舍结论 / 完成定义）交拍板人过目并表态，默认每次都过。
- **[原型取段与框架外置](./spec/2026-08-27-原型取段与框架外置-eng-spec.md)** — 2.10.0 的技术 spec（FR-001–017 / AC-001–020）：读侧新增 `preview.mjs extract`，按分区标记原样取出 `TITLE` / `NOTES` / `SCREENS`（`--with-css` 补两段样式区）。

- **[评审门积压通路与测试面收窄](./spec/2026-09-14-评审门积压通路与测试面收窄-eng-spec.md)** — 让评审门的派发量与触发频率都与改动的真实风险相称。
- **[变更日志与依赖声明（多项目变更感知）](./spec/2026-09-16-变更日志与依赖声明-eng-spec.md)** — 2.17.0 的技术 spec：上游在每次合并前往仓库根 `CHANGELOG.md` 的 `## 未发布` 写条目。
- **[dw 体系重组与两条总纲 PRD](./spec/2026-09-17-dw体系重组与两条总纲-PRD.md)** — 3.0.0 的变更 PRD：两条总纲、八个 `dw-` skill、代码事实卡质量、整体更名与旧安装自动迁移；兼容取舍 C1–C12 已拍板。
- **[dw-system 技术 spec：安装器迁移、ctx 卡片体检与机器闸](./spec/2026-09-17-dw-system-安装器迁移与ctx体检与机器闸-eng-spec.md)** — 3.0.0 动到可执行代码的部分：安装器名字表与旧残留迁移、`ctx` 域卡解析与 `lint-cards`、`authority-unique` 题型、三条新闸与退役名单。

## 进行中的计划（`docs/plan/`）


按次产出的计划文件名 MUST 以 `YYYY-MM-DD-` 开头；已归并计划移入归档索引。

- **[dw-system 3.0 Coding Plan](./plan/2026-09-17-dw-system-3.0-coding-plan.md)** — 3.0.0 的十个任务：机械更名、换闸、安装器迁移、`dw-prose` 与来历清理、决策记录、拆评审门、拆其余与取消 Lean 副本、`ctx` 卡片体检、收紧体积、发布件。
- **[spec 过稿门 Coding Plan](./plan/2026-08-27-spec过稿门-coding-plan.md)** — 9 个垂直切片任务（字节上限 → 总纲立判据 → 完整流程分册 → Lean 自足册 → 模板 → 协作面与注入片段 → 入口加载点 → 门同步机器闸 → 版本与账本），每个任务带 `满足:` 的 `FR-###`。
- **[原型注解分层与文档日期前缀 Coding Plan](./plan/2026-08-27-原型注解分层与文档日期前缀-coding-plan.md)** — 本期的 coding plan：15 个垂直切片任务（容器 → 工具 → 纪律模板 → 机器闸），每个任务带 `满足:` 的 `FR-###`、失败测试先行、替换清单核销表与三个 checkpoint。

- **[渐进式披露与需求追溯 Coding Plan](./plan/2026-08-23-渐进式披露与需求追溯-coding-plan.md)** — [渐进式披露与需求追溯 spec](./spec/2026-08-23-渐进式披露与需求追溯-eng-spec.md) 的任务拆解（FR-001…FR-014 / AC-001…AC-024 的核销表）。

其余已完成的计划见[归档索引](./index-archive.md)。

## 进行中的报告（`docs/report/`）

- **[dw 3.0 规范去向清单](./report/2026-09-17-dw-3.0-规范去向清单.md)** — 3.0.0 重组期间每个含规范词的小节搬到了哪；`test/rule-destinations.test.mjs` 逐行核对。
- **[评审门积压通路与测试面收窄 · 代码评审门报告](./report/2026-09-14-评审门积压通路与测试面收窄-review-report.md)** — 本次评审门 A/B/C/D/S 五轴的发现与处置：3 条 P0。
- **[变更日志与依赖声明 · 代码评审门报告](./report/2026-09-16-变更日志与依赖声明-review-report.md)** — 本次评审门 A/B/C/D/S 五轴（三组子代理）的发现与处置：0 条 P0、5 条 P1。

- **[agentic-principle 缺口报告](./report/2026-08-02-agentic-principle-gap-report.md)** — 待 `agentic-principle` 维护者评估，未结案。
- **[渐进式披露真跑验收](./report/2026-08-23-渐进式披露真跑验收.md)** — 2.5.0 改造后三种典型 Lean 与完整流程的实测加载量（观测指标，非门槛），以及真跑撞出的三个缺口——三个都不是机器闸能发现的，撞出时 260 项测试全绿。

## 归档

历史文档（已归并的实施计划、被取代的设计）见 **[归档索引](./index-archive.md)**。**归档文档不代表现行口径**，与本索引所列文档冲突时以本索引为准。
