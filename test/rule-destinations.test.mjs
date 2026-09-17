// 规范去向清单闸：分支起点里每个含规范词的小节，要么仍在原处，要么在去向清单里有交代。
// 契约：docs/spec/2026-09-17-dw-system-安装器迁移与ctx体检与机器闸-eng-spec.md §4.5（FR-017）。
//
// 粒度是小节，不是句子：小节内部压缩时每条命题是否保住，由代码评审门的 skill 原则轴按
// `dw-prose` 的完整命题规则判；本闸只保证"没有一个含规范词的小节无声消失"。
//
// 去向清单：`docs/report/*规范去向清单.md` 里表头为 `| 原位置 | 去向 | 说明 |` 的表。
//   原位置  `<路径> § <标题>`（一个小节） | `<路径>`（整份文件） | `<前缀>/**`（整棵子树）
//   去向    `<路径> § <标题>` | `<路径>` | `<前缀>/**` | `并入 <路径> § <标题>` | `删除`（说明列 MUST 非空）
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SKILL_TREES = [/^ai-dev-system\/skills\/.+\.md$/, /^dw-system\/skills\/.+\.md$/, /^CLAUDE\.md$/]
const NORMATIVE = /\b(MUST|SHOULD)\b/

const git = args =>
  execFileSync('git', ['-c', 'core.quotepath=false', ...args], {
    cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  })

/** 按 `##` / `###` 切小节（跳过代码围栏），返回 [{heading, body}]。 */
export function sectionsOf(raw) {
  const out = []
  let current = null
  let fenced = false
  for (const line of raw.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) fenced = !fenced
    const m = !fenced && /^(#{2,3})\s+(.+?)\s*$/.exec(line)
    if (m) {
      current = { heading: m[2].trim(), body: '' }
      out.push(current)
    } else if (current) {
      current.body += line + '\n'
    }
  }
  return out
}

/** 清单单元格整格包在反引号里，解析时去掉了；标题自带的反引号同样去掉再比。 */
const plain = heading => heading.replace(/`/g, '')

const normativeCount = raw => (raw.match(/\bMUST\b|\bSHOULD\b/g) || []).length

/** 解析去向清单里的全部表行。 */
export function parseLedger(raw) {
  const rows = []
  let inTable = false
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim().startsWith('|')) { inTable = false; continue }
    const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim())
    if (cells[0] === '原位置' && cells[1] === '去向') { inTable = true; continue }
    if (!inTable || /^-+$/.test(cells[0].replace(/[:\s]/g, ''))) continue
    rows.push({ from: cells[0].replace(/`/g, ''), to: (cells[1] || '').replace(/`/g, ''), note: cells[2] || '' })
  }
  return rows
}

const splitSpec = spec => {
  const i = spec.indexOf(' § ')
  return i < 0 ? { file: spec.trim(), heading: null } : { file: spec.slice(0, i).trim(), heading: spec.slice(i + 3).trim() }
}

/**
 * @param baseSections Array<{file, heading}> 起点里含规范词的小节
 * @param hasHeading (file, heading) => boolean，判当前工作区里某文件是否有某标题
 * @param fileExists (file) => boolean
 */
export function unresolved(baseSections, ledger, hasHeading, fileExists) {
  const failures = []
  const exact = new Map()
  const fileRows = new Map()
  const prefixRows = []
  for (const row of ledger) {
    if (row.from.endsWith('/**')) prefixRows.push(row)
    else if (row.from.includes(' § ')) exact.set(row.from, row)
    else fileRows.set(row.from, row)
  }
  const checkDest = (label, row, heading) => {
    const to = row.to.replace(/^并入\s*/, '')
    if (row.to === '删除') {
      if (!row.note) failures.push(`${label}：去向写「删除」但说明列为空`)
      return
    }
    const dest = splitSpec(to)
    if (!fileExists(dest.file)) { failures.push(`${label}：去向文件不存在 → ${dest.file}`); return }
    const wanted = dest.heading ?? (row.to.startsWith('并入') ? null : heading)
    if (wanted && !hasHeading(dest.file, wanted)) failures.push(`${label}：去向里找不到标题 → ${dest.file} § ${wanted}`)
  }
  for (const s of baseSections) {
    const label = `${s.file} § ${s.heading}`
    const key = label.replace(/`/g, '') // 清单单元格用反引号包住整格，解析时已去掉；标题自带的反引号同样去掉再比
    if (exact.has(key)) { checkDest(label, exact.get(key), s.heading); continue }
    if (fileRows.has(s.file)) { checkDest(label, fileRows.get(s.file), s.heading); continue }
    const prefix = prefixRows.find(r => s.file.startsWith(r.from.slice(0, -2)))
    const mapped = prefix ? prefix.to.slice(0, -2) + s.file.slice(prefix.from.length - 2) : s.file
    if (fileExists(mapped) && hasHeading(mapped, s.heading)) continue
    failures.push(`${label}：小节已不在原处（${mapped}），去向清单里没有交代`)
  }
  return failures
}

function baseRef() {
  for (const ref of ['main', 'origin/main']) {
    try { return git(['merge-base', 'HEAD', ref]).trim() } catch { /* 该 ref 不存在，试下一个 */ }
  }
  return null
}

