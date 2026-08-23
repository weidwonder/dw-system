# 文档索引（现行口径）

> **本索引只列 `lifecycle: active` 的文档。** 已归并 / 被取代 / 已废弃的进 [归档索引](./index-archive.md)，文件仍在原路径，只是不再代表现行口径。
> 规则见 `ai-dev-system/skills/ai-dev-workflow/references/core/文档治理.md` §文档生命周期与索引门控。创建、归档或重命名文档后**必须**同步本索引与归档索引。
> 本仓库是方法论分发包，没有 `REQUIREMENTS.md` / `ARCHITECTURE.md`——真相源是根目录 `CLAUDE.md` 与 `ai-dev-system/skills/` 下的 skill markdown 本身。

## 现行设计与规范（`docs/spec/`）

- **[ai-dev-system 体系设计](./spec/2026-07-06-ai-dev-system-design.md)** — 三层架构、skill 加壳与路由、Engineering Context 层的总设计。
- **[ai-prd 设计](./spec/2026-07-06-ai-prd-design.md)** — 产 PRD skill 的设计；§7 是变更 PRD 模板的覆盖度映射，改模板前对照。
- **[Skill 写作自检清单](./spec/2026-07-16-skill写作自检清单.md)** — 信息层级 / 六大失败模式 / 交叉引用同步；改任何 skill markdown 前后各过一遍。
- **[Skill 版本管理与迁移机制](./spec/2026-07-16-skill版本管理与迁移机制.md)** — VERSION、migrations、tag 与安装器 stamp 的现行约定。
- **[源头对齐基线与回灌机制](./spec/2026-07-14-源头对齐基线与回灌机制.md)** — 与上游来源保持对齐、变更回灌的治理规则。
- **[codegraph 自动安装与索引](./spec/2026-08-14-codegraph自动安装与索引-lean-change-spec.md)** — 安装器保持 codegraph 最新、接线到 agent、给目标项目建索引的现行口径与选项。
- **[ctx 全局命令安装](./spec/2026-08-16-ctx全局命令安装-lean-change-spec.md)** — 安装器把 skill 自带的 ctx CLI 链接成全局命令、验证可用性与失败降级的现行口径与选项。
- **[代码事实层强制化](./spec/2026-08-18-代码事实层强制化-eng-spec.md)** — 2.1.0 的设计依据：`engineering-context/` 卡片层改为**无条件必备**（初始化建骨架、干活过程中渐进补齐），取消按项目资产分档；分流默认倾向改为无条件。`authority_refs`：SKILL.md §路由逻辑、总纲 §默认倾向、core/代码事实纪律.md、references/ 目录分层。
- **[PRD 复核门](./spec/2026-08-19-prd复核门-lean-change-spec.md)** — 2.2.0 的设计依据：`ai-prd` 组稿后、落盘确认门前新增双轴子代理复核（自洽轴查 PRD 内部打架、冲突轴查与现有系统的功能/约束冲突）；三个出口的分流判据是"事实错了回去补，取舍待定才给用户"。`authority_refs`：ai-prd/references/prd复核纪律.md、00-prd生成流程.md §组稿、prd质量清单.md、ai-prd/SKILL.md §路由逻辑。
- **[文档轴](./spec/2026-08-19-文档轴-lean-change-spec.md)** — 2.3.0 的设计依据：代码评审门新增恒跑的 **D 文档轴**（参照物是 `docs/` 现行文档与真相源，查正文与代码是否背离 / 断链与孤儿 / 真相源跟上没有），agent 架构轴顺延为 E；完成门那条文档结算从"执行整套盘点"改成"核对 D 轴报告"。`authority_refs`：代码评审纪律.md §四条轴、worktree开发纪律.md §完成与自动合并门、文档治理.md §3、00-流程总纲.md §代码评审门。

- **[ai-dev-workflow 精简与需求追溯](./spec/2026-08-22-workflow精简与需求追溯-PRD.md)** — 与 `github/spec-kit` 比对后的调整需求：常驻负担由 108,003 压到 ≤50,000（移出文档治理/spec写作纪律/worktree开发纪律三篇、入口瘦身、抽历史沿革、全篇措辞精简）、Lean 路径改为**渐进式披露**（交付加载点清单，每行须触发条件明确/加载单元最小/说得出为什么此刻需要；不定体积阈值——该清单取决于命中哪几道门，三版阈值均被复核证伪）、spec 需求编号贯通四个落点、评审门忠实轴增加五类偏离类型。经三轮子代理复核（双轴 28 条 + 验证 8 条 + 收敛验证 6 条，含 6 条 P0）三次重修。`authority_refs`：加载点清单的三条判据、工作区隔离门要点驻留入口、需求编号的 MUST 与永不复用规则、忠实轴报告两维度格式、升级零手动动作承诺。

## 进行中的计划（`docs/plan/`）

（暂无——已完成的计划见[归档索引](./index-archive.md)。）

## 进行中的报告（`docs/report/`）

- **[agentic-principle 缺口报告](./report/agentic-principle-gap-report.md)** — 待 `agentic_principle` 维护者评估，未结案。

## 归档

历史文档（已归并的实施计划、被取代的设计）见 **[归档索引](./index-archive.md)**。**归档文档不代表现行口径**，与本索引所列文档冲突时以本索引为准。
