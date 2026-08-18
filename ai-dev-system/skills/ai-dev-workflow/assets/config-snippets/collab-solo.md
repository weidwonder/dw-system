<!-- 本片段从不单独注入：注入或替换时 MUST 只取下方 start 与 end 之间的**块内内容**（不含两行标记本身），拼在 `base.md` 的块内内容之后，再用一对标记包裹。属性行（含 collaboration / merge-gate / worktree-dir）只在 `base.md` 里，本片段 MUST NOT 出现属性行。 -->
<!-- ai-dev-workflow:start -->
> - 本项目没有其他人类协作方：MUST NOT 向不存在的 owner 求证，MUST NOT 开评审会，MUST NOT 因等**第三方**（owner / 业务方 / 评审人）确认而挂起任务；**用户本人的兼容取舍拍板、以及合并方式为 `pr` 时的平台审批与 CI 除外**（那两项是门，不是对齐开销）。需要第二意见时派子代理，不等人。
> - **兼容取舍每次由你（开发者本人）拍板**，AI MUST NOT 代拍，也 MUST NOT 因为"只有我一个人用"就跳过这次拍板。
<!-- ai-dev-workflow:end -->
