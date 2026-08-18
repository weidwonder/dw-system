<!-- 本片段从不单独注入：注入或替换时 MUST 只取下方 start 与 end 之间的**块内内容**（不含两行标记本身），拼在 `base.md` 的块内内容之后，再用一对标记包裹。属性行（含 collaboration / merge-gate / worktree-dir）只在 `base.md` 里，本片段 MUST NOT 出现属性行。 -->
<!-- ai-dev-workflow:start -->
> - 本项目存在其他人类协作方：每个仓库有明确 owner，**改动别人的仓库前 MUST 先对齐 owner**（要改什么、为什么、对该仓对外契约的影响、合并时机）；跨 ≥3 仓的需求 MUST 在 Overview 后开评审会，评审结论 MUST 回写 Overview 的"已定决策"表。
> - **兼容取舍每次由业务方拍板**，AI MUST NOT 代拍，工程侧 MUST NOT 替业务方决定；送审时用业务语言给出受影响范围、三个选项与推荐。
> - 有其他协作方时的合并增量（合并方式与 PR 自身的要求都不在这里，只读 `merge-gate` 与 core）：多仓合并**顺序**由 core 推导，但 MUST 先与各仓 owner 协商确认后再执行。
<!-- ai-dev-workflow:end -->
