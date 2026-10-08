// 体积上限闸：`test/doc-budgets.json` 是各规范文本体积上限的唯一定义处。
// 契约：docs/spec/2026-09-17-dw-system-安装器迁移与ctx体检与机器闸-eng-spec.md §2.3 / §4.3（FR-015）。
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { checkBudgets, DISPOSAL_ORDER, globToRegExp } from './doc-budgets-lib.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'test', 'doc-budgets.json'), 'utf8'))

function sandbox(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-budgets-'))
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    fs.writeFileSync(path.join(dir, rel), content)
  }
  return dir
}

test('仓库内每份受管文本都在上限以内', () => {
  const { rows, failures } = checkBudgets(repoRoot, manifest)
  console.log('# ── 体积实测（上限定义处：test/doc-budgets.json）──')
  for (const r of rows) {
    console.log(`#   ${String(r.actual).padStart(7)} / ${String(r.max).padStart(7)}  余量 ${String(r.max - r.actual).padStart(7)}  ${r.subject}`)
  }
  assert.deepEqual(failures, [], `\n${failures.join('\n')}\n${DISPOSAL_ORDER}`)
})

test('自检：超限、点名文件缺失、glob 零命中各判红', () => {
  const dir = sandbox({ 'a/big.md': 'x'.repeat(50), 'a/small.md': 'x' })
  const over = checkBudgets(dir, { classes: [{ glob: 'a/*.md', max: 10 }] })
  assert.equal(over.failures.length, 1)
  assert.match(over.failures[0], /超限：a\/big\.md/)
  const missing = checkBudgets(dir, { files: { 'a/gone.md': 10 } })
  assert.match(missing.failures[0], /不存在/)
  const empty = checkBudgets(dir, { classes: [{ glob: 'b/**/*.md', max: 10 }] })
  assert.match(empty.failures[0], /零命中/)
  // 单条上限的 entryPattern 一行都匹配不到：索引换了行形态，这条规则在空跑。
  const idle = checkBudgets(dir, { lines: [{ file: 'a/small.md', entryPattern: '^- ', maxBytes: 10 }] })
  assert.match(idle.failures[0], /空跑/)
})

test('自检：files 优先于 classes，单条按行判', () => {
  const dir = sandbox({
    's/one/r/a.md': 'x'.repeat(30), 's/one/r/b.md': 'x'.repeat(30), 's/two/r/a.md': 'x'.repeat(30),
    'index.md': '- 短\n- ' + '长'.repeat(40) + '\n',
  })
  const classes = [{ glob: 's/**/*.md', max: 40 }]
  const named = checkBudgets(dir, { files: { 's/one/r/a.md': { max: 100, note: '拍过板的例外' } }, classes })
  assert.deepEqual(named.failures, [])
  // 高于同类上限的例外 MUST 带理由；不高于的可以是裸数字。
  assert.match(checkBudgets(dir, { files: { 's/one/r/a.md': 100 }, classes }).failures[0], /例外缺理由/)
  assert.deepEqual(checkBudgets(dir, { files: { 's/one/r/a.md': 35 }, classes }).failures, [])
  const lines = checkBudgets(dir, { lines: [{ file: 'index.md', entryPattern: '^- ', maxBytes: 60 }] })
  assert.equal(lines.failures.length, 1)
})

test('自检：清单里判定逻辑不认识的顶层键判红', () => {
  // 不认识的键不参与任何判定：不判红，它就是一条看着在守、其实不生效的规则。
  const dir = sandbox({ 'a/x.md': 'x' })
  const classes = [{ glob: 'a/*.md', max: 10 }]
  assert.match(checkBudgets(dir, { classes, totals: [] }).failures.join('\n'), /未知键：totals/)
  assert.deepEqual(checkBudgets(dir, { classes }).failures, [])
})

test('自检：blockExcluded 只扣掉标记块本身', () => {
  const dir = sandbox({ 'C.md': 'ab<!--s-->' + 'x'.repeat(100) + '<!--e-->cd' })
  const r = checkBudgets(dir, { files: { 'C.md': 4 }, blockExcluded: { file: 'C.md', start: '<!--s-->', end: '<!--e-->' } })
  assert.deepEqual(r.failures, [])
})

test('自检：glob 的 * 不跨段、** 跨段', () => {
  assert.ok(globToRegExp('a/*.md').test('a/x.md'))
  assert.ok(!globToRegExp('a/*.md').test('a/b/x.md'))
  assert.ok(globToRegExp('a/**/*.md').test('a/b/c/x.md'))
  assert.ok(globToRegExp('a/**/*.md').test('a/x.md'))
})
