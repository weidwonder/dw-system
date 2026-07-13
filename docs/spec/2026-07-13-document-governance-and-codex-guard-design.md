# ai-dev-system 文档治理与 Codex 保护设计

## 目标

- 项目文档按职责落盘：spec 到 `docs/spec/`，plan 到 `docs/plan/`，report 到 `docs/report/`。
- ai-dev-workflow 与 ai-prd 使用同一套路径规则，不再把产物写到项目根或工具命名目录。
- Codex 项目安装后，`AGENTS.md` 必须同时包含冲突技能保护块与已有 workflow mode 块。

## 文档分类

| 目录 | 文档 |
|---|---|
| `docs/spec/` | PRD、Requirements、Overview、Lean Change Spec、技术 Spec、测试 Spec、设计与契约 |
| `docs/plan/` | Coding Plan、实施计划、迁移计划 |
| `docs/report/` | 执行报告、验证报告、测试报告、审计报告 |

文件名表达业务主题，不包含生成工具名。不得创建 `docs/superpowers/` 等工具专属产物目录。

## Codex 安装行为

Codex 0.144.1 当前环境没有已验证的项目级插件开关。安装器继续采用项目级 `AGENTS.md` 指令约束，不修改用户全局插件配置，但必须：

1. 使用当前实际插件标识 `superpowers@openai-curated`。
2. 幂等写入 `ai-dev-system:codex-conflicts` 保护块。
3. 若 `CLAUDE.md` 或 `AGENTS.md` 已有 workflow mode 块，把同一块同步到另一文件。
4. 写入后重新读取并验证两个标记块；缺失时安装失败。
5. 输出明确称为“Codex 自动触发约束”，不得宣称真正禁用了 Codex 插件。

## 当前项目迁移

- 把现有 PRD、架构、契约和各类 Spec 移入 `docs/spec/`。
- 把现有 Coding Plan 和实施计划移入 `docs/plan/`。
- 删除空的 `docs/superpowers/` 层级。
- 修复源码、测试和 Markdown 中的旧路径引用。
- `docs/modules/` 继续作为模块参考文档，不属于本次三类交付物。

## 验收

- 安装器临时目录测试证明 `AGENTS.md` 同时含 conflict guard 与 mode。
- skill 扫描测试证明三类目录均有明确规则，且不存在“plan 放项目根”或模板主动推荐 superpowers。
- 当前项目不存在 `docs/superpowers/`，spec/plan 不散落在 `docs/` 根。
- 受路径迁移影响的项目测试通过。
