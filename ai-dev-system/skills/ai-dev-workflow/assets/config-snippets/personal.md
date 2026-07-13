<!-- ai-dev-workflow:start -->
> **本项目采用 ai-dev-workflow【个人版】** (mode="personal")
>
> - 默认走轻量流程：小改动用一页 Lean Change Spec 直接实现；只有跨仓/含 AI-LLM/涉及安全或不可逆的大需求才升级到完整 Overview→Spec→Plan。
> - 无需评审会 / 多仓协作 / owner 归属。
> - 非显而易见的技术决策与踩坑，沉淀进 memory（一条一个事实，写清"为什么"）。
> - 文档目录固定：spec → `docs/spec/`，plan → `docs/plan/`，report → `docs/report/`。
> - 用户沟通只用业务语言；大架构需确认，模块内设计问业务问题，详细程序设计无需用户确认。
> - 开发全程使用独立 worktree；全部完成并通过验证后自动合并主分支，失败时保留 worktree。
> - 唤起 `ai-dev-workflow` skill 时按个人版路由，不再询问 mode。
<!-- ai-dev-workflow:end -->
