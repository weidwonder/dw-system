<!-- ai-dev-workflow:start -->
> - 本项目没有其他人类协作方：MUST NOT 向不存在的 owner 求证，MUST NOT 开评审会，MUST NOT 因"等人确认"挂起任务；需要第二意见时派子代理，不等人。
> - **兼容取舍每次由你（开发者本人）拍板**，AI MUST NOT 代拍，也 MUST NOT 因为"只有我一个人用"就跳过这次拍板。
> - 合并按 `merge-gate` 执行：值为 `direct` 时，全部门禁通过后在本地对主分支做非快进合并并清理 worktree；合并失败 MUST 保留 worktree 待处理，MUST NOT 强推。
<!-- ai-dev-workflow:end -->
