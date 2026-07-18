<!-- ai-dev-workflow:start -->
> **本项目采用 ai-dev-workflow【团队版】** (mode="team")
>
> - Engineering Context 在 `./engineering-context/`。查"能力对应哪个仓库/接口""跨服务影响面""哪个是权威实现"时，**先用 `ctx` CLI，不要 grep 旧代码**。
> - **业务全景门限**：未明确限定单仓的跨服务需求，**第一步先 `ctx find-scenes`** 取端到端全景，再 `discover`/`get-card` 收窄。
> - 每条来自 card 的接口/字段/topic 事实**必须附 cite**（path + anchor + 最近确认时间）；无 cite 视为幻觉，回查。
> - 流程：Triage → Overview → 按仓 Spec → Coding Plan → 测试。跨 ≥3 仓需求先出 Overview 并评审。
> - 改动触碰权威面（接口签名/废弃标记/路由配置/DB schema/兼容窗口）即使只有几行也要刷对应 card。
> - 唤起 `ai-dev-workflow` skill 后会自动加载团队版协作约定与 Engineering Context 设计（skill 内部 references）。
> - 文档目录固定：spec → `docs/spec/`，plan → `docs/plan/`，report → `docs/report/`。
> - 用户沟通只用业务语言；大架构需确认，模块内设计问业务问题，详细程序设计由工程侧内部完成。
> - 每个仓库全程使用独立 worktree；全部完成后按 PR / CI / 保护分支规则自动合并主分支。
> - 唤起 `ai-dev-workflow` skill 时按团队版路由，不再询问 mode。
<!-- ai-dev-workflow:end -->