test('分支起点里每个含规范词的小节都有去处', () => {
  const base = baseRef()
  if (!base) {
    console.log('# 本闸未生效：取不到分支起点（main / origin/main 都不存在）')
    return
  }
  const baseFiles = git(['ls-tree', '-r', '--name-only', base]).split('\n').filter(f => SKILL_TREES.some(re => re.test(f)))
  const baseSections = []
  const counts = []
  for (const file of baseFiles) {
    const raw = git(['show', `${base}:${file}`])
    counts.push({ file, base: normativeCount(raw) })
    for (const s of sectionsOf(raw)) if (NORMATIVE.test(s.body)) baseSections.push({ file, heading: s.heading })
  }
  const reportDir = path.join(repoRoot, 'docs', 'report')
  const ledger = fs.existsSync(reportDir)
    ? fs.readdirSync(reportDir).filter(f => f.endsWith('规范去向清单.md'))
        .flatMap(f => parseLedger(fs.readFileSync(path.join(reportDir, f), 'utf8')))
    : []
  const cache = new Map()
  const headingsOf = file => {
    if (!cache.has(file)) {
      const abs = path.join(repoRoot, file)
      cache.set(file, fs.existsSync(abs) ? new Set(sectionsOf(fs.readFileSync(abs, 'utf8')).map(s => plain(s.heading))) : null)
    }
    return cache.get(file)
  }
  const failures = unresolved(
    baseSections, ledger,
    (file, heading) => headingsOf(file)?.has(plain(heading)) ?? false,
    file => headingsOf(file) !== null,
  )
  console.log(`# 起点含规范词的小节 ${baseSections.length} 个；去向清单 ${ledger.length} 行`)
  // 规范词条数的增减：只作信息、不判红（条数少了不等于规则丢了，丢没丢由上面的小节去向判）。
  const headFiles = git(['ls-files']).split('\n').filter(f => SKILL_TREES.some(re => re.test(f)))
  const headCount = new Map(headFiles.map(f => [f, normativeCount(fs.readFileSync(path.join(repoRoot, f), 'utf8'))]))
  const sum = list => list.reduce((n, x) => n + x, 0)
  console.log(`# 规范词条数：起点 ${sum(counts.map(c => c.base))} → 现在 ${sum([...headCount.values()])}`)
  for (const { file, base: before } of counts) {
    const now = headCount.get(file)
    if (now !== undefined && now !== before) console.log(`#   ${file}: ${before} → ${now}`)
  }
  assert.deepEqual(failures, [], `\n${failures.join('\n')}\n每个消失的小节 MUST 在 docs/report/*规范去向清单.md 里写明：搬到哪 / 并进哪 / 删除及理由。`)
})

test('自检：删了含规范词的小节且清单无交代 → 判红；有交代且去向存在 → 通过', () => {
  const base = [{ file: 'a/x.md', heading: '门禁' }]
  const none = () => false
  assert.equal(unresolved(base, [], none, none).length, 1)
  const ledger = [{ from: 'a/x.md § 门禁', to: 'b/y.md § 门禁细则', note: '' }]
  assert.deepEqual(unresolved(base, ledger, (f, h) => f === 'b/y.md' && h === '门禁细则', f => f === 'b/y.md'), [])
})

test('自检：去向指向不存在的位置、「删除」缺理由 → 判红', () => {
  const base = [{ file: 'a/x.md', heading: '门禁' }]
  const gone = unresolved(base, [{ from: 'a/x.md § 门禁', to: 'b/y.md § 门禁', note: '' }], () => false, () => false)
  assert.match(gone[0], /去向文件不存在/)
  const noReason = unresolved(base, [{ from: 'a/x.md § 门禁', to: '删除', note: '' }], () => false, () => false)
  assert.match(noReason[0], /说明列为空/)
  assert.deepEqual(unresolved(base, [{ from: 'a/x.md § 门禁', to: '删除', note: '副本已取消' }], () => false, () => false), [])
})

test('自检：整份文件行与子树前缀行都按原标题核对', () => {
  const base = [{ file: 'old/s/a.md', heading: '一' }, { file: 'old/s/b.md', heading: '二' }]
  const has = (f, h) => (f === 'new/s/a.md' && h === '一') || (f === 'z/b2.md' && h === '二')
  const exists = f => f === 'new/s/a.md' || f === 'z/b2.md'
  const ledger = [{ from: 'old/**', to: 'new/**', note: '机械更名' }, { from: 'old/s/b.md', to: 'z/b2.md', note: '' }]
  assert.deepEqual(unresolved(base, ledger, has, exists), [])
  assert.equal(unresolved(base, [ledger[0]], has, exists).length, 1)
})

test('自检：清单解析只认表头为「原位置 | 去向 | 说明」的表', () => {
  const rows = parseLedger('| 原位置 | 去向 | 说明 |\n|---|---|---|\n| `a.md § 甲` | 删除 | 副本 |\n\n| 别的 | 表 |\n|---|---|\n| x | y |\n')
  assert.deepEqual(rows, [{ from: 'a.md § 甲', to: '删除', note: '副本' }])
})
