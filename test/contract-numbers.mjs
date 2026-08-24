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

/** 入口 `SKILL.md` 的字节上限（AC-004）。压不下去 MUST 扩大拆分范围，MUST NOT 上调。 */
export const ENTRY_MAX_BYTES = 8000

/** 常驻前置量门槛（AC-003）。权威计算在 `resident-budget.test.mjs`，本值只作它的门槛常量。 */
export const RESIDENT_BUDGET = 50000
