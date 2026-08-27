// 为什么要有这份测试：六个固定实现区搬出 ui-prototype.html 之后，容器与框架源文件之间
// 多了一条谁都看不见的约定——区标记在容器里、正文在别的文件里。这条约定断掉时页面照常
// 生成、命令照常退出 0，只是产出的原型缺一整块样式或整个批注框架。
//
// 本闸 MUST NOT 断言“装配结果等于某个历史字节”：那条等值只在外置落地的那一次成立，
// 固化成常驻闸之后，日后每改一次 anno.css 都会判红——而让改框架变容易正是外置的目的。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { composeTemplate, FRAMEWORK, FRAMEWORK_DIR, FRAMEWORK_PRE, FRAMEWORK_POST } from '../ai-dev-system/skills/ai-prd/scripts/preview.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const container = path.join(repoRoot, 'ai-dev-system/skills/ai-prd/assets/templates/ui-prototype.html')

function markRange(h, m) {
  const b = h.indexOf(`<!-- ${m}:BEGIN`); if (b < 0) return null
  const be = h.indexOf('-->', b);          if (be < 0) return null
  const e = h.indexOf(`<!-- ${m}:END`, be); if (e < 0) return null
  return { from: be + 3, to: e }
}

test('容器的六个固定区区间为空——正文只有一处，在框架源文件里', () => {
  const html = readFileSync(container, 'utf8')
  for (const it of FRAMEWORK) {
    const r = markRange(html, it.mark)
    assert.ok(r, `容器缺固定区标记：${it.mark}`)
    assert.equal(
      html.slice(r.from, r.to).trim(), '',
      `容器的 ${it.mark} 区间不为空。正文 MUST 只住在 ${it.file} 里；容器里再留一份会让装配后同一段内容出现两次，而页面照常打开。`,
    )
  }
})

test('装配表每项都对应一个存在且非空的框架源文件', () => {
  for (const it of FRAMEWORK) {
    const p = path.join(FRAMEWORK_DIR, it.file)
    assert.ok(existsSync(p), `装配表指向的框架源文件不存在：${it.mark} → ${p}`)
    assert.ok(readFileSync(p, 'utf8').trim().length > 0, `框架源文件是空的：${p}`)
  }
})

// 这条 MUST 断言“区间正文 === 对应源文件的内容”，MUST NOT 只验“非空 + 含 open/close”:
// 后者是同义反复——open/close 来自同一张装配表，把 anno.css 装进 THEME 区照样全绿，
// 而那正是这条闸唯一挡得住、别处又挡不住的错误（映射错位）。
test('装配结果每个区的正文逐字节等于它那份源文件', async () => {
  const html = await composeTemplate()
  for (const it of FRAMEWORK) {
    const r = markRange(html, it.mark)
    assert.ok(r, `装配结果缺固定区标记：${it.mark}`)
    const body = readFileSync(path.join(FRAMEWORK_DIR, it.file), 'utf8')
    assert.equal(
      html.slice(r.from, r.to),
      FRAMEWORK_PRE + it.open + body + it.close + FRAMEWORK_POST,
      `${it.mark} 区的装配结果与 ${it.file} 不一致——要么装配串错了，要么装配表把这个区指向了别的文件`,
    )
  }
})

test('缺框架源文件时 init 报错退出且不留残页', async () => {
  const { spawnSync } = await import('node:child_process')
  const { cpSync, mkdtempSync, rmSync, unlinkSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-missing-'))
  // 在临时副本中删文件，避免测试并发时短暂改名共享源码，干扰其他测试读装配表。
  const skillCopy = path.join(dir, 'ai-prd')
  cpSync(path.join(repoRoot, 'ai-dev-system/skills/ai-prd'), skillCopy, { recursive: true })
  const script = path.join(skillCopy, 'scripts/preview.mjs')
  const victim = path.join(skillCopy, 'assets/templates/ui-prototype-framework', FRAMEWORK[0].file)
  const target = path.join(dir, 'p.html')

  unlinkSync(victim)
  try {
    const r = spawnSync(process.execPath, [script, 'init', target, '--title', '缺文件'], { encoding: 'utf8' })
    const out = (r.stdout || '') + (r.stderr || '')
    assert.equal(r.status, 2, `缺框架源文件时 init 必须以退出码 2 终止，实际 ${r.status}：${out}`)
    assert.ok(out.includes(FRAMEWORK[0].mark), '错误文案必须指出是哪个区')
    assert.ok(out.includes(FRAMEWORK[0].file), '错误文案必须给出源文件路径')
    assert.ok(!existsSync(target), 'init 失败时 MUST NOT 留下一个缺样式的残页')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('icons.svg 不得含 xmlns——它是 sprite 片段，不是独立 SVG 文档', () => {
  const svg = readFileSync(path.join(FRAMEWORK_DIR, 'icons.svg'), 'utf8')
  assert.doesNotMatch(svg, /xmlns/, 'xmlns 会带进 http:// 串，当场挂掉容器的零外链自检')
})
