<!-- ai-dev-workflow:start -->
> **本项目采用 ai-dev-workflow【个人版】** (mode="personal")
>
> - 默认走轻量流程：小改动用一页 Lean Change Spec 直接实现；只有跨仓/含 AI-LLM/涉及安全或不可逆的大需求才升级到完整 Overview→Spec→Plan。
> - 无需评审会 / 多仓协作 / owner 归属。
> - 非显而易见的技术决策与踩坑，沉淀进 memory（一条一个事实，写清"为什么"）。
> - 文档目录固定：spec → `docs/spec/`，plan → `docs/plan/`，report → `docs/report/`。
> - 新建文档 frontmatter 带 `lifecycle: active`；口径归并进代码后改 `merged` 并加归档头注——个人项目没有同事提醒你哪份文档已不作数。
> - 用户沟通只用业务语言；大架构需确认，模块内设计问业务问题，详细程序设计无需用户确认。
> - **Agentic 应用必须加载 `agentic-principle` skill**（模型自主规划 / 直接调工具 / 未过闸门就改状态 / 记忆跨会话影响决策）：架构选型、提示词、注意力预算、步骤级测试用它；运行期 AI 契约仍用 ai-dev-workflow 的 AI overlay。两者内容互相独立，不合并。
> - **编码完成后必须过代码评审门**：派子代理跑规范 / 忠实 / 残留三轴（Lean 用单子代理精简版），子代理需加载 `ai-dev-workflow`，P0/P1 修完才收工；Agentic 项目增派一个加载 `agentic-principle` 的 agent 架构轴。
> - **是否向后兼容每次由你拍板**，AI 不得默认兼容；被新逻辑取代的旧函数/文件/配置/开关当场删除，不留"以后可能用"。
> - 用户提供的真实数据固化进 `tests/fixtures/<场景名>/`（凭证进 `secrets/` 并 gitignore，脱敏副本入库）；长链路必须有断言中间结果的端到端用例；未覆盖的重要场景挂账到 `docs/report/测试场景覆盖度.md`。
> - 开发全程使用独立 worktree；全部完成并通过验证后自动合并主分支，失败时保留 worktree。
> - Worktree 目录固定在仓库根的 `./.worktrees/`（每次从本设置读取，除非用户显式要求改到其它位置）。
> - 唤起 `ai-dev-workflow` skill 时按个人版路由，不再询问 mode。
<!-- ai-dev-workflow:end -->
