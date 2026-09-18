// 规范句重复检测：含 MUST / SHOULD 的句子归一化后出现在两个以上 skill 文件即判红。
// 契约：docs/spec/2026-09-17-dw-system-安装器迁移与ctx体检与机器闸-eng-spec.md §4.4（FR-016）。
//
// 确需就地重复的关键一句登记在 single-home.allow.json（sentence / files / reason 三项齐全）。
// 白名单里已不再重复的条目同样判红：否则它只增不减，最后变成一份没人看的豁免清单。
// 本闸只抓逐字重复；换了措辞的重复展开由评审门的文档轴与 skill 原则轴查。
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { compareWithAllowlist, findDuplicates, normativeSentences } from './single-home-lib.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const skillsRoot = path.join(here, '..', 'dw-system', 'skills')
const allow = JSON.parse(fs.readFileSync(path.join(here, 'single-home.allow.json'), 'utf8'))

test('skills 树里没有未登记的逐字重复规范句，白名单没有过期条目', () => {
  const duplicates = findDuplicates(skillsRoot)
  const { unlisted, stale, malformed } = compareWithAllowlist(duplicates, allow)
  const lines = []
  for (const d of unlisted) lines.push(`未登记的重复：${d.files.join(' + ')}\n    ${d.text}`)
  for (const e of stale) lines.push(`白名单条目已不再重复，MUST 删掉：${e.sentence}`)
  for (const e of malformed) lines.push(`白名单条目缺 sentence / files / reason：${JSON.stringify(e)}`)
  assert.deepEqual(lines, [], `\n${lines.join('\n')}\n处置：留家里那份，其余改成名字加指针（家在哪见 dw-workflow/SKILL.md §归属表）；`
    + '读者在那个位置非知道不可的关键一句才登记白名单，并写明理由。')
})

function withTree(files, fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'single-home-'))
  try {
    for (const [rel, body] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
      fs.writeFileSync(path.join(root, rel), body)
    }
    return fn(root)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

const RULE = '删除旧 skill 目录之前 MUST 先核对它的父目录确实是 skills 目录'

test('自检：同一句规范句写进两个文件判红；强调符、空白与标点的差异不影响判定', () => {
  withTree({ 'a/SKILL.md': `- **${RULE}**。\n`, 'b/ref.md': `> ${RULE.replace('MUST', ' MUST ')}；其余略。\n` }, (root) => {
    const d = findDuplicates(root)
    assert.equal(d.length, 1)
    assert.deepEqual(d[0].files, ['a/SKILL.md', 'b/ref.md'])
  })
})

test('自检：同一文件内重复、不含规范词的句子、过短的句子、代码围栏里的句子都不判', () => {
  withTree({
    'a.md': `${RULE}。${RULE}。\n这句没有规范词但两边都有，长度也足够超过下限了的。\nMUST NOT 顺延\n\`\`\`\n${RULE}\n\`\`\`\n`,
    'b.md': `这句没有规范词但两边都有，长度也足够超过下限了的。\nMUST NOT 顺延\n\`\`\`\n${RULE}\n\`\`\`\n`,
  }, (root) => assert.deepEqual(findDuplicates(root), []))
})

test('自检：登记过的放行；文件集超出登记范围、条目缺理由、条目已不再重复各判红', () => {
  withTree({ 'a.md': `${RULE}\n`, 'b.md': `${RULE}\n`, 'c.md': `${RULE}\n` }, (root) => {
    const d = findDuplicates(root)
    const ok = [{ sentence: RULE, files: ['a.md', 'b.md', 'c.md'], reason: '关键一句' }]
    assert.deepEqual(compareWithAllowlist(d, ok), { unlisted: [], stale: [], malformed: [] })
    assert.equal(compareWithAllowlist(d, [{ ...ok[0], files: ['a.md', 'b.md'] }]).unlisted.length, 1, '又多抄了一处 MUST 判红')
    assert.equal(compareWithAllowlist(d, [{ ...ok[0], reason: ' ' }]).malformed.length, 1)
    assert.equal(compareWithAllowlist([], ok).stale.length, 1)
  })
})

test('自检：抽取确实抽得到东西——skills 树里的规范句不是零条', () => {
  const sample = fs.readFileSync(path.join(skillsRoot, 'dw-workflow', 'SKILL.md'), 'utf8')
  assert.ok(normativeSentences(sample).length > 5, '一条规范句都抽不到时，上面的零重复是假绿')
})
