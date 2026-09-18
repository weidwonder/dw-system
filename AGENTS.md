<!-- dw-workflow:start -->
> **本项目采用 dw-workflow**
> (collaboration="solo" merge-gate="direct" worktree-dir="./.worktrees/")
>
> 本块只放每个会话都要知道的规则与指针；每条规则的判据在它后面点名的 skill 里，到那一步 MUST 加载该 skill，MUST NOT 凭本块一句话推断判据。skill 在项目级或全局的 `<skills 根>/<名>/`（路径见 `dw-code-facts`）。按 RFC 2119 解释规范词。
>
> - **路由**：唤起 `dw-workflow` / `dw-prd` 时按本块字段路由，MUST NOT 再问一次。有没有代码图谱索引由 skill 每次运行探测，MUST NOT 写死在本块。
> - **两条总纲**（展开在 `dw-workflow` 入口）：一个事实只有一个家，别处只放链接；规范文本有体积上限，超限先搬走、再压缩、最后才抬上限。
> - **落盘前 MUST 先建独立 worktree**（`dw-worktree`）：任何文档或代码落盘前，Lean 也不例外；多仓每仓一个。目录取本块 `worktree-dir`，每次从这里读；换位置 MUST 改本字段，MUST NOT 临时另建目录。MUST NOT 在主工作树直接改，MUST NOT stash / reset 用户既有改动。
> - **查代码事实 MUST 先用 `ctx`**（`dw-code-facts`）：`ctx find-scenes <关键词>` → `ctx discover "<意图>"` → `ctx get-card <repo> [域]`，每条事实 MUST 附 cite（`路径#符号` + 确认时间），无 cite 视为幻觉。查不到卡片 → 读源码核实并当场补卡（最小四节：职责 / 权威实现与对外接口 / 陷阱项 / 确认）、随本次分支提交，MUST NOT 顺延。`ctx` 命令找不到时用 `node <skills 根>/dw-code-facts/scripts/ctx/src/cli.js <命令>`。两种情况都 MUST NOT 退回 grep 找权威实现。`engineering-context/` 没有开关，起步只有模板占位是正常状态。
> - **bug、回归、异常行为**：改代码前 MUST 先造出能变红的复现回路（`dw-bug-diagnosis`）。
> - **AI MUST NOT 默认向后兼容**：spec 定稿前把被改变的既有行为逐条列出送拍板；被取代的旧函数 / 文件 / 配置 / 开关当场删除，保留项 MUST 带理由与到期日并登记进替换清单（`dw-workflow` 的 `确认门.md`、`dw-review-gate` 的 `替换清单.md`）。
> - **spec 定稿后、动手实现前 MUST 过 spec 过稿门**（`dw-workflow` 的 `确认门.md`）：只请拍板人看业务可判定的部分；他没回复 MUST NOT 推进；跳过只认他自己说"这次不用看"，且只对本次有效。
> - **改动落盘后（含只改 `docs/`）MUST 过代码评审门**（`dw-review-gate`）：判对象面 → 推评审轴 → 派子代理 → P0 / P1 修完；三个对象面都不命中时轴集合只有文档轴，MUST NOT 跳过本门。够小的改动 MAY 按该 skill 的规则登记积压；未过门也未登记积压时 MUST NOT 合并。
> - **写方案与写代码 MUST 守 YAGNI / KISS / DRY / LoD**（`dw-workflow` 的 `实现纪律.md` §设计原则）：没有需求对应的抽象、开关、配置项不写。
> - **纯 skill 改动**（范围不含可执行代码文件）：PRD 即 spec，动手前 MUST 加载 `skill-principle`；跳过的是产物，不是门（`dw-workflow` 的 `纯skill改动.md`）。
> - **文档**（`dw-doc-governance`）：spec → `docs/spec/`，plan → `docs/plan/`，report → `docs/report/`，决策记录 → `docs/decisions/`；新建文档 frontmatter MUST 带 `lifecycle: active` 与 `authority_refs`；`docs/index.md` 只放现行口径。需求真相源只写已实现的现状，还没做的去 `docs/TODO.md`。
> - **写或精简规范文本、注释、卡片、提示词**：按 `dw-prose`——删改前保住每条命题，只写现状，来历进决策记录。
> - **每次合并 MUST 在仓库根 `CHANGELOG.md` 的 `## 未发布` 下至少写一条**，在评审门之前写好；分类是闭集 `不兼容` / `新增` / `变更` / `修复` / `内部`，MUST NOT 自造，对外不可见的写 `内部`，MUST NOT 以"本次无对外变化"为由不写；升级上游前 MUST 先读 `engineering-context/dependencies/` 下它的依赖声明（`dw-code-facts`）。`direct` 下 AI MUST NOT 替拍板人定版本号或打 tag；`pr` 下合并即发。
> - **合并方式只读本块 `merge-gate`，与协作面无关**（`dw-worktree`）：`direct` 为全部门禁通过后本地非快进合并并清理 worktree；`pr` 为过评审门后开 PR，平台放行后才合并——本门是 PR 前的地板，MUST NOT 替代人审，平台未放行 MUST NOT 改用本地直合。合并失败 MUST 保留 worktree，MUST NOT 强推，MUST NOT 绕过保护分支。
> - **真实数据**固化进项目既有测试目录，没有则 `tests/fixtures/<场景名>/`，凭证进同级 `secrets/` 并 gitignore、脱敏副本入库；未覆盖的重要场景挂账到 `docs/report/测试场景覆盖度.md`；长链路 MUST 有断言中间结果的端到端用例（`dw-workflow` 的 `测试资产纪律.md`）。
> - **Agentic 应用**（命中任一即是：模型自主规划、直接调工具、未过确定性闸门就改状态、记忆跨会话影响决策）MUST 加载 `agentic-principle`；**新建或改动 skill** MUST 加载 `skill-principle`。两者是伴生 skill，判据以它们当前版本为准。
> - **与用户只用业务语言**：大架构 MUST 交用户确认，模块内设计只问业务问题，详细程序设计不要求用户确认（`dw-workflow` 的 `用户沟通纪律.md`）。
> - 本项目没有其他人类协作方：MUST NOT 向不存在的 owner 求证，MUST NOT 开评审会，MUST NOT 因等**第三方**（owner / 业务方 / 评审人）确认而挂起任务；**用户本人的兼容取舍拍板、用户本人在 spec 过稿门的表态、以及合并方式为 `pr` 时的平台审批与 CI 除外**（这些例外是门，不是对齐开销；前两者是仅有的两个允许因等用户而挂起的流程内点，MUST NOT 因为"只有我一个人用"就跳过）。需要第二意见时派子代理，不等人。
> - **兼容取舍每次由你（开发者本人）拍板**，AI MUST NOT 代拍，也 MUST NOT 因为"只有我一个人用"就跳过这次拍板。
> - 合并方式为 `pr` 时，PR 的审批人就是你本人：MUST 把 PR 链接与各轴报告结论交给你过目并请你放行，MUST NOT 静默等待外部审批；CI 失败按常规修复后重推，MUST NOT 改用本地直合。
<!-- dw-workflow:end -->
