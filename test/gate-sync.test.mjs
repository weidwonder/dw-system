// 贯穿门同步闸（FR-013 / AC-012）。
//
// 病史：贯穿门的清单被**复述**在至少三处——总纲的总表（权威定义处）、Lean 自足册 §1.3 的
// 门全景、入口 `SKILL.md` 的加载点清单。2.11.0 新增 spec 过稿门时，实测要改的文件有九个，
// 其中任何一处漏掉都**不会报错**：Lean 侧漏了，走 Lean 的 agent 就永远不知道有这道门；
// 入口漏了，判据在触发那一刻取不到。`counter-word.test.mjs` 只盯**数字**（四道门/五道门），
// 盯不到"数字对了但某个文件里少了一行"。按 `代码评审纪律.md` §门禁「同一类问题被报到
// 第二次就该有闸接手」的判据，上本闸。
//
// 判据两条：
//  1. 总表里的每个门名，在 `路径-lean.md` §1.3 与入口 `SKILL.md` 里都**字面在场**。
//  2. 总表的**行数**与该节标题里的计数词一致（`五道门` → 5 行），防"加了行忘了改标题"
//     或"改了标题忘了加行"。
//
// 设计取舍（三条，都是为了不让本闸变成另一处硬编码或哑闸）：
//  - **门名从总纲现场解析，不在本文件里写死清单**。写死等于把同一份清单抄到第四个地方，
//    正是本闸要消灭的形态；加一道门时本闸自动跟着变严，不需要有人记得来改它。
//  - **只查"在不在场"，不查上下文写得对不对**。后者是代码评审门文档轴的判断题，机器判不了；
//    本闸只守住机械可判的那一半——**MUST NOT 把本闸全绿读成"各处对这道门的描述都正确"**。
//  - **有 `section` 的复述点 MUST 只在那一节里找，MUST NOT 退回全文匹配**。这条是写本闸时
//    做反向自检当场撞出来的：起初对 `路径-lean.md` 用全文 `includes`，把 §1.3 门全景表里的
//    那一行整条抽掉，本闸照样全绿——因为同一个门名在 §6.3、§14 等处还出现着。要防的是
//    "**门全景表漏了一行**"，全文匹配防不住它，只会给出一个恒绿的假保证。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const wfRoot = path.join(repoRoot, 'ai-dev-system', 'skills', 'ai-dev-workflow')
const read = (...rel) => readFileSync(path.join(wfRoot, ...rel), 'utf8')

// 中文数字 → 阿拉伯数字。总表标题写的是「五道门」这类计数词。
const CN_NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }

/** 从总纲解析贯穿门总表：返回 { declared, names }。 */
export function parseGateTable(overview) {
  const m = overview.match(/^## ([一二三四五六七八九十])道门（[^\n]*）$/m)
  assert.ok(
    m,
    '在 `00-流程总纲.md` 里找不到贯穿门总表的标题（形如 `## 五道门（贯穿两条路径，…）`）。\n' +
      '  标题找不到 MUST 判红而不是跳过——它是本闸与 `counter-word.test.mjs` 共同的锚点，' +
      '改标题格式要同步这里。',
  )
  const declared = CN_NUM[m[1]]
  const body = overview.slice(overview.indexOf(m[0]) + m[0].length)
  // 切段边界同样 MUST 断言存在。`indexOf` 找不到时返回 -1，`slice(0, -1)` 会把总表悄悄扩到
  // 全文末尾，`names` 混进后文表格的加粗首列——又是一次静默失效（同下方 sliceSection 的约定）。
  const end = body.indexOf('\n\n另有')
  assert.notEqual(
    end,
    -1,
    '总表下方的「另有三道条件触发的门」锚点找不到——切段边界已失效，MUST 判红而不是让总表扩到全文末尾。',
  )
  const table = body.slice(0, end)
  // 表格数据行的首列形如 `| **工作区隔离门** | …`
  const names = [...table.matchAll(/^\|\s*\*\*(.+?)\*\*\s*\|/gm)].map((r) => r[1].trim())
  return { declared, names }
}

// 每个门名必须字面在场的文件。**MUST NOT 退化成空清单**——那样本闸就只剩计数一条。
// `section` 给定时只在该节正文里找（节 = 从这个标题到下一个同级或更高级标题之间）。
// 入口没有 `section`：贯穿门在入口的复述形态本就不统一——工作区隔离门是独立小节，
// 其余门散在加载点清单的行里，切节反而会漏。
const MUST_RESTATE = [
  {
    label: 'Lean 自足册 §1.3 门的全景',
    file: ['references', 'core', '路径-lean.md'],
    section: '### 1.3 ',
  },
  { label: '入口 SKILL.md', file: ['SKILL.md'] },
]

/** 取出以 `heading` 开头的那一节正文；`heading` 为空则返回全文。 */
function sliceSection(body, heading) {
  if (!heading) return body
  const start = body.indexOf(heading)
  assert.notEqual(
    start,
    -1,
    `切段锚点「${heading}」找不到——小节被改名或删了。MUST 判红而不是回退到全文匹配：` +
      '全文匹配会让本闸对"这一节漏了一行"恒绿（见文件顶部第三条设计取舍）。',
  )
  const level = heading.trim().match(/^#+/)[0].length
  const rest = body.slice(start + heading.length)
  const next = rest.search(new RegExp(`^#{1,${level}} `, 'm'))
  return next === -1 ? rest : rest.slice(0, next)
}

test('贯穿门：总表行数与标题里的计数词一致', () => {
  const { declared, names } = parseGateTable(read('references', 'core', '00-流程总纲.md'))
  assert.equal(
    names.length,
    declared,
    `贯穿门总表标题写的是 ${declared} 道，表里实际 ${names.length} 行：${names.join(' / ')}\n` +
      '  处置：加门时标题与表格 MUST 一起改；改完还要跑 `counter-word.test.mjs`（它盯别处有没有残留旧数字）。',
  )
  assert.ok(names.length > 0, '总表解析出零个门名——表格格式变了，本闸已静默失效')
})

test('贯穿门：每道门在必须复述它的文件里都在场', () => {
  const { names } = parseGateTable(read('references', 'core', '00-流程总纲.md'))
  const problems = []
  for (const { label, file, section } of MUST_RESTATE) {
    const body = sliceSection(read(...file), section)
    for (const name of names) {
      if (!body.includes(name)) {
        problems.push(
          `【${label}】缺少贯穿门「${name}」（${path.join('ai-dev-workflow', ...file)}）\n` +
            '    总纲声明了这道门，而这里一次都没提到它。走这条路径的 agent 因此永远不知道有这道门，' +
            '且不会有任何报错。MUST 在该文件里补上，MUST NOT 从总表里删掉这道门来让本闸转绿。',
        )
      }
    }
  }
  assert.equal(problems.length, 0, `\n${problems.join('\n\n')}\n`)
})

test('护栏：复述清单非空，且每个门名不是空串', () => {
  // 防退化：MUST_RESTATE 清空后第二条测试恒绿，看着在盯实际没盯。
  assert.ok(MUST_RESTATE.length > 0, 'MUST_RESTATE 是空的——本闸的第二条已不再检查任何文件')
  const { names } = parseGateTable(read('references', 'core', '00-流程总纲.md'))
  for (const name of names) assert.ok(name.length > 0, '解析出空门名，表格首列格式可能变了')
})
