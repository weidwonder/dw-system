# 初始化：写入 mode 到 CLAUDE.md / AGENTS.md

> 首次在某项目调用 skill 且找不到 mode 标记时执行。**只问一次 mode**，之后固化。

## 流程

1. **检测**：读项目根的 `CLAUDE.md` 与 `AGENTS.md`，查找标记块：
   ```
   <!-- ai-dev-workflow:start -->
   ... mode="personal" | mode="team" ...
   <!-- ai-dev-workflow:end -->
   ```
   - 任一文件已有标记块 → **不是初始化**，直接读出 mode，并把同一标记块幂等同步到另一文件后走路由，不再询问。

2. **冲突扫描**：按 `references/环境冲突扫描.md` 扫描项目自带的 `.claude/`、`.agents/` 下
   rules/skills/agents，产出冲突清单（可能为空）。扫描是事实收集，自动完成，不问用户。

3. **询问**（仅当两文件都无标记块）：
   > "这个项目用 ai-dev-workflow 的哪种模式？
   > - **个人版**：一个人的轻量项目，默认最短流程。
   > - **团队版**：多人多项目，含协作约定 + Engineering Context 层。"

   若第 2 步冲突清单非空，把冲突决断（逐项 移除/修改/保留 + 建议）与 mode 问题
   **同一批**抛出，不一问一答；用户答复后先按 `环境冲突扫描.md` §处置流程执行，再继续注入。

4. **注入**（幂等）：按选择，把 `assets/config-snippets/{personal|team}.md` 的内容，用标记块包裹，写入项目根的 **两个** 文件：
   - `CLAUDE.md`（Claude Code 自动加载）
   - `AGENTS.md`（Codex 自动加载）
   - 文件不存在则创建；已存在则在末尾追加标记块（不动其它内容）。
   - **写之前先按下方「入口是软链接时」判断**：任一入口是软链接时，写的对象是链接目标，不是链接本身。

5. **团队版额外引导**：
   > "团队版建议初始化 Engineering Context 目录：
   > `node <skill路径>/scripts/ctx/src/cli.js init`
   > 它会生成 engineering-context/（capability-registry + cards + scenes + probe-set + glossary 模板），按 references/company/context-engineering.md 逐步填充；
   > 场景蓝图（scenes/）是 `ctx find-scenes` 的数据源，高频跨服务场景应优先补。"

## 幂等规则（重要）

- **只更新标记块内的内容，绝不重复追加**。重复调用初始化时：
  - 若标记块已存在 → 用新内容**替换块内**，保留块外一切。
  - 若不存在 → 追加一个新块。
- **两个入口必须收敛**：只有 `CLAUDE.md` 或只有 `AGENTS.md` 有 mode 块时，自动补齐另一文件；两边 mode 不一致时，以 `CLAUDE.md` 为准并同步到 `AGENTS.md`。
- 标记用 HTML 注释，对 markdown 渲染无影响，且机器可精确定位。

## 入口是软链接时（重要）

很多项目让 Claude Code 与 Codex **共用一份指导文件**，做法是把 `AGENTS.md` 软链接到 `CLAUDE.md`（反向亦有，也可能两者都链到仓库外的共用文件）。这种链接是用户的刻意配置，**任何写入都必须保留它**。

写 `CLAUDE.md` / `AGENTS.md` 之前，先各判断一次（例如 `ls -l CLAUDE.md AGENTS.md`，或 `readlink CLAUDE.md`）：

- **不是链接** → 按上面的幂等规则直接写这个文件。
- **是链接** → 逐层解析到实体文件，**把实体文件当作写入对象**，对它照常判断"替换块内"还是"追加新块"。链接本身不删、不改、不替换成普通文件；不要用"先删再建"或整文件覆盖的写法。
- **两个入口解析到同一个实体文件** → 这就是共用一份的情形：**只写一次**，不要把同一标记块注入两遍。此时"两个入口都要有 mode"天然满足，不必再补第二次。
- **断链**（链接目标不存在，或目标所在目录不存在）→ **停下来问用户**，不要新建实体文件把链接顶掉。这通常意味着用户的共用文件被移走了。

## 切换 mode

用户显式要求切换时（如"把这个项目改成团队版"）：
- 找到标记块，替换为另一 mode 的 snippet。
- 团队版 → 个人版：保留 engineering-context/ 目录（不删数据），只改行为。
- 个人版 → 团队版：提示跑 `ctx init`。

## 写入示例

见 `assets/config-snippets/personal.md` 与 `team.md`——它们就是被注入标记块内的原文。
