# Capability Registry — 产品能力到权威代码实体的映射

> 精简骨架；完整字段说明与填写指南见 ai-dev-workflow skill 的 assets/context-layer/capability-registry.md。
> 代码事实层（"信哪个"）的核心资产，**每个装了本体系的项目都维护它**。人工确认。
> 事实以源码为准，PRD 仅作 scope + 业务语境。每条带 freshness 与理由链。
> 只剩【】占位行是**正常起步态**：内容按任务渐进补齐（见 references/core/代码事实纪律.md §4），
> MUST NOT 因为表是空的就告警、或退回裸 grep 找权威实现。
> 下面两张表**填哪张都算，解析器会合并**（表头首列命中 Capability/能力的表全部解析）：
> 三列是 MUST，十列表里的其余列是 MAY——缺列跳过不报错，没有 freshness 列的条目输出标注「未声明新鲜度」。

## 最小合法 schema（起步用这个）

| Capability | 权威实现 | 陷阱项（废弃或中间产物） |
|---|---|---|
| 【能力，如 背单词记录】 | 【现在该改/该调的那一个，如 POST /v2/word/record 或 src/word/record.ts】 | 【相似但不该用的旧实现，如 POST /v1/word/record；确实没有就写 无】 |

## 能力表（完整形态）

| Capability | 业务含义 | 权威仓库 | 权威接口(含版本) | 废弃/中间产物替代 | 兼容窗口 | owner | 测试入口 | freshness(最近确认) | 理由链 |
|---|---|---|---|---|---|---|---|---|---|
| 【能力】 | 【含义】 | 【repo】 | 【POST /v2/xxx】 | 【旧接口不可用】 | 【切点】 | 【owner】 | 【测试入口】 | 【YYYY-MM-DD / PR】 | 【诞生压力】 |
| 原型容器与批注框架 | 原型的唯一容器：分区标记 + 设计系统 + 图标库 + 批注框架 | ai-dev-system | `ai-dev-system/skills/ai-prd/assets/templates/ui-prototype.html` | 无 | — | 本人 | `test/prototype-annotations.test.mjs` | 2026-08-27 | 容器里放示例会锚定产出 |
| 原型产出与改稿工具 | init/screen/slot/annotations/check/serve 六条子命令 | ai-dev-system | `ai-dev-system/skills/ai-prd/scripts/preview.mjs` | 手工编辑原型文件（会抹掉批注锚点，明令禁止） | — | 本人 | `test/prototype-preview.test.mjs` | 2026-08-27 | 手工改稿会让用户批注失联 |
| 文档命名与生命周期 | 产出文档的目录、命名、lifecycle/authority_refs 与索引门控 | ai-dev-system | `ai-dev-system/skills/ai-dev-workflow/references/core/文档治理.md` §默认命名 | 字段名 `status`（已被 lean-change-spec 的「写作进度」占用） | — | 本人 | `test/doc-index.test.mjs` | 2026-08-27 | 索引与真相源要可机检 |
| 原型纪律（结构/自检/批注/写回） | 原型的产出、结构、自检、批注框架与写回路径的权威判据 | ai-dev-system | `ai-dev-system/skills/ai-prd/references/UI原型纪律.md` | 无 | — | 本人 | `test/prototype-annotations.test.mjs` | 2026-08-27 | 结构知识靠记必漏，收进 check |
