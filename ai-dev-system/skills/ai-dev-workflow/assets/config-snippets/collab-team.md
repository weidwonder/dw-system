<!-- ai-dev-workflow:start -->
> - 本项目存在其他人类协作方：每个仓库有明确 owner，**改动别人的仓库前 MUST 先对齐 owner**（要改什么、为什么、对该仓对外契约的影响、合并时机）；跨 ≥3 仓的需求 MUST 在 Overview 后开评审会，评审结论 MUST 回写 Overview 的"已定决策"表。
> - **兼容取舍每次由业务方拍板**，AI MUST NOT 代拍，工程侧 MUST NOT 替业务方决定；送审时用业务语言给出受影响范围、三个选项与推荐。
> - 合并按 `merge-gate` 执行：值为 `pr` 时，MUST 先过代码评审门再开 PR（该门是 PR 前的地板，MUST NOT 用它替代人审），PR 描述 MUST 引用对应 spec / plan 任务号；审批与 CI 全部通过后才启用平台自动合并，MUST NOT 绕过保护分支；多仓合并顺序 MUST 与各仓 owner 协商确认后再执行。
<!-- ai-dev-workflow:end -->
