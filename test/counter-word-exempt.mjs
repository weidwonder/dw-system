// 计数词豁免清单的唯一定义处：`counter-word.test.mjs` 与 `cards-mandatory.test.mjs` 共用。
//
// 文件名不带 `.test.`：`node --test test/*.test.mjs` 按这个后缀收集用例，带上会被当成一份空
// 测试文件；把常量放进某个 `.test.mjs` 再 import，另一个进程会把那份文件的用例再注册一遍。
//
// 路径基准是 `dw-system/skills/`。

/** 逐个豁免的文件。 */
export const EXEMPT_FILES = []

/**
 * 整目录豁免。`config-snippets/` 被注入目标项目的 CLAUDE.md / AGENTS.md，
 * 读它的 AI 不一定已经加载 skill，"按某文件某小节执行"在那一刻无法兑现。
 */
export const EXEMPT_DIRS = ['dw-workflow/assets/config-snippets/']
