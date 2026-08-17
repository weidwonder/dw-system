<!-- ai-dev-workflow:start -->
> **本项目采用 ai-dev-workflow【团队版】** (mode="team")
>
> - Engineering Context 在 `./engineering-context/`。查"能力对应哪个仓库/接口""跨服务影响面""哪个是权威实现"时，**先用 `ctx` CLI，不要 grep 旧代码**。`ctx` 命令找不到时改用 `node .claude/skills/ai-dev-workflow/scripts/ctx/src/cli.js <命令>`（功能相同），**不是**退回 grep。
> - **业务全景门限**：未明确限定单仓的跨服务需求，**第一步先 `ctx find-scenes`** 取端到端全景，再 `discover`/`get-card` 收窄。
> - 每条来自 card 的接口/字段/topic 事实**必须附 cite**（path + anchor + 最近确认时间）；无 cite 视为幻觉，回查。
> - 流程：Triage → Overview → 按仓 Spec → Coding Plan → 测试。跨 ≥3 仓需求先出 Overview 并评审。
> - 改动触碰权威面（接口签名/废弃标记/路由配置/DB schema/兼容窗口）即使只有几行也要刷对应 card。
> - 唤起 `ai-dev-workflow` skill 后会自动加载团队版协作约定与 Engineering Context 设计（skill 内部 references）。
> - 文档目录固定：spec → `docs/spec/`，plan → `docs/plan/`，report → `docs/report/`。
> - 文档有生命周期：新建文档 frontmatter 带 `lifecycle: active` 与 `authority_refs`；`docs/index.md` 只放现行口径，归档进 `docs/index-archive.md`；准出时按本次**触碰的权威面**（与刷 card 同一个面）结算文档去留。
> - 用户沟通只用业务语言；大架构需确认，模块内设计问业务问题，详细程序设计由工程侧内部完成。
> - **Agentic 应用必须加载 `agentic-principle` skill**（模型自主规划 / 直接调工具 / 未过闸门就改状态 / 记忆跨会话影响决策）：架构选型、提示词、注意力与并发预算、步骤级测试用它；运行期 AI 契约仍用 ai-dev-workflow 的 AI overlay。两者内容互相独立，不合并。
> - **编码完成后必须过代码评审门**：派 3 个并行子代理跑规范 / 忠实 / 残留三轴（Lean 用单子代理精简版），子代理需加载 `ai-dev-workflow`，P0/P1 修完才准进测试步与合并门；Agentic 项目增派一个加载 `agentic-principle` 的 agent 架构轴。此门是 PR 前的地板，不替代人审。
> - **是否向后兼容每次由业务方拍板**，AI 不得默认兼容；被取代的旧逻辑当场删除，保留项必须带理由与到期日（登记在 spec 的替换清单）。
> - 用户/业务方提供的真实数据固化进 `tests/fixtures/<场景名>/`（凭证进 `secrets/` 并 gitignore，脱敏副本入库）；长链路必须有断言中间结果的端到端用例；未覆盖的重要场景挂账到 `docs/report/测试场景覆盖度.md`，攒批索要素材。
> - 每个仓库全程使用独立 worktree；全部完成后按 PR / CI / 保护分支规则自动合并主分支。
> - Worktree 目录固定在各仓库根的 `./.worktrees/`（每次从本设置读取，除非用户显式要求改到其它位置）。
> - 唤起 `ai-dev-workflow` skill 时按团队版路由，不再询问 mode。
<!-- ai-dev-workflow:end -->
