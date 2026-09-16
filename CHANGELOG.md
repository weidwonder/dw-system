# CHANGELOG

> 每次合并到主分支写一条；`不兼容` 条目以对外接口名开头，含旧调用方式 / 新调用方式 / 迁移步骤。规则见 `ai-dev-system/skills/ai-dev-workflow/references/core/代码事实纪律.md` §10.1。
> 2.17.0 之前的历史不回填：按版本看 git tag `v<版本>`，按设计依据看 `docs/spec/`。

## 未发布

### 不兼容

### 新增

### 变更

### 修复

### 内部
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
