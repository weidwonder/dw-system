// 贯穿门同步闸。
//
// 总纲的门全景表是贯穿门清单的家。两条判据：
//  1. 表里的每个门名，在 Lean 一页的 §顺序 表里字面在场——漏一行，走 Lean 的 agent 不知道有这道门，
//     且不会有任何报错。`counter-word.test.mjs` 只盯数字，盯不到"数字对了但少了一行"。
//  2. 表的行数与该节标题里的计数词一致（`五道门` → 5 行）。
//
// 门名从总纲现场解析，不在本文件里写死：写死等于把同一份清单再抄一处。
// 只查"在不在场"；描述得对不对由评审门文档轴判，本闸全绿 MUST NOT 被读成各处描述都正确。
// 有 `section` 的核对点只在那一节里找，MUST NOT 退回全文匹配：同一个门名在别的小节也出现，
// 全文匹配对"§顺序 表漏了一行"恒绿。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const wfRoot = path.join(repoRoot, 'dw-system', 'skills', 'dw-workflow')
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
// 总纲的门全景表是门名的家。Lean 走的是另一页步骤顺序（`路径-lean.md` §顺序），那张表 MUST 给
// 每道贯穿门排一行：漏一行，走 Lean 的 agent 就不知道有这道门，且不会有任何报错。
// 这里核对的是"排了没有"，判据本身只在各门自己的 skill 里。
const MUST_RESTATE = [
  // 入口只写门的名字加指针，不展开判据；但名字 MUST 在——Triage 之前 agent 手里只有入口。
  { label: '入口 SKILL.md', file: ['SKILL.md'], section: '' },
  {
    label: 'Lean 一页 §顺序',
    file: ['references', '路径-lean.md'],
    section: '## 顺序',
  },
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
  const { declared, names } = parseGateTable(read('references', '00-流程总纲.md'))
  assert.equal(
    names.length,
    declared,
    `贯穿门总表标题写的是 ${declared} 道，表里实际 ${names.length} 行：${names.join(' / ')}\n` +
      '  处置：加门时标题与表格 MUST 一起改；改完还要跑 `counter-word.test.mjs`（它盯别处有没有残留旧数字）。',
  )
  assert.ok(names.length > 0, '总表解析出零个门名——表格格式变了，本闸已静默失效')
})

test('贯穿门：每道门在必须复述它的文件里都在场', () => {
  const { names } = parseGateTable(read('references', '00-流程总纲.md'))
  const problems = []
  for (const { label, file, section } of MUST_RESTATE) {
    const body = sliceSection(read(...file), section)
    for (const name of names) {
      if (!body.includes(name)) {
        problems.push(
          `【${label}】缺少贯穿门「${name}」（${path.join('dw-workflow', ...file)}）\n` +
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
  const { names } = parseGateTable(read('references', '00-流程总纲.md'))
  for (const name of names) assert.ok(name.length > 0, '解析出空门名，表格首列格式可能变了')
})
