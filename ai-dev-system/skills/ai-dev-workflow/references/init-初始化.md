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

2. **询问**（仅当两文件都无标记块）：
   > "这个项目用 ai-dev-workflow 的哪种模式？
   > - **个人版**：一个人的轻量项目，默认最短流程。
   > - **团队版**：多人多项目，含协作约定 + Engineering Context 层。"

3. **注入**（幂等）：按选择，把 `assets/config-snippets/{personal|team}.md` 的内容，用标记块包裹，写入项目根的 **两个** 文件：
   - `CLAUDE.md`（Claude Code 自动加载）
   - `AGENTS.md`（Codex 自动加载）
   - 文件不存在则创建；已存在则在末尾追加标记块（不动其它内容）。

4. **团队版额外引导**：
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

## 切换 mode

用户显式要求切换时（如"把这个项目改成团队版"）：
- 找到标记块，替换为另一 mode 的 snippet。
- 团队版 → 个人版：保留 engineering-context/ 目录（不删数据），只改行为。
- 个人版 → 团队版：提示跑 `ctx init`。

## 写入示例

见 `assets/config-snippets/personal.md` 与 `team.md`——它们就是被注入标记块内的原文。
