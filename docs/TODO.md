# TODO

> **本文是本仓库"还没做的事"的唯一出口。** 需求真相源 [`docs/REQUIREMENTS.md`](./REQUIREMENTS.md) 只写已实现的现状，尚未实现的一切在这里。
> **本文是快照**：只记此刻仍未做的，做掉的当场删，**MUST NOT 保留"已完成"区**——那是历史，[归档索引](./index-archive.md)才是它的去处。
> **章节是下面这四类，MUST NOT 自造第五类。** 行格式：`- YYYY-MM-DD ｜ <归属模块或"跨模块"> ｜ <一句话>`。
> 判据在 `dw-system/skills/dw-doc-governance/references/文档治理.md` §TODO 出口。

<!-- 陈旧阈值默认 3 个月。本项目要改就取消下一行注释并改数字，改了以本行为准。 -->
<!-- > 陈旧阈值：6 个月 -->

## 想做的功能

- 2026-08-27 ｜ dw-workflow ｜ 目前流程默认由本工具自身派发子代理执行 Step 7 编码，未提供"改用其他 AI coding 工具（codex / claude code / grok 等）执行编码"的选项；想在流程起始（Triage 之前或路由阶段）询问用户本次编码由谁派发，若指定外部工具，则 Step 6 Coding Plan 产出后、正式编码前须先让该外部工具 review spec 与 coding plan、有卡点则打回主代理调整，通过后再执行编码，编码完成后仍回到主代理走既有「代码评审门」；需理清与已有 `codex:codex-rescue` / `grok-build:grok-delegate` 等伴生技能委派机制的关系，避免另起一套重复的委派通道
- 2026-09-03 ｜ 代码事实层 ｜ `engineering-context/probe-set.md` 六行全是模板占位，`ctx probe` 恒报 NO-PROBE（退出码 1）——B 类四道零上下文交接题（`requirement-reachable` / `architecture-reachable` / `implementation-usable` / `rationale-traceable`）从未填过，防腐门禁实际不在岗。存量缺口，2026-09-03 的评审门 D 文档轴报出
- 2026-08-26 ｜ dw-prd ｜ 原型的**写侧** token 负载仍未收窄：`slot --set screens` 一次替换整个 `SCREENS` 区，多屏原型改一屏也要把全部屏重写一遍，没有「只改第 N 屏」的粒度。2026-08-27 的 `extract` 与框架外置解决的是**读侧**（读一份原型从 85KB 降到约 11KB）与容器的维护成本，**产物字节数不变、写侧未触及**——原条目里「按屏拆分产出、`slot` 之外再收窄写入粒度」那一半仍然待做
- 2026-08-26 ｜ ctx ｜ `ctx probe` 的"按权威面自动触发重扫"CI hook 仍待接，现在只能在 CI 发布或里程碑节点显式跑一次

## 待澄清的问题

- 2026-09-17 ｜ 跨模块 ｜ 架构真相源由谁承载待拍板（README 加〈架构与边界〉节，或由地图卡 `engineering-context/cards/dw-system.md` 承担）；拍板之前 `architecture-reachable` 与 `implementation-usable` 两道题没有可指的输入，从未真跑（`probe-set.md` 仍是占位行一事见〈想做的功能〉2026-09-03 那条）
- 2026-08-26 ｜ 文档 ｜ 根 CLAUDE.md §版本管理 里"四条既有断言无条件要求当前 VERSION 有同名迁移指南"的记载与实际代码不符，那四条在 2.5.0 已改成条件式，需确认这段描述怎么收敛

## 已知风险

- 2026-08-26 ｜ 安装器 ｜ 全局 `ctx` 命令指向最后一次安装的那个项目里的副本，该项目被删除或移动后全局命令会失效；目前兜底是文档里那条 `node <skill>/scripts/ctx/src/cli.js` 的调用方式
- 2026-08-26 ｜ 安装器 ｜ codegraph 与两个伴生 skill（`agentic-principle` / `skill-principle`）是外部仓库，上游改名、改命令或下线会让安装器这两段静默降级为警告，使用者可能不知道自己没拿到检索加速面与伴生 skill

