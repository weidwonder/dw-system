// 计数词豁免清单的**唯一定义处**（spec §4.3 的豁免 1 与豁免 3）。
//
// 为什么单独一个文件：这份清单同时被两条机器闸用到——`counter-word.test.mjs` 管"别处还有
// 没有残留数字"，`cards-mandatory.test.mjs` 的护栏取值闸管"权威文件里的数字对不对"。此前两边
// 各抄了一份、只靠注释「保持一致」手工同步，两边写法还不同（`SKILL.md` vs
// `dw-workflow/SKILL.md`），漂了不会报任何错。同一份判据 MUST 只有一处定义。
//
// 文件名**刻意不带 `.test.`**：`node --test test/*.test.mjs` 按这个后缀收集用例，带上就会被
// 当成一份空测试文件；而如果把常量放在某个 `.test.mjs` 里再 import，另一个进程会把那份文件的
// 用例一并注册，同一批测试跑两遍。
//
// 路径基准是 `dw-workflow/`（`counter-word.test.mjs` 的 wfRoot）。以仓库根为基准的调用方
// （`cards-mandatory.test.mjs`）用 `includes` 匹配，前缀差异不影响判定。
//
// spec：docs/spec/2026-08-23-渐进式披露与需求追溯-eng-spec.md §4.3

// 1. `SKILL.md` 与 Lean 自足册 `路径-lean.md` —— 它们按设计必须复述这些内容（入口在没有
//    别的文件在手时就要判门；Lean 路径不读常驻篇），且按从属规则不可能是权威定义文件。
export const EXEMPT_FILES = ['SKILL.md', 'references/core/路径-lean.md']

// 3. `assets/config-snippets/**` 整目录 —— 内容被注入**目标项目**的 CLAUDE.md/AGENTS.md，
//    读它的 AI 手边没有本 skill 的文件可跳转，"按某文件某小节执行"对它无法兑现；
//    2026-08-23 兼容取舍门已拍板保留原表述（spec §8.1）。
export const EXEMPT_DIRS = ['assets/config-snippets/']
