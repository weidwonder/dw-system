// 契约数字的**单点定义处**（无 `.test.` 后缀，不进 `node --test test/*.test.mjs` 的用例收集）。
//
// 为什么要有这个文件：本仓已经因为"同一个量在多处各写一份"栽过三次——
//   ① 计数词（`四轴`/`四道门`/…）复写在十几个文件里 → `counter-word.test.mjs`
//   ② 常驻前置量在五处漂成五个值 → `resident-budget.test.mjs` + `number-drift.test.mjs`
//   ③ 加载点清单行数下限：测试断言写 18、spec §6 与 `CLAUDE.md` 写 14 → 就是本文件
// 第三次之后按 `代码评审纪律.md` §门禁 的判据（同一类问题被报到第二次就该有闸接手），
// 把这类"既在代码里判、又在文档里被引用"的数字收敛到这里定义一次，
// 由 `contract-sync.test.mjs` 断言文档侧的引用与它一致。
//
// **新增一个契约数字时 MUST 同时在 `contract-sync.test.mjs` 里给它加引用点清单**，
// 否则它只是换了个地方硬编码，一个引用点都没被盯住。

/**
 * 加载点清单的行数下限。
 * 判据：spec §7 列出的加载点个数（设计阶段十四个 + 实现阶段判出的四个）。
 * 它是**下限不是上限**——每新判出一个触发式小节 MUST 增行，spec §7 增行时同步上调本值。
 * MUST NOT 为了让删行通过而下调它。
 */
export const LOADING_POINT_MIN = 18

/**
 * 入口 `SKILL.md` 的字节上限（AC-004）。
 *
 * 2026-08-27 由 8000 上调到 12000（`docs/spec/2026-08-27-ai-dev-workflow-spec过稿门-eng-spec.md`
 * FR-018，用户在 spec 过稿门拍板）。判据：本仓的判据文本是中文，**UTF-8 下一个汉字占 3 字节**，
 * 8000 字节只有约 2600 汉字——装不下入口的三样必载内容（路由三步 + 工作区隔离门要点 +
 * 只增不减的加载点清单）。上调前入口实测 7,980，余量 20 字节，新增一行加载点必然判红。
 *
 * 新纪律（取代旧的「MUST NOT 上调」）：上调 MUST 由用户拍板，并**同步全部活引用点**
 * （`test/` 下的断言与 `CLAUDE.md` 的契约条目，由 `contract-sync.test.mjs` 盯着）；
 * MUST NOT 为了让某一次改动过闸而顺手上调。`docs/spec/`、`docs/plan/` 下已完成文档里的
 * 旧值是**历史记账**，MUST NOT 跟着改写。
 * 压不下去时的首选仍是扩大拆分范围，上调是次选。
 */
export const ENTRY_MAX_BYTES = 12000

/** 常驻前置量门槛（AC-003）。权威计算在 `resident-budget.test.mjs`，本值只作它的门槛常量。 */
export const RESIDENT_BUDGET = 50000

/**
 * `dw-prd` 入口 `SKILL.md` 的字节上限。**与 `ENTRY_MAX_BYTES` 是两个量**：后者管
 * `dw-workflow` 的入口，两个 skill 的入口结构不同（workflow 走渐进式披露、判据下沉到
 * 分册；dw-prd 的路由第 2 步无条件加载三份 references，入口自带完整纪律），**MUST NOT 合并
 * 成一个数**。
 *
 * 定为 20000 的判据：本值是**防回涨的棘轮，不是精简目标**。2026-08-30 实测入口 19,579 字节、
 * 内含 61 条规范结论（按本闸四桶口径：MUST NOT 40 + 裸 MUST 20 + SHOULD 1；
 * **MUST NOT 单独成桶、不计进 MUST**，用 `grep -o MUST` 数会把 MUST NOT 双计成 100，MUST NOT 那样数），
 * 约每 320 字节一条——它不是注水文件，压到 `ENTRY_MAX_BYTES` 那个量级等于每条结论只剩约 197 字节，
 * 会把 `wording-redline` 红线②③要保护的消歧上下文剥光。
 *
 * **超了怎么办**：首选把新增内容写进 references（路由第 2 步反正会加载它们），MUST NOT 顺手
 * 上调本值。注意**存量判据往外搬会被 `wording-redline.test.mjs` 判红**（它按文件计规范词条数，
 * 没有"判据移到别处"的豁免通路）——真要做整体下沉，MUST 先与用户拍板该闸的逃生口怎么开，
 * MUST NOT 靠绕过任一条闸来达成。
 */
export const PRD_ENTRY_MAX_BYTES = 20000
