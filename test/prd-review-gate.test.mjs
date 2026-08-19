// 2.2.0「PRD 复核门」的契约测试。
//
// 为什么要有这份测试：本次变更的核心是一个**顺序**约定——复核门必须在落盘确认门
// 之前。顺序写在 markdown 的步骤编号里，而编号散在四个文件中，改一处忘一处不会有
// 任何报错，只会让门在错误的时机跑。这份测试把机器可判的那部分锁住：门的存在、
// 门的先后、五处接线、三个出口、步骤号全仓一致。
//
// spec：docs/spec/2026-08-19-prd复核门-lean-change-spec.md
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const prdRoot = path.join(repoRoot, 'ai-dev-system', 'skills', 'ai-prd')
const read = (...seg) => readFileSync(path.join(...seg), 'utf8')

/** ai-prd 下所有 markdown，供全仓一致性扫描。 */
const prdFiles = (function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) walk(full, acc)
    else if (name.endsWith('.md')) acc.push([path.relative(prdRoot, full), readFileSync(full, 'utf8')])
  }
  return acc
})(prdRoot)

test('复核纪律存在，且两轴与三个出口都写明', () => {
  const body = read(prdRoot, 'references', 'prd复核纪律.md')
  for (const must of ['自洽轴', '冲突轴', '三个出口', '事实错了回去补，取舍待定才给用户']) {
    assert.ok(body.includes(must), `prd复核纪律.md 缺「${must}」`)
  }
  // 冲突轴的六类冲突是判据本体，缺一类就等于漏一整类问题
  const rows = [...body.matchAll(/^\| [1-6] \| \*\*/gm)].length
  assert.equal(rows, 6, `冲突轴应有 6 类冲突，实际 ${rows} 类`)
})

test('复核门排在落盘确认门之前（本次变更的核心约定）', () => {
  const flow = read(prdRoot, 'references', '00-prd生成流程.md')
  const section = flow.slice(flow.indexOf('\n## 组稿'), flow.indexOf('\n## PRD 生命周期'))
  const review = section.search(/^4\. \*\*复核门/m)
  const landing = section.search(/^5\. \*\*落盘确认门/m)
  assert.ok(review > 0, '组稿第 4 步不是复核门')
  assert.ok(landing > 0, '组稿第 5 步不是落盘确认门')
  assert.ok(review < landing, '复核门 MUST 排在落盘确认门之前')
})

test('五处接线都在（少一处，门就在那条路径上不存在）', () => {
  const wired = {
    'SKILL.md': ['prd复核纪律', '复核门'],
    'references/prd质量清单.md': ['prd复核纪律', '本清单不是最后一道关'],
    'references/collab/solo.md': ['prd复核纪律'],
    'references/collab/team.md': ['prd复核纪律'],
    'assets/question-bank.md': ['复核门'],
  }
  const missing = []
  for (const [file, needles] of Object.entries(wired)) {
    const body = read(prdRoot, file)
    for (const n of needles) if (!body.includes(n)) missing.push(`${file} ← 缺「${n}」`)
  }
  assert.deepEqual(missing, [], '复核门接线缺失：\n' + missing.join('\n'))
})

test('组稿步骤号全仓一致：编号连续，且指向落盘确认门的引用恒为第 5', () => {
  // 编号漂移不会报错，只会让引用指向另一道门——这正是机器该盯的
  const flow = read(prdRoot, 'references', '00-prd生成流程.md')
  const section = flow.slice(flow.indexOf('\n## 组稿'), flow.indexOf('\n## PRD 生命周期'))
  const nums = [...section.matchAll(/^([0-9])\. /gm)].map((m) => Number(m[1]))
  assert.deepEqual(nums, [1, 2, 3, 4, 5, 6, 7, 8], '组稿步骤编号必须 1–8 连续不重复')

  const wrong = []
  for (const [file, body] of prdFiles) {
    for (const m of body.matchAll(/第 ([0-9]) 条的落盘确认门/g)) {
      if (m[1] !== '5') wrong.push(`${file} ← 「第 ${m[1]} 条的落盘确认门」应为第 5 条`)
    }
  }
  assert.deepEqual(wrong, [], '组稿步骤号漂移：\n' + wrong.join('\n'))
})