## 技术欠账

- 2026-09-17 ｜ dw-workflow ｜ `references/` 合计超出 `test/doc-budgets.json` 的 `totals` 目标，上限暂冻结在实测值（同一文件的 `overrides`）。下一步候选：测试阶段三篇（`步骤-8-10-测试.md`、`测试资产纪律.md`）与 `AI-LLM-overlay.md` 是否各自成 skill，由拍板人定
- 2026-09-17 ｜ dw-prd ｜ 入口、`00-prd生成流程.md`、`UI原型纪律.md` 三篇与 `references/` 合计都超出 `test/doc-budgets.json` 的目标，上限暂冻结在实测值（同一文件的 `files` 与 `overrides`）。3.0 只给它改了名，没有按两条总纲重组
- 2026-09-17 ｜ 跨模块 ｜ 三个已装项目（myclaws、agent_fs、aiudit_platform）的存量卡片是按任务追加的单文件大卡，需各自跑 `ctx lint-cards --init-baseline` 后按业务域拆成地图卡加域卡

- 2026-09-17 ｜ 文档 ｜ `docs/index.md` 现行区里仍有早已归并进需求真相源的 lean spec 与已结束的评审门报告，语义上与 `REQUIREMENTS.md` 的 `authority_refs` 重叠而 `authority-unique` 只比逐字相等；需逐篇判定后标 `merged` 移入归档索引
- 2026-09-17 ｜ 文档 ｜ `docs/spec/2026-08-23-流程总纲历史沿革.md` 是一篇住在 `docs/spec/` 的来历文档，总纲里指向它的指针已移除；待拆成 `docs/decisions/` 下的决策记录后归档
- 2026-08-27 ｜ dw-prd ｜ 下次真跑一遍完整产 PRD 流程时回看：产出的原型里“写进屏幕内容的说明文字”是否为零、每屏该说的话是否都在自己的注解区里
- 2026-08-27 ｜ dw-prd ｜ 批注图钉在**祖先已建立层叠上下文**（`transform` / `filter` / `opacity<1` / 带 `z-index` 的定位祖先）的画布里仍可能被遮挡：`z-index: 880` 只在最近的层叠上下文内有效，拉多高都出不去。彻底解法是把图钉挂到 body 下的覆盖层按 `getBoundingClientRect()` 定位（缺陷报告的修法 C），需处理滚动、resize 与 `serialize()` 剥离；2026-08-27 那次已按修法 A+B 修掉定位改写与 `overflow` 裁切两项，见 `docs/spec/2026-08-27-原型批注框架绝对定位与图钉可见性-lean-change-spec.md`
- 2026-08-26 ｜ 跨模块 ｜ `FR-###` / `AC-###` 需求编号贯通五个落点，但这条契约没有机器闸，唯一防线是 spec 的覆盖自查与评审门忠实轴的覆盖矩阵
- 2026-08-27 ｜ 跨模块 ｜ PRD 与 spec 同住 `docs/spec/`、只靠文件名里的 `-PRD-` 区分，零上下文 agent 分不清哪份是意图、哪份是行为规格；拆出独立 `docs/prd/` 目录，需同改 dw-prd 的落盘位置与质量清单、`文档治理.md` §默认命名与索引分层、dw-workflow 里以 PRD 为输入的各步骤路径，并考虑存量 PRD 的迁移方式

- **框架升级后已有原型无法应用修复，只能重建，而重建会清空批注块**（2026-08-28 提出）。原型是单文件、框架在 `init` 时装配进产物，所以改 `ui-prototype-framework/` 下任何内容对既有原型都不生效。验证 demo 无所谓，真实 PRD 场景下批注是需求的一部分，重建等于丢用户意见。可能的出路：给 `preview.mjs` 加一条"就地换框架、保留插槽与批注块"的子命令。
