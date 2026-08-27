<!-- ai-dev-workflow:start -->
> **本项目采用 ai-dev-workflow**
> (mode="team" collaboration="solo" merge-gate="direct" worktree-dir="./.worktrees/")
>
> - 唤起 `ai-dev-workflow` / `ai-prd` skill 时按本块字段路由，MUST NOT 再问一次；本项目有没有代码图谱索引由 skill 每次运行时探测得出，MUST NOT 写死在本块里。
> - 文档目录固定：spec → `docs/spec/`，plan → `docs/plan/`，report → `docs/report/`。
> - 文档有生命周期：新建文档 frontmatter MUST 带 `lifecycle: active` 与 `authority_refs`；`docs/index.md` 只放现行口径，归档进 `docs/index-archive.md`；代码评审门的 **D 文档轴**按本次**触碰的权威面**（与刷新代码事实**同源但更宽**——多出的那几类不触发刷卡；**唯一权威清单只有一份**，在 `ai-dev-workflow` 的 `references/core/文档治理.md` §3 第 1 步，MUST NOT 在本块复述）判定文档去留、主会话当场落盘，准出时只核对结论。
> - **任何文档或代码落盘前 MUST 先建立独立 worktree**，Lean Change Spec 也不例外；多仓需求每个仓库各建一个。MUST NOT 在主工作树直接改，MUST NOT stash / reset 用户既有改动。
> - Worktree 目录以本块 `worktree-dir` 字段为准，**每次从本设置读取**；用户要求换位置时 MUST 改本字段，MUST NOT 临时另建目录。
> - **编码完成后 MUST 过代码评审门**：派子代理跑规范 / 忠实 / 残留 / 文档四轴（Lean 用单子代理精简版），子代理需加载 `ai-dev-workflow`，P0/P1 修完才收工；Agentic 项目增派一个加载 `agentic-principle` 的 agent 架构轴。
> - **合并方式只读本块 `merge-gate` 字段，与协作面无关**（`solo` + `pr`、`team` + `direct` 都是合法组合，MUST NOT 由协作面推合并方式）：值为 `direct` 时，全部门禁通过后在本地对主分支做非快进合并（`git merge --no-ff`）并清理 worktree，不开 PR、不等外部门禁；值为 `pr` 时，MUST 先过代码评审门再开 PR（该门是 PR 前的地板，MUST NOT 用它替代人审），审批与 CI 全部通过后才启用平台自动合并，MUST NOT 绕过保护分支、也 MUST NOT 在平台未放行时改用本地直合。两个取值下合并失败都 MUST 保留 worktree 待处理，MUST NOT 强推。完成条件、本字段缺失时的兜底与多仓合并顺序的**推导规则**，唯一权威定义在 `ai-dev-workflow` skill 的 `references/core/worktree开发纪律.md` §完成与自动合并门。
> - **AI MUST NOT 默认向后兼容**：spec 定稿前把被改变的既有行为逐条列出送拍板（拍板人见下方协作面条目）；被取代的旧函数 / 文件 / 配置 / 开关当场删除，不留"以后可能用"，保留项 MUST 带理由与到期日并登记进替换清单。
> - 真实数据固化进项目既有测试目录，没有则 `tests/fixtures/<场景名>/`（凭证进同级 `secrets/` 并 gitignore，脱敏副本入库）；长链路 MUST 有断言中间结果的端到端用例；未覆盖的重要场景挂账到 `docs/report/测试场景覆盖度.md`。
> - **Agentic 应用 MUST 加载 `agentic-principle` skill**（模型自主规划 / 直接调工具 / 未过闸门就改状态 / 记忆跨会话影响决策）：架构选型、提示词、注意力与并发预算、步骤级测试用它；运行期 AI 契约仍用 ai-dev-workflow 的 AI overlay。两者内容互相独立，MUST NOT 合并。
> - 用户沟通只用业务语言：大架构 MUST 交用户确认，模块内设计只问业务问题，详细程序设计不要求用户确认。
> - **本项目维护 `engineering-context/` 代码事实层**：`capability-registry.md`（能力 → 权威实现的登记表）+ `cards/<repo>.md`（每个仓库一张事实卡）。它没有开关，内容按任务渐进补齐；起步时只有模板占位是正常状态。
> - 查"能力对应哪个仓库/接口""跨服务影响面""哪个是权威实现"时 MUST 先用 `ctx`：`ctx find-scenes <关键词>`（未限定单仓时先取端到端全景）→ `ctx discover "<意图>"` → `ctx get-card <repo> [域]`。每条据此得到的事实 MUST 附 cite（path + anchor + 确认时间），无 cite 视为幻觉。
> - **`ctx` 查不到卡片时 MUST 读源码把事实核实清楚，并当场把卡片补上**（职责 / 对外接口带 `文件:行` / 陷阱项 / 确认时间四项即可），随本次分支一起提交，MUST NOT 顺延到以后；**MUST NOT 退回 grep 找权威实现**。
> - `ctx` 命令找不到时改用 `node <本skill根目录>/scripts/ctx/src/cli.js <命令>`（功能相同；`<本skill根目录>` = ai-dev-workflow 的 SKILL.md 所在目录）——Claude Code 下是 `.claude/skills/ai-dev-workflow/`，Codex 下是 `.agents/skills/ai-dev-workflow/`，两份内容一致，用你这一侧那份；**MUST NOT 退回 grep**。
> - 本项目没有其他人类协作方：MUST NOT 向不存在的 owner 求证，MUST NOT 开评审会，MUST NOT 因等**第三方**（owner / 业务方 / 评审人）确认而挂起任务；**用户本人的兼容取舍拍板、以及合并方式为 `pr` 时的平台审批与 CI 除外**（这些例外是门，不是对齐开销）。需要第二意见时派子代理，不等人。
> - **兼容取舍每次由你（开发者本人）拍板**，AI MUST NOT 代拍，也 MUST NOT 因为"只有我一个人用"就跳过这次拍板。
> - 合并方式为 `pr` 时，PR 的审批人就是你本人：MUST 把 PR 链接与四轴报告结论交给你过目并请你放行，MUST NOT 静默等待外部审批；CI 失败按常规修复后重推，MUST NOT 改用本地直合。
<!-- ai-dev-workflow:end -->