test('子代理 prompt 模板守住三条硬约束', () => {
  const body = read(prdRoot, 'references', 'prd复核纪律.md')
  const start = body.indexOf('```text')
  const prompt = body.slice(start, body.indexOf('```', start + 7))
  assert.ok(/MUST NOT 修改或创建任何文件/.test(prompt), 'prompt 未禁止子代理写文件')
  assert.ok(/无出处的冲突指控视为幻觉/.test(prompt), 'prompt 未要求冲突带出处')
  assert.ok(/查不到 MUST NOT 报成冲突/.test(prompt), 'prompt 未挡住"查不到即报冲突"')
  // PRD 尚未落盘，必须内联；否则子代理会去 docs/spec/ 找一个不存在的文件
  assert.ok(/尚未落盘/.test(prompt), 'prompt 未说明 PRD 尚未落盘、需内联')
})

test('VERSION 不低于 2.2.0（复核门自此版起）并带一屏内的迁移指南', () => {
  // 与 cards-mandatory 同一修法：写死当前版本会让此后每次无关的 bump 都在这里假红
  const version = read(repoRoot, 'ai-dev-system', 'VERSION').trim()
  const [maj, min] = version.split('.').map(Number)
  assert.ok(maj > 2 || (maj === 2 && min >= 2), `复核门自 2.2.0 起，VERSION 不应低于它：${version}`)
  const migration = path.join(repoRoot, 'ai-dev-system', 'migrations', `${version}.md`)
  assert.ok(existsSync(migration), `缺迁移指南：${migration}`)
  assert.ok(readFileSync(migration, 'utf8').split('\n').length <= 45, '迁移指南要保持一屏内（≤45 行）')
})

test('[组稿·复核后] 标签枚举三处同步（本次已重演两次的失败模式，锁成机器闸）', () => {
  // 标签枚举散在三处：question-bank 的说明 / 00-prd生成流程 的标签清单 / SKILL.md 路由。
  // 改一处漏一处不会报错，只会让新标签在漏掉那处被当成普通 [组稿] 在第 3 步勾验。
  const spots = [
    ['assets/question-bank.md', '定义勾验时机'],
    ['references/00-prd生成流程.md', '§4 批提问的标签清单'],
    ['SKILL.md', '路由第 4 步的枚举'],
  ]
  const missing = spots.filter(([f]) => !read(prdRoot, f).includes('[组稿·复核后]'))
  assert.deepEqual(missing.map(([f, why]) => `${f}（${why}）`), [], '标签枚举漏同步')

  // 勾验时机是这个子类存在的全部理由，丢了它就退化成一个多余的标签
  const qb = read(prdRoot, 'assets', 'question-bank.md')
  assert.ok(/第 3 步 MUST NOT 勾验/.test(qb), 'question-bank 未写明第 3 步不勾验')
})

test('子代理报告的「出口」列取值能表达全部三个出口', () => {
  // 三出口改判时这一列漏改过一次：两个可填值装不下三个出口，
  // "现状失实"只能被标成【需用户拍板】——正是判据明令禁止的路径
  const body = read(prdRoot, 'references', 'prd复核纪律.md')
  for (const v of ['【当场改稿】', '【回流到批 B】', '【回流到批 D】', '【需用户拍板】']) {
    assert.ok(body.includes(v), `返回格式的出口列缺取值 ${v}`)
  }
  // 冲突轴的取证足迹是"补交接面"那条无条件 MUST 的唯一输入，缺了它该条就是空转
  assert.ok(/取证足迹/.test(body), '返回格式缺「取证足迹」段')
  assert.ok(/与本轴有没有发现无关/.test(body), '取证足迹未写成无条件必交')
})
